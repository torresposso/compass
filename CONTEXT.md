# Compass Domain Glossary

This document defines the canonical domain vocabulary for Compass, a deterministic evolutionary astrology chart engine and profile management CLI strictly adhering to the Jeffrey Wolf Green Evolutionary Astrology (JWGEA) paradigm.

## Core Axiom: Strict Evolutionary Astrology Alignment

Compass is exclusively designed for Western Evolutionary Astrology (JWGEA). All concepts, calculations, and chart interpretations are governed by this school. Techniques, house systems, zodiacs, or astrological branches outside of JWGEA (such as Horary, Electional, Vedic/Sidereal, or traditional 7-planet rulerships) are explicitly out of scope.

---

## Core Concepts

### Chart
An astronomical chart calculated for a specific UTC date/time and geographic observer position, containing planetary positions, houses, angles, and aspect relationships computed via Caelus. In Compass, every chart is computed using:
- **Tropical Zodiac** exclusively (Western).
- **Porphyry House System** exclusively (the canonical house division system of JWGEA).
- **True Lunar Node** exclusively (for the nodal axis).

### Chart Services (Chart Engine)
The domain calculation services providing deterministic chart computation and JWGEA evolutionary analysis. Each astrological chart dynamic is realized via a dedicated chart kind service (`NatalService`, `ProgressedService`, `TransitsService`, `SynastryService`, `CompositeService`) sharing a common `Ephemeris` seam.

### GeoLocation
A geographic observer location represented by validated `Latitude` ([-90, +90]) and `Longitude` ([-180, +180]) coordinates.

### JWGEA Analysis
Evolutionary astrology metadata derived from a chart. In JWGEA, this represents the structural state and growth vector of the Soul. Every natal chart carries this analysis intrinsically.

The core components are:
- **Pluto Polarity Point (PPP)**: Pluto's ecliptic longitude + 180° (the evolutionary growth direction for the current lifetime).
- **Nodal Axis**: The **True North Node** and the **True South Node** (South Node = North Node + 180°).
- **Nodal Rulers**: The modern domicile planetary rulers of the signs occupied by the North and South nodes (Scorpio→Pluto, Aquarius→Uranus, Pisces→Neptune; the rest traditional).
- **Skipped Steps**: Planets forming a square (90° ± orb) to the nodal axis, representing past evolutionary lessons that must be resolved.

### Profile
A persisted individual birth record (the incarnation blueprint of a Soul) identified by a unique, immutable `ProfileSlug`. A Profile contains:
- `name`: Display name of the person.
- `whenUtc`: Exact UTC birth timestamp.
- `location`: Birth `GeoLocation` (`latitude`, `longitude`).

*(Note: House system and zodiac preferences are omitted from Profile because Porphyry and Tropical are system invariants).*

---

## Chart Kinds & Temporal/Relational Dynamics

### NatalChart
The foundational soul blueprint for an individual birth instant. Always carries its full `jwgea` analysis.

### ProgressedChart
The secondary progression of a natal chart over time. Recomputes its own `jwgea` analysis from progressed positions, interpreted relative to the root `NatalChart`.

### TransitChart
Planetary transits at a given instant evaluated strictly against a root `NatalChart`. Transits do not carry a standalone PPP; instead, they expose transiting nodes and planets triggering the natal PPP, nodal axis, and skipped steps.

### SynastryChart
An inter-chart comparison between two individual `NatalChart` blueprints, detecting cross-contacts (such as partner planets squaring the other's nodes or contacting Pluto/PPP) and house overlays.

### CompositeChart
A derived midpoint chart representing the relationship entity itself. Carries its own recomputed `jwgea` analysis (Composite Pluto → Composite PPP, Composite Nodal Axis, etc.).
