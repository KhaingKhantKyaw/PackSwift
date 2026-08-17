import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const client = path.join(dist, "client");
const server = path.join(dist, "server");
const hostingDirectory = path.join(dist, ".openai");

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });
await mkdir(hostingDirectory, { recursive: true });
await cp(path.join(root, "public"), client, { recursive: true });
await cp(
  path.join(root, ".openai", "hosting.json"),
  path.join(hostingDirectory, "hosting.json"),
);

const workerSource = await readFile(
  path.join(root, "worker", "hosted-worker.mjs"),
  "utf8",
);

const wranglerConfig = {
  topLevelName: "packswift-travel-assistant",
  name: "packswift-travel-assistant",
  compatibility_date: "2026-05-15",
  compatibility_flags: ["nodejs_compat"],
  main: "index.js",
  no_bundle: true,
  rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
  assets: { directory: "../client" },
  observability: { enabled: true },
};

await writeFile(path.join(server, "index.js"), workerSource.trimStart());
await writeFile(
  path.join(server, "wrangler.json"),
  `${JSON.stringify(wranglerConfig)}\n`,
);

const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
console.log(
  `Built ${packageJson.name}: Express source plus deployable Vanilla JavaScript interface.`,
);
