import { describe, expect, it } from "bun:test";
import type { Chart, ChartBody } from "caelus";
import { computeJwgea } from "../src/core/jwgea.js";

function body(lon: number, sign: string): ChartBody {
  return {
    lon,
    speed: 0,
    retrograde: false,
    sign,
    signDeg: 0,
    lat: 0,
    dist: 1,
    ra: 0,
    dec: 0,
    house: 1,
    dignities: [],
  };
}

function chartWith(
  trueNodeLon: number,
  trueNodeSign: string,
  plutoLon: number,
  extraBodies: Record<string, ChartBody> = {},
): Chart {
  return {
    jdUt: 2451545,
    zodiac: "tropical",
    houseSystem: "placidus",
    houseSystemRequested: "placidus",
    bodies: {
      pluto: body(plutoLon, "Aries"),
      true_node: body(trueNodeLon, trueNodeSign),
      ...extraBodies,
    },
    unavailable: [],
    warnings: [],
    angles: { asc: 0, mc: 0, vertex: 0, eastPoint: 0 },
    cusps: [],
    aspects: [],
  } as unknown as Chart;
}

describe("computeJwgea", () => {
  it("derives PPP from Pluto longitude + 180 and uses modern rulers", () => {
    // true node at 210deg -> Scorpio -> modern ruler Pluto
    const chart = chartWith(210, "Scorpio", 45);
    const jwgea = computeJwgea(chart);

    expect(jwgea.plutoPolarityPoint).toBeCloseTo(225, 5);
    expect(jwgea.northNodeSign).toBe("Scorpio");
    expect(jwgea.northNodeRuler).toBe("pluto");
    // South node = 210 + 180 = 390 % 360 = 30 -> Taurus -> Venus
    expect(jwgea.southNodeSign).toBe("Taurus");
    expect(jwgea.southNodeRuler).toBe("venus");
  });

  it("resolves Aquarius node to Uranus (modern rulership)", () => {
    const chart = chartWith(330, "Aquarius", 10);
    const jwgea = computeJwgea(chart);

    expect(jwgea.northNodeSign).toBe("Aquarius");
    expect(jwgea.northNodeRuler).toBe("uranus");
  });

  it("collects skipped steps as planets squaring the nodal axis", () => {
    // true node at 0 (Aries). Mars at 90 (Cancer) squares it; Sun at 0 conjuncts it.
    const chart = chartWith(0, "Aries", 45, {
      mars: body(90, "Cancer"),
      sun: body(0, "Aries"),
    });
    const jwgea = computeJwgea(chart);

    expect(jwgea.skippedSteps).toContain("mars");
    expect(jwgea.skippedSteps).not.toContain("sun");
    expect(jwgea.skippedSteps).not.toContain("true_node");
  });

  it("throws when Pluto is unavailable", () => {
    const chart = {
      ...chartWith(210, "Scorpio", 45),
      bodies: { true_node: body(210, "Scorpio") },
    } as unknown as Chart;

    expect(() => computeJwgea(chart)).toThrow(/Pluto/);
  });
});
