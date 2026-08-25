import type { Chart } from "caelus";
import type { DateTime } from "effect";
import type { GeoLocation } from "../../core/Astronomy.js";
import type { JwgeaAnalysis } from "../../core/Jwgea.js";

/**
 * Natal chart: the foundational soul blueprint for an individual birth instant.
 */
export interface NatalChart {
  readonly kind: "natal";
  readonly whenUtc: DateTime.Utc;
  readonly location: GeoLocation;
  readonly chart: Chart;
  readonly jwgea: JwgeaAnalysis;
}
