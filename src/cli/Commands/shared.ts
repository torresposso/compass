import { Effect, Schema } from "effect";
import { ProfileSlug } from "../../core/ProfileStore.js";

export function resolveSlug(input: {
  slug?: string;
  _?: readonly string[];
}): Effect.Effect<ProfileSlug, Schema.SchemaError> {
  const rawSlug = input.slug ?? input._?.[0];
  return Schema.decodeUnknownEffect(ProfileSlug)(rawSlug);
}

export function resolveTwoSlugs(input: {
  slugA?: string;
  slugB?: string;
  _?: readonly string[];
}): Effect.Effect<[ProfileSlug, ProfileSlug], Schema.SchemaError> {
  const rawA = input.slugA ?? input._?.[0];
  const rawB = input.slugB ?? input._?.[1];
  return Effect.all([
    Schema.decodeUnknownEffect(ProfileSlug)(rawA),
    Schema.decodeUnknownEffect(ProfileSlug)(rawB),
  ]);
}
