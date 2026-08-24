import { type AxiCliCommand, type AxiCliOptions, runAxiCli } from "axi-sdk-js";
import { Effect } from "effect";
import { VERSION } from "../version.js";
import { runEffectToAxi } from "./bridge.js";

/**
 * Smoke test / system status command.
 */
export const pingCommand: AxiCliCommand<undefined> = async () => {
  const program = Effect.gen(function* () {
    yield* Effect.logDebug("executing ping smoke test");
    return {
      status: "ok",
      name: "compass",
      version: VERSION,
      engine: "caelus+effect",
      timestamp: new Date().toISOString(),
    };
  });

  return runEffectToAxi(program);
};

export const compassCliOptions: AxiCliOptions<undefined> = {
  description: "Deterministic Astrological Chart Engine & Profile Manager CLI",
  version: VERSION,
  topLevelHelp: `Compass - Astrological Chart Engine & Profile Management CLI

USAGE:
  compass <command> [arguments] [flags]

COMMANDS:
  ping               Smoke test & engine status check
  chart calculate    Calculate chart on the fly (--when, --lat, --lon, --house-system)
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
  },
};

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  await runAxiCli({
    ...compassCliOptions,
    argv,
  });
}
