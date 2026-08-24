# 0001 — JWGEA scope, nodal basis, modern rulership & tropical-only

- **Status:** Accepted
- **Date:** 2026-08-24
- **Deciders:** Erik (Compass)

## Context

Phase 2 introduces JWGEA (Jeffrey Wolf Green Evolutionary Astrology) analysis
into the natal chart pipeline. Several domain questions had no obvious
engineering answer and would surprise a future reader:

1. Which chart types carry JWGEA?
2. True node vs mean node as the basis of the nodal axis?
3. Traditional (7-planet) vs modern (outer-planet) domicile rulership?
4. Tropical vs sidereal zodiac?

## Decision

- **JWGEA is intrinsic to the natal chart.** Every natal chart carries its full
  analysis (`jwgea` is a required field on `NatalChart`, not optional). The
  `includeJwgea` flag was removed.
- **Nodal axis uses the TRUE node** (not the mean node). The South Node is the
  true node's opposition (longitude + 180°).
- **Modern domicile rulership** resolves the nodal rulers: Scorpio→Pluto,
  Aquarius→Uranus, Pisces→Neptune; the remaining signs keep their traditional
  rulers. (Caelus only ships the traditional `SIGN_RULERS`, so Compass defines
  its own `MODERN_SIGN_RULERS`.)
- **Compass is tropical-only.** The `zodiac` parameter was removed from the
  input; vedic/sidereal is explicitly out of scope.

## Consequences

- `src/core/jwgea.ts` is a pure function `computeJwgea(chart)`; `natal.ts`
  calls it and always attaches the result.
- A chart without Pluto (outside Caelus' validated ephemeris range) cannot
  yield JWGEA and surfaces as an `EphemerisError`.
- For **progressed** charts (later phases) JWGEA is recomputed from progressed
  positions; **transits** expose the transiting nodes against the natal JWGEA
  rather than a standalone PPP; **synastry** keeps each person's natal JWGEA and
  computes cross-contacts. See `docs/research/jwgea-scope.md`.
