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

  it("handles profile CRUD and full multi-chart CLI commands", async () => {
    const {
      profileAddCommand,
      profileListCommand,
      profileGetCommand,
      chartNatalCommand,
      chartProgressedCommand,
      chartTransitsCommand,
      chartSynastryCommand,
      chartCompositeCommand,
      profileDeleteCommand,
    } = await import("../src/cli/App.js");

    // Add profile A (Carl Jung)
    const addedA = (await profileAddCommand(
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
    expect(addedA.status).toBe("created");

    // Add profile B (Sigmund Freud)
    const addedB = (await profileAddCommand(
      [
        "--slug",
        "sigmund-freud",
        "--name",
        "Sigmund Freud",
        "--whenUtc",
        "1856-05-06T18:30:00Z",
        "--latitude",
        "49.5955",
        "--longitude",
        "18.1436",
      ],
      undefined,
    )) as Record<string, unknown>;
    expect(addedB.status).toBe("created");

    // List profiles
    const list = (await profileListCommand([], undefined)) as Record<string, unknown>;
    expect(Number(list.count)).toBeGreaterThanOrEqual(2);

    // Get profile
    const fetched = (await profileGetCommand(["carl-jung"], undefined)) as Record<string, unknown>;
    expect(fetched.name).toBe("Carl Gustav Jung");

    // Chart natal
    const chart = (await chartNatalCommand(["carl-jung"], undefined)) as Record<string, unknown>;
    expect(chart.profile).toBeDefined();
    expect((chart.profile as Record<string, unknown>).slug).toBe("carl-jung");
    expect(chart.jwgea).toBeDefined();

    // Chart progressed
    const progressed = (await chartProgressedCommand(
      ["carl-jung", "--targetUtc", "1913-01-01T00:00:00Z"],
      undefined,
    )) as Record<string, unknown>;
    expect(progressed.kind).toBe("progressed");
    expect(progressed.jwgea).toBeDefined();

    // Chart transits
    const transits = (await chartTransitsCommand(
      ["carl-jung", "--transitUtc", "1913-01-01T00:00:00Z"],
      undefined,
    )) as Record<string, unknown>;
    expect(transits.kind).toBe("transits");
    expect(Array.isArray(transits.hits)).toBe(true);

    // Chart synastry
    const synastry = (await chartSynastryCommand(
      ["carl-jung", "sigmund-freud"],
      undefined,
    )) as Record<string, unknown>;
    expect(synastry.kind).toBe("synastry");
    expect(synastry.aspects).toBeDefined();
    expect(synastry.overlays).toBeDefined();

    // Chart composite
    const composite = (await chartCompositeCommand(
      ["carl-jung", "sigmund-freud"],
      undefined,
    )) as Record<string, unknown>;
    expect(composite.kind).toBe("composite");
    expect(composite.jwgea).toBeDefined();

    // Delete profiles
    await profileDeleteCommand(["carl-jung"], undefined);
    await profileDeleteCommand(["sigmund-freud"], undefined);
  });
});
