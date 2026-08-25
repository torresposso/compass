import {
  type BodyId,
  type Chart,
  compositePlacements as caelusCompositePlacements,
  progressedJd as caelusProgressedJd,
  transitAspects as caelusTransitAspects,
  Engine,
  julianDay,
  normalizeHouseSystem,
  type Position,
} from "caelus";
import { embeddedData } from "caelus/data-embedded";
import { Context, DateTime, Effect, Layer, Predicate, Schema } from "effect";

/** The canonical house system of JWGEA */
export const JWGEA_HOUSE_SYSTEM = "porphyry";

/**
 * Raised when astronomical calculation fails or a requested date/body is out of ephemeris bounds.
 */
export class EphemerisError extends Schema.TaggedError<EphemerisError>()("EphemerisError", {
  message: Schema.String,
  date: Schema.optional(Schema.String),
  body: Schema.optional(Schema.String),
  details: Schema.optional(Schema.String),
}) {}

/**
 * Convert DateTime.Utc to Julian Day (UT).
 */
export function dateTimeToJulianDay(dt: DateTime.Utc): number {
  const parts = DateTime.toPartsUtc(dt);
  return julianDay(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
}

/**
 * Re-export caelus progressedJd for progressed calculations.
 */
export const progressedJd = caelusProgressedJd;

export interface EphemerisService {
  readonly chart: (
    whenUtc: DateTime.Utc,
    latitude: number,
    longitude: number,
  ) => Effect.Effect<Chart, EphemerisError>;
  readonly chartAt: (
    jd: number,
    latitude: number,
    longitude: number,
  ) => Effect.Effect<Chart, EphemerisError>;
  readonly position: (id: BodyId, jd: number) => Effect.Effect<Position, EphemerisError>;
  readonly transitAspects: (
    chart: Chart,
    jd: number,
    options?: Parameters<typeof caelusTransitAspects>[3],
  ) => Effect.Effect<ReturnType<typeof caelusTransitAspects>, EphemerisError>;
  readonly compositePlacements: (
    jdA: number,
    jdB: number,
  ) => Effect.Effect<ReturnType<typeof caelusCompositePlacements>, EphemerisError>;
}

export class Ephemeris extends Context.Service<Ephemeris, EphemerisService>()(
  "compass/core/Ephemeris",
) {
  static readonly layer = Layer.sync(Ephemeris, () => {
    const engine = new Engine(embeddedData);

    const chart = Effect.fn("Ephemeris.chart")(function* (
      whenUtc: DateTime.Utc,
      latitude: number,
      longitude: number,
    ) {
      const parts = DateTime.toPartsUtc(whenUtc);
      try {
        return engine.chart(
          parts.year,
          parts.month,
          parts.day,
          parts.hour,
          parts.minute,
          parts.second,
          latitude,
          longitude,
          {
            houseSystem: normalizeHouseSystem(JWGEA_HOUSE_SYSTEM),
            zodiac: "tropical",
            bodies: ["true_lilith"],
          },
        );
      } catch (err) {
        return yield* new EphemerisError({
          message: Predicate.isError(err) ? err.message : String(err),
          date: DateTime.formatIso(whenUtc),
        });
      }
    });

    const chartAt = Effect.fn("Ephemeris.chartAt")(function* (
      jd: number,
      latitude: number,
      longitude: number,
    ) {
      try {
        return engine.chartAt(jd, latitude, longitude, {
          houseSystem: normalizeHouseSystem(JWGEA_HOUSE_SYSTEM),
          zodiac: "tropical",
          bodies: ["true_lilith"],
        });
      } catch (err) {
        return yield* new EphemerisError({
          message: Predicate.isError(err) ? err.message : String(err),
        });
      }
    });

    const position = Effect.fn("Ephemeris.position")(function* (id: BodyId, jd: number) {
      try {
        return engine.position(id, jd);
      } catch (err) {
        return yield* new EphemerisError({
          message: Predicate.isError(err) ? err.message : String(err),
          body: id,
        });
      }
    });

    const transitAspects = Effect.fn("Ephemeris.transitAspects")(function* (
      chartData: Chart,
      jd: number,
      options?: Parameters<typeof caelusTransitAspects>[3],
    ) {
      try {
        return caelusTransitAspects(
          chartData,
          engine,
          jd,
          options ?? {
            maxOrb: 6,
            zodiac: "tropical",
          },
        );
      } catch (err) {
        return yield* new EphemerisError({
          message: Predicate.isError(err) ? err.message : String(err),
        });
      }
    });

    const compositePlacements = Effect.fn("Ephemeris.compositePlacements")(function* (
      jdA: number,
      jdB: number,
    ) {
      try {
        return caelusCompositePlacements(engine, jdA, jdB);
      } catch (err) {
        return yield* new EphemerisError({
          message: Predicate.isError(err) ? err.message : String(err),
        });
      }
    });

    return Ephemeris.of({
      chart,
      chartAt,
      position,
      transitAspects,
      compositePlacements,
    });
  });
}
