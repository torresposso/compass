import { describe, expect, it } from "bun:test";
import { tryFastPath } from "axi-sdk-js/fast-path";
import { pingCommand } from "../src/cli/App.js";
import { VERSION } from "../src/Version.js";

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
    expect(typeof res.timestamp).toBe("string");
  });

  it("calculates chart on the fly via chart calculate command", async () => {
    const { chartCalculateCommand } = await import("../src/cli/App.js");
    const result = await chartCalculateCommand(
      ["--whenUtc", "2024-03-21T12:00:00Z", "--latitude", "-34.6037", "--longitude", "-58.3816"],
      undefined,
    );
    expect(result).toBeObject();
    const res = result as Record<string, unknown>;
    expect(res.whenUtc).toBe("2024-03-21T12:00:00Z");
    expect(res.location).toBeDefined();
    expect(res.bodies).toBeDefined();
    expect(res.houses).toBeDefined();
    expect(res.aspects).toBeDefined();
    expect(res.jwgea).toBeDefined();
  });
});
