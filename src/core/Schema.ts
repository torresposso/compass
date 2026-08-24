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
} from "caelus";
import { Schema } from "effect";

// Re-export Caelus native types
export type { Aspect, Body, BodyId, CaelusHouseSystem, Chart, ChartBodies, ChartBody, Position };
export { BODIES, EXTRA_BODIES, HOUSE_SYSTEMS, normalizeHouseSystem, SIGNS };

/**
 * Validated House System using Caelus canonical list.
 */
export const HouseSystem = Schema.Literals(HOUSE_SYSTEMS);
export type HouseSystem = typeof HouseSystem.Type;

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
 * Geographic observer coordinates for CLI / Input.
 */
export class GeoLocation extends Schema.Class<GeoLocation>("compass/core/GeoLocation")({
  latitude: Latitude,
  longitude: Longitude,
  name: Schema.optional(Schema.String),
  altitudeMeters: Schema.optional(Schema.Number),
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
 * Request payload for calculating a natal chart on the fly.
 */
export class CalculateChartInput extends Schema.Class<CalculateChartInput>(
  "compass/core/CalculateChartInput",
)({
  whenUtc: Schema.String,
  latitude: Latitude,
  longitude: Longitude,
  houseSystem: Schema.optional(HouseSystem),
}) {}
export type CalculateChartInputType = typeof CalculateChartInput.Type;

/**
 * Jeffrey Wolf Green Evolutionary Astrology (JWGEA) points.
 */
export class JwgeaAnalysis extends Schema.Class<JwgeaAnalysis>("compass/core/JwgeaAnalysis")({
  plutoPolarityPoint: Schema.Number,
  northNodeSign: Schema.String,
  northNodeRuler: Schema.String,
  southNodeSign: Schema.String,
  southNodeRuler: Schema.String,
  skippedSteps: Schema.Array(Schema.String),
}) {}

/**
 * Natal chart: a Compass chart computed for a birth instant, always carrying
 * its full JWGEA evolutionary analysis.
 */
export interface NatalChart {
  readonly kind: "natal";
  readonly whenUtc: string;
  readonly location: GeoLocation;
  readonly chart: Chart;
  readonly jwgea: JwgeaAnalysis;
}

/**
 * Discriminated union of every Compass chart kind. Phase 2 materializes only
 * `NatalChart`; `progressed`, `transits`, and `synastry` join in later phases.
 */
export type CompassChart = NatalChart;
