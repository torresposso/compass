import type { Chart } from "caelus";
import { Effect, Schema } from "effect";
import { CalculateChartInput, NatalService } from "../../../charts/natal/NatalService.js";
import type { JwgeaAnalysis } from "../../../core/Jwgea.js";
import { ProfileSlug, ProfileStore } from "../../../core/ProfileStore.js";
import { ProfileSlugInput, resolveSlug, resolveTwoSlugs } from "../shared.js";

export const ChartRelationalInput = Schema.Struct({
  slugA: Schema.optional(ProfileSlug),
  slugB: Schema.optional(ProfileSlug),
  _: Schema.optional(Schema.Array(Schema.String)),
});

export { ProfileSlugInput, resolveSlug, resolveTwoSlugs };

/**
 * Helper to fetch a profile and calculate its root natal chart in a single effect.
 */
export const natalFromProfile = Effect.fn("natalFromProfile")(function* (slug: ProfileSlug) {
  const store = yield* ProfileStore;
  const natalService = yield* NatalService;
  const profile = yield* store.get(slug);

  const chartInput = new CalculateChartInput({
    whenUtc: profile.whenUtc,
    latitude: profile.location.latitude,
    longitude: profile.location.longitude,
  });

  const natal = yield* natalService.natal(chartInput);
  return { profile, natal };
});

/**
 * Helper to format standard chart angles, cusps, bodies, aspects, and JWGEA analysis.
 */
export function renderChartView(result: { readonly chart: Chart; readonly jwgea: JwgeaAnalysis }) {
  return {
    ascendant: result.chart.angles.asc,
    mc: result.chart.angles.mc,
    houses: result.chart.cusps,
    bodies: result.chart.bodies,
    aspects: result.chart.aspects,
    jwgea: result.jwgea,
  };
}
