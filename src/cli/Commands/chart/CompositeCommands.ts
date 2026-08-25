import { DateTime, Effect, type Layer } from "effect";
import { CompositeService } from "../../../charts/composite/CompositeService.js";
import type { NatalService } from "../../../charts/natal/NatalService.js";
import type { ProfileStore } from "../../../core/ProfileStore.js";
import { makeCommand } from "../../Command.js";
import {
  ChartRelationalInput,
  natalFromProfile,
  renderChartView,
  resolveTwoSlugs,
} from "./shared.js";

export const handleChartComposite = Effect.fn("handleChartComposite")(function* (
  input: typeof ChartRelationalInput.Type,
) {
  const [slugA, slugB] = yield* resolveTwoSlugs(input);
  const compositeService = yield* CompositeService;

  const [{ profile: profileA, natal: natalA }, { profile: profileB, natal: natalB }] =
    yield* Effect.all([natalFromProfile(slugA), natalFromProfile(slugB)]);

  const composite = yield* compositeService.composite(natalA, natalB);

  return {
    profileA: { slug: profileA.slug, name: profileA.name },
    profileB: { slug: profileB.slug, name: profileB.name },
    kind: composite.kind,
    chartAWhenUtc: DateTime.formatIso(composite.chartAWhenUtc),
    chartBWhenUtc: DateTime.formatIso(composite.chartBWhenUtc),
    ...renderChartView(composite),
  };
});

export const makeChartCompositeCommand = (
  layer: Layer.Layer<ProfileStore | NatalService | CompositeService, unknown, never>,
) => makeCommand(ChartRelationalInput, handleChartComposite, layer);
