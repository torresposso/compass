import { progressedJd } from "caelus";
import { Context, DateTime, Effect, Layer } from "effect";
import type { NatalChart, ProgressedChart } from "./Charts.js";
import { dateTimeToJulianDay, Ephemeris, type EphemerisError } from "./Ephemeris.js";
import { computeJwgea } from "./Jwgea.js";

export class ProgressedService extends Context.Service<
  ProgressedService,
  {
    readonly progressed: (
      natal: NatalChart,
      targetUtc: DateTime.Utc,
    ) => Effect.Effect<ProgressedChart, EphemerisError>;
  }
>()("compass/core/ProgressedService") {
  static readonly layer = Layer.effect(
    ProgressedService,
    Effect.gen(function* () {
      const ephemeris = yield* Ephemeris;

      const progressed = Effect.fn("ProgressedService.progressed")(function* (
        natal: NatalChart,
        targetUtc: DateTime.Utc,
      ) {
        yield* Effect.logDebug("Calculating progressed chart in ProgressedService", {
          rootNatalWhenUtc: DateTime.formatIso(natal.whenUtc),
          targetUtc: DateTime.formatIso(targetUtc),
        });

        const natalJd = dateTimeToJulianDay(natal.whenUtc);
        const targetJd = dateTimeToJulianDay(targetUtc);
        const progJd = progressedJd(natalJd, targetJd);

        const progChart = yield* ephemeris.chartAt(
          progJd,
          natal.location.latitude,
          natal.location.longitude,
        );
        const jwgea = yield* computeJwgea(progChart);

        return {
          kind: "progressed",
          rootNatalWhenUtc: natal.whenUtc,
          targetUtc,
          location: natal.location,
          chart: progChart,
          jwgea,
        } as const;
      });

      return ProgressedService.of({
        progressed,
      });
    }),
  );
}
