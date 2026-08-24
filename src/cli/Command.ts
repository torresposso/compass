import type { AxiCliCommand } from "axi-sdk-js";
import { Effect, type Layer, Schema } from "effect";
import { type AxiRenderable, runEffectToAxi } from "./Bridge.js";

/**
 * Creates an AXI CLI command that parses raw string flags/arguments using an Effect Schema,
 * passes the decoded strongly-typed payload to the effect handler, and renders the result.
 *
 * @param schema Effect Schema describing the expected input object or arguments
 * @param handler Function accepting decoded input and returning an Effect computation
 * @param layer Optional Layer to provide dependencies
 */
export function makeCommand<A, E, R, Context = undefined>(
  schema: Schema.Schema<A>,
  handler: (input: A) => Effect.Effect<AxiRenderable, E, R>,
  layer?: Layer.Layer<R, unknown, never>,
): AxiCliCommand<Context> {
  const decode = Schema.decodeUnknownEffect(schema);

  return async (args: string[]) => {
    const rawInput = parseArgvToObject(args);
    const program = decode(rawInput).pipe(
      Effect.flatMap((validInput) => handler(validInput)),
    ) as Effect.Effect<AxiRenderable, E | Schema.SchemaError, R>;

    return runEffectToAxi(program, layer);
  };
}

/**
 * Helper to convert CLI argv strings (e.g. `["--when", "2024-01-01", "--lat", "-34.6"]`)
 * into a key-value object for Schema decoding.
 */
export function parseArgvToObject(args: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !isFlag(next)) {
        result[key] = coercePrimitive(next);
        i++;
      } else {
        result[key] = true;
      }
    } else if (arg.startsWith("-") && arg.length > 1 && !isNumeric(arg)) {
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next !== undefined && !isFlag(next)) {
        result[key] = coercePrimitive(next);
        i++;
      } else {
        result[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    result._ = positional;
  }

  return result;
}

function isFlag(val: string): boolean {
  return (
    (val.startsWith("--") && val.length > 2) ||
    (val.startsWith("-") && val.length > 1 && !isNumeric(val))
  );
}

function isNumeric(val: string): boolean {
  if (val.trim() === "") return false;
  return !Number.isNaN(Number(val));
}

function coercePrimitive(val: string): unknown {
  if (val === "true") return true;
  if (val === "false") return false;
  if (isNumeric(val)) {
    return Number(val);
  }
  return val;
}
