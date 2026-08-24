import { type BodyId, type Chart, Engine, normalizeHouseSystem, SIGNS } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { Context, DateTime, Effect, Layer, Option } from "effect";
import { EphemerisError } from "./Errors.js";
import {
  type CalculateChartInputType,
  type CelestialBody,
  GeoLocation,
  JwgeaAnalysis,
  JwgeaNodalPoint,
  JwgeaPoint,
  JwgeaSkippedStep,
  type NatalChart,
  type ZodiacSign,
} from "./Schema.js";

/** The canonical house system of JWGEA */
export const JWGEA_HOUSE_SYSTEM = "porphyry";

/** Orb (degrees) within which a body counts as squaring the nodal axis. */
const SQUARE_ORB = 6;

const NODE_BODY_IDS = new Set(["true_node", "mean_node", "north_node", "south_node"]);

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
function signOfLongitude(longitude: number): ZodiacSign {
  const normalized = ((longitude % 360) + 360) % 360;
  const index = Math.min(SIGNS.length - 1, Math.floor(normalized / 30));
  return SIGNS[index] as ZodiacSign;
}

/**
 * Modern domicile ruler of the sign containing the given longitude.
 */
function modernRulerOfLongitude(longitude: number): CelestialBody {
  const sign = signOfLongitude(longitude);
  return MODERN_SIGN_RULERS[sign] ?? "mars";
}

/**
 * Safe lookup of modern ruler for a sign.
 */
function getModernSignRuler(sign: string): Option.Option<CelestialBody> {
  const ruler = MODERN_SIGN_RULERS[sign as ZodiacSign];
  return ruler ? Option.some(ruler) : Option.none();
}

/**
 * Shortest angular distance (degrees, [0, 180]) between two ecliptic longitudes.
 */
function angularSeparation(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

/**
 * Determines which house (1..12) contains a given ecliptic longitude using chart cusps.
 */
function houseOfLongitude(longitude: number, cusps: readonly number[]): number {
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
 * Compute the Jeffrey Wolf Green Evolutionary Astrology (JWGEA) analysis for a chart.
 *
 * Deterministically derives:
 * 1. Pluto Polarity Point (PPP = Pluto + 180°), its sign and Porphyry house.
 * 2. True North Node & South Node positions, houses, and modern domicile rulers with their house/sign.
 * 3. Skipped Steps (planets squaring nodal axis within 6° orb) with directional resolution vector:
 *    - resolvedVia "north_node" if moving from South Node to North Node.
 *    - resolvedVia "south_node" if moving from North Node to South Node.
 */
const computeJwgea = Effect.fn("ChartEngine.computeJwgea")(function* (
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
      // In JWGEA, calculate zodiacal distance from South Node to planet:
      // If ((body.lon - southNodeLongitude + 360) % 360) < 180, it moved past the South Node towards North Node.
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

/**
 * Calculate natal chart pipeline: compute the Caelus chart
 * (tropical, Porphyry houses), derive the JWGEA analysis, and assemble a
 * {@link NatalChart}.
 */
const calculateNatalPipeline = Effect.fn("ChartEngine.calculateNatalPipeline")(function* (
  input: CalculateChartInputType,
  engine: Engine,
): Effect.fn.Return<NatalChart, EphemerisError> {
  const parts = DateTime.toPartsUtc(input.whenUtc);

  let chart: Chart;
  try {
    chart = engine.chart(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      input.latitude,
      input.longitude,
      { houseSystem: normalizeHouseSystem(JWGEA_HOUSE_SYSTEM), zodiac: "tropical" },
    );
  } catch (err) {
    return yield* new EphemerisError({
      message: err instanceof Error ? err.message : String(err),
      date: DateTime.formatIso(input.whenUtc),
    });
  }

  const jwgea = yield* computeJwgea(chart);

  const location = new GeoLocation({
    latitude: input.latitude,
    longitude: input.longitude,
  });

  return {
    kind: "natal",
    whenUtc: input.whenUtc,
    location,
    chart,
    jwgea,
  };
});

/**
 * Service interface for astronomical and evolutionary chart calculations (JWGEA).
 *
 * Deep module encapsulating the Caelus ephemeris engine, Porphyry house calculations,
 * and canonical JWGEA evolutionary analysis (PPP, Nodal axis, Modern rulership, Skipped steps).
 */
export class ChartEngine extends Context.Service<
  ChartEngine,
  {
    readonly natal: (input: CalculateChartInputType) => Effect.Effect<NatalChart, EphemerisError>;
  }
>()("compass/core/ChartEngine") {
  /**
   * Production layer creating an instance of the Caelus engine with embedded ephemeris.
   */
  static readonly layer = Layer.sync(ChartEngine, () => {
    const engine = new Engine(embeddedData);

    const natal = Effect.fn("ChartEngine.natal")(function* (input: CalculateChartInputType) {
      yield* Effect.logDebug("Calculating natal chart in ChartEngine", {
        whenUtc: DateTime.formatIso(input.whenUtc),
        latitude: input.latitude,
        longitude: input.longitude,
      });

      return yield* calculateNatalPipeline(input, engine);
    });

    return ChartEngine.of({
      natal,
    });
  });

  /**
   * Helper to construct a test layer with a deterministic fake chart.
   */
  static readonly testLayer = (stubChart: NatalChart) =>
    Layer.succeed(
      ChartEngine,
      ChartEngine.of({
        natal: Effect.fn("ChartEngine.natalFake")(() => Effect.succeed(stubChart)),
      }),
    );
}
