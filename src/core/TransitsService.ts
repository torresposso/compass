import type { BodyId } from "caelus";
import { Context, DateTime, Effect, Layer } from "effect";
import type { CelestialBody } from "./Astronomy.js";
import type { NatalChart, TransitChart } from "./Charts.js";
import { dateTimeToJulianDay, Ephemeris, type EphemerisError } from "./Ephemeris.js";
import {
  type AstrologicalAspect,
  angularSeparation,
  JwgeaEvolutionaryActivation,
} from "./Jwgea.js";

export class TransitsService extends Context.Service<
  TransitsService,
  {
    readonly transits: (
      natal: NatalChart,
      transitUtc: DateTime.Utc,
    ) => Effect.Effect<TransitChart, EphemerisError>;
  }
>()("compass/core/TransitsService") {
  static readonly layer = Layer.effect(
    TransitsService,
    Effect.gen(function* () {
      const ephemeris = yield* Ephemeris;

      const transits = Effect.fn("TransitsService.transits")(function* (
        natal: NatalChart,
        transitUtc: DateTime.Utc,
      ) {
        yield* Effect.logDebug("Calculating transits in TransitsService", {
          natalWhenUtc: DateTime.formatIso(natal.whenUtc),
          transitUtc: DateTime.formatIso(transitUtc),
        });

        const transitJd = dateTimeToJulianDay(transitUtc);
        const hits = yield* ephemeris.transitAspects(natal.chart, transitJd);

        const jwgeaActivations: JwgeaEvolutionaryActivation[] = [];
        const pppLon = natal.jwgea.plutoPolarityPoint.longitude;

        // Evaluate transits directly hitting natal evolutionary points
        for (const hit of hits) {
          if (hit.natal === "pluto") {
            jwgeaActivations.push(
              new JwgeaEvolutionaryActivation({
                transitBody: hit.transit as CelestialBody,
                target: "pluto",
                aspect: hit.aspect as AstrologicalAspect,
                orb: hit.orb,
              }),
            );
          } else if (hit.natal === "true_node") {
            jwgeaActivations.push(
              new JwgeaEvolutionaryActivation({
                transitBody: hit.transit as CelestialBody,
                target: "north_node",
                aspect: hit.aspect as AstrologicalAspect,
                orb: hit.orb,
              }),
            );
          } else if (natal.jwgea.skippedSteps.some((s) => s.body === hit.natal)) {
            jwgeaActivations.push(
              new JwgeaEvolutionaryActivation({
                transitBody: hit.transit as CelestialBody,
                target: "skipped_step",
                aspect: hit.aspect as AstrologicalAspect,
                orb: hit.orb,
              }),
            );
          }
        }

        // Also check transits directly to PPP (which is not a default Caelus aspectable body)
        for (const [id, body] of Object.entries(natal.chart.bodies)) {
          if (!body) continue;
          const transitBodyLon = yield* ephemeris.longitude(id as BodyId, transitJd);

          const sep = angularSeparation(transitBodyLon, pppLon);
          if (sep <= 3) {
            jwgeaActivations.push(
              new JwgeaEvolutionaryActivation({
                transitBody: id as CelestialBody,
                target: "ppp",
                aspect: "conjunction",
                orb: sep,
              }),
            );
          } else if (Math.abs(sep - 180) <= 3) {
            jwgeaActivations.push(
              new JwgeaEvolutionaryActivation({
                transitBody: id as CelestialBody,
                target: "ppp",
                aspect: "opposition",
                orb: Math.abs(sep - 180),
              }),
            );
          }
        }

        return {
          kind: "transits",
          natalWhenUtc: natal.whenUtc,
          transitUtc,
          hits,
          jwgeaActivations,
        } as const;
      });

      return TransitsService.of({
        transits,
      });
    }),
  );
}
