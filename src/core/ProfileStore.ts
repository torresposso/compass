import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Context, Effect, Layer, Ref, Schema } from "effect";
import { DatabaseError, ProfileAlreadyExistsError, ProfileNotFoundError } from "./Errors.js";
import { Profile, type ProfileSlug } from "./Schema.js";

export interface ProfileStoreService {
  readonly create: (
    profile: Profile,
  ) => Effect.Effect<Profile, ProfileAlreadyExistsError | DatabaseError>;
  readonly get: (slug: ProfileSlug) => Effect.Effect<Profile, ProfileNotFoundError | DatabaseError>;
  readonly list: () => Effect.Effect<readonly Profile[], DatabaseError>;
  readonly update: (
    profile: Profile,
  ) => Effect.Effect<Profile, ProfileNotFoundError | DatabaseError>;
  readonly delete: (slug: ProfileSlug) => Effect.Effect<void, ProfileNotFoundError | DatabaseError>;
  readonly exists: (slug: ProfileSlug) => Effect.Effect<boolean, DatabaseError>;
}

export class ProfileStore extends Context.Service<ProfileStore, ProfileStoreService>()(
  "compass/core/ProfileStore",
) {
  /**
   * In-memory implementation layer for unit testing and ephemeral operations.
   */
  static readonly memoryLayer = Layer.effect(
    ProfileStore,
    Effect.gen(function* () {
      const storage = yield* Ref.make<Map<string, Profile>>(new Map());

      return ProfileStore.of({
        create: (profile) =>
          Effect.gen(function* () {
            const key = profile.slug as string;
            const map = yield* Ref.get(storage);
            if (map.has(key)) {
              return yield* Effect.fail(
                new ProfileAlreadyExistsError({
                  name: key,
                  message: `Profile with slug '${key}' already exists`,
                }),
              );
            }
            const next = new Map(map);
            next.set(key, profile);
            yield* Ref.set(storage, next);
            return profile;
          }),

        get: (slug) =>
          Effect.gen(function* () {
            const map = yield* Ref.get(storage);
            const key = slug as string;
            const found = map.get(key);
            if (!found) {
              return yield* Effect.fail(
                new ProfileNotFoundError({
                  name: key,
                  message: `Profile '${key}' was not found`,
                }),
              );
            }
            return found;
          }),

        list: () =>
          Ref.get(storage).pipe(
            Effect.map((map) => Array.from(map.values()) as readonly Profile[]),
          ),

        update: (profile) =>
          Effect.gen(function* () {
            const key = profile.slug as string;
            const map = yield* Ref.get(storage);
            if (!map.has(key)) {
              return yield* Effect.fail(
                new ProfileNotFoundError({
                  name: key,
                  message: `Cannot update profile '${key}': not found`,
                }),
              );
            }
            const next = new Map(map);
            next.set(key, profile);
            yield* Ref.set(storage, next);
            return profile;
          }),

        delete: (slug) =>
          Effect.gen(function* () {
            const key = slug as string;
            const map = yield* Ref.get(storage);
            if (!map.has(key)) {
              return yield* Effect.fail(
                new ProfileNotFoundError({
                  name: key,
                  message: `Cannot delete profile '${key}': not found`,
                }),
              );
            }
            const next = new Map(map);
            next.delete(key);
            yield* Ref.set(storage, next);
          }),

        exists: (slug) => Ref.get(storage).pipe(Effect.map((map) => map.has(slug as string))),
      });
    }),
  );

  /**
   * Filesystem-based layer storing profiles in individual JSON files under a directory.
   */
  static fileSystemLayer(baseDir?: string) {
    return Layer.succeed(ProfileStore, ProfileStore.of(createFileSystemStore(baseDir)));
  }
}

/**
 * Helper to determine default base directory according to XDG conventions.
 */
function resolveDefaultDataDir(): string {
  if (process.env.COMPASS_DATA_DIR) {
    return process.env.COMPASS_DATA_DIR;
  }
  const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(xdgData, "compass", "profiles");
}

