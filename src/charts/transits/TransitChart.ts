import type { TransitHit } from "caelus";
import type { DateTime } from "effect";
import type { JwgeaEvolutionaryActivation } from "../../core/Jwgea.js";

/**
 * Transit chart: active transits evaluated against a root natal chart.
 */
export interface TransitChart {
  readonly kind: "transits";
  readonly natalWhenUtc: DateTime.Utc;
  readonly transitUtc: DateTime.Utc;
  readonly hits: readonly TransitHit[];
  readonly jwgeaActivations: readonly JwgeaEvolutionaryActivation[];
}
