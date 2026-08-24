import type { Chart } from "caelus";
import { Effect } from "effect";
import { EphemerisError } from "./Errors.js";
import { getModernSignRuler, modernRulerOfLongitude, signOfLongitude } from "./Rulership.js";
import { type CelestialBody, JwgeaAnalysis, type ZodiacSign } from "./Schema.js";

/**
 * Compute the Jeffrey Wolf Green Evolutionary Astrology (JWGEA) analysis for a
 * natal chart.
 *
 * Pure Effect over a Caelus {@link Chart}: derives the Pluto Polarity Point
 * from Pluto, the nodal axis from the TRUE node (South Node = North + 180), the
 * modern domicile rulers of each node, and the skipped-step planets (bodies
 * squaring the nodal axis).
 *
 * Returns an EphemerisError if Pluto or the true node are missing.
 */
export const computeJwgea = Effect.fn("computeJwgea")(function* (
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

  const plutoPolarityPoint = (pluto.lon + 180) % 360;

  const northNodeSign = trueNode.sign as ZodiacSign;
  const northNodeRulerOpt = getModernSignRuler(northNodeSign);
  if (northNodeRulerOpt._tag === "None") {
    return yield* new EphemerisError({
      message: `No modern ruler defined for sign "${northNodeSign}"`,
    });
  }
  const northNodeRuler = northNodeRulerOpt.value;

  const southNodeLongitude = (trueNode.lon + 180) % 360;
  const southNodeSign = signOfLongitude(southNodeLongitude);
  const southNodeRuler = modernRulerOfLongitude(southNodeLongitude);

  // Skipped steps: planets squaring the nodal axis. Caelus excludes the nodes
  // from aspect search by default, so we measure the square directly from the
  // body longitudes against both nodes (the axis is a line: North + South).
  const skippedSteps: Array<CelestialBody> = [];
  for (const [id, body] of Object.entries(chart.bodies)) {
    if (body === undefined) continue;
    if (NODE_BODY_IDS.has(id)) continue;
    const sepTrue = angularSeparation(body.lon, trueNode.lon);
    const sepSouth = angularSeparation(body.lon, southNodeLongitude);
    const distFromSquare = Math.min(Math.abs(sepTrue - 90), Math.abs(sepSouth - 90));
    if (distFromSquare <= SQUARE_ORB && !skippedSteps.includes(id as CelestialBody)) {
      skippedSteps.push(id as CelestialBody);
    }
  }

  return new JwgeaAnalysis({
    plutoPolarityPoint,
    northNodeSign,
    northNodeRuler,
    southNodeSign,
    southNodeRuler,
    skippedSteps,
  });
});

const NODE_BODY_IDS = new Set(["true_node", "mean_node", "north_node", "south_node"]);

/** Orb (degrees) within which a body counts as squaring the nodal axis. */
const SQUARE_ORB = 6;

/**
 * Shortest angular distance (degrees, [0, 180]) between two ecliptic longitudes.
 */
function angularSeparation(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}
