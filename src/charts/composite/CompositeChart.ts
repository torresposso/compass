import type { Chart } from "caelus";
import type { DateTime } from "effect";
import type { JwgeaAnalysis } from "../../core/Jwgea.js";

/**
 * Composite chart: relationship entity midpoint chart with recomputed JWGEA analysis.
 */
export interface CompositeChart {
  readonly kind: "composite";
  readonly chartAWhenUtc: DateTime.Utc;
  readonly chartBWhenUtc: DateTime.Utc;
  readonly chart: Chart;
  readonly jwgea: JwgeaAnalysis;
}
