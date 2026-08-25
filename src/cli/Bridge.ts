import { AxiError } from "axi-sdk-js";
import { Cause, Effect, Exit, type Layer, Predicate, Schema } from "effect";

export type AxiStructuredOutput = Record<string, unknown>;
export type AxiRenderable = string | AxiStructuredOutput;

/**
 * Maps a typed domain error, SchemaError, or unknown defect from Effect to an AxiError with suggestions.
 */
export function mapErrorToAxi(error: unknown): AxiError {
  if (Schema.isSchemaError(error)) {
    return new AxiError(error.message, "VALIDATION_ERROR", [
      "Check input parameters against the required schema.",
    ]);
  }

  if (typeof error === "object" && error !== null && "_tag" in error) {
    const tagged = error as { _tag: string; message: string; [key: string]: unknown };
    switch (tagged._tag) {
      case "ProfileNotFoundError":
        return new AxiError(tagged.message, "NOT_FOUND", [
          "Run 'compass profile list' to see all available profiles.",
        ]);
      case "ProfileAlreadyExistsError":
        return new AxiError(tagged.message, "ALREADY_EXISTS", [
          "Specify a different profile slug or delete the existing profile.",
        ]);
      case "EphemerisError":
        return new AxiError(tagged.message, "ENGINE_ERROR", [
          "Ensure date is within ephemeris range (1800-2100) and house system is supported.",
        ]);
      case "DatabaseError":
        return new AxiError(tagged.message, "DATABASE_ERROR", [
          "Ensure the database directory is writable and database is not locked.",
        ]);
    }
  }

  if (error instanceof AxiError) {
    return error;
  }

  if (Predicate.isError(error)) {
    return new AxiError(error.message, "INTERNAL_ERROR");
  }

  return new AxiError(String(error), "INTERNAL_ERROR");
}

/**
 * Extracts failure value from Effect Cause and throws corresponding AxiError.
 */
export function handleCauseToAxi(cause: Cause.Cause<unknown>): never {
  if (Cause.hasInterruptsOnly(cause)) {
    throw new AxiError("Operation was interrupted", "INTERRUPTED");
  }

  for (const reason of cause.reasons) {
    if (Cause.isFailReason(reason)) {
      throw mapErrorToAxi(reason.error);
    }
    if (Cause.isDieReason(reason)) {
      throw mapErrorToAxi(reason.defect);
    }
  }

  throw new AxiError(Cause.pretty(cause), "INTERNAL_ERROR");
}

/**
 * Runs an Effect computation and unwraps the result into an AxiRenderable,
 * translating typed DomainErrors to AxiError on failure.
 *
 * @param effect The Effect program to run
 * @param layer Optional Layer providing dependencies (e.g. Database, Engine)
 */
export async function runEffectToAxi<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer?: Layer.Layer<R, unknown, never>,
): Promise<AxiRenderable> {
  const runnable = layer ? Effect.provide(effect, layer) : (effect as Effect.Effect<A, E, never>);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onSuccess: (value) => {
      if (typeof value === "string") {
        return value;
      }
      if (value && typeof value === "object") {
        return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
      }
      return String(value);
    },
    onFailure: (cause) => handleCauseToAxi(cause),
  });
}
