import { describe, expect, it } from "bun:test";
import { DateTime, Effect, Schema } from "effect";
import { NatalService } from "../../src/charts/natal/NatalService.js";
import { TransitsService } from "../../src/charts/transits/TransitsService.js";
import { ChartServicesLive, decodeInput } from "./fixtures.js";

describe("Transits Chart Service (JWGEA Canonical)", () => {
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
});
