import { type Zodiac as CaelusZodiac, type Chart, Engine, normalizeHouseSystem } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { Context, Effect, Layer, Schema } from "effect";
import { EphemerisError, ValidationError } from "./Errors.js";
import {
  type CompassChart,
  GeoLocation,
  HouseSystem,
  JwgeaAnalysis,
  Latitude,
  Longitude,
  Zodiac,
} from "./Schema.js";

// Singleton Caelus Engine instance initialized with embedded astronomical coefficients
const defaultCaelusEngine = new Engine(embeddedData);

/**
 * Request payload schema for calculating a chart.
 */
export class CalculateChartInput extends Schema.Class<CalculateChartInput>(
  "compass/core/CalculateChartInput",
)({
  whenUtc: Schema.String,
  latitude: Latitude,
  longitude: Longitude,
  houseSystem: Schema.optional(HouseSystem),
  zodiac: Schema.optional(Zodiac),
  includeJwgea: Schema.optional(Schema.Boolean),
}) {}

export type CalculateChartInputType = typeof CalculateChartInput.Type;

/**
 * Service interface for astronomical and evolutionary chart calculations.
 */
export class ChartEngine extends Context.Service<
  ChartEngine,
  {
    readonly calculate: (
      input: CalculateChartInputType,
    ) => Effect.Effect<CompassChart, EphemerisError | ValidationError>;
  }
>()("compass/core/ChartEngine") {
  /**
   * Production layer using Caelus native astronomical engine & JWGEA analysis.
   */
  static readonly layer = Layer.sync(ChartEngine, () => {
    const calculate = Effect.fn("ChartEngine.calculate")(function* (
      input: CalculateChartInputType,
    ) {
      yield* Effect.logDebug("Calculating chart in ChartEngine", {
        whenUtc: input.whenUtc,
        latitude: input.latitude,
        longitude: input.longitude,
        houseSystem: input.houseSystem,
      });

      // 1. Validate date parseability
      const date = new Date(input.whenUtc);
      if (Number.isNaN(date.getTime())) {
        return yield* new ValidationError({
          message: `Invalid ISO date format: '${input.whenUtc}'`,
          field: "whenUtc",
          issues: ["Date must be a valid ISO-8601 string (e.g. 2024-03-21T12:00:00Z)"],
        });
      }

      // 2. Perform Caelus chart calculation
      let chart: Chart;
      const houseSystem = input.houseSystem ?? "placidus";
      const zodiac = input.zodiac ?? "tropical";
      const includeJwgea = input.includeJwgea ?? true;

      try {
        const y = date.getUTCFullYear();
        const mo = date.getUTCMonth() + 1;
        const d = date.getUTCDate();
        const h = date.getUTCHours();
        const mi = date.getUTCMinutes();
        const s = date.getUTCSeconds();

        chart = defaultCaelusEngine.chart(y, mo, d, h, mi, s, input.latitude, input.longitude, {
          houseSystem: normalizeHouseSystem(houseSystem),
          zodiac: zodiac === "tropical" ? "tropical" : (zodiac as CaelusZodiac),
        });
      } catch (err) {
        return yield* new EphemerisError({
          message: err instanceof Error ? err.message : String(err),
          date: input.whenUtc,
        });
      }

      // 3. Optional JWGEA analysis computation
      let jwgea: JwgeaAnalysis | undefined;
      if (includeJwgea && chart.bodies) {
        const pluto = chart.bodies.pluto;
        const northNode = chart.bodies.north_node || chart.bodies.mean_node;
        const southNode = chart.bodies.south_node;

        if (pluto) {
          const plutoPolarityPoint = (pluto.lon + 180) % 360;
          const northNodeSign = northNode?.sign ?? "unknown";
          const southNodeSign = southNode?.sign ?? "unknown";

          // Find skipped steps (planets squaring the nodal axis)
          const skippedSteps: string[] = [];
          if (chart.aspects) {
            for (const aspect of chart.aspects) {
              if (
                (aspect.a === "north_node" ||
                  aspect.a === "south_node" ||
                  aspect.b === "north_node" ||
                  aspect.b === "south_node") &&
                aspect.aspect === "square"
              ) {
                const planet =
                  aspect.a === "north_node" || aspect.a === "south_node" ? aspect.b : aspect.a;
                if (!skippedSteps.includes(planet)) {
                  skippedSteps.push(planet);
                }
              }
            }
          }

          jwgea = new JwgeaAnalysis({
            plutoPolarityPoint,
            northNodeSign,
            northNodeRuler: "unknown",
            southNodeSign,
            southNodeRuler: "unknown",
            skippedSteps,
          });
        }
      }

      const location = new GeoLocation({
        latitude: input.latitude,
        longitude: input.longitude,
      });

      return {
        chart,
        jwgea,
        location,
        whenUtc: input.whenUtc,
      };
    });

    return ChartEngine.of({
      calculate,
    });
  });

  /**
   * Helper to construct a test layer with a deterministic fake chart.
   */
  static readonly testLayer = (stubChart: CompassChart) =>
    Layer.succeed(
      ChartEngine,
      ChartEngine.of({
        calculate: Effect.fn("ChartEngine.calculateFake")(() => Effect.succeed(stubChart)),
      }),
    );
}
