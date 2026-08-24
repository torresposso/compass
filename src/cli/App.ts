import { type AxiCliCommand, type AxiCliOptions, runAxiCli } from "axi-sdk-js";
import { DateTime, Effect, Schema } from "effect";
import { ChartEngine } from "../core/ChartEngine.js";
import { CalculateChartInput } from "../core/Schema.js";
import { VERSION } from "../Version.js";
import { makeCommand } from "./Command.js";

/**
 * Ping handler defined with Effect.fn for proper span tracing & debugging.
 */
export const handlePing = Effect.fn("handlePing")(function* (_: Record<string, never>) {
  yield* Effect.logDebug("executing ping smoke test");
  const now = yield* DateTime.now;
  return {
    status: "ok",
    name: "compass",
    version: VERSION,
    engine: "caelus+effect",
    timestamp: DateTime.formatIso(now),
  };
});

/**
 * Smoke test / system status command.
 */
export const pingCommand: AxiCliCommand<undefined> = makeCommand(Schema.Struct({}), handlePing);

/**
 * Chart calculate handler defined with Effect.fn consuming ChartEngine service.
 */
export const handleChartCalculate = Effect.fn("handleChartCalculate")(function* (
  input: CalculateChartInput,
) {
  const engine = yield* ChartEngine;
  const result = yield* engine.calculate(input);
  return {
    whenUtc: result.whenUtc,
    location: {
      latitude: result.location.latitude,
      longitude: result.location.longitude,
    },
    ascendant: result.chart.angles.asc,
    mc: result.chart.angles.mc,
    houses: result.chart.cusps,
    bodies: result.chart.bodies,
    aspects: result.chart.aspects,
    jwgea: result.jwgea,
  };
});

/**
 * Calculate command with ChartEngine.layer injected.
 */
export const chartCalculateCommand: AxiCliCommand<undefined> = makeCommand(
  CalculateChartInput,
  handleChartCalculate,
  ChartEngine.layer,
);

export const compassCliOptions: AxiCliOptions<undefined> = {
  description: "Deterministic Astrological Chart Engine & Profile Manager CLI (JWGEA Canonical)",
  version: VERSION,
  topLevelHelp: `Compass - Astrological Chart Engine & Profile Management CLI (JWGEA)

USAGE:
  compass <command> [arguments] [flags]

COMMANDS:
  ping               Smoke test & engine status check
  chart calculate    Calculate natal chart on the fly (--whenUtc, --latitude, --longitude)
  chart natal        Calculate natal chart for a saved profile (<name>)
  profile list       List all saved birth profiles
  profile get        Get profile details (<name>)
  profile add        Save a new birth profile
  profile delete     Delete a saved profile (<name>)

FLAGS:
  -v, --version      Print CLI version
  -h, --help         Print help message
`,
  home: async () => {
    return {
      name: "compass",
      version: VERSION,
      commands: [
        "ping",
        "chart calculate",
        "chart natal",
        "profile list",
        "profile get",
        "profile add",
        "profile delete",
      ],
    };
  },
  commands: {
    ping: pingCommand,
    "chart calculate": chartCalculateCommand,
  },
};

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  await runAxiCli({
    ...compassCliOptions,
    argv,
  });
}
