import type { BodyId } from "caelus";
import { Context, DateTime, Effect, Layer } from "effect";
import { dateTimeToJulianDay, Ephemeris, type EphemerisError } from "../../core/Ephemeris.js";
import { computeJwgea, houseOfLongitude } from "../../core/Jwgea.js";
import type { NatalChart } from "../natal/NatalChart.js";
import type { CompositeChart } from "./CompositeChart.js";

export class CompositeService extends Context.Service<
  CompositeService,
  {
    readonly composite: (
      chartA: NatalChart,
      chartB: NatalChart,
    ) => Effect.Effect<CompositeChart, EphemerisError>;
  }
>()("compass/charts/composite/CompositeService") {
  static readonly layer = Layer.effect(
    CompositeService,
    Effect.gen(function* () {
      const ephemeris = yield* Ephemeris;

      const composite = Effect.fn("CompositeService.composite")(function* (
        chartA: NatalChart,
        chartB: NatalChart,
      ) {
        yield* Effect.logDebug("Calculating composite chart in CompositeService", {
          chartAWhenUtc: DateTime.formatIso(chartA.whenUtc),
          chartBWhenUtc: DateTime.formatIso(chartB.whenUtc),
        });

        const jdA = dateTimeToJulianDay(chartA.whenUtc);
        const jdB = dateTimeToJulianDay(chartB.whenUtc);

        // Time & place midpoint (Davison method / mid-instant) for house cusps calculation
        const midJd = (jdA + jdB) / 2;
        const midLat = (chartA.location.latitude + chartB.location.latitude) / 2;
        const midLon = (chartA.location.longitude + chartB.location.longitude) / 2;

        const baseChart = yield* ephemeris.chartAt(midJd, midLat, midLon);
        const placements = yield* ephemeris.compositePlacements(jdA, jdB);

        const updatedBodies = { ...baseChart.bodies };

        for (const p of placements) {
          const existing = baseChart.bodies[p.body as BodyId];
          if (existing) {
            updatedBodies[p.body as BodyId] = {
              ...existing,
              lon: p.lon,
              sign: p.sign,
              signDeg: p.signDeg,
              house: houseOfLongitude(p.lon, baseChart.cusps),
            };
          }
        }

        const compositeChart = {
          ...baseChart,
          bodies: updatedBodies,
        };

        const jwgea = yield* computeJwgea(compositeChart);

        return {
          kind: "composite",
          chartAWhenUtc: chartA.whenUtc,
          chartBWhenUtc: chartB.whenUtc,
          chart: compositeChart,
          jwgea,
        } as const;
      });

      return CompositeService.of({
        composite,
      });
    }),
  );
}
