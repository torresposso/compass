import type { Chart } from "caelus";
import { DateTime, Effect, type Layer, Schema } from "effect";
import { CompositeService } from "../../core/CompositeService.js";
import type { JwgeaAnalysis } from "../../core/Jwgea.js";
import { CalculateChartInput, NatalService } from "../../core/NatalService.js";
import { ProfileSlug, ProfileStore } from "../../core/ProfileStore.js";
import { ProgressedService } from "../../core/ProgressedService.js";
import { SynastryService } from "../../core/SynastryService.js";
import { TransitsService } from "../../core/TransitsService.js";
import { makeCommand } from "../Command.js";
import { ProfileSlugInput, resolveSlug, resolveTwoSlugs } from "./shared.js";

export const ChartProgressedInput = Schema.Struct({
  slug: Schema.optional(ProfileSlug),
  targetUtc: Schema.DateTimeUtcFromString,
  _: Schema.optional(Schema.Array(Schema.String)),
});

export const ChartTransitsInput = Schema.Struct({
  slug: Schema.optional(ProfileSlug),
  transitUtc: Schema.DateTimeUtcFromString,
  _: Schema.optional(Schema.Array(Schema.String)),
});

export const ChartRelationalInput = Schema.Struct({
  slugA: Schema.optional(ProfileSlug),
  slugB: Schema.optional(ProfileSlug),
  _: Schema.optional(Schema.Array(Schema.String)),
});

export { ProfileSlugInput };

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

export const handleChartSynastry = Effect.fn("handleChartSynastry")(function* (
  input: typeof ChartRelationalInput.Type,
) {
  const [slugA, slugB] = yield* resolveTwoSlugs(input);
  const synastryService = yield* SynastryService;

  const [{ profile: profileA, natal: natalA }, { profile: profileB, natal: natalB }] =
    yield* Effect.all([natalFromProfile(slugA), natalFromProfile(slugB)]);

  const synastry = yield* synastryService.synastry(natalA, natalB);

  return {
    profileA: { slug: profileA.slug, name: profileA.name },
    profileB: { slug: profileB.slug, name: profileB.name },
    kind: synastry.kind,
    aspects: synastry.aspects,
    overlays: synastry.overlays,
    crossContacts: synastry.crossContacts,
  };
});

export const handleChartComposite = Effect.fn("handleChartComposite")(function* (
  input: typeof ChartRelationalInput.Type,
) {
  const [slugA, slugB] = yield* resolveTwoSlugs(input);
  const compositeService = yield* CompositeService;

  const [{ profile: profileA, natal: natalA }, { profile: profileB, natal: natalB }] =
    yield* Effect.all([natalFromProfile(slugA), natalFromProfile(slugB)]);

  const composite = yield* compositeService.composite(natalA, natalB);

  return {
    profileA: { slug: profileA.slug, name: profileA.name },
    profileB: { slug: profileB.slug, name: profileB.name },
    kind: composite.kind,
    chartAWhenUtc: DateTime.formatIso(composite.chartAWhenUtc),
    chartBWhenUtc: DateTime.formatIso(composite.chartBWhenUtc),
    ...renderChartView(composite),
  };
});

export const makeChartCalculateCommand = (layer: Layer.Layer<NatalService, unknown, never>) =>
  makeCommand(CalculateChartInput, handleChartCalculate, layer);

export const makeChartNatalCommand = (
  layer: Layer.Layer<ProfileStore | NatalService, unknown, never>,
) => makeCommand(ProfileSlugInput, handleChartNatal, layer);

export const makeChartProgressedCommand = (
  layer: Layer.Layer<ProfileStore | NatalService | ProgressedService, unknown, never>,
) => makeCommand(ChartProgressedInput, handleChartProgressed, layer);

export const makeChartTransitsCommand = (
  layer: Layer.Layer<ProfileStore | NatalService | TransitsService, unknown, never>,
) => makeCommand(ChartTransitsInput, handleChartTransits, layer);

export const makeChartSynastryCommand = (
  layer: Layer.Layer<ProfileStore | NatalService | SynastryService, unknown, never>,
) => makeCommand(ChartRelationalInput, handleChartSynastry, layer);

export const makeChartCompositeCommand = (
  layer: Layer.Layer<ProfileStore | NatalService | CompositeService, unknown, never>,
) => makeCommand(ChartRelationalInput, handleChartComposite, layer);
