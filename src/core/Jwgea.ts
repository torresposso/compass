import type { BodyId, Chart } from "caelus";
import { Effect, Option, Schema } from "effect";
import { CelestialBody, ZodiacSign } from "./Astronomy.js";
import { EphemerisError } from "./Ephemeris.js";

/** Orb (degrees) within which a body counts as squaring the nodal axis. */
export const SQUARE_ORB = 6;

export const NODE_BODY_IDS = new Set(["true_node", "mean_node", "north_node", "south_node"]);

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
  const signs = [
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
  const normalized = ((longitude % 360) + 360) % 360;
  const index = Math.min(signs.length - 1, Math.floor(normalized / 30));
  return signs[index] as ZodiacSign;
}

/**
 * Modern domicile ruler of the sign containing the given longitude.
 */
export function modernRulerOfLongitude(longitude: number): CelestialBody {
  const sign = signOfLongitude(longitude);
  return MODERN_SIGN_RULERS[sign] ?? "mars";
}

/**
 * Safe lookup of modern ruler for a sign.
 */
export function getModernSignRuler(sign: string): Option.Option<CelestialBody> {
  const ruler = MODERN_SIGN_RULERS[sign as ZodiacSign];
  return ruler ? Option.some(ruler) : Option.none();
}

/**
 * Shortest angular distance (degrees, [0, 180]) between two ecliptic longitudes.
 */
export function angularSeparation(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

/**
 * Determines which house (1..12) contains a given ecliptic longitude using chart cusps.
 */
export function houseOfLongitude(longitude: number, cusps: readonly number[]): number {
  const normLon = ((longitude % 360) + 360) % 360;
  if (!cusps || cusps.length < 12) return 1;

  for (let i = 0; i < 12; i++) {
    const rawCurrent = cusps[i];
    const rawNext = cusps[(i + 1) % 12];
    if (rawCurrent === undefined || rawNext === undefined) continue;

    const cuspCurrent = ((rawCurrent % 360) + 360) % 360;
    const cuspNext = ((rawNext % 360) + 360) % 360;

    if (cuspCurrent < cuspNext) {
      if (normLon >= cuspCurrent && normLon < cuspNext) {
        return i + 1;
      }
    } else {
      // House crosses 0° Aries
      if (normLon >= cuspCurrent || normLon < cuspNext) {
        return i + 1;
      }
    }
  }

  return 1;
}

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
 * Compute the Jeffrey Wolf Green Evolutionary Astrology (JWGEA) analysis for a chart.
 */
export const computeJwgea = Effect.fn("Jwgea.computeJwgea")(function* (
  chart: Chart,
): Effect.fn.Return<JwgeaAnalysis, EphemerisError> {
  const pluto = chart.bodies.pluto;
  const trueNode = chart.bodies.true_node;

  if (!pluto) {
    return yield* new EphemerisError({
      message:
        "JWGEA requires Pluto, which is unavailable for this chart instant (outside the validated ephemeris range).",
      body: "pluto",
    });
  }
  if (!trueNode) {
    return yield* new EphemerisError({
      message: "JWGEA requires the true nodal axis, which is missing from this chart.",
      body: "true_node",
    });
  }

  // 1. Pluto Polarity Point
  const pppLongitude = (pluto.lon + 180) % 360;
  const pppSign = signOfLongitude(pppLongitude);
  const pppHouse = houseOfLongitude(pppLongitude, chart.cusps);

  const plutoPolarityPoint = new JwgeaPoint({
    longitude: pppLongitude,
    sign: pppSign,
    house: pppHouse,
  });

  // 2. North Node & Ruler
  const northNodeSign = trueNode.sign as ZodiacSign;
  const northNodeHouse = trueNode.house ?? houseOfLongitude(trueNode.lon, chart.cusps);
  const northNodeRulerOpt = getModernSignRuler(northNodeSign);
  if (northNodeRulerOpt._tag === "None") {
    return yield* new EphemerisError({
      message: `No modern ruler defined for sign "${northNodeSign}"`,
    });
  }
  const northNodeRuler = northNodeRulerOpt.value;
  const northRulerBody = chart.bodies[northNodeRuler as BodyId];
  const northNodeRulerSign =
    (northRulerBody?.sign as ZodiacSign) ?? signOfLongitude(northRulerBody?.lon ?? 0);
  const northNodeRulerHouse =
    northRulerBody?.house ??
    (northRulerBody ? houseOfLongitude(northRulerBody.lon, chart.cusps) : 1);

  const northNode = new JwgeaNodalPoint({
    longitude: trueNode.lon,
    sign: northNodeSign,
    house: northNodeHouse,
    ruler: northNodeRuler,
    rulerSign: northNodeRulerSign,
    rulerHouse: northNodeRulerHouse,
  });

  // 3. South Node & Ruler
  const southNodeLongitude = (trueNode.lon + 180) % 360;
  const southNodeSign = signOfLongitude(southNodeLongitude);
  const southNodeHouse = houseOfLongitude(southNodeLongitude, chart.cusps);
  const southNodeRuler = modernRulerOfLongitude(southNodeLongitude);
  const southRulerBody = chart.bodies[southNodeRuler as BodyId];
  const southNodeRulerSign =
    (southRulerBody?.sign as ZodiacSign) ?? signOfLongitude(southRulerBody?.lon ?? 0);
  const southNodeRulerHouse =
    southRulerBody?.house ??
    (southRulerBody ? houseOfLongitude(southRulerBody.lon, chart.cusps) : 1);

  const southNode = new JwgeaNodalPoint({
    longitude: southNodeLongitude,
    sign: southNodeSign,
    house: southNodeHouse,
    ruler: southNodeRuler,
    rulerSign: southNodeRulerSign,
    rulerHouse: southNodeRulerHouse,
  });

  // 4. Skipped steps with directional resolution vector
  const skippedSteps: Array<JwgeaSkippedStep> = [];
  for (const [id, body] of Object.entries(chart.bodies)) {
    if (body === undefined) continue;
    if (NODE_BODY_IDS.has(id)) continue;

    const sepTrue = angularSeparation(body.lon, trueNode.lon);
    const sepSouth = angularSeparation(body.lon, southNodeLongitude);
    const distFromSquare = Math.min(Math.abs(sepTrue - 90), Math.abs(sepSouth - 90));

    if (distFromSquare <= SQUARE_ORB && !skippedSteps.some((s) => s.body === id)) {
      const distFromSouthZodiacal = (body.lon - southNodeLongitude + 360) % 360;
      const resolvedVia: "north_node" | "south_node" =
        distFromSouthZodiacal < 180 ? "north_node" : "south_node";

      skippedSteps.push(
        new JwgeaSkippedStep({
          body: id as CelestialBody,
          resolvedVia,
        }),
      );
    }
  }

  return new JwgeaAnalysis({
    plutoPolarityPoint,
    northNode,
    southNode,
    skippedSteps,
  });
});
