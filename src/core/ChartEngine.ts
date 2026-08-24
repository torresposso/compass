import { Engine } from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { Context, Effect, Layer } from "effect";
import type { EphemerisError, ValidationError } from "./Errors.js";
import { calculateNatal } from "./Natal.js";
import type { CalculateChartInputType, NatalChart } from "./Schema.js";

// Singleton Caelus Engine instance initialized with embedded astronomical coefficients
const defaultCaelusEngine = new Engine(embeddedData);

/**
 * Service interface for astronomical and evolutionary natal chart calculations.
 *
 * Thin wrapper around the Caelus engine: it owns the engine instance and
 * delegates the natal pipeline (including JWGEA) to {@link calculateNatal}.
 */
export class ChartEngine extends Context.Service<
  ChartEngine,
  {
    readonly calculate: (
      input: CalculateChartInputType,
    ) => Effect.Effect<NatalChart, EphemerisError | ValidationError>;
  }
>()("compass/core/ChartEngine") {
  /**
   * Production layer using Caelus native astronomical engine & JWGEA analysis.
   */
  static readonly layer = Layer.sync(ChartEngine, () => {
    const calculate = Effect.fn("ChartEngine.calculate")(function* (
      input: CalculateChartInputType,
    ) {
      yield* Effect.logDebug("Calculating natal chart in ChartEngine", {
        whenUtc: input.whenUtc,
        latitude: input.latitude,
        longitude: input.longitude,
      });

      return yield* calculateNatal(input, defaultCaelusEngine);
    });

    return ChartEngine.of({
      calculate,
    });
  });

  /**
   * Helper to construct a test layer with a deterministic fake chart.
   */
  static readonly testLayer = (stubChart: NatalChart) =>
    Layer.succeed(
      ChartEngine,
      ChartEngine.of({
        calculate: Effect.fn("ChartEngine.calculateFake")(() => Effect.succeed(stubChart)),
      }),
    );
}
