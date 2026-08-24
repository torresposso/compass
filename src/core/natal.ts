import { type Chart, type Engine, normalizeHouseSystem } from "caelus";
import { Effect } from "effect";
import { EphemerisError, ValidationError } from "./Errors.js";
import { computeJwgea } from "./jwgea.js";
import { type CalculateChartInputType, GeoLocation, type NatalChart } from "./Schema.js";

/**
 * Natal chart pipeline: parse the request, compute the Caelus chart (tropical,
 * default Placidus houses), derive the JWGEA analysis, and assemble a
 * {@link NatalChart}. Pure-domain errors are mapped to typed Compass errors.
 */
export const calculateNatal = Effect.fn("calculateNatal")(function* (
  input: CalculateChartInputType,
  engine: Engine,
): Effect.fn.Return<NatalChart, EphemerisError | ValidationError> {
  const date = new Date(input.whenUtc);
  if (Number.isNaN(date.getTime())) {
    return yield* new ValidationError({
      message: `Invalid ISO date format: '${input.whenUtc}'`,
      field: "whenUtc",
      issues: ["Date must be a valid ISO-8601 string (e.g. 2024-03-21T12:00:00Z)"],
    });
  }

  const houseSystem = input.houseSystem ?? "placidus";

  let chart: Chart;
  try {
    chart = engine.chart(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      input.latitude,
      input.longitude,
      { houseSystem: normalizeHouseSystem(houseSystem), zodiac: "tropical" },
    );
  } catch (err) {
    return yield* new EphemerisError({
      message: err instanceof Error ? err.message : String(err),
      date: input.whenUtc,
    });
  }

  let jwgea: import("./Schema.js").JwgeaAnalysis;
  try {
    jwgea = computeJwgea(chart);
  } catch (err) {
    return yield* new EphemerisError({
      message: err instanceof Error ? err.message : String(err),
      date: input.whenUtc,
    });
  }

  const location = new GeoLocation({
    latitude: input.latitude,
    longitude: input.longitude,
  });

  return {
    kind: "natal",
    whenUtc: input.whenUtc,
    location,
    chart,
    jwgea,
  };
});
