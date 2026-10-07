import { spawn } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";
const cli = existsSync("node_modules/firebase-tools/lib/bin/firebase.js")
  ? "node_modules/firebase-tools/lib/bin/firebase.js"
  : join(
      process.env.APPDATA,
      "npm/node_modules/firebase-tools/lib/bin/firebase.js",
    );
const java21 = "C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot";
const env = { ...process.env };
if (process.platform === "win32" && existsSync(java21)) {
  env.JAVA_HOME = java21;
  env.PATH = join(java21, "bin") + ";" + process.env.PATH;
}
const command = "node --test --test-concurrency=1 tests/firebase/*.test.mjs";
const child = spawn(
  process.execPath,
  [
    cli,
    "emulators:exec",
    "--only",
    "auth,functions,firestore,storage",
    "--config",
    "firebase.test.json",
    "--project",
    "demo-conecta-tp5-test",
    command,
  ],
  { stdio: "inherit", env },
);
child.on("exit", (code) => (process.exitCode = code || 0));
child.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
