# 0002 — Strict alignment with Jeffrey Wolf Green Evolutionary Astrology (JWGEA) canon

- **Status:** Accepted
- **Date:** 2026-08-24
- **Deciders:** Erik (Compass)

## Context

Compass was originally conceived as a general astrological CLI tool. As the design evolved, support for non-Evolutionary Astrology branches (such as Horary, Electional, Sidereal/Vedic, alternate house systems like Placidus/Whole Sign, and traditional 7-planet rulerships) raised ambiguity and architectural bloat.

We need a firm, invariant domain boundary for the entire project.

## Decision

1. **Strict JWGEA Alignment**: Compass is exclusively aligned with Jeffrey Wolf Green Evolutionary Astrology (JWGEA). All functionality, chart calculations, temporal overlays, and relationship analyses must directly serve the EA paradigm.
2. **System-wide Invariants**:
   - **Zodiac**: Western Tropical exclusively.
   - **House System**: Porphyry exclusively.
   - **Lunar Nodes**: True Node exclusively (South Node is exact 180° opposition).
   - **Domicile Rulership**: Modern rulership (Scorpio→Pluto, Aquarius→Uranus, Pisces→Neptune).
3. **Exclusions**: Horary astrology, electional charts, mundane astrology without a natal root, sidereal calculations, and customizable house systems are strictly out of scope.
4. **Data Model Simplifications**:
   - Profiles represent individual birth records (Soul incarnations) and do not store house system or zodiac options, since these are system invariants.
   - `CompassChart` is partitioned strictly into JWGEA chart dynamics: `NatalChart`, `ProgressedChart`, `TransitActivation`, `SynastryContacts`, and `CompositeChart`.

## Consequences

- Configuration complexity is drastically minimized across the codebase.
- API inputs no longer need `--houseSystem` or `--zodiac` options.
- The domain vocabulary in `CONTEXT.md` is unified and unambiguous.
