import { describe, expect, it } from "bun:test";
import type { Chart } from "caelus";
import { Effect } from "effect";
import { CalculateChartInput, ChartEngine } from "../src/core/ChartEngine.js";
import { type CompassChart, GeoLocation, Latitude, Longitude } from "../src/core/Schema.js";

describe("ChartEngine Service", () => {
  it("calculates chart with Caelus live layer", async () => {
    const program = Effect.gen(function* () {
      const engine = yield* ChartEngine;
      return yield* engine.calculate(
        new CalculateChartInput({
          whenUtc: "2024-03-21T12:00:00Z",
          latitude: Latitude.make(-34.6037),
          longitude: Longitude.make(-58.3816),
          houseSystem: "placidus",
          zodiac: "tropical",
          includeJwgea: true,
        }),
      );
    }).pipe(Effect.provide(ChartEngine.layer));

    const result = await Effect.runPromise(program);
    expect(result.whenUtc).toBe("2024-03-21T12:00:00Z");
    expect(result.location.latitude as number).toBe(-34.6037);
    expect(result.location.longitude as number).toBe(-58.3816);
    expect(result.chart.bodies).toBeDefined();
    expect(result.chart.angles.asc).toBeDefined();
    expect(result.jwgea).toBeDefined();
  });

  it("fails with ValidationError on invalid ISO date format", async () => {
    const program = Effect.gen(function* () {
      const engine = yield* ChartEngine;
      return yield* engine.calculate(
        new CalculateChartInput({
          whenUtc: "invalid-date-string",
          latitude: Latitude.make(0),
          longitude: Longitude.make(0),
        }),
      );
    }).pipe(Effect.provide(ChartEngine.layer));

    const exit = await Effect.runPromiseExit(program);
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const cause = exit.cause;
      expect(cause.toString()).toContain("ValidationError");
    }
  });

  it("supports testLayer with deterministic fake chart", async () => {
    const fakeChart: CompassChart = {
      chart: {
        jdUt: 2451545,
        zodiac: "tropical",
        houseSystem: "placidus",
        houseSystemRequested: "placidus",
        bodies: {} as Chart["bodies"],
        unavailable: [],
        warnings: [],
        angles: { asc: 120, mc: 30, vertex: 0, eastPoint: 0 },
        cusps: [],
        aspects: [],
      },
      location: new GeoLocation({
        latitude: Latitude.make(10),
        longitude: Longitude.make(20),
      }),
      whenUtc: "2000-01-01T00:00:00Z",
    };

    const program = Effect.gen(function* () {
      const engine = yield* ChartEngine;
      return yield* engine.calculate(
        new CalculateChartInput({
          whenUtc: "2000-01-01T00:00:00Z",
          latitude: Latitude.make(10),
          longitude: Longitude.make(20),
        }),
      );
    }).pipe(Effect.provide(ChartEngine.testLayer(fakeChart)));

    const result = await Effect.runPromise(program);
    expect(result).toEqual(fakeChart);
  });
});
