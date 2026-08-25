import { DateTime, Effect, type Layer, Schema } from "effect";
import type { NatalService } from "../../../charts/natal/NatalService.js";
import { TransitsService } from "../../../charts/transits/TransitsService.js";
import { ProfileSlug, type ProfileStore } from "../../../core/ProfileStore.js";
import { makeCommand } from "../../Command.js";
import { natalFromProfile, resolveSlug } from "./shared.js";

export const ChartTransitsInput = Schema.Struct({
  slug: Schema.optional(ProfileSlug),
  transitUtc: Schema.DateTimeUtcFromString,
  _: Schema.optional(Schema.Array(Schema.String)),
});

export const handleChartTransits = Effect.fn("handleChartTransits")(function* (
  input: typeof ChartTransitsInput.Type,
) {
  const slug = yield* resolveSlug(input);
  const transitsService = yield* TransitsService;
  const { profile, natal } = yield* natalFromProfile(slug);

  const transits = yield* transitsService.transits(natal, input.transitUtc);

  return {
    profile: {
      slug: profile.slug,
      name: profile.name,
    },
    kind: transits.kind,
    natalWhenUtc: DateTime.formatIso(transits.natalWhenUtc),
    transitUtc: DateTime.formatIso(transits.transitUtc),
    hits: transits.hits,
    jwgeaActivations: transits.jwgeaActivations,
  };
});

export const makeChartTransitsCommand = (
  layer: Layer.Layer<ProfileStore | NatalService | TransitsService, unknown, never>,
) => makeCommand(ChartTransitsInput, handleChartTransits, layer);
