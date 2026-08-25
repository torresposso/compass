import { describe, expect, it } from "bun:test";
import { Cause, DateTime, Effect, Exit, Option, Schema } from "effect";
import { GeoLocation, Latitude, Longitude } from "../src/core/Astronomy.js";
import {
  Profile,
  ProfileAlreadyExistsError,
  ProfileNotFoundError,
  ProfileSlug,
  ProfileStore,
} from "../src/core/ProfileStore.js";

const sampleProfile = new Profile({
  slug: Schema.decodeUnknownSync(ProfileSlug)("carl-jung"),
  name: "Carl Gustav Jung",
  whenUtc: Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)("1875-07-26T19:32:00Z"),
  location: new GeoLocation({
    latitude: Schema.decodeUnknownSync(Latitude)(47.5596),
    longitude: Schema.decodeUnknownSync(Longitude)(7.5886),
  }),
});

const sampleProfile2 = new Profile({
  slug: Schema.decodeUnknownSync(ProfileSlug)("alan-leo"),
  name: "Alan Leo",
  whenUtc: Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)("1860-08-07T05:49:00Z"),
  location: new GeoLocation({
    latitude: Schema.decodeUnknownSync(Latitude)(51.5074),
    longitude: Schema.decodeUnknownSync(Longitude)(-0.1278),
  }),
});

describe("ProfileStore Service (TDD)", () => {
  it("creates and retrieves a profile in memory / test layer", async () => {
    const program = Effect.gen(function* () {
      const store = yield* ProfileStore;
      yield* store.create(sampleProfile);
      return yield* store.get(sampleProfile.slug);
    }).pipe(Effect.provide(ProfileStore.memoryLayer));

    const result = await Effect.runPromise(program);
    expect(result.slug).toBe(sampleProfile.slug);
    expect(result.name).toBe("Carl Gustav Jung");
    expect(DateTime.formatIso(result.whenUtc)).toBe("1875-07-26T19:32:00.000Z");
    expect(result.location.latitude as number).toBe(47.5596);
  });

  it("fails with ProfileNotFoundError when getting a non-existent slug", async () => {
    const missingSlug = Schema.decodeUnknownSync(ProfileSlug)("non-existent");
    const program = Effect.gen(function* () {
      const store = yield* ProfileStore;
      return yield* store.get(missingSlug);
    }).pipe(Effect.provide(ProfileStore.memoryLayer));

    const exit = await Effect.runPromiseExit(program);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(ProfileNotFoundError);
        expect((failure.value as ProfileNotFoundError).name).toBe("non-existent");
      }
    }
  });

  it("fails with ProfileAlreadyExistsError when creating duplicate slug", async () => {
    const program = Effect.gen(function* () {
      const store = yield* ProfileStore;
      yield* store.create(sampleProfile);
      yield* store.create(sampleProfile);
    }).pipe(Effect.provide(ProfileStore.memoryLayer));

    const exit = await Effect.runPromiseExit(program);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(ProfileAlreadyExistsError);
        expect((failure.value as ProfileAlreadyExistsError).name).toBe(sampleProfile.slug);
      }
    }
  });

  it("lists all stored profiles", async () => {
    const program = Effect.gen(function* () {
      const store = yield* ProfileStore;
      yield* store.create(sampleProfile);
      yield* store.create(sampleProfile2);
      return yield* store.list();
    }).pipe(Effect.provide(ProfileStore.memoryLayer));

    const list = await Effect.runPromise(program);
    expect(list.length).toBe(2);
    const slugs = list.map((p) => p.slug as string);
    expect(slugs).toContain("carl-jung");
    expect(slugs).toContain("alan-leo");
  });

  it("updates an existing profile", async () => {
    const updated = new Profile({
      ...sampleProfile,
      name: "C. G. Jung (Updated)",
    });

    const program = Effect.gen(function* () {
      const store = yield* ProfileStore;
      yield* store.create(sampleProfile);
      yield* store.update(updated);
      return yield* store.get(sampleProfile.slug);
    }).pipe(Effect.provide(ProfileStore.memoryLayer));

    const result = await Effect.runPromise(program);
    expect(result.name).toBe("C. G. Jung (Updated)");
  });

  it("deletes a profile and confirms removal", async () => {
    const program = Effect.gen(function* () {
      const store = yield* ProfileStore;
      yield* store.create(sampleProfile);
      yield* store.delete(sampleProfile.slug);
      const exists = yield* store.exists(sampleProfile.slug);
      return exists;
    }).pipe(Effect.provide(ProfileStore.memoryLayer));

    const exists = await Effect.runPromise(program);
    expect(exists).toBe(false);
  });

  it("persists and reads profiles from filesystem JSON layer", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    const tmpDir = path.join(os.tmpdir(), `compass-test-${Date.now()}`);

    try {
      const fsLayer = ProfileStore.fileSystemLayer(tmpDir);

      const writeAndRead = Effect.gen(function* () {
        const store = yield* ProfileStore;
        yield* store.create(sampleProfile);
        yield* store.create(sampleProfile2);
        const listed = yield* store.list();
        const fetched = yield* store.get(sampleProfile.slug);
        return { listed, fetched };
      }).pipe(Effect.provide(fsLayer));

      const { listed, fetched } = await Effect.runPromise(writeAndRead);
      expect(listed.length).toBe(2);
      expect(fetched.slug).toBe(sampleProfile.slug);
      expect(fetched.name).toBe("Carl Gustav Jung");

      // Verify file existence on disk as JSON
      const filePath = path.join(tmpDir, `${sampleProfile.slug}.json`);
      const fileContent = JSON.parse(await fs.readFile(filePath, "utf-8"));
      expect(fileContent.name).toBe("Carl Gustav Jung");
      expect(fileContent.whenUtc).toBe("1875-07-26T19:32:00.000Z");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
