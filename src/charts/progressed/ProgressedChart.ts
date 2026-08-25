import type { Chart } from "caelus";
import type { DateTime } from "effect";
import type { GeoLocation } from "../../core/Astronomy.js";
import type { JwgeaAnalysis } from "../../core/Jwgea.js";

/**
 * Progressed chart: secondary progression of a natal chart over time (day for a year).
 */
export interface ProgressedChart {
  readonly kind: "progressed";
  readonly rootNatalWhenUtc: DateTime.Utc;
  readonly targetUtc: DateTime.Utc;
  readonly location: GeoLocation;
  readonly chart: Chart;
  readonly jwgea: JwgeaAnalysis;
}
