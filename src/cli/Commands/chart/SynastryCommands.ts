import { Effect, type Layer } from "effect";
import type { NatalService } from "../../../charts/natal/NatalService.js";
import { SynastryService } from "../../../charts/synastry/SynastryService.js";
import type { ProfileStore } from "../../../core/ProfileStore.js";
import { makeCommand } from "../../Command.js";
import { ChartRelationalInput, natalFromProfile, resolveTwoSlugs } from "./shared.js";

export const handleChartSynastry = Effect.fn("handleChartSynastry")(function* (
  input: typeof ChartRelationalInput.Type,
) {
  const [slugA, slugB] = yield* resolveTwoSlugs(input);
  const synastryService = yield* SynastryService;

  const [{ profile: profileA, natal: natalA }, { profile: profileB, natal: natalB }] =
    yield* Effect.all([natalFromProfile(slugA), natalFromProfile(slugB)]);

  const synastry = yield* synastryService.synastry(natalA, natalB);

  return {
    profileA: { slug: profileA.slug, name: profileA.name },
    profileB: { slug: profileB.slug, name: profileB.name },
    kind: synastry.kind,
    aspects: synastry.aspects,
    overlays: synastry.overlays,
    crossContacts: synastry.crossContacts,
  };
});

export const makeChartSynastryCommand = (
  layer: Layer.Layer<ProfileStore | NatalService | SynastryService, unknown, never>,
) => makeCommand(ChartRelationalInput, handleChartSynastry, layer);
