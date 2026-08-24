import { type Chart, type Engine, normalizeHouseSystem } from "caelus";
import { DateTime, Effect, Schema } from "effect";
import { EphemerisError, ValidationError } from "./Errors.js";
import { computeJwgea } from "./Jwgea.js";
import { type CalculateChartInputType, GeoLocation, type NatalChart } from "./Schema.js";

const parseIsoDate = Schema.decodeUnknownOption(Schema.DateTimeUtcFromString);

/** The canonical house system of JWGEA */
export const JWGEA_HOUSE_SYSTEM = "porphyry";

/**
 * Natal chart pipeline: parse the request, compute the Caelus chart (tropical,
 * Porphyry houses), derive the JWGEA analysis, and assemble a
 * {@link NatalChart}. Pure-domain errors are mapped to typed Compass errors.
 */
export const calculateNatal = Effect.fn("calculateNatal")(function* (
  input: CalculateChartInputType,
  engine: Engine,
): Effect.fn.Return<NatalChart, EphemerisError | ValidationError> {
  const parsedDate = parseIsoDate(input.whenUtc);
  if (parsedDate._tag === "None") {
    return yield* new ValidationError({
      message: `Invalid ISO date format: '${input.whenUtc}'`,
      field: "whenUtc",
      issues: ["Date must be a valid ISO-8601 string (e.g. 2024-03-21T12:00:00Z)"],
    });
  }

  const dt = parsedDate.value;
  const parts = DateTime.toPartsUtc(dt);

  let chart: Chart;
  try {
    chart = engine.chart(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      input.latitude,
      input.longitude,
      { houseSystem: normalizeHouseSystem(JWGEA_HOUSE_SYSTEM), zodiac: "tropical" },
    );
  } catch (err) {
    return yield* new EphemerisError({
      message: err instanceof Error ? err.message : String(err),
      date: input.whenUtc,
    });
  }

  const jwgea = yield* computeJwgea(chart);

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
