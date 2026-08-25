# 0004 — Chart-kind module layout: un directorio por chart kind, seams compartidos en core

- **Status:** Accepted
- **Date:** 2026-08-25
- **Deciders:** Erik (Compass)

## Context

`src/core/` creció fase a fase como un cajón plano donde convivían todos los servicios de cálculo (`NatalService`, `ProgressedService`, `TransitsService`, `SynastryService`, `CompositeService`) y un archivo `Charts.ts` que agrupaba todas las interfaces de resultado.

La convención Effect v4 de identifiers codifica la ruta completa del paquete y subdirectorio (`package name + subdirectory path + ServiceName`). Con un layout plano por tipo de archivo, los traces de runtime no permitían localizar inmediatamente el módulo funcional responsable. Además, existía una unión discriminada `CompassChart` en `Charts.ts` sin ningún consumidor ni uso real.

## Decision

1. **Estructura modular `src/charts/<kind>/`**:
   - Cada tipo de carta astrológica posee su propio subdirectorio en `src/charts/<kind>/` (`natal`, `progressed`, `transits`, `synastry`, `composite`).
   - Cada módulo contiene su interfaz de resultado (`<Kind>Chart.ts`) y su servicio (`<Kind>Service.ts`), además de sus inputs específicos (`CalculateChartInput` en `natal`).
   - Se actualizan los identifiers de Effect v4 de acuerdo a la nueva ruta:
     - `compass/charts/natal/NatalService` y `compass/charts/natal/CalculateChartInput`
     - `compass/charts/progressed/ProgressedService`
     - `compass/charts/transits/TransitsService`
     - `compass/charts/synastry/SynastryService`
     - `compass/charts/composite/CompositeService`

2. **Seams transversales en `src/core/`**:
   - `Ephemeris`, `Astronomy`, `Jwgea`, `Errors` y `ProfileStore` permanecen en `src/core/`.
   - `src/core/Charts.ts` y la unión `CompassChart` se disuelven por completo.

3. **Subcomandos CLI modulares (`src/cli/Commands/chart/`)**:
   - `ChartCommands.ts` se divide en `src/cli/Commands/chart/{Natal,Progressed,Transits,Synastry,Composite}Commands.ts`.
   - `src/cli/Commands/chart/shared.ts` alberga `ChartRelationalInput`, `natalFromProfile`, y `renderChartView`.

4. **Reglas de dependencia**:
   - `src/core/` **nunca** importa de `src/charts/`.
   - Entre módulos de `src/charts/`, **únicamente** se permiten imports de tipos (`import type { NatalChart } from "../natal/NatalChart.js"`).
   - `src/cli/` importa de `src/charts/` y `src/core/`; nunca al revés.

5. **Tests espejados**:
   - `tests/chart-services.test.ts` se divide en `tests/charts/{natal,progressed,transits,synastry,composite}.test.ts` y `tests/charts/fixtures.ts` sin alterar ninguna aserción de test.

## Consequences

- Navegabilidad y mantenibilidad aumentadas: cada error trace o identifier de Effect auto-localiza su archivo fuente.
- Añadir un nuevo tipo de carta en el futuro es puramente aditivo: crear `src/charts/<nuevo-kind>/` y registrar el Layer en `App.ts`.
- `ProfileStore` permanece en `core/` como una asimetría deliberada pendiente de promoción a módulo propio si el dominio de perfiles crece.
