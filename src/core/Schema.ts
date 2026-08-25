import {
  type Aspect,
  BODIES,
  type Body,
  type BodyId,
  type HouseSystem as CaelusHouseSystem,
  type Chart,
  type ChartBodies,
  type ChartBody,
  EXTRA_BODIES,
  HOUSE_SYSTEMS,
  normalizeHouseSystem,
  type Position,
  SIGNS,
  type SynastryAspectHit,
  type SynastryOverlays,
  type TransitHit,
} from "caelus";
import { type DateTime, Schema } from "effect";

// Re-export Caelus native types
export type {
  Aspect,
  Body,
  BodyId,
  CaelusHouseSystem,
  Chart,
  ChartBodies,
  ChartBody,
  Position,
  SynastryAspectHit,
  SynastryOverlays,
  TransitHit,
};
export { BODIES, EXTRA_BODIES, HOUSE_SYSTEMS, normalizeHouseSystem, SIGNS };

/**
 * Validated Zodiac Signs.
 */
export const ZodiacSign = Schema.Literals(SIGNS as unknown as readonly [string, ...string[]]);
export type ZodiacSign = typeof ZodiacSign.Type;

/**
 * Validated Celestial Body IDs.
 */
export const CelestialBody = Schema.Literals([...BODIES, ...EXTRA_BODIES, "south_node"] as const);
export type CelestialBody = typeof CelestialBody.Type;

/**
 * Latitude in degrees [-90, +90] (North positive, South negative).
 */
export const Latitude = Schema.Number.pipe(
  Schema.check(Schema.isBetween({ minimum: -90, maximum: 90 })),
  Schema.brand("Latitude"),
);
export type Latitude = typeof Latitude.Type;

/**
 * Longitude in degrees [-180, +180] (East positive, West negative, standard WGS84).
 */
export const Longitude = Schema.Number.pipe(
  Schema.check(Schema.isBetween({ minimum: -180, maximum: 180 })),
  Schema.brand("Longitude"),
);
export type Longitude = typeof Longitude.Type;

/**
 * Geographic observer location coordinates.
 */
export class GeoLocation extends Schema.Class<GeoLocation>("compass/core/GeoLocation")({
  latitude: Latitude,
  longitude: Longitude,
}) {}

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
 * Request payload for calculating a natal chart on the fly.
 * Compass strictly uses Western Tropical zodiac and the Porphyry house system.
 */
export class CalculateChartInput extends Schema.Class<CalculateChartInput>(
  "compass/core/CalculateChartInput",
)({
  whenUtc: Schema.DateTimeUtcFromString,
  latitude: Latitude,
  longitude: Longitude,
}) {}
export type CalculateChartInputType = typeof CalculateChartInput.Type;

/**
 * Calculated point with longitude, sign and Porphyry house.
 */
export class JwgeaPoint extends Schema.Class<JwgeaPoint>("compass/core/JwgeaPoint")({
  longitude: Schema.Number,
  sign: ZodiacSign,
  house: Schema.Number,
}) {}

/**
 * JWGEA Nodal Axis point with its sign, house, and modern ruler positioning.
 */
export class JwgeaNodalPoint extends Schema.Class<JwgeaNodalPoint>("compass/core/JwgeaNodalPoint")({
  longitude: Schema.Number,
  sign: ZodiacSign,
  house: Schema.Number,
  ruler: CelestialBody,
  rulerSign: ZodiacSign,
  rulerHouse: Schema.Number,
}) {}

/**
 * Skipped Step: celestial body squaring the nodal axis with directional resolution vector.
 */
export class JwgeaSkippedStep extends Schema.Class<JwgeaSkippedStep>(
  "compass/core/JwgeaSkippedStep",
)({
  body: CelestialBody,
  resolvedVia: Schema.Literals(["north_node", "south_node"] as const),
}) {}

/**
 * Jeffrey Wolf Green Evolutionary Astrology (JWGEA) canonical calculations.
 */
export class JwgeaAnalysis extends Schema.Class<JwgeaAnalysis>("compass/core/JwgeaAnalysis")({
  plutoPolarityPoint: JwgeaPoint,
  northNode: JwgeaNodalPoint,
  southNode: JwgeaNodalPoint,
  skippedSteps: Schema.Array(JwgeaSkippedStep),
}) {}

/**
 * Transit aspect activation triggering a key natal evolutionary component (PPP, Nodal axis, Skipped steps).
 */
export class JwgeaEvolutionaryActivation extends Schema.Class<JwgeaEvolutionaryActivation>(
  "compass/core/JwgeaEvolutionaryActivation",
)({
  transitBody: CelestialBody,
  target: Schema.Literals(["pluto", "ppp", "north_node", "south_node", "skipped_step"] as const),
  aspect: Schema.String,
  orb: Schema.Number,
}) {}

/**
 * Inter-chart evolutionary contact between person A and person B.
 */
export class JwgeaCrossContact extends Schema.Class<JwgeaCrossContact>(
  "compass/core/JwgeaCrossContact",
)({
  sourceBody: CelestialBody,
  targetPoint: Schema.String,
  aspect: Schema.String,
  orb: Schema.Number,
}) {}

/**
 * Natal chart: the foundational soul blueprint for an individual birth instant.
 */
export interface NatalChart {
  readonly kind: "natal";
  readonly whenUtc: DateTime.Utc;
  readonly location: GeoLocation;
  readonly chart: Chart;
  readonly jwgea: JwgeaAnalysis;
}

/**
 * Progressed chart: secondary progression of a natal chart over time (day for a year).
 */
export interface ProgressedChart {
  readonly kind: "progressed";
  readonly rootNatalWhenUtc: DateTime.Utc;
  readonly targetUtc: DateTime.Utc;
  readonly location: GeoLocation;
  readonly chart: Chart;
  readonly jwgea: JwgeaAnalysis;
}

/**
 * Transit chart: active transits evaluated against a root natal chart.
 */
export interface TransitChart {
  readonly kind: "transits";
  readonly natalWhenUtc: DateTime.Utc;
  readonly transitUtc: DateTime.Utc;
  readonly hits: readonly TransitHit[];
  readonly jwgeaActivations: readonly JwgeaEvolutionaryActivation[];
}

/**
 * Synastry chart: inter-chart comparative dynamics between chart A and chart B.
 */
export interface SynastryChart {
  readonly kind: "synastry";
  readonly aspects: readonly SynastryAspectHit[];
  readonly overlays: SynastryOverlays;
  readonly crossContacts: readonly JwgeaCrossContact[];
}

/**
 * Composite chart: relationship entity midpoint chart with recomputed JWGEA analysis.
 */
export interface CompositeChart {
  readonly kind: "composite";
  readonly chartAWhenUtc: DateTime.Utc;
  readonly chartBWhenUtc: DateTime.Utc;
  readonly chart: Chart;
  readonly jwgea: JwgeaAnalysis;
}

/**
 * Discriminated union of every Compass chart kind.
 */
export type CompassChart =
  | NatalChart
  | ProgressedChart
  | TransitChart
  | SynastryChart
  | CompositeChart;
