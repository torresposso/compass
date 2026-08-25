import { Context, DateTime, Effect, Layer } from "effect";
import type { CelestialBody } from "../../core/Astronomy.js";
import { Ephemeris, type EphemerisError } from "../../core/Ephemeris.js";
import { type AstrologicalAspect, JwgeaCrossContact } from "../../core/Jwgea.js";
import type { NatalChart } from "../natal/NatalChart.js";
import type { SynastryChart } from "./SynastryChart.js";

export class SynastryService extends Context.Service<
  SynastryService,
  {
    readonly synastry: (
      chartA: NatalChart,
      chartB: NatalChart,
    ) => Effect.Effect<SynastryChart, EphemerisError>;
  }
>()("compass/charts/synastry/SynastryService") {
  static readonly layer = Layer.effect(
    SynastryService,
    Effect.gen(function* () {
      const ephemeris = yield* Ephemeris;

      const synastry = Effect.fn("SynastryService.synastry")(function* (
        chartA: NatalChart,
        chartB: NatalChart,
      ) {
        yield* Effect.logDebug("Calculating synastry in SynastryService", {
          chartAWhenUtc: DateTime.formatIso(chartA.whenUtc),
          chartBWhenUtc: DateTime.formatIso(chartB.whenUtc),
        });

        const aspects = yield* ephemeris.synastryAspects(chartA.chart, chartB.chart);
        const overlays = yield* ephemeris.synastryOverlays(chartA.chart, chartB.chart);

        const crossContacts: JwgeaCrossContact[] = [];

        for (const aspect of aspects) {
          // Cross contacts to Pluto / Nodes / Skipped steps
          if (aspect.b === "pluto" || aspect.b === "true_node") {
            crossContacts.push(
              new JwgeaCrossContact({
                sourceBody: aspect.a as CelestialBody,
                targetPoint: aspect.b,
                aspect: aspect.aspect as AstrologicalAspect,
                orb: aspect.orb,
              }),
            );
          }
          if (aspect.a === "pluto" || aspect.a === "true_node") {
            crossContacts.push(
              new JwgeaCrossContact({
                sourceBody: aspect.b as CelestialBody,
                targetPoint: aspect.a,
                aspect: aspect.aspect as AstrologicalAspect,
                orb: aspect.orb,
              }),
            );
          }
        }

        return {
          kind: "synastry",
          aspects,
          overlays,
          crossContacts,
        } as const;
      });

      return SynastryService.of({
        synastry,
      });
    }),
  );
}
