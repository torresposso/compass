# Compass

Deterministic evolutionary astrology chart engine and profile management CLI strictly adhering to the **Jeffrey Wolf Green Evolutionary Astrology (JWGEA)** paradigm.

Built with **[Effect v4](https://effect.website)** for pure functional domain modeling and typed error handling, **[Caelus](https://github.com/)** for astronomical ephemeris calculations, and **[AXI](https://axi.md)** for structured CLI execution.

---

## Core JWGEA Axioms & Invariants

Compass is designed exclusively for Western Evolutionary Astrology. All calculations enforce:
- **Tropical Zodiac** exclusively.
- **Porphyry House System** exclusively (the canonical house division system of JWGEA).
- **True Lunar Node** exclusively (for the nodal axis; South Node is exact 180° opposition).
- **Modern Domicile Rulership** for nodal rulers (Scorpio → Pluto, Aquarius → Uranus, Pisces → Neptune; rest traditional).
- **Intrinsic JWGEA Analysis**: Pluto Polarity Point (PPP = Pluto + 180°), nodal axis, nodal rulers, and skipped steps resolution vector.

---

## Installation & Requirements

- **Runtime:** [Bun](https://bun.sh) (v1.4.0+)

```bash
# Clone the repository
git clone https://github.com/torresposso/compass.git
cd compass

# Install dependencies
bun install
```

---

## CLI Usage

Run directly with Bun or compile to a standalone executable:

```bash
# Run via Bun
bun run bin/compass.ts <command> [arguments] [flags]

# Build standalone binary to dist/compass
bun run build
./dist/compass <command>
```

### 1. Chart Calculations

#### Calculate On-The-Fly
```bash
compass chart calculate --whenUtc "1990-05-15T14:30:00Z" --latitude 4.7110 --longitude -74.0721
```

#### Calculate from Saved Profile
```bash
compass chart natal erik
```

#### Secondary Progressions (Day-for-a-Year)
Recomputes progressed JWGEA evolutionary points relative to the root natal chart:
```bash
compass chart progressed erik --targetUtc "2026-08-25T00:00:00Z"
```

#### Transits & Evolutionary Activations
Evaluates transit hits and activations against the natal Pluto, Nodal Axis, PPP, and Skipped Steps:
```bash
compass chart transits erik --transitUtc "2026-08-25T18:00:00Z"
```

#### Synastry (Relationship Cross-Contacts)
Compares two profiles and computes inter-chart aspects and evolutionary cross-contacts:
```bash
compass chart synastry erik partner
```

#### Composite Chart (Midpoint Entity)
Calculates derived relationship midpoint chart with its own recomputed composite JWGEA analysis:
```bash
compass chart composite erik partner
```

---

### 2. Profile Management

Birth profiles are stored atomically in `~/.config/compass/profiles.json`.

```bash
# Add a birth profile
compass profile add --slug erik --name "Erik" --whenUtc "1990-05-15T14:30:00Z" --latitude 4.7110 --longitude -74.0721

# List all saved profiles
compass profile list

# Get profile details
compass profile get erik

# Delete a profile
compass profile delete erik
```

---

## Development & Quality Gates

```bash
# Run unit & integration test suite (37 tests across core and chart services)
bun test

# Typecheck with TypeScript (zero errors)
bun run typecheck

# Check code formatting and linter with Biome
bun run check
bun run check:write
```

---

## Architecture & Documentation

- [`CONTEXT.md`](CONTEXT.md) — Canonical domain glossary and vocabulary.
- [`docs/adr/`](docs/adr/) — Architecture Decision Records:
  - [0001: JWGEA scope, nodal basis, modern rulership, tropical-only & Porphyry houses](docs/adr/0001-jwgea-scope.md)
  - [0002: Strict JWGEA canon & system-wide invariants](docs/adr/0002-strict-jwgea-canon.md)
  - [0003: Seam consolidation, error taxonomy, lunar node canonicalization, lazy data loading](docs/adr/0003-refactor-structure.md)
  - [0004: Chart-kind module layout (`src/charts/<kind>/`)](docs/adr/0004-chart-kind-module-layout.md)
- [`docs/research/jwgea-scope.md`](docs/research/jwgea-scope.md) — Research and literature citations on JWGEA chart dynamics.
- [`AGENTS.md`](AGENTS.md) — Effect v4 guidelines and agent skill pointers.

