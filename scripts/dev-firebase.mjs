import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { createServer } from "vite";
const project = "san-francisco-conecta-tp5";
const test = process.argv.includes("--test"),
  offline = process.argv.includes("--offline");
const globalCli =
  process.platform === "win32"
    ? join(
        process.env.APPDATA,
        "npm/node_modules/firebase-tools/lib/bin/firebase.js",
      )
    : "";
const cli = existsSync("node_modules/firebase-tools/lib/bin/firebase.js")
  ? resolve("node_modules/firebase-tools/lib/bin/firebase.js")
  : globalCli;
if (!existsSync(cli))
  throw new Error("Instalá Firebase CLI con npm install -g firebase-tools.");
const java21 = "C:/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot";
const childEnv = { ...process.env };
if (process.platform === "win32" && existsSync(java21)) {
  childEnv.JAVA_HOME = java21;
  childEnv.PATH = join(java21, "bin") + ";" + process.env.PATH;
}
mkdirSync(".firebase", { recursive: true });
const services =
  (test || offline ? "auth," : "") + "functions,firestore,storage";
const args = [cli, "emulators:start", "--only", services, "--project", project];
if (!test) {
  args.push("--export-on-exit", ".firebase/data");
  if (existsSync(".firebase/data/firebase-export-metadata.json"))
    args.push("--import", ".firebase/data");
}
const emulator = spawn(process.execPath, args, {
  stdio: "inherit",
  env: childEnv,
});
emulator.on("error", (e) => {
  console.error(e.message);
  process.exit(1);
});
async function waitForEmulators() {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch("http://127.0.0.1:4405/emulators");
      const value = await r.json();
      if (value.functions && value.firestore && value.storage) {
        const health=await fetch(`http://127.0.0.1:5001/${project}/southamerica-east1/bootstrapResident`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"data":{}}'});
        if(health.status===401)return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(
    "Firebase Emulator Suite no pudo iniciarse. Revisá su salida.",
  );
}
let vite,
  worker,
  stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await vite?.close();
  worker?.kill();
  emulator.kill("SIGINT");
  setTimeout(() => process.exit(), 5000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
emulator.on("exit", () => {
  if (!stopping) {
    console.error("Firebase se detuvo.");
    process.exitCode = 1;
  }
  vite?.close();
  worker?.kill();
});
try {
  await waitForEmulators();
  process.env.VITE_FIREBASE_AUTH_EMULATOR = test || offline ? "true" : "false";
  process.env.VITE_FIREBASE_EMULATORS = "true";
  vite = await createServer({
    mode: test ? "test" : "development",
    server: { port: test ? 5176 : 5175, strictPort: true },
  });
  await vite.listen();
  vite.printUrls();
  worker = spawn(process.execPath, ["scripts/reminder-worker.mjs"], {
    stdio: "inherit",
    env: {
      ...childEnv,
      GCLOUD_PROJECT: project,
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085",
      FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
    },
  });
  console.log(
    "Cuenta: Google " +
      (test || offline
        ? "en Auth Emulator"
        : "con Firebase Authentication real") +
      ". APIs y datos: Firebase local",
  );
} catch (e) {
  console.error(e.message);
  await stop();
  process.exitCode = 1;
}
