import { BODIES, EXTRA_BODIES } from "caelus";
import { Schema } from "effect";

// Direct re-exports of Caelus native types and constants
export type {
  Aspect,
  Body,
  BodyId,
  Chart,
  ChartBodies,
  ChartBody,
  HouseSystem as CaelusHouseSystem,
  Position,
  SynastryAspectHit,
  SynastryOverlays,
  TransitHit,
} from "caelus";
export const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

/**
 * Validated Zodiac Signs.
 */
export const ZodiacSign = Schema.Literals(ZODIAC_SIGNS);
export type ZodiacSign = typeof ZodiacSign.Type;

/**
 * Validated Celestial Body IDs.
 */
export const CelestialBody = Schema.Literals([...BODIES, ...EXTRA_BODIES] as const);
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
