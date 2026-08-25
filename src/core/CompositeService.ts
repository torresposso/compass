import type { BodyId } from "caelus";
import { Context, DateTime, Effect, Layer } from "effect";
import type { CompositeChart, NatalChart } from "./Charts.js";
import { dateTimeToJulianDay, Ephemeris, type EphemerisError } from "./Ephemeris.js";
import { computeJwgea, houseOfLongitude } from "./Jwgea.js";

export interface CompositeServiceApi {
  readonly composite: (
    chartA: NatalChart,
    chartB: NatalChart,
  ) => Effect.Effect<CompositeChart, EphemerisError>;
}

export class CompositeService extends Context.Service<CompositeService, CompositeServiceApi>()(
  "compass/core/CompositeService",
) {
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

        for (const p of placements) {
          const existing = baseChart.bodies[p.body as BodyId];
          if (existing) {
            existing.lon = p.lon;
            existing.sign = p.sign;
            existing.signDeg = p.signDeg;
            existing.house = houseOfLongitude(p.lon, baseChart.cusps);
          }
        }

        const jwgea = yield* computeJwgea(baseChart);

        return {
          kind: "composite",
          chartAWhenUtc: chartA.whenUtc,
          chartBWhenUtc: chartB.whenUtc,
          chart: baseChart,
          jwgea,
        } as const;
      });

      return CompositeService.of({
        composite,
      });
    }),
  );

  static readonly testLayer = (stubChart: NatalChart) =>
    Layer.succeed(
      CompositeService,
      CompositeService.of({
        composite: Effect.fn("CompositeService.compositeFake")((a, b) =>
          Effect.succeed({
            kind: "composite",
            chartAWhenUtc: a.whenUtc,
            chartBWhenUtc: b.whenUtc,
            chart: stubChart.chart,
            jwgea: stubChart.jwgea,
          }),
        ),
      }),
    );
}
