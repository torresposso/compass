import { Schema } from "effect";

/**
 * Raised when input validation fails (invalid dates, invalid coordinates, missing required parameters).
 */
export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  message: Schema.String,
  field: Schema.optional(Schema.String),
  issues: Schema.optional(Schema.Array(Schema.String)),
}) {}

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
 * Raised when a profile identifier or slug is not found in the persistence store.
 */
export class ProfileNotFoundError extends Schema.TaggedError<ProfileNotFoundError>()(
  "ProfileNotFoundError",
  {
    name: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Raised when attempting to create a profile with a name/slug that already exists.
 */
export class ProfileAlreadyExistsError extends Schema.TaggedError<ProfileAlreadyExistsError>()(
  "ProfileAlreadyExistsError",
  {
    name: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Raised when a persistence or SQLite operation fails.
 */
export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  message: Schema.String,
  operation: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

/**
 * Union of all domain errors in Compass.
 */
export type DomainError =
  | ValidationError
  | EphemerisError
  | ProfileNotFoundError
  | ProfileAlreadyExistsError
  | DatabaseError;
