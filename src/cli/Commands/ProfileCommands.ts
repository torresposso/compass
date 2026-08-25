import { DateTime, Effect, type Layer, Schema } from "effect";
import { GeoLocation, Latitude, Longitude } from "../../core/Astronomy.js";
import { Profile, ProfileSlug, ProfileStore } from "../../core/ProfileStore.js";
import { makeCommand } from "../Command.js";
import { ProfileSlugInput, resolveSlug } from "./shared.js";

// Schemas for Profile CLI operations
export const ProfileAddInput = Schema.Struct({
  slug: ProfileSlug,
  name: Schema.String,
  whenUtc: Schema.DateTimeUtcFromString,
  latitude: Latitude,
  longitude: Longitude,
});

export { ProfileSlugInput };

export const handleProfileAdd = Effect.fn("handleProfileAdd")(function* (
  input: typeof ProfileAddInput.Type,
) {
  const store = yield* ProfileStore;
  const profile = new Profile({
    slug: input.slug,
    name: input.name,
    whenUtc: input.whenUtc,
    location: new GeoLocation({
      latitude: input.latitude,
      longitude: input.longitude,
    }),
  });

  const created = yield* store.create(profile);
  return {
    status: "created",
    profile: {
      slug: created.slug,
      name: created.name,
      whenUtc: DateTime.formatIso(created.whenUtc),
      location: {
        latitude: created.location.latitude,
        longitude: created.location.longitude,
      },
    },
  };
});

export const handleProfileList = Effect.fn("handleProfileList")(function* () {
  const store = yield* ProfileStore;
  const profiles = yield* store.list();
  return {
    count: profiles.length,
    profiles: profiles.map((p) => ({
      slug: p.slug,
      name: p.name,
      whenUtc: DateTime.formatIso(p.whenUtc),
      location: {
        latitude: p.location.latitude,
        longitude: p.location.longitude,
      },
    })),
  };
});

export const handleProfileGet = Effect.fn("handleProfileGet")(function* (
  input: typeof ProfileSlugInput.Type,
) {
  const slug = yield* resolveSlug(input);
  const store = yield* ProfileStore;
  const profile = yield* store.get(slug);
  return {
    slug: profile.slug,
    name: profile.name,
    whenUtc: DateTime.formatIso(profile.whenUtc),
    location: {
      latitude: profile.location.latitude,
      longitude: profile.location.longitude,
    },
  };
});

export const handleProfileDelete = Effect.fn("handleProfileDelete")(function* (
  input: typeof ProfileSlugInput.Type,
) {
  const slug = yield* resolveSlug(input);
  const store = yield* ProfileStore;
  yield* store.delete(slug);
  return {
    status: "deleted",
    slug,
  };
});

export const makeProfileAddCommand = (layer: Layer.Layer<ProfileStore, unknown, never>) =>
  makeCommand(ProfileAddInput, handleProfileAdd, layer);

export const makeProfileListCommand = (layer: Layer.Layer<ProfileStore, unknown, never>) =>
  makeCommand(Schema.Struct({}), handleProfileList, layer);

export const makeProfileGetCommand = (layer: Layer.Layer<ProfileStore, unknown, never>) =>
  makeCommand(ProfileSlugInput, handleProfileGet, layer);

export const makeProfileDeleteCommand = (layer: Layer.Layer<ProfileStore, unknown, never>) =>
  makeCommand(ProfileSlugInput, handleProfileDelete, layer);
