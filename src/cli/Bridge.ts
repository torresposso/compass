import { AxiError } from "axi-sdk-js";
import { Cause, Effect, Exit, type Layer, Schema } from "effect";
import {
  DatabaseError,
  EphemerisError,
  ProfileAlreadyExistsError,
  ProfileNotFoundError,
  ValidationError,
} from "../core/Errors.js";

export type AxiStructuredOutput = Record<string, unknown>;
export type AxiRenderable = string | AxiStructuredOutput;

/**
 * Maps a typed DomainError, SchemaError, or unknown defect from Effect to an AxiError with suggestions.
 */
export function mapErrorToAxi(error: unknown): AxiError {
  if (error instanceof ValidationError) {
    const suggestions: string[] =
      error.issues && error.issues.length > 0
        ? [...error.issues]
        : ["Check input parameters and format."];
    return new AxiError(error.message, "VALIDATION_ERROR", suggestions);
  }

  if (Schema.isSchemaError(error)) {
    return new AxiError(error.message, "VALIDATION_ERROR", [
      "Check input parameters against the required schema.",
    ]);
  }

  if (error instanceof ProfileNotFoundError) {
    return new AxiError(error.message, "NOT_FOUND", [
      "Run 'compass profile list' to see all available profiles.",
    ]);
  }

  if (error instanceof ProfileAlreadyExistsError) {
    return new AxiError(error.message, "ALREADY_EXISTS", [
      "Specify a different profile name or update the existing profile.",
    ]);
  }

  if (error instanceof EphemerisError) {
    return new AxiError(error.message, "ENGINE_ERROR", [
      "Ensure date is within ephemeris range (1800-2100) and house system is supported.",
    ]);
  }

  if (error instanceof DatabaseError) {
    return new AxiError(error.message, "DATABASE_ERROR", [
      "Ensure the database directory is writable and database is not locked.",
    ]);
  }

  if (error instanceof AxiError) {
    return error;
  }

  if (error instanceof Error) {
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
        return value as Record<string, unknown>;
      }
      return String(value);
    },
    onFailure: (cause) => handleCauseToAxi(cause),
  });
}
