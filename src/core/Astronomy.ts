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
import { Schema } from "effect";

// Re-export Caelus native types and constants
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
