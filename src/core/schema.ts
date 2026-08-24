import { Schema } from "effect";

/**
 * Standard House Systems supported by Compass & Caelus.
 */
export const HouseSystem = Schema.Literals([
  "placidus",
  "whole_sign",
  "koch",
  "equal",
  "regiomontanus",
  "porphyry",
  "campanus",
  "alcabitius",
  "morinus",
  "meridian",
  "polich_page",
  "vehlow",
]);
export type HouseSystem = typeof HouseSystem.Type;

/**
 * Zodiac systems.
 */
export const Zodiac = Schema.Union([
  Schema.Literal("tropical"),
  Schema.String.pipe(Schema.check(Schema.isPattern(/^sidereal:.+$/))),
]);
export type Zodiac = typeof Zodiac.Type;

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
 * Geographic observer coordinates.
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
 * Major and Minor Aspect Types.
 */
export const AspectType = Schema.Literals([
  "conjunction",
  "sextile",
  "square",
  "trine",
  "opposition",
  "quincunx",
  "semisextile",
  "semisquare",
  "sesquiquadrate",
]);
export type AspectType = typeof AspectType.Type;

/**
 * Celestial Bodies.
 */
export const CelestialBody = Schema.Literals([
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "chiron",
  "true_node",
  "mean_node",
  "south_node",
  "mean_lilith",
  "true_lilith",
]);
export type CelestialBody = typeof CelestialBody.Type;

/**
 * Zodiac Signs (0 to 11, Aries = 0).
 */
export const ZodiacSign = Schema.Literals([
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
]);
export type ZodiacSign = typeof ZodiacSign.Type;

/**
 * Essential Dignity types.
 */
export const Dignity = Schema.Literals(["domicile", "exaltation", "detriment", "fall"]);
export type Dignity = typeof Dignity.Type;

/**
 * Planetary position result schema.
 */
export class PlanetaryPosition extends Schema.Class<PlanetaryPosition>(
  "compass/core/PlanetaryPosition",
)({
  body: CelestialBody,
  longitude: Schema.Number,
  latitude: Schema.Number,
  distance: Schema.Number,
  speedLongitude: Schema.Number,
  isRetrograde: Schema.Boolean,
  sign: ZodiacSign,
  signDegree: Schema.Number,
  house: Schema.optional(Schema.Number),
  dignities: Schema.Array(Dignity),
}) {}

/**
 * Calculated house cusp schema.
 */
export class HouseCusp extends Schema.Class<HouseCusp>("compass/core/HouseCusp")({
  house: Schema.Number,
  longitude: Schema.Number,
  sign: ZodiacSign,
  signDegree: Schema.Number,
}) {}

/**
 * Aspect hit between two celestial bodies or points.
 */
export class AspectHit extends Schema.Class<AspectHit>("compass/core/AspectHit")({
  bodyA: CelestialBody,
  bodyB: CelestialBody,
  aspect: AspectType,
  targetAngle: Schema.Number,
  actualAngle: Schema.Number,
  orb: Schema.Number,
  phase: Schema.Literals(["applying", "separating", "exact"]),
  strength: Schema.Number, // Normalized 0..1
}) {}

/**
 * Jeffrey Wolf Green Evolutionary Astrology (JWGEA) points.
 */
export class JwgeaAnalysis extends Schema.Class<JwgeaAnalysis>("compass/core/JwgeaAnalysis")({
  plutoPolarityPoint: Schema.Number,
  northNodeSign: ZodiacSign,
  northNodeRuler: CelestialBody,
  southNodeSign: ZodiacSign,
  southNodeRuler: CelestialBody,
  skippedSteps: Schema.Array(CelestialBody),
}) {}

/**
 * Complete Natal Chart result.
 */
export class NatalChart extends Schema.Class<NatalChart>("compass/core/NatalChart")({
  whenUtc: Schema.String,
  location: GeoLocation,
  houseSystem: HouseSystem,
  zodiac: Zodiac,
  ascendant: Schema.Number,
  midheaven: Schema.Number,
  vertex: Schema.optional(Schema.Number),
  positions: Schema.Array(PlanetaryPosition),
  houses: Schema.Array(HouseCusp),
  aspects: Schema.Array(AspectHit),
  jwgea: Schema.optional(JwgeaAnalysis),
}) {}
