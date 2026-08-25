import { describe, expect, it } from "bun:test";
import type { Chart } from "caelus";
import { DateTime, Effect, Layer, Schema } from "effect";
import { GeoLocation, Latitude, Longitude } from "../src/core/Astronomy.js";
import type { NatalChart } from "../src/core/Charts.js";
import { CompositeService } from "../src/core/CompositeService.js";
import { Ephemeris } from "../src/core/Ephemeris.js";
import { houseOfLongitude, JwgeaAnalysis, JwgeaNodalPoint, JwgeaPoint } from "../src/core/Jwgea.js";
import { CalculateChartInput, NatalService } from "../src/core/NatalService.js";
import { ProgressedService } from "../src/core/ProgressedService.js";
import { SynastryService } from "../src/core/SynastryService.js";
import { TransitsService } from "../src/core/TransitsService.js";

const decodeInput = Schema.decodeUnknownSync(CalculateChartInput);

const ChartServicesLive = Layer.provide(
  Layer.mergeAll(
    NatalService.layer,
    ProgressedService.layer,
    TransitsService.layer,
    SynastryService.layer,
    CompositeService.layer,
  ),
  Ephemeris.layer,
);

describe("Chart Services (JWGEA Canonical)", () => {
  it("calculates natal chart with Caelus live layer (defaults to porphyry)", async () => {
    const input = decodeInput({
      whenUtc: "2024-03-21T12:00:00Z",
      latitude: -34.6037,
      longitude: -58.3816,
    });

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      return yield* natalService.natal(input);
    }).pipe(Effect.provide(ChartServicesLive));

    const result = await Effect.runPromise(program);
    expect(result.kind).toBe("natal");
    expect(DateTime.formatIso(result.whenUtc)).toBe("2024-03-21T12:00:00.000Z");
    expect(result.location.latitude as number).toBe(-34.6037);
    expect(result.location.longitude as number).toBe(-58.3816);
    expect(result.chart.houseSystem).toBe("porphyry");
    expect(result.chart.bodies).toBeDefined();
    expect(result.chart.angles.asc).toBeDefined();
    expect(result.jwgea).toBeDefined();
    expect(result.jwgea.northNode.ruler).toBeDefined();
    expect(result.jwgea.skippedSteps).toBeDefined();
  });

  it("fails decoding on invalid ISO date format with Schema error", () => {
    expect(() =>
      decodeInput({
        whenUtc: "invalid-date-string",
        latitude: 0,
        longitude: 0,
      }),
    ).toThrow();
  });

  it("calculates natal chart deterministically (deepEqual on repeat runs)", async () => {
    const input = decodeInput({
      whenUtc: "1993-11-04T12:00:00Z",
      latitude: 51.5074,
      longitude: -0.1278,
    });

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      const run1 = yield* natalService.natal(input);
      const run2 = yield* natalService.natal(input);
      return { run1, run2 };
    }).pipe(Effect.provide(ChartServicesLive));

    const { run1, run2 } = await Effect.runPromise(program);
    expect(run1).toEqual(run2);
  });

  it("includes Lilith (true_lilith) in chart bodies calculation", async () => {
    const input = decodeInput({
      whenUtc: "2000-01-01T12:00:00Z",
      latitude: 40.7128,
      longitude: -74.006,
    });

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      return yield* natalService.natal(input);
    }).pipe(Effect.provide(ChartServicesLive));

    const result = await Effect.runPromise(program);
    expect(result.chart.bodies.true_lilith).toBeDefined();
    expect(typeof result.chart.bodies.true_lilith?.lon).toBe("number");
    expect(typeof result.chart.bodies.true_lilith?.house).toBe("number");
  });

  it("detects skipped steps positively with directional resolution vector", async () => {
    const input = decodeInput({
      whenUtc: "2005-01-15T12:00:00Z",
      latitude: 40.7128,
      longitude: -74.006,
    });

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      return yield* natalService.natal(input);
    }).pipe(Effect.provide(ChartServicesLive));

    const result = await Effect.runPromise(program);
    expect(result.jwgea.skippedSteps.length).toBeGreaterThan(0);

    const stepBodies = result.jwgea.skippedSteps.map((s) => s.body);
    expect(stepBodies).toContain("sun");
    expect(stepBodies).toContain("saturn");

    const sunStep = result.jwgea.skippedSteps.find((s) => s.body === "sun");
    expect(sunStep?.resolvedVia).toBe("north_node");

    const saturnStep = result.jwgea.skippedSteps.find((s) => s.body === "saturn");
    expect(saturnStep?.resolvedVia).toBe("south_node");
  });

  it("supports testLayer with deterministic fake chart", async () => {
    const parsedDate = Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)(
      "2000-01-01T00:00:00Z",
    );
    const fakeChart: NatalChart = {
      kind: "natal",
      whenUtc: parsedDate,
      location: new GeoLocation({
        latitude: Latitude.make(10),
        longitude: Longitude.make(20),
      }),
      jwgea: new JwgeaAnalysis({
        plutoPolarityPoint: new JwgeaPoint({
          longitude: 0,
          sign: "Aries",
          house: 1,
        }),
        northNode: new JwgeaNodalPoint({
          longitude: 120,
          sign: "Leo",
          house: 9,
          ruler: "sun",
          rulerSign: "Leo",
          rulerHouse: 9,
        }),
        southNode: new JwgeaNodalPoint({
          longitude: 300,
          sign: "Aquarius",
          house: 3,
          ruler: "uranus",
          rulerSign: "Aquarius",
          rulerHouse: 3,
        }),
        skippedSteps: [],
      }),
      chart: {
        jdUt: 2451545,
        zodiac: "tropical",
        houseSystem: "porphyry",
        houseSystemRequested: "porphyry",
        bodies: {} as Chart["bodies"],
        unavailable: [],
        warnings: [],
        angles: { asc: 120, mc: 30, vertex: 0, eastPoint: 0 },
        cusps: [],
        aspects: [],
      },
    };

    const input = decodeInput({
      whenUtc: "2000-01-01T00:00:00Z",
      latitude: 10,
      longitude: 20,
    });

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      return yield* natalService.natal(input);
    }).pipe(Effect.provide(NatalService.testLayer(fakeChart)));

    const result = await Effect.runPromise(program);
    expect(result).toEqual(fakeChart);
  });

  it("calculates canonical JWGEA components (PPP, modern rulers, skipped steps)", async () => {
    const input = decodeInput({
      whenUtc: "1993-11-04T12:00:00Z",
      latitude: 51.5074,
      longitude: -0.1278,
    });

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      return yield* natalService.natal(input);
    }).pipe(Effect.provide(ChartServicesLive));

    const result = await Effect.runPromise(program);
    expect(result.jwgea).toBeDefined();

    const pluto = result.chart.bodies.pluto;
    expect(pluto).toBeDefined();
    if (pluto) {
      const expectedPpp = (pluto.lon + 180) % 360;
      expect(result.jwgea.plutoPolarityPoint.longitude).toBeCloseTo(expectedPpp, 4);
      expect(result.jwgea.plutoPolarityPoint.house).toBeGreaterThanOrEqual(1);
      expect(result.jwgea.plutoPolarityPoint.house).toBeLessThanOrEqual(12);
    }

    const northSign = result.jwgea.northNode.sign;
    if (northSign === "Scorpio") {
      expect(result.jwgea.northNode.ruler).toBe("pluto");
    } else if (northSign === "Sagittarius") {
      expect(result.jwgea.northNode.ruler).toBe("jupiter");
    }

    expect(result.jwgea.northNode.rulerHouse).toBeGreaterThanOrEqual(1);
    expect(result.jwgea.southNode.rulerHouse).toBeGreaterThanOrEqual(1);

    expect(Array.isArray(result.jwgea.skippedSteps)).toBe(true);
    for (const step of result.jwgea.skippedSteps) {
      expect(["north_node", "south_node"]).toContain(step.resolvedVia);
    }
  });

  it("calculates secondary progressed chart (day-for-a-year) with its own JWGEA analysis", async () => {
    const natalInput = decodeInput({
      whenUtc: "1990-06-10T14:30:00Z",
      latitude: 40.7128,
      longitude: -74.006,
    });
    const targetUtc = Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)(
      "2025-06-10T14:30:00Z",
    );

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      const progressedService = yield* ProgressedService;
      const natal = yield* natalService.natal(natalInput);
      return yield* progressedService.progressed(natal, targetUtc);
    }).pipe(Effect.provide(ChartServicesLive));

    const result = await Effect.runPromise(program);
    expect(result.kind).toBe("progressed");
    expect(DateTime.formatIso(result.rootNatalWhenUtc)).toBe("1990-06-10T14:30:00.000Z");
    expect(DateTime.formatIso(result.targetUtc)).toBe("2025-06-10T14:30:00.000Z");
    expect(result.chart.houseSystem).toBe("porphyry");
    expect(result.jwgea.plutoPolarityPoint).toBeDefined();
    expect(result.jwgea.northNode).toBeDefined();
  });

  it("calculates transits against a natal chart with evolutionary activations", async () => {
    const natalInput = decodeInput({
      whenUtc: "1990-06-10T14:30:00Z",
      latitude: 40.7128,
      longitude: -74.006,
    });
    const transitUtc = Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)(
      "2026-08-24T12:00:00Z",
    );

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      const transitsService = yield* TransitsService;
      const natal = yield* natalService.natal(natalInput);
      return yield* transitsService.transits(natal, transitUtc);
    }).pipe(Effect.provide(ChartServicesLive));

    const result = await Effect.runPromise(program);
    expect(result.kind).toBe("transits");
    expect(DateTime.formatIso(result.natalWhenUtc)).toBe("1990-06-10T14:30:00.000Z");
    expect(DateTime.formatIso(result.transitUtc)).toBe("2026-08-24T12:00:00.000Z");
    expect(Array.isArray(result.hits)).toBe(true);
    expect(Array.isArray(result.jwgeaActivations)).toBe(true);
  });

  it("detects evolutionary activations hitting the Pluto Polarity Point (PPP)", async () => {
    const natalInput = decodeInput({
      whenUtc: "1990-06-10T14:30:00Z",
      latitude: 40.7128,
      longitude: -74.006,
    });
    const transitUtc = Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)(
      "2024-03-15T12:00:00Z",
    );

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      const transitsService = yield* TransitsService;
      const natal = yield* natalService.natal(natalInput);
      return yield* transitsService.transits(natal, transitUtc);
    }).pipe(Effect.provide(ChartServicesLive));

    const result = await Effect.runPromise(program);
    const pppActivations = result.jwgeaActivations.filter((a) => a.target === "ppp");
    expect(pppActivations.length).toBeGreaterThan(0);
    expect(
      pppActivations.some((a) => a.transitBody === "jupiter" && a.aspect === "conjunction"),
    ).toBe(true);
  });

  it("correctly computes houseOfLongitude when a house crosses 0° Aries", () => {
    // Cusps array where house 12 starts at 345° and house 1 starts at 15°
    const cusps = [15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];

    // 350° is in house 12
    expect(houseOfLongitude(350, cusps)).toBe(12);
    // 5° (crossed 0° Aries) is still in house 12 before cusp 1 (15°)
    expect(houseOfLongitude(5, cusps)).toBe(12);
    // 20° is in house 1
    expect(houseOfLongitude(20, cusps)).toBe(1);

    // Throws on incomplete cusps
    expect(() => houseOfLongitude(20, [15, 45])).toThrow("Invalid cusps");
  });

  it("calculates synastry comparison between Chart A and Chart B", async () => {
    const chartAInput = decodeInput({
      whenUtc: "1990-06-10T14:30:00Z",
      latitude: 40.7128,
      longitude: -74.006,
    });
    const chartBInput = decodeInput({
      whenUtc: "1992-08-15T08:00:00Z",
      latitude: 51.5074,
      longitude: -0.1278,
    });

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      const synastryService = yield* SynastryService;
      const chartA = yield* natalService.natal(chartAInput);
      const chartB = yield* natalService.natal(chartBInput);
      return yield* synastryService.synastry(chartA, chartB);
    }).pipe(Effect.provide(ChartServicesLive));

    const result = await Effect.runPromise(program);
    expect(result.kind).toBe("synastry");
    expect(Array.isArray(result.aspects)).toBe(true);
    expect(result.overlays.aInB).toBeDefined();
    expect(result.overlays.bInA).toBeDefined();
    expect(Array.isArray(result.crossContacts)).toBe(true);
  });

  it("calculates composite midpoint chart between Chart A and Chart B", async () => {
    const chartAInput = decodeInput({
      whenUtc: "1990-06-10T14:30:00Z",
      latitude: 40.7128,
      longitude: -74.006,
    });
    const chartBInput = decodeInput({
      whenUtc: "1992-08-15T08:00:00Z",
      latitude: 51.5074,
      longitude: -0.1278,
    });

    const program = Effect.gen(function* () {
      const natalService = yield* NatalService;
      const compositeService = yield* CompositeService;
      const chartA = yield* natalService.natal(chartAInput);
      const chartB = yield* natalService.natal(chartBInput);
      return yield* compositeService.composite(chartA, chartB);
    }).pipe(Effect.provide(ChartServicesLive));

    const result = await Effect.runPromise(program);
    expect(result.kind).toBe("composite");
    expect(DateTime.formatIso(result.chartAWhenUtc)).toBe("1990-06-10T14:30:00.000Z");
    expect(DateTime.formatIso(result.chartBWhenUtc)).toBe("1992-08-15T08:00:00.000Z");
    expect(result.chart.houseSystem).toBe("porphyry");
    expect(result.jwgea.plutoPolarityPoint).toBeDefined();
    expect(result.jwgea.northNode).toBeDefined();
  });
});
