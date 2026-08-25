import {
  type BodyId,
  type Chart,
  compositePlacements,
  Engine,
  julianDay,
  normalizeHouseSystem,
  type Position,
  progressedJd,
  SIGNS,
  synastryAspects,
  synastryOverlays,
  transitAspects,
} from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { Context, DateTime, Effect, Layer, Option, Predicate } from "effect";
import { EphemerisError } from "./Errors.js";
import {
  type CalculateChartInputType,
  type CelestialBody,
  type CompositeChart,
  GeoLocation,
  JwgeaAnalysis,
  JwgeaCrossContact,
  JwgeaEvolutionaryActivation,
  JwgeaNodalPoint,
  JwgeaPoint,
  JwgeaSkippedStep,
  type NatalChart,
  type ProgressedChart,
  type SynastryChart,
  type TransitChart,
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
 * Convert DateTime.Utc to Julian Day (UT).
 */
function dateTimeToJulianDay(dt: DateTime.Utc): number {
  const parts = DateTime.toPartsUtc(dt);
  return julianDay(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
}

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
      {
        houseSystem: normalizeHouseSystem(JWGEA_HOUSE_SYSTEM),
        zodiac: "tropical",
        bodies: ["true_lilith"],
      },
    );
  } catch (err) {
    return yield* new EphemerisError({
      message: Predicate.isError(err) ? err.message : String(err),
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
 * Calculate secondary progressed chart (day-for-a-year) using Caelus progressedJd.
 */
const calculateProgressedPipeline = Effect.fn("ChartEngine.calculateProgressedPipeline")(function* (
  natal: NatalChart,
  targetUtc: DateTime.Utc,
  engine: Engine,
): Effect.fn.Return<ProgressedChart, EphemerisError> {
  const natalJd = dateTimeToJulianDay(natal.whenUtc);
  const targetJd = dateTimeToJulianDay(targetUtc);
  const progJd = progressedJd(natalJd, targetJd);

  let progChart: Chart;
  try {
    progChart = engine.chartAt(progJd, natal.location.latitude, natal.location.longitude, {
      houseSystem: normalizeHouseSystem(JWGEA_HOUSE_SYSTEM),
      zodiac: "tropical",
      bodies: ["true_lilith"],
    });
  } catch (err) {
    return yield* new EphemerisError({
      message: Predicate.isError(err) ? err.message : String(err),
      date: DateTime.formatIso(targetUtc),
    });
  }

  const jwgea = yield* computeJwgea(progChart);

  return {
    kind: "progressed",
    rootNatalWhenUtc: natal.whenUtc,
    targetUtc,
    location: natal.location,
    chart: progChart,
    jwgea,
  };
});

/**
 * Calculate transits against a natal chart, deriving planetary aspects and JWGEA activations.
 */
const calculateTransitsPipeline = Effect.fn("ChartEngine.calculateTransitsPipeline")(function* (
  natal: NatalChart,
  transitUtc: DateTime.Utc,
  engine: Engine,
): Effect.fn.Return<TransitChart, EphemerisError> {
  const transitJd = dateTimeToJulianDay(transitUtc);

  let hits: ReturnType<typeof transitAspects>;
  try {
    hits = transitAspects(natal.chart, engine, transitJd, {
      maxOrb: 6,
      zodiac: "tropical",
    });
  } catch (err) {
    return yield* new EphemerisError({
      message: Predicate.isError(err) ? err.message : String(err),
      date: DateTime.formatIso(transitUtc),
    });
  }

  const jwgeaActivations: JwgeaEvolutionaryActivation[] = [];
  const pppLon = natal.jwgea.plutoPolarityPoint.longitude;

  // Evaluate transits directly hitting natal evolutionary points
  for (const hit of hits) {
    if (hit.natal === "pluto") {
      jwgeaActivations.push(
        new JwgeaEvolutionaryActivation({
          transitBody: hit.transit as CelestialBody,
          target: "pluto",
          aspect: hit.aspect,
          orb: hit.orb,
        }),
      );
    } else if (hit.natal === "true_node" || hit.natal === "north_node") {
      jwgeaActivations.push(
        new JwgeaEvolutionaryActivation({
          transitBody: hit.transit as CelestialBody,
          target: "north_node",
          aspect: hit.aspect,
          orb: hit.orb,
        }),
      );
    } else if (natal.jwgea.skippedSteps.some((s) => s.body === hit.natal)) {
      jwgeaActivations.push(
        new JwgeaEvolutionaryActivation({
          transitBody: hit.transit as CelestialBody,
          target: "skipped_step",
          aspect: hit.aspect,
          orb: hit.orb,
        }),
      );
    }
  }

  // Also check transits directly to PPP (which is not a default Caelus aspectable body)
  for (const [id, body] of Object.entries(natal.chart.bodies)) {
    if (!body) continue;
    let transitBodyPos: Position;
    try {
      transitBodyPos = engine.position(id as BodyId, transitJd);
    } catch (err) {
      return yield* new EphemerisError({
        message: Predicate.isError(err) ? err.message : String(err),
        date: DateTime.formatIso(transitUtc),
        body: id,
      });
    }

    const sep = angularSeparation(transitBodyPos.lon, pppLon);
    if (sep <= 3) {
      jwgeaActivations.push(
        new JwgeaEvolutionaryActivation({
          transitBody: id as CelestialBody,
          target: "ppp",
          aspect: "conjunction",
          orb: sep,
        }),
      );
    } else if (Math.abs(sep - 180) <= 3) {
      jwgeaActivations.push(
        new JwgeaEvolutionaryActivation({
          transitBody: id as CelestialBody,
          target: "ppp",
          aspect: "opposition",
          orb: Math.abs(sep - 180),
        }),
      );
    }
  }

  return {
    kind: "transits",
    natalWhenUtc: natal.whenUtc,
    transitUtc,
    hits,
    jwgeaActivations,
  };
});

/**
 * Calculate synastry comparison between Chart A and Chart B (aspects, overlays, evolutionary contacts).
 */
const calculateSynastryPipeline = Effect.fn("ChartEngine.calculateSynastryPipeline")(function* (
  chartA: NatalChart,
  chartB: NatalChart,
): Effect.fn.Return<SynastryChart, EphemerisError> {
  let aspects: ReturnType<typeof synastryAspects>;
  let overlays: ReturnType<typeof synastryOverlays>;

  try {
    aspects = synastryAspects(chartA.chart, chartB.chart, 6);
    overlays = synastryOverlays(chartA.chart, chartB.chart);
  } catch (err) {
    return yield* new EphemerisError({
      message: Predicate.isError(err) ? err.message : String(err),
    });
  }

  const crossContacts: JwgeaCrossContact[] = [];

  for (const aspect of aspects) {
    // Cross contacts to Pluto / Nodes / Skipped steps
    if (aspect.b === "pluto" || aspect.b === "true_node") {
      crossContacts.push(
        new JwgeaCrossContact({
          sourceBody: aspect.a as CelestialBody,
          targetPoint: aspect.b,
          aspect: aspect.aspect,
          orb: aspect.orb,
        }),
      );
    }
    if (aspect.a === "pluto" || aspect.a === "true_node") {
      crossContacts.push(
        new JwgeaCrossContact({
          sourceBody: aspect.b as CelestialBody,
          targetPoint: aspect.a,
          aspect: aspect.aspect,
          orb: aspect.orb,
        }),
      );
    }
  }

  return {
    kind: "synastry",
    aspects,
    overlays,
    crossContacts,
  };
});

/**
 * Calculate midpoint composite chart and derive its JWGEA analysis.
 */
const calculateCompositePipeline = Effect.fn("ChartEngine.calculateCompositePipeline")(function* (
  chartA: NatalChart,
  chartB: NatalChart,
  engine: Engine,
): Effect.fn.Return<CompositeChart, EphemerisError> {
  const jdA = dateTimeToJulianDay(chartA.whenUtc);
  const jdB = dateTimeToJulianDay(chartB.whenUtc);

  // Time & place midpoint (Davison method / mid-instant) for house cusps calculation
  const midJd = (jdA + jdB) / 2;
  const midLat = (chartA.location.latitude + chartB.location.latitude) / 2;
  const midLon = (chartA.location.longitude + chartB.location.longitude) / 2;

  let baseChart: Chart;
  try {
    baseChart = engine.chartAt(midJd, midLat, midLon, {
      houseSystem: normalizeHouseSystem(JWGEA_HOUSE_SYSTEM),
      zodiac: "tropical",
      bodies: ["true_lilith"],
    });
  } catch (err) {
    return yield* new EphemerisError({
      message: Predicate.isError(err) ? err.message : String(err),
    });
  }

  // Override longitudes with true midpoint composite placements
  let placements: ReturnType<typeof compositePlacements>;
  try {
    placements = compositePlacements(engine, jdA, jdB);
  } catch (err) {
    return yield* new EphemerisError({
      message: Predicate.isError(err) ? err.message : String(err),
    });
  }

  for (const p of placements) {
    const existing = baseChart.bodies[p.body as BodyId];
    if (existing) {
      existing.lon = p.lon;
      existing.sign = p.sign;
      existing.signDeg = p.signDeg;
      existing.house = houseOfLongitude(p.lon, baseChart.cusps);
    }
  }

  const jwgea = yield* computeJwgea(baseChart);

  return {
    kind: "composite",
    chartAWhenUtc: chartA.whenUtc,
    chartBWhenUtc: chartB.whenUtc,
    chart: baseChart,
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
    readonly progressed: (
      natal: NatalChart,
      targetUtc: DateTime.Utc,
    ) => Effect.Effect<ProgressedChart, EphemerisError>;
    readonly transits: (
      natal: NatalChart,
      transitUtc: DateTime.Utc,
    ) => Effect.Effect<TransitChart, EphemerisError>;
    readonly synastry: (
      chartA: NatalChart,
      chartB: NatalChart,
    ) => Effect.Effect<SynastryChart, EphemerisError>;
    readonly composite: (
      chartA: NatalChart,
      chartB: NatalChart,
    ) => Effect.Effect<CompositeChart, EphemerisError>;
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

    const progressed = Effect.fn("ChartEngine.progressed")(function* (
      natalChart: NatalChart,
      targetUtc: DateTime.Utc,
    ) {
      yield* Effect.logDebug("Calculating progressed chart in ChartEngine", {
        rootNatalWhenUtc: DateTime.formatIso(natalChart.whenUtc),
        targetUtc: DateTime.formatIso(targetUtc),
      });

      return yield* calculateProgressedPipeline(natalChart, targetUtc, engine);
    });

    const transits = Effect.fn("ChartEngine.transits")(function* (
      natalChart: NatalChart,
      transitUtc: DateTime.Utc,
    ) {
      yield* Effect.logDebug("Calculating transits in ChartEngine", {
        natalWhenUtc: DateTime.formatIso(natalChart.whenUtc),
        transitUtc: DateTime.formatIso(transitUtc),
      });

      return yield* calculateTransitsPipeline(natalChart, transitUtc, engine);
    });

    const synastry = Effect.fn("ChartEngine.synastry")(function* (
      chartA: NatalChart,
      chartB: NatalChart,
    ) {
      yield* Effect.logDebug("Calculating synastry in ChartEngine", {
        chartAWhenUtc: DateTime.formatIso(chartA.whenUtc),
        chartBWhenUtc: DateTime.formatIso(chartB.whenUtc),
      });

      return yield* calculateSynastryPipeline(chartA, chartB);
    });

    const composite = Effect.fn("ChartEngine.composite")(function* (
      chartA: NatalChart,
      chartB: NatalChart,
    ) {
      yield* Effect.logDebug("Calculating composite chart in ChartEngine", {
        chartAWhenUtc: DateTime.formatIso(chartA.whenUtc),
        chartBWhenUtc: DateTime.formatIso(chartB.whenUtc),
      });

      return yield* calculateCompositePipeline(chartA, chartB, engine);
    });

    return ChartEngine.of({
      natal,
      progressed,
      transits,
      synastry,
      composite,
    });
  });

  /**
   * Helper to construct a test layer with deterministic fake responses.
   */
  static readonly testLayer = (stubChart: NatalChart) =>
    Layer.succeed(
      ChartEngine,
      ChartEngine.of({
        natal: Effect.fn("ChartEngine.natalFake")(() => Effect.succeed(stubChart)),
        progressed: Effect.fn("ChartEngine.progressedFake")((_, targetUtc) =>
          Effect.succeed({
            kind: "progressed",
            rootNatalWhenUtc: stubChart.whenUtc,
            targetUtc,
            location: stubChart.location,
            chart: stubChart.chart,
            jwgea: stubChart.jwgea,
          }),
        ),
        transits: Effect.fn("ChartEngine.transitsFake")((_, transitUtc) =>
          Effect.succeed({
            kind: "transits",
            natalWhenUtc: stubChart.whenUtc,
            transitUtc,
            hits: [],
            jwgeaActivations: [],
          }),
        ),
        synastry: Effect.fn("ChartEngine.synastryFake")(() =>
          Effect.succeed({
            kind: "synastry",
            aspects: [],
            overlays: { aInB: {}, bInA: {} },
            crossContacts: [],
          }),
        ),
        composite: Effect.fn("ChartEngine.compositeFake")((a, b) =>
          Effect.succeed({
            kind: "composite",
            chartAWhenUtc: a.whenUtc,
            chartBWhenUtc: b.whenUtc,
            chart: stubChart.chart,
            jwgea: stubChart.jwgea,
          }),
        ),
      }),
    );
}
