import {
  type BodyId,
  type Chart,
  type ChartOptions,
  compositePlacements as caelusCompositePlacements,
  synastryAspects as caelusSynastryAspects,
  synastryOverlays as caelusSynastryOverlays,
  transitAspects as caelusTransitAspects,
  Engine,
  julianDay,
  type Position,
} from "caelus";
import { Context, DateTime, Effect, Layer, Predicate, Schema } from "effect";

/** The canonical house system of JWGEA */
export const JWGEA_HOUSE_SYSTEM = "porphyry";

/** Default maximum aspect orb in degrees */
export const TRANSIT_MAX_ORB = 6;

/** Standard chart options invariant for JWGEA */
export const CHART_OPTIONS: ChartOptions = {
  houseSystem: JWGEA_HOUSE_SYSTEM,
  zodiac: "tropical",
  bodies: ["true_lilith"],
};

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
 * Convert DateTime.Utc to Julian Day (UT) with millisecond precision.
 */
export function dateTimeToJulianDay(dt: DateTime.Utc): number {
  const parts = DateTime.toPartsUtc(dt);
  return julianDay(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second + parts.millisecond / 1000,
  );
}

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
  readonly longitude: (id: BodyId, jd: number) => Effect.Effect<number, EphemerisError>;
  readonly transitAspects: (
    chart: Chart,
    jd: number,
    options?: Parameters<typeof caelusTransitAspects>[3],
  ) => Effect.Effect<ReturnType<typeof caelusTransitAspects>, EphemerisError>;
  readonly synastryAspects: (
    chartA: Chart,
    chartB: Chart,
    maxOrb?: number,
    orbs?: Record<string, number>,
  ) => Effect.Effect<ReturnType<typeof caelusSynastryAspects>, EphemerisError>;
  readonly synastryOverlays: (
    chartA: Chart,
    chartB: Chart,
  ) => Effect.Effect<ReturnType<typeof caelusSynastryOverlays>, EphemerisError>;
  readonly compositePlacements: (
    jdA: number,
    jdB: number,
  ) => Effect.Effect<ReturnType<typeof caelusCompositePlacements>, EphemerisError>;
}

export class Ephemeris extends Context.Service<Ephemeris, EphemerisService>()(
  "compass/core/Ephemeris",
) {
  static readonly layer = Layer.effect(
    Ephemeris,
    Effect.gen(function* () {
      const { embeddedData } = yield* Effect.promise(() => import("caelus/data-embedded"));
      const engine = new Engine(embeddedData);

      const chartAt = Effect.fn("Ephemeris.chartAt")(
        (jd: number, latitude: number, longitude: number) =>
          Effect.try({
            try: () => engine.chartAt(jd, latitude, longitude, CHART_OPTIONS),
            catch: (err) =>
              new EphemerisError({
                message: Predicate.isError(err) ? err.message : String(err),
              }),
          }),
      );

      const chart = Effect.fn("Ephemeris.chart")(
        (whenUtc: DateTime.Utc, latitude: number, longitude: number) =>
          chartAt(dateTimeToJulianDay(whenUtc), latitude, longitude),
      );

      const position = Effect.fn("Ephemeris.position")((id: BodyId, jd: number) =>
        Effect.try({
          try: () => engine.position(id, jd),
          catch: (err) =>
            new EphemerisError({
              message: Predicate.isError(err) ? err.message : String(err),
              body: id,
            }),
        }),
      );

      const longitude = Effect.fn("Ephemeris.longitude")((id: BodyId, jd: number) =>
        Effect.try({
          try: () => engine.longitude(id, jd),
          catch: (err) =>
            new EphemerisError({
              message: Predicate.isError(err) ? err.message : String(err),
              body: id,
            }),
        }),
      );

      const transitAspects = Effect.fn("Ephemeris.transitAspects")(
        (chartData: Chart, jd: number, options?: Parameters<typeof caelusTransitAspects>[3]) =>
          Effect.try({
            try: () =>
              caelusTransitAspects(
                chartData,
                engine,
                jd,
                options ?? {
                  maxOrb: TRANSIT_MAX_ORB,
                  zodiac: "tropical",
                },
              ),
            catch: (err) =>
              new EphemerisError({
                message: Predicate.isError(err) ? err.message : String(err),
              }),
          }),
      );

      const synastryAspects = Effect.fn("Ephemeris.synastryAspects")(
        (chartA: Chart, chartB: Chart, maxOrb?: number, orbs?: Record<string, number>) =>
          Effect.try({
            try: () => caelusSynastryAspects(chartA, chartB, maxOrb ?? TRANSIT_MAX_ORB, orbs),
            catch: (err) =>
              new EphemerisError({
                message: Predicate.isError(err) ? err.message : String(err),
              }),
          }),
      );

      const synastryOverlays = Effect.fn("Ephemeris.synastryOverlays")(
        (chartA: Chart, chartB: Chart) =>
          Effect.try({
            try: () => caelusSynastryOverlays(chartA, chartB),
            catch: (err) =>
              new EphemerisError({
                message: Predicate.isError(err) ? err.message : String(err),
              }),
          }),
      );

      const compositePlacements = Effect.fn("Ephemeris.compositePlacements")(
        (jdA: number, jdB: number) =>
          Effect.try({
            try: () => caelusCompositePlacements(engine, jdA, jdB),
            catch: (err) =>
              new EphemerisError({
                message: Predicate.isError(err) ? err.message : String(err),
              }),
          }),
      );

      return Ephemeris.of({
        chart,
        chartAt,
        position,
        longitude,
        transitAspects,
        synastryAspects,
        synastryOverlays,
        compositePlacements,
      });
    }),
  );
}
