import { describe, expect, it } from "bun:test";
import { tryFastPath } from "axi-sdk-js/fast-path";
import { pingCommand } from "../src/cli/app.js";
import { VERSION } from "../src/version.js";

describe("CLI Entrypoint & Fast-Path", () => {
  it("tryFastPath intercepts --version flag", () => {
    let captured = "";
    const handled = tryFastPath(["--version"], {
      version: VERSION,
      stdout: { write: (chunk: string) => (captured += chunk) },
    });

    expect(handled).toBe(true);
    expect(captured).toContain(VERSION);
  });

  it("tryFastPath intercepts -v flag", () => {
    let captured = "";
    const handled = tryFastPath(["-v"], {
      version: VERSION,
      stdout: { write: (chunk: string) => (captured += chunk) },
    });

    expect(handled).toBe(true);
    expect(captured).toContain(VERSION);
  });

  it("tryFastPath returns false on normal commands", () => {
    const handled = tryFastPath(["ping"], { version: VERSION });
    expect(handled).toBe(false);
  });

  it("executes ping smoke test command via bridge", async () => {
    const result = await pingCommand([], undefined);
    expect(result).toBeObject();
    const res = result as Record<string, unknown>;
    expect(res.status).toBe("ok");
    expect(res.name).toBe("compass");
    expect(res.version).toBe(VERSION);
  });
});
