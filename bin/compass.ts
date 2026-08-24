#!/usr/bin/env bun
import { tryFastPath } from "axi-sdk-js/fast-path";
import { VERSION } from "../src/version.js";

const argv = process.argv.slice(2);

// Fast path handles --version / -v before importing heavy modules
if (!tryFastPath(argv, { version: VERSION })) {
  const { main } = await import("../src/cli/app.js");
  await main(argv);
}
