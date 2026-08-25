import type { Chart, SynastryAspectHit, SynastryOverlays, TransitHit } from "caelus";
import type { DateTime } from "effect";
import type { GeoLocation } from "./Astronomy.js";
import type { JwgeaAnalysis, JwgeaCrossContact, JwgeaEvolutionaryActivation } from "./Jwgea.js";

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

/**
 * Synastry chart: inter-chart comparative dynamics between chart A and chart B.
 */
export interface SynastryChart {
  readonly kind: "synastry";
  readonly aspects: readonly SynastryAspectHit[];
  readonly overlays: SynastryOverlays;
  readonly crossContacts: readonly JwgeaCrossContact[];
}

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

/**
 * Discriminated union of every Compass chart kind.
 */
export type CompassChart =
  | NatalChart
  | ProgressedChart
  | TransitChart
  | SynastryChart
  | CompositeChart;
