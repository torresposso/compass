# Auditoría del Módulo de Carta Natal — Compass

**Fecha:** 2026-08-24  
**Scope:** `src/core/ChartEngine.ts`, `src/core/Schema.ts`, `src/core/Errors.ts`, `src/cli/Bridge.ts`, `src/cli/App.ts`, `src/cli/Command.ts`, `tests/chart-engine.test.ts`

---

## Veredicto General

El módulo es **sólido y bien estructurado**. Sigue las convenciones de Effect v4 en un ~85%, la integración AXI es correcta, y los invariantes de dominio JWGEA (Tropical, Porphyry, True Node) están bien forzados. Sin embargo, hay **3 blindspots de riesgo**, **4 oportunidades de profundización**, y **brechas significativas en tests**.

---

## 1. Convenciones Effect v4

### ✅ Lo que está bien

| Convención | Estado | Referencia |
|---|---|---|
| `Effect.fn("nombre")` para todas las funciones | ✅ Correcto | [ChartEngine.ts:L146](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L146), [L261](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L261), [L306](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L306), etc. |
| `Context.Service` con `static layer` | ✅ Correcto | [ChartEngine.ts:L543-564](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L543-L564) |
| `Schema.TaggedError` para errores tipados | ✅ Correcto | [Errors.ts](file:///home/erik/Projects/clis/compass/src/core/Errors.ts) |
| `DateTime.Utc` en vez de `Date` nativo | ✅ Correcto | Sin uso de `Date` en ningún archivo |
| `return yield*` para fail temprano | ✅ Correcto | [ChartEngine.ts:L153](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L153), [L160](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L160), [L281](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L281) |
| `Schema.Class` para domain models | ✅ Parcial | JWGEA types sí, chart interfaces no |

### ❌ Hallazgos

#### F1. Chart types son `interface` en vez de `Schema.Class`

> [!WARNING]  
> Las interfaces [`NatalChart`](file:///home/erik/Projects/clis/compass/src/core/Schema.ts#L176-L182), [`ProgressedChart`](file:///home/erik/Projects/clis/compass/src/core/Schema.ts#L187-L194), [`TransitChart`](file:///home/erik/Projects/clis/compass/src/core/Schema.ts#L199-L205), [`SynastryChart`](file:///home/erik/Projects/clis/compass/src/core/Schema.ts#L210-L215), [`CompositeChart`](file:///home/erik/Projects/clis/compass/src/core/Schema.ts#L220-L226) son TypeScript plain interfaces.

Effect AGENTS.md dice: *"All validation and domain modeling in Effect is done with Schema."*

Sin embargo, estas interfaces envuelven `Chart` de Caelus (que es un tipo externo opaco). Migrarlas a `Schema.Class` tiene trade-offs:
- **Pro:** Podrían validarse, serializarse, y participar en encoding pipelines.
- **Contra:** `Chart` de Caelus no tiene un Schema propio, así que habría que declarar `Schema.Any` o crear un schema wrapper parcial.
- **Recomendación:** Evaluar si vale la pena el esfuerzo. Si no se necesita serializar/decodificar `NatalChart` desde JSON externo, las interfaces son pragmáticas.

#### F2. `Predicate` module no utilizado

`AGENTS.md` dice: *"NEVER write your own helper functions like isRecord or isString"*. En [ChartEngine.ts:L282](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L282) y líneas similares:
```ts
err instanceof Error ? err.message : String(err)
```
Debería usarse `Predicate.isError(err)` del módulo `Predicate` de Effect. Es un cambio cosmético pero de alineación.

---

## 2. Integración Caelus

### ✅ Lo que está bien

| Invariante JWGEA | Forzado | Referencia |
|---|---|---|
| Zodíaco Tropical | ✅ `zodiac: "tropical"` en toda llamada | [L278](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L278), [L319](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L319), [L354](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L354), [L505](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L505) |
| Casas Porphyry | ✅ Constante `JWGEA_HOUSE_SYSTEM = "porphyry"` | [L36](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L36) |
| True Node (no Mean) | ✅ `chart.bodies.true_node` | [L150](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L150) |
| PPP = Pluto + 180° | ✅ Implementación propia (correcto) | [L167](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L167) |
| Modern rulership (Scorpio→Pluto, etc.) | ✅ Tabla completa | [L50-63](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L50-L63) |

### ❌ Hallazgos

#### F3. Llamadas a Caelus sin `try/catch` — excepciones crudas que rompen el canal Effect

> [!CAUTION]
> Dos llamadas a Caelus ejecutan código síncrono que puede lanzar excepciones **sin ser capturadas**, escapando del canal de errores de Effect:

1. **[`engine.position()`](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L401)** en `calculateTransitsPipeline`:
   ```ts
   const transitBodyPos = engine.position(id as BodyId, transitJd);
   ```
   Si `transitJd` está fuera de rango o `id` es inválido, lanza una excepción cruda.

2. **[`compositePlacements()`](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L515)** en `calculateCompositePipeline`:
   ```ts
   const placements = compositePlacements(engine, jdA, jdB);
   ```
   Misma situación.

**Fix recomendado:** Envolver con `Effect.try({ try: () => ..., catch: (err) => new EphemerisError(...) })`.

#### F4. Lilith ausente del chart

[CONTEXT.md](file:///home/erik/Projects/clis/compass/CONTEXT.md#L107) lista `Lilith (mean_lilith / true_lilith)` como cuerpo del dominio. Caelus la expone como `EXTRA_BODIES` pero requiere pasarla explícitamente en las opciones del chart:
```ts
engine.chart(..., { bodies: [...BODIES, "true_lilith"], ... })
```
Actualmente se omite el parámetro `bodies`, así que Lilith no aparece en el chart.

#### F5. `detectPatterns` y `lots` sin usar

[SDR.md](file:///home/erik/Projects/clis/compass/SDR.md#L62) declara que Caelus incluye `patterns` y `lots`. La API de Caelus exporta `detectPatterns()` para T-Square, Grand Trine, Grand Cross, Yod, Kite, etc. y módulos de lots (Part of Fortune, etc.). Ninguno se usa en el codebase actual.

> [!NOTE]
> Esto puede ser intencional si es Phase 4 pendiente. Pero vale la pena confirmar.

#### F6. Skipped Steps reimplementados en vez de usar aspectos de Caelus

El cálculo de skipped steps ([L224-246](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L224-L246)) reimplementa la detección de cuadraturas manualmente con `angularSeparation`. Caelus ya calcula `chart.aspects` con cuadraturas incluidas. Se podrían filtrar los aspectos nativos en vez de recalcular.

---

## 3. Integración AXI SDK

### ✅ Lo que está bien

| Aspecto | Estado |
|---|---|
| Bridge mapea `Exit → AxiError` correctamente | ✅ |
| Todos los `DomainError` → código AXI correcto | ✅ |
| `tryFastPath` para `--version` sin cargar módulos pesados | ✅ |
| `normalizeArgv` para subcomandos de dos palabras | ✅ |
| Envelope JSON estructurado (no arrays crudos) | ✅ |

### Observación menor

`Command.ts` ignora el parámetro `context` de `AxiCliCommand`, pero como el contexto es `undefined`, es correcto.

---

## 4. Cobertura de Tests

### ✅ Tests existentes cubren el happy path

Todos los 5 métodos del engine (`natal`, `progressed`, `transits`, `synastry`, `composite`) tienen un smoke test.

### ❌ Brechas críticas

| Brecha | Severidad | Detalle |
|---|---|---|
| **Skipped Steps nunca verificados positivamente** | 🔴 Alta | El test itera sobre `skippedSteps` pero si es `[]` el loop no ejecuta. Necesita una carta con skipped step real. |
| **Determinismo no probado** | 🔴 Alta | No existe test que ejecute `natal(input)` dos veces y verifique `deepEqual`. |
| **Rutas de error del engine no testeadas** | 🟡 Media | Ningún test pasa una fecha fuera de rango de efemérides para verificar `EphemerisError`. |
| **Tránsitos al PPP no testeados** | 🟡 Media | La rama [L398-422](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L398-L422) que genera `target: "ppp"` no tiene cobertura. |
| **Regentes modernos testeados parcialmente** | 🟡 Media | Test usa `if/else` condicional en vez de una carta cuyo nodo norte cae en un signo conocido. |
| **`houseOfLongitude` en cruce 0° Aries** | 🟡 Media | La lógica de wraparound [L126-130](file:///home/erik/Projects/clis/compass/src/core/ChartEngine.ts#L126-L130) no tiene test unitario dedicado. |
| **Aserciones con `JSON.stringify(...).toContain`** | 🟡 Media | Patrón frágil en profile-store tests. Usar `Cause.failureOption` o `Exit.match`. |

---

## 5. Resumen de Acciones Recomendadas

### Prioridad Alta (blindspots de runtime)

1. **Envolver `engine.position()` y `compositePlacements()` en `Effect.try`** — evitar excepciones crudas que escapan del canal de errores Effect.
2. **Agregar test de skipped steps con carta real** — buscar una fecha cuyo chart tenga un planeta en cuadratura exacta al eje nodal.
3. **Agregar test de determinismo** — `natal(input)` × 2 → `deepEqual`.

### Prioridad Media (alineación y profundización)

4. **Incluir Lilith** (`true_lilith`) en el parámetro `bodies` de `engine.chart()`.
5. **Usar `Predicate.isError`** en vez de `instanceof Error` en los catch blocks.
6. **Agregar test de fecha fuera de rango** para verificar propagación de `EphemerisError`.
7. **Agregar test de tránsito a PPP** para cubrir la rama `target: "ppp"`.

### Prioridad Baja (mejoras futuras)

8. **Evaluar usar `chart.aspects` de Caelus** para skipped steps en vez de reimplementar.
9. **Integrar `detectPatterns`** de Caelus (T-Square, Grand Trine, etc.) — Phase 4.
10. **Evaluar `Schema.Class` para chart types** — trade-off entre pureza Effect y practicidad.
11. **Refactorizar aserciones** en tests de ProfileStore usando `Cause.failureOption`.
