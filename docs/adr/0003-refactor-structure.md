# 0003 — Seam consolidation, error taxonomy simplification, lunar node canonicalization, and lazy data loading

- **Status:** Accepted
- **Date:** 2026-08-25
- **Deciders:** Erik (Compass)

## Context

Following the initial MVP implementation of Compass, several architectural seams, domain models, and CLI handlers contained redundancies, loose error unions, potential mutation side-effects, and eagerly loaded multi-megabyte ephemeris data:

1. `Ephemeris` and `SynastryService` used repetitive manual `try/catch` blocks rather than idiomatic Effect v4 `Effect.try`.
2. Synastry calculations bypassed `EphemerisService`, creating inconsistent layer dependencies.
3. Sub-second precision was truncated in Julian Day conversion.
4. `ValidationError` and `DomainError` duplicated native `Schema.isSchemaError` validation in the CLI bridge.
5. Inconsistent body identifiers (`north_node`/`south_node` vs `true_node`) created dead branches across transit calculations and AST schemas.
6. `CompositeService` mutated `baseChart.bodies` in-place.
7. Ephemeris data JSON was evaluated synchronously at startup rather than lazily when chart calculations were requested.

## Decision

1. **Ephemeris Seam & Effect v4 Idioms**:
   - Consolidated all Caelus calls behind `EphemerisService` using `Effect.try({ try, catch })` mapped to `EphemerisError`.
   - Synastry operations (`synastryAspects`, `synastryOverlays`) are routed through `EphemerisService`, and `SynastryService.layer` depends on `Ephemeris` via `Layer.effect`.
   - Fixed millisecond precision in `dateTimeToJulianDay` (`parts.second + parts.millisecond / 1000`).
   - Standardized chart options invariant `CHART_OPTIONS` (`houseSystem: "porphyry"`, `zodiac: "tropical"`, `bodies: ["true_lilith"]`).
   - Exposed fast-path `longitude(body, jd)` in `EphemerisService` for transit PPP evaluations.
   - Dynamic lazy-loading of ephemeris embedded data in `Ephemeris.layer` (`yield* Effect.promise(() => import("caelus/data-embedded"))`).

2. **Error Taxonomy Simplification**:
   - Removed `ValidationError` and `DomainError`. All input parsing and argument validation are handled natively by Effect `Schema` (`Schema.isSchemaError` in `Bridge.ts`).
   - Retained specific domain errors: `EphemerisError`, `ProfileNotFoundError`, `ProfileAlreadyExistsError`, and `DatabaseError`.

3. **Lunar Nodes & Body Canonicalization**:
   - Canonicalized `NODE_BODY_IDS` to `["true_node", "mean_node"]`.
   - In JWGEA, the True South Node is strictly derived as `(true_node.lon + 180) % 360` and directional resolution in `JwgeaSkippedStep.resolvedVia` remains `["north_node", "south_node"]`.
   - Purged dead `"north_node"` / `"south_node"` conditions in `TransitsService` and closed `CelestialBody` to `[...BODIES, ...EXTRA_BODIES]`.

4. **Immutability & Pure Functions**:
   - `CompositeService` constructs a new `Chart` instance and shallow-copies `bodies` placements, preventing side-effect mutations on base charts.
   - `houseOfLongitude` and `computeJwgea` strictly validate house cusps (requiring 12 cusps) and use `Option.match` for safe dictionary lookups.
   - Closed aspect schemas (`AstrologicalAspect`, `JwgeaCrossContact.targetPoint`, `JwgeaEvolutionaryActivation.target`).

5. **CLI Deduplication**:
   - Extracted `natalFromProfile(slug)` and `renderChartView(result)` in `ChartCommands.ts`.
   - Shared `ProfileSlugInput` between chart commands and profile commands in `src/cli/Commands/shared.ts`.
   - Removed `NatalLive` and built all commands directly with `CompassLive`.

## Consequences

- Startup time and memory footprint for non-chart commands (`ping`, `profile list/get/delete`, `--help`, `--version`) are reduced by deferring ephemeris JSON parsing.
- Error reporting is unified and transparent across the CLI bridge.
- All core chart services follow consistent Effect v4 service patterns and deep module boundaries.
