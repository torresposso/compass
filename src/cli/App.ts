import { type AxiCliOptions, runAxiCli } from "axi-sdk-js";
import { Layer } from "effect";
import { CompositeService } from "../core/CompositeService.js";
import { Ephemeris } from "../core/Ephemeris.js";
import { NatalService } from "../core/NatalService.js";
import { ProfileStore } from "../core/ProfileStore.js";
import { ProgressedService } from "../core/ProgressedService.js";
import { SynastryService } from "../core/SynastryService.js";
import { TransitsService } from "../core/TransitsService.js";
import { VERSION } from "../Version.js";
import {
  handleChartCalculate,
  handleChartComposite,
  handleChartNatal,
  handleChartProgressed,
  handleChartSynastry,
  handleChartTransits,
  makeChartCalculateCommand,
  makeChartCompositeCommand,
  makeChartNatalCommand,
  makeChartProgressedCommand,
  makeChartSynastryCommand,
  makeChartTransitsCommand,
} from "./Commands/ChartCommands.js";
import { handlePing, pingCommand } from "./Commands/PingCommand.js";
import {
  handleProfileAdd,
  handleProfileDelete,
  handleProfileGet,
  handleProfileList,
  makeProfileAddCommand,
  makeProfileDeleteCommand,
  makeProfileGetCommand,
  makeProfileListCommand,
} from "./Commands/ProfileCommands.js";

// Re-export command handlers and inputs for consumers & tests
export {
  handleChartCalculate,
  handleChartComposite,
  handleChartNatal,
  handleChartProgressed,
  handleChartSynastry,
  handleChartTransits,
  handlePing,
  handleProfileAdd,
  handleProfileDelete,
  handleProfileGet,
  handleProfileList,
  pingCommand,
};

/**
 * Combined runtime Layer for the CLI: All services + ProfileStore (FileSystem) provided with Ephemeris.
 */
export const CompassLive = Layer.provide(
  Layer.mergeAll(
    NatalService.layer,
    ProgressedService.layer,
    TransitsService.layer,
    SynastryService.layer,
    CompositeService.layer,
    ProfileStore.fileSystemLayer(),
  ),
  Ephemeris.layer,
);

export const chartCalculateCommand = makeChartCalculateCommand(CompassLive);
export const chartNatalCommand = makeChartNatalCommand(CompassLive);
export const chartProgressedCommand = makeChartProgressedCommand(CompassLive);
export const chartTransitsCommand = makeChartTransitsCommand(CompassLive);
export const chartSynastryCommand = makeChartSynastryCommand(CompassLive);
export const chartCompositeCommand = makeChartCompositeCommand(CompassLive);

export const profileAddCommand = makeProfileAddCommand(CompassLive);
export const profileListCommand = makeProfileListCommand(CompassLive);
export const profileGetCommand = makeProfileGetCommand(CompassLive);
export const profileDeleteCommand = makeProfileDeleteCommand(CompassLive);

export const compassCliOptions: AxiCliOptions<undefined> = {
  description: "Deterministic Astrological Chart Engine & Profile Manager CLI (JWGEA Canonical)",
  version: VERSION,
  topLevelHelp: `Compass - Astrological Chart Engine & Profile Management CLI (JWGEA)

USAGE:
  compass <command> [arguments] [flags]

COMMANDS:
  ping               Smoke test & engine status check
  chart calculate    Calculate natal chart on the fly (--whenUtc, --latitude, --longitude)
  chart natal        Calculate natal chart for a saved profile (<slug> or --slug <slug>)
  chart progressed   Calculate secondary progressed chart (<slug> --targetUtc <date>)
  chart transits     Calculate transit activations on natal chart (<slug> --transitUtc <date>)
  chart synastry     Compare two profiles in synastry (<slugA> <slugB>)
  chart composite    Calculate midpoint composite chart of two profiles (<slugA> <slugB>)
  profile list       List all saved birth profiles
  profile get        Get profile details (<slug> or --slug <slug>)
  profile add        Save a new birth profile (--slug, --name, --whenUtc, --latitude, --longitude)
  profile delete     Delete a saved profile (<slug> or --slug <slug>)

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
        "chart progressed",
        "chart transits",
        "chart synastry",
        "chart composite",
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
    "chart natal": chartNatalCommand,
    "chart progressed": chartProgressedCommand,
    "chart transits": chartTransitsCommand,
    "chart synastry": chartSynastryCommand,
    "chart composite": chartCompositeCommand,
    "profile list": profileListCommand,
    "profile get": profileGetCommand,
    "profile add": profileAddCommand,
    "profile delete": profileDeleteCommand,
  },
};

/**
 * Normalize multi-word command names (e.g. `["profile", "add", ...]` -> `["profile add", ...]`)
 * so that axi-sdk-js can route subcommands registered with space-separated names.
 */
export function normalizeArgv(argv: string[], knownCommands: string[]): string[] {
  if (argv.length >= 2) {
    const twoWord = `${argv[0]} ${argv[1]}`;
    if (knownCommands.includes(twoWord)) {
      return [twoWord, ...argv.slice(2)];
    }
  }
  return argv;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const normalizedArgv = normalizeArgv(argv, Object.keys(compassCliOptions.commands));
  await runAxiCli({
    ...compassCliOptions,
    argv: normalizedArgv,
  });
}
