import type { AxiCliCommand } from "axi-sdk-js";
import { DateTime, Effect, Schema } from "effect";
import { VERSION } from "../../Version.js";
import { makeCommand } from "../Command.js";

/**
 * Ping handler defined with Effect.fn for proper span tracing & debugging.
 */
export const handlePing = Effect.fn("handlePing")(function* (_: Record<string, never>) {
  yield* Effect.logDebug("executing ping smoke test");
  const now = yield* DateTime.now;
  return {
    status: "ok",
    name: "compass",
    version: VERSION,
    engine: "caelus+effect",
    timestamp: DateTime.formatIso(now),
  };
});

export const pingCommand: AxiCliCommand<undefined> = makeCommand(Schema.Struct({}), handlePing);
