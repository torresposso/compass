import { Schema } from "effect";
import type { EphemerisError } from "./Ephemeris.js";
import type {
  DatabaseError,
  ProfileAlreadyExistsError,
  ProfileNotFoundError,
} from "./ProfileStore.js";

/**
 * Raised when input validation fails (invalid dates, invalid coordinates, missing required parameters).
 */
export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  message: Schema.String,
  field: Schema.optional(Schema.String),
  issues: Schema.optional(Schema.Array(Schema.String)),
}) {}

// Re-export specific domain errors for convenience
export { EphemerisError } from "./Ephemeris.js";
export {
  DatabaseError,
  ProfileAlreadyExistsError,
  ProfileNotFoundError,
} from "./ProfileStore.js";

/**
 * Union of all domain errors in Compass.
 */
export type DomainError =
  | ValidationError
  | EphemerisError
  | ProfileNotFoundError
  | ProfileAlreadyExistsError
  | DatabaseError;
