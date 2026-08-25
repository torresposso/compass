import { DateTime, Effect, type Layer } from "effect";
import { CalculateChartInput, NatalService } from "../../../charts/natal/NatalService.js";
import type { ProfileStore } from "../../../core/ProfileStore.js";
import { makeCommand } from "../../Command.js";
import { natalFromProfile, ProfileSlugInput, renderChartView, resolveSlug } from "./shared.js";

/**
 * Chart calculate handler defined with Effect.fn consuming NatalService.
 */
export const handleChartCalculate = Effect.fn("handleChartCalculate")(function* (
  input: CalculateChartInput,
) {
  const natalService = yield* NatalService;
  const result = yield* natalService.natal(input);
  return {
    kind: result.kind,
    whenUtc: DateTime.formatIso(result.whenUtc),
    location: {
      latitude: result.location.latitude,
      longitude: result.location.longitude,
    },
    ...renderChartView(result),
  };
});

export const handleChartNatal = Effect.fn("handleChartNatal")(function* (
  input: typeof ProfileSlugInput.Type,
) {
  const slug = yield* resolveSlug(input);
  const { profile, natal } = yield* natalFromProfile(slug);

  return {
    profile: {
      slug: profile.slug,
      name: profile.name,
    },
    kind: natal.kind,
    whenUtc: DateTime.formatIso(natal.whenUtc),
    location: {
      latitude: natal.location.latitude,
      longitude: natal.location.longitude,
    },
    ...renderChartView(natal),
  };
});

export const makeChartCalculateCommand = (layer: Layer.Layer<NatalService, unknown, never>) =>
  makeCommand(CalculateChartInput, handleChartCalculate, layer);

export const makeChartNatalCommand = (
  layer: Layer.Layer<ProfileStore | NatalService, unknown, never>,
) => makeCommand(ProfileSlugInput, handleChartNatal, layer);
