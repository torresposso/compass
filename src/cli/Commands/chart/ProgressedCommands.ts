import { DateTime, Effect, type Layer, Schema } from "effect";
import type { NatalService } from "../../../charts/natal/NatalService.js";
import { ProgressedService } from "../../../charts/progressed/ProgressedService.js";
import { ProfileSlug, type ProfileStore } from "../../../core/ProfileStore.js";
import { makeCommand } from "../../Command.js";
import { natalFromProfile, renderChartView, resolveSlug } from "./shared.js";

export const ChartProgressedInput = Schema.Struct({
  slug: Schema.optional(ProfileSlug),
  targetUtc: Schema.DateTimeUtcFromString,
  _: Schema.optional(Schema.Array(Schema.String)),
});

export const handleChartProgressed = Effect.fn("handleChartProgressed")(function* (
  input: typeof ChartProgressedInput.Type,
) {
  const slug = yield* resolveSlug(input);
  const progressedService = yield* ProgressedService;
  const { profile, natal } = yield* natalFromProfile(slug);

  const progressed = yield* progressedService.progressed(natal, input.targetUtc);

  return {
    profile: {
      slug: profile.slug,
      name: profile.name,
    },
    kind: progressed.kind,
    rootNatalWhenUtc: DateTime.formatIso(progressed.rootNatalWhenUtc),
    targetUtc: DateTime.formatIso(progressed.targetUtc),
    location: {
      latitude: progressed.location.latitude,
      longitude: progressed.location.longitude,
    },
    ...renderChartView(progressed),
  };
});

export const makeChartProgressedCommand = (
  layer: Layer.Layer<ProfileStore | NatalService | ProgressedService, unknown, never>,
) => makeCommand(ChartProgressedInput, handleChartProgressed, layer);
