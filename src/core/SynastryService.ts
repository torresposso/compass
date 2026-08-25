import { synastryAspects, synastryOverlays } from "caelus";
import { Context, DateTime, Effect, Layer, Predicate } from "effect";
import type { CelestialBody } from "./Astronomy.js";
import type { NatalChart, SynastryChart } from "./Charts.js";
import { EphemerisError } from "./Ephemeris.js";
import { JwgeaCrossContact } from "./Jwgea.js";

export interface SynastryServiceApi {
  readonly synastry: (
    chartA: NatalChart,
    chartB: NatalChart,
  ) => Effect.Effect<SynastryChart, EphemerisError>;
}

export class SynastryService extends Context.Service<SynastryService, SynastryServiceApi>()(
  "compass/core/SynastryService",
) {
  static readonly layer = Layer.sync(SynastryService, () => {
    const synastry = Effect.fn("SynastryService.synastry")(function* (
      chartA: NatalChart,
      chartB: NatalChart,
    ) {
      yield* Effect.logDebug("Calculating synastry in SynastryService", {
        chartAWhenUtc: DateTime.formatIso(chartA.whenUtc),
        chartBWhenUtc: DateTime.formatIso(chartB.whenUtc),
      });

      let aspects: ReturnType<typeof synastryAspects>;
      let overlays: ReturnType<typeof synastryOverlays>;

      try {
        aspects = synastryAspects(chartA.chart, chartB.chart, 6);
        overlays = synastryOverlays(chartA.chart, chartB.chart);
      } catch (err) {
        return yield* new EphemerisError({
          message: Predicate.isError(err) ? err.message : String(err),
        });
      }

      const crossContacts: JwgeaCrossContact[] = [];

      for (const aspect of aspects) {
        // Cross contacts to Pluto / Nodes / Skipped steps
        if (aspect.b === "pluto" || aspect.b === "true_node") {
          crossContacts.push(
            new JwgeaCrossContact({
              sourceBody: aspect.a as CelestialBody,
              targetPoint: aspect.b,
              aspect: aspect.aspect,
              orb: aspect.orb,
            }),
          );
        }
        if (aspect.a === "pluto" || aspect.a === "true_node") {
          crossContacts.push(
            new JwgeaCrossContact({
              sourceBody: aspect.b as CelestialBody,
              targetPoint: aspect.a,
              aspect: aspect.aspect,
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
  });

  static readonly testLayer = Layer.succeed(
    SynastryService,
    SynastryService.of({
      synastry: Effect.fn("SynastryService.synastryFake")(() =>
        Effect.succeed({
          kind: "synastry",
          aspects: [],
          overlays: { aInB: {}, bInA: {} },
          crossContacts: [],
        }),
      ),
    }),
  );
}
