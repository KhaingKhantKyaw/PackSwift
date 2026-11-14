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
// Keep the no-bundle Worker self-contained. Only these public-search modules
// go into the deployment; no Express/DB modules or local configuration files.
const liveModules = [
  "worker/live-search.mjs",
  "src/services/booking-search.js","src/services/booking-exchange-rate.js",
  "src/services/destination-currency.js","src/services/activity-discovery-plan.js",
  "src/services/place-search-service.js","src/services/google-places-service.js",
  "public/js/destination-currency.js","public/js/place-search-model.js",
];
for (const file of liveModules) {
  const target=path.join(server,file);
  await mkdir(path.dirname(target),{recursive:true});
  await cp(path.join(root,file),target);
}
const cities=JSON.parse(await readFile(path.join(root,"public/data/destinations.json"),"utf8"));
await writeFile(path.join(server,"src/services/search-destinations.js"),"export default "+JSON.stringify(cities)+";\n");

const wranglerConfig = {
  topLevelName: "packswift-travel-assistant",
  name: "packswift-travel-assistant",
  compatibility_date: "2026-05-15",
  compatibility_flags: ["nodejs_compat"],
  main: "index.js",
  no_bundle: true,
  find_additional_modules: true,
  rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }],
  assets: { directory: "../client" },
  observability: { enabled: true },
};

await writeFile(path.join(server, "index.js"), workerSource.trimStart().replace("from './live-search.mjs'","from './worker/live-search.mjs'"));
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
