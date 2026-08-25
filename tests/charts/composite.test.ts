import { describe, expect, it } from "bun:test";
import { DateTime, Effect } from "effect";
import { CompositeService } from "../../src/charts/composite/CompositeService.js";
import { NatalService } from "../../src/charts/natal/NatalService.js";
import { houseOfLongitude } from "../../src/core/Jwgea.js";
import { ChartServicesLive, decodeInput } from "./fixtures.js";

describe("Composite Chart Service (JWGEA Canonical)", () => {
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
});
