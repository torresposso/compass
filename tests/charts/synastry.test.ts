import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { NatalService } from "../../src/charts/natal/NatalService.js";
import { SynastryService } from "../../src/charts/synastry/SynastryService.js";
import { ChartServicesLive, decodeInput } from "./fixtures.js";

describe("Synastry Chart Service (JWGEA Canonical)", () => {
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
});
