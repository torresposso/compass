import { Layer, Schema } from "effect";
import { CompositeService } from "../../src/charts/composite/CompositeService.js";
import { CalculateChartInput, NatalService } from "../../src/charts/natal/NatalService.js";
import { ProgressedService } from "../../src/charts/progressed/ProgressedService.js";
import { SynastryService } from "../../src/charts/synastry/SynastryService.js";
import { TransitsService } from "../../src/charts/transits/TransitsService.js";
import { Ephemeris } from "../../src/core/Ephemeris.js";

export const decodeInput = Schema.decodeUnknownSync(CalculateChartInput);

export const ChartServicesLive = Layer.provide(
  Layer.mergeAll(
    NatalService.layer,
    ProgressedService.layer,
    TransitsService.layer,
    SynastryService.layer,
    CompositeService.layer,
  ),
  Ephemeris.layer,
);
