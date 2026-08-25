import type { SynastryAspectHit, SynastryOverlays } from "caelus";
import type { JwgeaCrossContact } from "../../core/Jwgea.js";

/**
 * Synastry chart: inter-chart comparative dynamics between chart A and chart B.
 */
export interface SynastryChart {
  readonly kind: "synastry";
  readonly aspects: readonly SynastryAspectHit[];
  readonly overlays: SynastryOverlays;
  readonly crossContacts: readonly JwgeaCrossContact[];
}
