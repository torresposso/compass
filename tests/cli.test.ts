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
    expect(res.whenUtc).toBe("2024-03-21T12:00:00.000Z");
    expect(res.location).toBeDefined();
    expect(res.bodies).toBeDefined();
    expect(res.houses).toBeDefined();
    expect(res.aspects).toBeDefined();
    expect(res.jwgea).toBeDefined();
  });

  it("handles profile CRUD and chart natal via CLI commands", async () => {
    const {
      profileAddCommand,
      profileListCommand,
      profileGetCommand,
      chartNatalCommand,
      profileDeleteCommand,
    } = await import("../src/cli/App.js");

    // Add profile
    const added = (await profileAddCommand(
      [
        "--slug",
        "carl-jung",
        "--name",
        "Carl Gustav Jung",
        "--whenUtc",
        "1875-07-26T19:32:00Z",
        "--latitude",
        "47.5596",
        "--longitude",
        "7.5886",
      ],
      undefined,
    )) as Record<string, unknown>;
    expect(added.status).toBe("created");

    // List profiles
    const list = (await profileListCommand([], undefined)) as Record<string, unknown>;
    expect(Number(list.count)).toBeGreaterThanOrEqual(1);

    // Get profile
    const fetched = (await profileGetCommand(["carl-jung"], undefined)) as Record<string, unknown>;
    expect(fetched.name).toBe("Carl Gustav Jung");

    // Chart natal for profile
    const chart = (await chartNatalCommand(["carl-jung"], undefined)) as Record<string, unknown>;
    expect(chart.profile).toBeDefined();
    expect((chart.profile as Record<string, unknown>).slug).toBe("carl-jung");
    expect(chart.jwgea).toBeDefined();

    // Delete profile
    const deleted = (await profileDeleteCommand(["carl-jung"], undefined)) as Record<
      string,
      unknown
    >;
    expect(deleted.status).toBe("deleted");
  });
});
