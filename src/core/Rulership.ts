import { SIGNS } from "caelus";
import { Option } from "effect";
import { CelestialBody, ZodiacSign } from "./Schema.js";

/**
 * Modern domicile rulership of each zodiac sign, Aries..Pisces.
 *
 * Differs from Caelus' traditional `SIGN_RULERS` (7-planet) by assigning the
 * outer planets to their modern signs: Scorpio -> Pluto, Aquarius -> Uranus,
 * Pisces -> Neptune. Used by JWGEA to resolve the nodal rulers.
 */
export const MODERN_SIGN_RULERS: Readonly<Record<ZodiacSign, CelestialBody>> = {
  Aries: "mars",
  Taurus: "venus",
  Gemini: "mercury",
  Cancer: "moon",
  Leo: "sun",
  Virgo: "mercury",
  Libra: "venus",
  Scorpio: "pluto",
  Sagittarius: "jupiter",
  Capricorn: "saturn",
  Aquarius: "uranus",
  Pisces: "neptune",
};

/**
 * Sign name containing the given ecliptic longitude (degrees, [0, 360)).
 */
export function signOfLongitude(longitude: number): ZodiacSign {
  const normalized = ((longitude % 360) + 360) % 360;
  const index = Math.min(SIGNS.length - 1, Math.floor(normalized / 30));
  const sign = SIGNS[index] as ZodiacSign;
  return sign;
}

/**
 * Modern domicile ruler of the sign containing the given longitude.
 */
export function modernRulerOfLongitude(longitude: number): CelestialBody {
  const sign = signOfLongitude(longitude);
  return MODERN_SIGN_RULERS[sign];
}

/**
 * Safe lookup of modern ruler for a sign.
 */
export function getModernSignRuler(sign: string): Option.Option<CelestialBody> {
  const ruler = MODERN_SIGN_RULERS[sign as ZodiacSign];
  return ruler ? Option.some(ruler) : Option.none();
}
