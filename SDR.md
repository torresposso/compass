# SDR — Compass CLI
**System Design & Requirements Document**

- **Project Name:** Compass
- **Type:** Astrological Chart Engine & Profile Management CLI
- **Location:** `/home/erik/Projects/clis/compass`
- **Status:** Audited / Ready for Implementation

---

## 1. Executive Summary & Vision

**Compass** is a deterministic astrological computation engine and profile manager designed from the ground up as an [AXI](https://axi.md/)-compliant CLI. It leverages **Effect v4** (`effect@rc`) for pure functional composition, explicit dependency management (`Context.Tag` & `Layer`), and typed error handling (`Schema.TaggedError`), combined with **Caelus** (`caelus@0.24.1`) for astronomical ephemeris calculations.

Unlike previous iterations (`lumen`, `astrolabio`), Compass avoids legacy baggage, redundant conversion layers, and early over-abstractions. It applies strict "Functional Core, Imperative Shell" architecture with zero-boilerplate bridging to AXI.

---

## 2. Core Architectural Pillars

```
┌──────────────────────────────────────────────────────────┐
│                   AXI CLI Shell                          │
│  (axi-sdk-js, arguments parsing, envelope formatting)    │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│                  Effect Runtime Bridge                   │
│   (runEffectToAxi: Exit -> AXI Result / Typed AxiError)  │
└────────────────────────────┬─────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌───────────────────────────────┐ ┌────────────────────────┐
│     Pure Domain / Engine      │ │   Services & Layers    │
│  (Caelus wrapper, Chart Math, │ │ (bun:sqlite Database,  │
│   Aspects, Patterns, JWGEA)   │ │  ProfileStore Layer)   │
└───────────────────────────────┘ └────────────────────────┘
```

1. **Pure Functional Core:**
   - Calculations (Julian Days, Planetary Positions, House Cusps, Aspects, Patterns, JWGEA Evolutionary points) are pure functions returning `Effect.Effect<A, E, R>`.
   - Data models, input parsing, and domain validations are expressed using native **Effect Schema** (`import { Schema } from "effect"`).

2. **Explicit Dependency Inversion:**
   - External dependencies (SQLite Database, File System, Config) are defined as Service Tags (`Context.Tag`) and provided via composable `Layer`s.
   - Database operations use native `bun:sqlite` wrapped in pure Effect Resource/Layer scopes.
   - Core astronomical engine calculations are completely decoupled from storage and presentation.

3. **AXI-Native Protocol:**
   - All commands emit valid AXI responses (JSON envelopes, structured terminal output, typed exit codes).
   - Standardized AXI error mapping (`VALIDATION_ERROR`, `NOT_FOUND`, `ENGINE_ERROR`, `DATABASE_ERROR`).

---

## 3. Technology Stack & Dependencies

- **Runtime & Package Manager:** [Bun](https://bun.sh) (v1.4.0+)
- **Language:** TypeScript 7.x (Strict mode)
- **Functional Framework:** `effect` (`^4.0.0-rc.111`) — includes native `Schema`, `DateTime`, and `TaggedError`
- **Astronomical Engine:** `caelus` (`^0.24.1`) — includes `embeddedData`, `relational`, `patterns`, `lots`
- **CLI Framework:** `axi-sdk-js` (`^0.1.11`)
- **Persistence:** `bun:sqlite` with native Effect Layer wrapper
- **Linter & Formatter:** `@biomejs/biome` (`^2.5.10`)

---

## 4. Directory & Module Structure

```
compass/
├── bin/
│   └── compass.ts             # CLI binary entrypoint (runAxiCli)
├── src/
│   ├── index.ts               # Library exports
│   ├── core/                  # Pure domain and astronomical engine
│   │   ├── types.ts           # Domain models & Schemas (Planets, Houses, Aspects, Chart)
│   │   ├── errors.ts          # Schema.TaggedError domain error classes
│   │   ├── engine.ts          # Caelus Engine instance & pure ephemeris wrappers
│   │   ├── chart.ts           # Natal chart calculations & formatting
│   │   ├── relational.ts      # Synastry, transit hits, and composite charts
│   │   └── jwgea.ts           # Jeffrey Wolf Green Evolutionary Astrology (PPP, Nodal rulers, Skipped steps)
│   ├── services/              # Effect Services & Live Layers
│   │   ├── Database.ts        # bun:sqlite connection Tag & Layer
│   │   └── ProfileStore.ts    # Birth profile CRUD Service & Layer
│   └── cli/                   # AXI CLI interface
│       ├── bridge.ts          # Generic Effect-to-AXI command executor (runEffectToAxi)
│       ├── formatters.ts      # TOON / terminal formatters
│       ├── commands/
│       │   ├── chart.ts       # `compass chart ...` (calculate, natal, transits, synastry, patterns)
│       │   └── profile.ts     # `compass profile ...` (add, list, get, delete)
│       └── app.ts             # AXI App & Command router definition
├── docs/                      # Documentation
├── tests/                     # Unit & integration tests
├── biome.json
├── package.json
├── tsconfig.json
└── SDR.md                     # System Design & Requirements (This file)
```

---

## 5. Domain Model & Calculations

### 5.1 Celestial Entities & Capabilities (via Caelus & Compass Engine)
- **Bodies:** Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Chiron, True North Node (`true_node`), True South Node (`south_node` derived at 180° opposition), Lilith (`mean_lilith` / `true_lilith`).
- **Houses Systems:** Placidus (default), Whole Sign, Koch, Equal, Regiomontanus, Porphyry, Campanus, Alcabitius, Morinus, Meridian, Polich-Page, Vehlow.
- **Angles:** Ascendant (ASC), Midheaven (MC), Vertex, East Point.
- **Dignities:** Domicile, Exaltation, Detriment, Fall (evaluated natively).
- **Aspects:** Conjunction (0°), Sextile (60°), Square (90°), Trine (120°), Opposition (180°), Quincunx (150°), with phase (`applying` / `separating`) and strength metrics (`0..1`).
- **Geometric Patterns:** T-Square, Grand Trine, Grand Cross, Yod, Kite, Mystic Rectangle, Stelliums (by sign and house).
- **Evolutionary Astrology (JWGEA):**
  - Pluto Polarity Point (PPP = `(pluto.lon + 180) % 360`).
  - True Nodal Axis & nodal rulers (sign lord of North Node and South Node).
  - Skipped steps (planets forming square aspects with the nodal axis within tight orbs).
  - Planetary nodes analysis.

### 5.2 Error Taxonomy (Typed Errors via `Schema.TaggedError`)
- `ValidationError`: Invalid input date/time, lat/lon coordinates, or CLI arguments.
- `ProfileNotFoundError`: Profile slug/identifier not found in SQLite store.
- `ProfileAlreadyExistsError`: Profile slug conflict on insertion.
- `EphemerisError`: Astronomical calculation failure or out-of-range date.
- `DatabaseError`: Persistence/SQLite query execution failure.

---

## 6. CLI Command Specifications

### 6.1 Ephemeral Calculations (No DB required)
* `compass chart calculate --when "<ISO-or-DateTime>" --lat <float> --lon <float> [--house-system <system>]`
  * Computes planetary positions, house cusps, angles, aspects, and JWGEA points on the fly.

### 6.2 Profile Management
* `compass profile add --name <slug> --when "<datetime>" --where "<location>" [--lat <float> --lon <float>] [--timezone "<tz>"] [--notes "<text>"]`
* `compass profile list`
* `compass profile get <name>`
* `compass profile delete <name>`

### 6.3 Profile-Based Charts & Analysis
* `compass chart natal <name> [--house-system <system>]`
* `compass chart transits <name> --when "<datetime>"`
* `compass chart synastry <name1> <name2>`
* `compass chart patterns <name>`
* `compass chart jwgea <name>`

---

## 7. Persistence Schema (SQLite via `bun:sqlite`)

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  birth_time TEXT NOT NULL,       -- ISO 8601 UTC
  timezone TEXT NOT NULL,         -- e.g. "America/Bogota"
  location_name TEXT NOT NULL,    -- e.g. "Bogota, Colombia"
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name);
```

---

## 8. Phased Implementation Roadmap

```
Phase 1 (Foundation & Bridge) ──► Phase 2 (Core Engine & JWGEA) ──► Phase 3 (Profile Persistence) ──► Phase 4 (Relational & Patterns) ──► Phase 5 (TOON & Polish)
• Effect v4 + AXI Bridge         • Caelus Engine Wrapper          • bun:sqlite Service & Layer     • Synastry & Transits Hits           • TOON Formatted Output
• Schemas & TaggedErrors         • JWGEA Core (PPP, Nodes)        • Profile CRUD Operations        • Geometric Patterns Detection       • Binary Compile & Tests
• Project Config Baseline        • `chart calculate` Command      • `chart natal <name>` Command   • `synastry` & `transits` Commands
```

### **Phase 1: Project Setup, Schemas & AXI Bridge**
1. Baseline configuration (`tsconfig.json`, `biome.json`, `package.json`).
2. Implement `src/core/errors.ts` (`ValidationError`, `EphemerisError`, `ProfileNotFoundError`, `DatabaseError`).
3. Implement `src/core/types.ts` & `src/core/schema.ts` (Effect Schema for coordinates, dates, bodies, aspects).
4. Implement `src/cli/bridge.ts` (`runEffectToAxi` mapping `Exit` to AXI results or `AxiError`).

### **Phase 2: Astronomical Engine & Ephemeral Calculations**
1. Implement `src/core/engine.ts` using `caelus` with `embeddedData`.
2. Implement `src/core/chart.ts` (natal calculation pipeline).
3. Implement `src/core/jwgea.ts` (PPP, South/North node axes, nodal rulers, skipped steps).
4. Implement `src/cli/commands/chart.ts` with `compass chart calculate`.

### **Phase 3: Persistent Storage & Profile Management**
1. Implement `src/services/Database.ts` wrapping `bun:sqlite` as an Effect `Layer`.
2. Implement `src/services/ProfileStore.ts` with CRUD operations.
3. Implement `src/cli/commands/profile.ts` (`add`, `list`, `get`, `delete`).
4. Connect `compass chart natal <name>`.

### **Phase 4: Relational Astrology, Transits & Patterns**
1. Implement `src/core/relational.ts` wrapping `caelus` synastry, transit hits, and composite charts.
2. Implement pattern detection integrations (`src/core/patterns.ts`).
3. Expose `compass chart transits`, `compass chart synastry`, and `compass chart patterns`.

### **Phase 5: Output Rendering, Standalone Binary & Quality Assurance**
1. Implement `src/cli/formatters.ts` (human-readable TOON/terminal charts).
2. Comprehensive unit & integration tests (`bun test`).
3. Standalone executable compilation (`bun build --compile`).

---

## 9. Verification & Quality Gates
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`) passes with zero errors.
- **Lint & Format:** `bun run check` (`biome check .`) passes cleanly.
- **Tests:** `bun test` covering ephemeris determinism, profile CRUD, and AXI bridge behavior.
- **AXI Compliance:** All CLI outputs strictly comply with AXI envelopes and error codes.

