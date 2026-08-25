import { describe, expect, it } from "bun:test";
import { DateTime, Effect, Schema } from "effect";
import { NatalService } from "../../src/charts/natal/NatalService.js";
import { ProgressedService } from "../../src/charts/progressed/ProgressedService.js";
import { ChartServicesLive, decodeInput } from "./fixtures.js";

describe("Progressed Chart Service (JWGEA Canonical)", () => {
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
});
