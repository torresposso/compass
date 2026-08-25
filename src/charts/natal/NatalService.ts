import { Context, DateTime, Effect, Layer, Schema } from "effect";
import { GeoLocation, Latitude, Longitude } from "../../core/Astronomy.js";
import { Ephemeris, type EphemerisError } from "../../core/Ephemeris.js";
import { computeJwgea } from "../../core/Jwgea.js";
import type { NatalChart } from "./NatalChart.js";

/**
 * Request payload for calculating a natal chart on the fly.
 * Compass strictly uses Western Tropical zodiac and the Porphyry house system.
 */
export class CalculateChartInput extends Schema.Class<CalculateChartInput>(
  "compass/charts/natal/CalculateChartInput",
)({
  whenUtc: Schema.DateTimeUtcFromString,
  latitude: Latitude,
  longitude: Longitude,
}) {}
export type CalculateChartInputType = typeof CalculateChartInput.Type;

export class NatalService extends Context.Service<
  NatalService,
  {
    readonly natal: (input: CalculateChartInputType) => Effect.Effect<NatalChart, EphemerisError>;
  }
>()("compass/charts/natal/NatalService") {
  static readonly layer = Layer.effect(
    NatalService,
    Effect.gen(function* () {
      const ephemeris = yield* Ephemeris;

      const natal = Effect.fn("NatalService.natal")(function* (input: CalculateChartInputType) {
        yield* Effect.logDebug("Calculating natal chart in NatalService", {
          whenUtc: DateTime.formatIso(input.whenUtc),
          latitude: input.latitude,
          longitude: input.longitude,
        });

        const chart = yield* ephemeris.chart(input.whenUtc, input.latitude, input.longitude);
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
        } as const;
      });

      return NatalService.of({
        natal,
      });
    }),
  );

  static readonly testLayer = (stubChart: NatalChart) =>
    Layer.succeed(
      NatalService,
      NatalService.of({
        natal: Effect.fn("NatalService.natalFake")(() => Effect.succeed(stubChart)),
      }),
    );
}