function createFileSystemStore(customDir?: string): ProfileStoreService {
  const rootDir = customDir ?? resolveDefaultDataDir();
  const filePathForSlug = (slug: string) => path.join(rootDir, `${slug}.json`);

  const ensureDir = Effect.tryPromise({
    try: () => fs.mkdir(rootDir, { recursive: true }),
    catch: (cause) =>
      new DatabaseError({
        operation: "mkdir",
        message: `Failed to create profiles directory: ${rootDir}`,
        cause,
      }),
  });

  return {
    create: (profile) =>
      Effect.gen(function* () {
        yield* ensureDir;
        const filePath = filePathForSlug(profile.slug as string);

        const exists = yield* Effect.tryPromise({
          try: async () => {
            try {
              await fs.access(filePath);
              return true;
            } catch {
              return false;
            }
          },
          catch: (cause) =>
            new DatabaseError({
              operation: "access",
              message: `Error checking existence of ${filePath}`,
              cause,
            }),
        });

        if (exists) {
          return yield* Effect.fail(
            new ProfileAlreadyExistsError({
              name: profile.slug as string,
              message: `Profile '${profile.slug}' already exists at ${filePath}`,
            }),
          );
        }

        const encoded = Schema.encodeSync(Profile)(profile);
        const json = JSON.stringify(encoded, null, 2);

        yield* Effect.tryPromise({
          try: () => fs.writeFile(filePath, json, "utf-8"),
          catch: (cause) =>
            new DatabaseError({
              operation: "writeFile",
              message: `Failed to save profile to ${filePath}`,
              cause,
            }),
        });

        return profile;
      }),

    get: (slug) =>
      Effect.gen(function* () {
        const filePath = filePathForSlug(slug as string);
        const exists = yield* Effect.tryPromise({
          try: async () => {
            try {
              await fs.access(filePath);
              return true;
            } catch {
              return false;
            }
          },
          catch: (cause) =>
            new DatabaseError({
              operation: "access",
              message: `Error checking file ${filePath}`,
              cause,
            }),
        });

        if (!exists) {
          return yield* Effect.fail(
            new ProfileNotFoundError({
              name: slug as string,
              message: `Profile '${slug}' not found at ${filePath}`,
            }),
          );
        }

        const raw = yield* Effect.tryPromise({
          try: () => fs.readFile(filePath, "utf-8"),
          catch: (cause) =>
            new DatabaseError({
              operation: "readFile",
              message: `Failed reading ${filePath}`,
              cause,
            }),
        });

        const parsedJson = yield* Effect.try({
          try: () => JSON.parse(raw),
          catch: (cause) =>
            new DatabaseError({
              operation: "JSON.parse",
              message: `Invalid JSON in profile file ${filePath}`,
              cause,
            }),
        });

        const profile = yield* Schema.decodeUnknownEffect(Profile)(parsedJson).pipe(
          Effect.mapError(
            (issue) =>
              new DatabaseError({
                operation: "Schema.decode",
                message: `Failed decoding profile schema from ${filePath}: ${issue}`,
                cause: issue,
              }),
          ),
        );

        return profile;
      }),

    list: () =>
      Effect.gen(function* () {
        yield* ensureDir;
        const fileNames = yield* Effect.tryPromise({
          try: async () => {
            try {
              return await fs.readdir(rootDir);
            } catch {
              return [];
            }
          },
          catch: (cause) =>
            new DatabaseError({
              operation: "readdir",
              message: `Failed to read profiles directory ${rootDir}`,
              cause,
            }),
        });

        const jsonFiles = fileNames.filter((f) => f.endsWith(".json"));
        const profiles: Profile[] = [];

        for (const fileName of jsonFiles) {
          const filePath = path.join(rootDir, fileName);
          const raw = yield* Effect.tryPromise({
            try: () => fs.readFile(filePath, "utf-8"),
            catch: (cause) =>
              new DatabaseError({
                operation: "readFile",
                message: `Failed reading ${filePath}`,
                cause,
              }),
          });

          const parsedJson = yield* Effect.try({
            try: () => JSON.parse(raw),
            catch: (cause) =>
              new DatabaseError({
                operation: "JSON.parse",
                message: `Invalid JSON in ${filePath}`,
                cause,
              }),
          });

          const profile = yield* Schema.decodeUnknownEffect(Profile)(parsedJson).pipe(
            Effect.mapError(
              (issue) =>
                new DatabaseError({
                  operation: "Schema.decode",
                  message: `Failed decoding profile ${filePath}: ${issue}`,
                  cause: issue,
                }),
            ),
          );
          profiles.push(profile);
        }

        return profiles;
      }),

    update: (profile) =>
      Effect.gen(function* () {
        yield* ensureDir;
        const filePath = filePathForSlug(profile.slug as string);

        const exists = yield* Effect.tryPromise({
          try: async () => {
            try {
              await fs.access(filePath);
              return true;
            } catch {
              return false;
            }
          },
          catch: (cause) =>
            new DatabaseError({
              operation: "access",
              message: `Error checking existence of ${filePath}`,
              cause,
            }),
        });

        if (!exists) {
          return yield* Effect.fail(
            new ProfileNotFoundError({
              name: profile.slug as string,
              message: `Cannot update profile '${profile.slug}': does not exist at ${filePath}`,
            }),
          );
        }

        const encoded = Schema.encodeSync(Profile)(profile);
        const json = JSON.stringify(encoded, null, 2);

        yield* Effect.tryPromise({
          try: () => fs.writeFile(filePath, json, "utf-8"),
          catch: (cause) =>
            new DatabaseError({
              operation: "writeFile",
              message: `Failed to overwrite profile at ${filePath}`,
              cause,
            }),
        });

        return profile;
      }),

    delete: (slug) =>
      Effect.gen(function* () {
        const filePath = filePathForSlug(slug as string);
        const exists = yield* Effect.tryPromise({
          try: async () => {
            try {
              await fs.access(filePath);
              return true;
            } catch {
              return false;
            }
          },
          catch: (cause) =>
            new DatabaseError({
              operation: "access",
              message: `Error checking file ${filePath}`,
              cause,
            }),
        });

        if (!exists) {
          return yield* Effect.fail(
            new ProfileNotFoundError({
              name: slug as string,
              message: `Cannot delete profile '${slug}': file not found`,
            }),
          );
        }

        yield* Effect.tryPromise({
          try: () => fs.unlink(filePath),
          catch: (cause) =>
            new DatabaseError({
              operation: "unlink",
              message: `Failed removing file ${filePath}`,
              cause,
            }),
        });
      }),

    exists: (slug) =>
      Effect.tryPromise({
        try: async () => {
          try {
            await fs.access(filePathForSlug(slug as string));
            return true;
          } catch {
            return false;
          }
        },
        catch: (cause) =>
          new DatabaseError({
            operation: "access",
            message: `Error checking exists for ${slug}`,
            cause,
          }),
      }),
  };
}
