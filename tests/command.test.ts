import { describe, expect, it } from "bun:test";
import { AxiError } from "axi-sdk-js";
import { Effect, Schema } from "effect";
import { makeCommand, parseArgvToObject } from "../src/cli/Command.js";

describe("makeCommand Dispatcher", () => {
  it("parses and coerces argv flags correctly", () => {
    const raw = parseArgvToObject(["natal", "--lat", "-34.6", "--verbose", "--name", "erik"]);
    expect(raw).toEqual({
      lat: -34.6,
      verbose: true,
      name: "erik",
      _: ["natal"],
    });
  });

  it("decodes input with Schema and runs effect handler", async () => {
    const InputSchema = Schema.Struct({
      name: Schema.String,
      age: Schema.Number,
    });

    const command = makeCommand(InputSchema, (input) =>
      Effect.gen(function* () {
        yield* Effect.logDebug("handling test command");
        return `Hello ${input.name}, age ${input.age}`;
      }),
    );

    const result = await command(["--name", "Erik", "--age", "30"], undefined);
    expect(result).toBe("Hello Erik, age 30");
  });

  it("fails with VALIDATION_ERROR if required flags are missing", async () => {
    const InputSchema = Schema.Struct({
      name: Schema.String,
      age: Schema.Number,
    });

    const command = makeCommand(InputSchema, (input) => Effect.succeed(input));

    try {
      await command(["--name", "Erik"], undefined);
      expect().fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AxiError);
      const axiErr = err as AxiError;
      expect(axiErr.code).toBe("VALIDATION_ERROR");
    }
  });
});
