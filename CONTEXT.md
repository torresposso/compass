# Compass Domain Glossary

This document defines the canonical domain vocabulary for Compass, a deterministic astrological chart engine and profile management CLI.

## Core Concepts

### Chart
An astrological chart calculated for a specific UTC date/time and geographic observer position, containing planetary positions, houses, angles, and aspect relationships computed via Caelus.

### ChartEngine
The core calculation module providing chart computation, house normalization, and JWGEA (Jeffrey Wolf Green Evolutionary Astrology) evolutionary analysis behind a unified interface.

### GeoLocation
A geographic observer location represented by validated `Latitude` ([-90, +90]) and `Longitude` ([-180, +180]) coordinates.

### JWGEA Analysis
Jeffrey Wolf Green Evolutionary Astrology metadata derived from a chart. Compass is **Western/tropical only** (never vedic/sidereal), and JWGEA is **intrinsic to the natal chart** — every natal chart carries its full analysis.

The analysis comprises:
- **Pluto Polarity Point (PPP)**: Pluto's ecliptic longitude + 180°.
- **Nodal axis**: the **true** North Node (South Node is its opposition, longitude + 180°).
- **Nodal rulers**: the **modern** domicile ruler of the sign each node occupies (Scorpio→Pluto, Aquarius→Uranus, Pisces→Neptune; the rest traditional).
- **Skipped steps**: planets forming a square (90°) to the nodal axis (via the chart's aspect list against the true node).

See `docs/adr/0001-jwgea-scope.md` for the rationale and for how JWGEA extends to progressed/transit/synastry charts in later phases.

### Profile
A persisted birth record identified by a validated `ProfileSlug` containing birth date/time, geographic coordinates, and default house system preferences.
