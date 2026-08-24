import { type AxiCliCommand, type AxiCliOptions, runAxiCli } from "axi-sdk-js";
import { DateTime, Effect, Layer, Schema } from "effect";
import { ChartEngine } from "../core/ChartEngine.js";
import { ProfileStore } from "../core/ProfileStore.js";
import {
  CalculateChartInput,
  GeoLocation,
  Latitude,
  Longitude,
  Profile,
  ProfileSlug,
} from "../core/Schema.js";
import { VERSION } from "../Version.js";
import { makeCommand } from "./Command.js";

/**
 * Combined runtime Layer for the CLI: ChartEngine + ProfileStore (FileSystem)
 */
export const CompassLiveLayer = Layer.merge(ChartEngine.layer, ProfileStore.fileSystemLayer());

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

export const pingCommand: AxiCliCommand<undefined> = makeCommand(Schema.Struct({}), handlePing);

/**
 * Chart calculate handler defined with Effect.fn consuming ChartEngine service.
 */
export const handleChartCalculate = Effect.fn("handleChartCalculate")(function* (
  input: CalculateChartInput,
) {
  const engine = yield* ChartEngine;
  const result = yield* engine.natal(input);
  return {
    whenUtc: DateTime.formatIso(result.whenUtc),
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

export const chartCalculateCommand: AxiCliCommand<undefined> = makeCommand(
  CalculateChartInput,
  handleChartCalculate,
  ChartEngine.layer,
);

// Schemas for Profile CLI operations
const ProfileAddInput = Schema.Struct({
  slug: ProfileSlug,
  name: Schema.String,
  whenUtc: Schema.DateTimeUtcFromString,
  latitude: Latitude,
  longitude: Longitude,
});

const ProfileSlugInput = Schema.Struct({
  slug: Schema.optional(ProfileSlug),
  _: Schema.optional(Schema.Array(Schema.String)),
});

function resolveSlug(input: {
  slug?: string;
  _?: readonly string[];
}): Effect.Effect<ProfileSlug, Schema.SchemaError> {
  const rawSlug = input.slug ?? input._?.[0];
  return Schema.decodeUnknownEffect(ProfileSlug)(rawSlug);
}

export const handleProfileAdd = Effect.fn("handleProfileAdd")(function* (
  input: typeof ProfileAddInput.Type,
) {
  const store = yield* ProfileStore;
  const profile = new Profile({
    slug: input.slug,
    name: input.name,
    whenUtc: input.whenUtc,
    location: new GeoLocation({
      latitude: input.latitude,
      longitude: input.longitude,
    }),
  });

  const created = yield* store.create(profile);
  return {
    status: "created",
    profile: {
      slug: created.slug,
      name: created.name,
      whenUtc: DateTime.formatIso(created.whenUtc),
      location: {
        latitude: created.location.latitude,
        longitude: created.location.longitude,
      },
    },
  };
});

export const handleProfileList = Effect.fn("handleProfileList")(function* () {
  const store = yield* ProfileStore;
  const profiles = yield* store.list();
  return {
    count: profiles.length,
    profiles: profiles.map((p) => ({
      slug: p.slug,
      name: p.name,
      whenUtc: DateTime.formatIso(p.whenUtc),
      location: {
        latitude: p.location.latitude,
        longitude: p.location.longitude,
      },
    })),
  };
});

export const handleProfileGet = Effect.fn("handleProfileGet")(function* (
  input: typeof ProfileSlugInput.Type,
) {
  const slug = yield* resolveSlug(input);
  const store = yield* ProfileStore;
  const profile = yield* store.get(slug);
  return {
    slug: profile.slug,
    name: profile.name,
    whenUtc: DateTime.formatIso(profile.whenUtc),
    location: {
      latitude: profile.location.latitude,
      longitude: profile.location.longitude,
    },
  };
});

export const handleProfileDelete = Effect.fn("handleProfileDelete")(function* (
  input: typeof ProfileSlugInput.Type,
) {
  const slug = yield* resolveSlug(input);
  const store = yield* ProfileStore;
  yield* store.delete(slug);
  return {
    status: "deleted",
    slug,
  };
});

export const handleChartNatal = Effect.fn("handleChartNatal")(function* (
  input: typeof ProfileSlugInput.Type,
) {
  const slug = yield* resolveSlug(input);
  const store = yield* ProfileStore;
  const engine = yield* ChartEngine;
  const profile = yield* store.get(slug);

  const chartInput = new CalculateChartInput({
    whenUtc: profile.whenUtc,
    latitude: profile.location.latitude,
    longitude: profile.location.longitude,
  });

  const result = yield* engine.natal(chartInput);

  return {
    profile: {
      slug: profile.slug,
      name: profile.name,
    },
    whenUtc: DateTime.formatIso(result.whenUtc),
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

export const profileAddCommand = makeCommand(ProfileAddInput, handleProfileAdd, CompassLiveLayer);
export const profileListCommand = makeCommand(
  Schema.Struct({}),
  handleProfileList,
  CompassLiveLayer,
);
export const profileGetCommand = makeCommand(ProfileSlugInput, handleProfileGet, CompassLiveLayer);
export const profileDeleteCommand = makeCommand(
  ProfileSlugInput,
  handleProfileDelete,
  CompassLiveLayer,
);
export const chartNatalCommand = makeCommand(ProfileSlugInput, handleChartNatal, CompassLiveLayer);

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
