import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Context, Effect, Layer, Ref, Schema } from "effect";
import { GeoLocation } from "./Astronomy.js";

/**
 * Validated profile slug (lowercase alphanumeric with hyphens).
 */
export const ProfileSlug = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  Schema.brand("ProfileSlug"),
);
export type ProfileSlug = typeof ProfileSlug.Type;

/**
 * Persisted Soul / Individual birth record.
 */
export class Profile extends Schema.Class<Profile>("compass/core/Profile")({
  slug: ProfileSlug,
  name: Schema.String,
  whenUtc: Schema.DateTimeUtcFromString,
  location: GeoLocation,
}) {}
export type ProfileType = typeof Profile.Type;

/**
 * Raised when a profile identifier or slug is not found in the persistence store.
 */
export class ProfileNotFoundError extends Schema.TaggedError<ProfileNotFoundError>()(
  "ProfileNotFoundError",
  {
    name: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Raised when attempting to create a profile with a name/slug that already exists.
 */
export class ProfileAlreadyExistsError extends Schema.TaggedError<ProfileAlreadyExistsError>()(
  "ProfileAlreadyExistsError",
  {
    name: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Raised when a persistence or filesystem operation fails.
 */
export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  message: Schema.String,
  operation: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

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

// Single-step JSON string <-> Profile Schema pipeline
const ProfileFromJsonString = Schema.fromJsonString(Profile);
const decodeProfileString = Schema.decodeUnknownEffect(ProfileFromJsonString);
const encodeProfileString = Schema.encodeEffect(ProfileFromJsonString);

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
            const key = profile.slug;
            const map = yield* Ref.get(storage);
            if (map.has(key)) {
              return yield* new ProfileAlreadyExistsError({
                name: key,
                message: `Profile with slug '${key}' already exists`,
              });
            }
            const next = new Map(map);
            next.set(key, profile);
            yield* Ref.set(storage, next);
            return profile;
          }),

        get: (slug) =>
          Effect.gen(function* () {
            const map = yield* Ref.get(storage);
            const key = slug;
            const found = map.get(key);
            if (!found) {
              return yield* new ProfileNotFoundError({
                name: key,
                message: `Profile '${key}' was not found`,
              });
            }
            return found;
          }),

        list: () =>
          Ref.get(storage).pipe(
            Effect.map((map) => Array.from(map.values()) as readonly Profile[]),
          ),

        update: (profile) =>
          Effect.gen(function* () {
            const key = profile.slug;
            const map = yield* Ref.get(storage);
            if (!map.has(key)) {
              return yield* new ProfileNotFoundError({
                name: key,
                message: `Cannot update profile '${key}': not found`,
              });
            }
            const next = new Map(map);
            next.set(key, profile);
            yield* Ref.set(storage, next);
            return profile;
          }),

        delete: (slug) =>
          Effect.gen(function* () {
            const key = slug;
            const map = yield* Ref.get(storage);
            if (!map.has(key)) {
              return yield* new ProfileNotFoundError({
                name: key,
                message: `Cannot delete profile '${key}': not found`,
              });
            }
            const next = new Map(map);
            next.delete(key);
            yield* Ref.set(storage, next);
          }),

        exists: (slug) => Ref.get(storage).pipe(Effect.map((map) => map.has(slug))),
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

function isNodeErrorWithCode(cause: unknown, code: string): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code: unknown }).code === code
  );
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
        const filePath = filePathForSlug(profile.slug);
        const encodedJson = yield* encodeProfileString(profile).pipe(
          Effect.mapError(
            (issue) =>
              new DatabaseError({
                operation: "Schema.encode",
                message: `Failed encoding profile '${profile.slug}': ${issue}`,
                cause: issue,
              }),
          ),
        );

        // Atomic write with 'wx' flag (fails if file already exists)
        yield* Effect.tryPromise({
          try: () => fs.writeFile(filePath, `${encodedJson}\n`, { flag: "wx", encoding: "utf-8" }),
          catch: (cause) => {
            if (isNodeErrorWithCode(cause, "EEXIST")) {
              return new ProfileAlreadyExistsError({
                name: profile.slug,
                message: `Profile '${profile.slug}' already exists at ${filePath}`,
              });
            }
            return new DatabaseError({
              operation: "writeFile",
              message: `Failed to create profile file: ${filePath}`,
              cause,
            });
          },
        });

        return profile;
      }),

    get: (slug) =>
      Effect.gen(function* () {
        const filePath = filePathForSlug(slug);
        const content = yield* Effect.tryPromise({
          try: () => fs.readFile(filePath, "utf-8"),
          catch: (cause) => {
            if (isNodeErrorWithCode(cause, "ENOENT")) {
              return new ProfileNotFoundError({
                name: slug,
                message: `Profile '${slug}' not found at ${filePath}`,
              });
            }
            return new DatabaseError({
              operation: "readFile",
              message: `Failed reading profile ${filePath}`,
              cause,
            });
          },
        });

        return yield* decodeProfileString(content).pipe(
          Effect.mapError(
            (issue) =>
              new DatabaseError({
                operation: "Schema.decode",
                message: `Failed decoding profile from ${filePath}: ${issue}`,
                cause: issue,
              }),
          ),
        );
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

          const profile = yield* decodeProfileString(raw).pipe(
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
        const filePath = filePathForSlug(profile.slug);
        const encodedJson = yield* encodeProfileString(profile).pipe(
          Effect.mapError(
            (issue) =>
              new DatabaseError({
                operation: "Schema.encode",
                message: `Failed encoding profile '${profile.slug}': ${issue}`,
                cause: issue,
              }),
          ),
        );

        yield* Effect.tryPromise({
          try: async () => {
            await fs.access(filePath);
            await fs.writeFile(filePath, `${encodedJson}\n`, "utf-8");
          },
          catch: (cause) => {
            if (isNodeErrorWithCode(cause, "ENOENT")) {
              return new ProfileNotFoundError({
                name: profile.slug,
                message: `Cannot update profile '${profile.slug}': does not exist at ${filePath}`,
              });
            }
            return new DatabaseError({
              operation: "writeFile",
              message: `Failed updating profile at ${filePath}`,
              cause,
            });
          },
        });

        return profile;
      }),

    delete: (slug) =>
      Effect.gen(function* () {
        const filePath = filePathForSlug(slug);
        yield* Effect.tryPromise({
          try: () => fs.unlink(filePath),
          catch: (cause) => {
            if (isNodeErrorWithCode(cause, "ENOENT")) {
              return new ProfileNotFoundError({
                name: slug,
                message: `Cannot delete profile '${slug}': file not found`,
              });
            }
            return new DatabaseError({
              operation: "unlink",
              message: `Failed removing file ${filePath}`,
              cause,
            });
          },
        });
      }),

    exists: (slug) =>
      Effect.tryPromise({
        try: async () => {
          try {
            await fs.access(filePathForSlug(slug));
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
