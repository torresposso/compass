import { describe, expect, it } from "bun:test";
import type { Chart } from "caelus";
import { DateTime, Effect, Schema } from "effect";
import type { NatalChart } from "../../src/charts/natal/NatalChart.js";
import { NatalService } from "../../src/charts/natal/NatalService.js";
import { GeoLocation, Latitude, Longitude } from "../../src/core/Astronomy.js";
import { JwgeaAnalysis, JwgeaNodalPoint, JwgeaPoint } from "../../src/core/Jwgea.js";
import { ChartServicesLive, decodeInput } from "./fixtures.js";

describe("Natal Chart Service (JWGEA Canonical)", () => {
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
});
