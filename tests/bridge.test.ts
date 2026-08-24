import { describe, expect, it } from "bun:test";
import { AxiError } from "axi-sdk-js";
import { Effect, Layer, Schema } from "effect";
import { runEffectToAxi } from "../src/cli/bridge.js";
import {
  DatabaseError,
  EphemerisError,
  ProfileNotFoundError,
  ValidationError,
} from "../src/core/errors.js";
import { Latitude } from "../src/core/schema.js";

describe("runEffectToAxi Bridge", () => {
  it("unwraps successful effect returning primitive string", async () => {
    const program = Effect.succeed("Hello AXI");
    const result = await runEffectToAxi(program);
    expect(result).toBe("Hello AXI");
  });

  it("unwraps successful effect returning structured record", async () => {
    const program = Effect.succeed({ status: "ok", count: 42 });
    const result = await runEffectToAxi(program);
    expect(result).toEqual({ status: "ok", count: 42 });
  });

  it("maps ValidationError to AxiError with suggestions", async () => {
    const program = Effect.fail(
      new ValidationError({
        message: "Invalid latitude",
        field: "lat",
        issues: ["Latitude must be between -90 and 90 degrees"],
      }),
    );

    try {
      await runEffectToAxi(program);
      expect().fail("Should have thrown AxiError");
    } catch (err) {
      expect(err).toBeInstanceOf(AxiError);
      const axiErr = err as AxiError;
      expect(axiErr.code).toBe("VALIDATION_ERROR");
      expect(axiErr.message).toBe("Invalid latitude");
      expect(axiErr.suggestions).toEqual(["Latitude must be between -90 and 90 degrees"]);
    }
  });

  it("maps native Effect Schema.decodeUnknown errors to VALIDATION_ERROR", async () => {
    const decodeLatitude = Schema.decodeUnknownEffect(Latitude);
    const program = decodeLatitude(999); // 999 is out of [-90, 90]

    try {
      await runEffectToAxi(program);
      expect().fail("Should have thrown AxiError");
    } catch (err) {
      expect(err).toBeInstanceOf(AxiError);
      const axiErr = err as AxiError;
      expect(axiErr.code).toBe("VALIDATION_ERROR");
    }
  });

  it("maps ProfileNotFoundError to AxiError with NOT_FOUND code", async () => {
    const program = Effect.fail(
      new ProfileNotFoundError({
        name: "unknown-person",
        message: "Profile 'unknown-person' does not exist",
      }),
    );

    try {
      await runEffectToAxi(program);
      expect().fail("Should have thrown AxiError");
    } catch (err) {
      expect(err).toBeInstanceOf(AxiError);
      const axiErr = err as AxiError;
      expect(axiErr.code).toBe("NOT_FOUND");
    }
  });

  it("maps EphemerisError to AxiError with ENGINE_ERROR code", async () => {
    const program = Effect.fail(
      new EphemerisError({
        message: "Date 1492-10-12 out of valid ephemeris bounds",
        date: "1492-10-12",
      }),
    );

    try {
      await runEffectToAxi(program);
      expect().fail("Should have thrown AxiError");
    } catch (err) {
      expect(err).toBeInstanceOf(AxiError);
      const axiErr = err as AxiError;
      expect(axiErr.code).toBe("ENGINE_ERROR");
    }
  });

  it("maps DatabaseError to AxiError with DATABASE_ERROR code", async () => {
    const program = Effect.fail(
      new DatabaseError({
        message: "SQLite busy: database is locked",
        operation: "insert",
      }),
    );

    try {
      await runEffectToAxi(program);
      expect().fail("Should have thrown AxiError");
    } catch (err) {
      expect(err).toBeInstanceOf(AxiError);
      const axiErr = err as AxiError;
      expect(axiErr.code).toBe("DATABASE_ERROR");
    }
  });

  it("runs effect with provided Layer", async () => {
    const program = Effect.gen(function* () {
      yield* Effect.logDebug("running test effect");
      return { success: true };
    });

    const result = await runEffectToAxi(program, Layer.empty);
    expect(result).toEqual({ success: true });
  });

  it("maps interrupted effect to INTERRUPTED error code", async () => {
    const program = Effect.interrupt;

    try {
      await runEffectToAxi(program);
      expect().fail("Should have thrown AxiError");
    } catch (err) {
      expect(err).toBeInstanceOf(AxiError);
      const axiErr = err as AxiError;
      expect(axiErr.code).toBe("INTERRUPTED");
    }
  });
});
