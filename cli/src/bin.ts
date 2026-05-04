#!/usr/bin/env node
import { runCli } from "./index.js";

runCli(process.argv).then(
  (code) => process.exit(code),
  (e) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  },
);
