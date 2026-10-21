// Usage: npm run render -- edits/plan.json [--preview]
// Writes out/<plan>-v<version>.mp4. --preview renders at half resolution (faster review cycles).
import { existsSync, mkdirSync, readFileSync, globSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { spawn } from "node:child_process";
import { loadEnv } from "./lib/media.mjs";

loadEnv();
const args = process.argv.slice(2);
const planPath = args.find((a) => a.endsWith(".json"));
if (!planPath) {
  console.error("Usage: npm run render -- edits/plan.json [--preview]");
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const preview = args.includes("--preview");
const name = basename(planPath, ".json");
const output = `out/${name}-v${plan.version ?? 1}${preview ? "-preview" : ""}.mp4`;

// Prefer an explicit browser, else a preinstalled headless shell, else let Remotion download one.
const browser =
  process.env.REMOTION_BROWSER ??
  [
    ...globSync("/opt/pw-browsers/chromium_headless_shell-*/*/headless_shell"),
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ].find(existsSync);

// The composition takes { plan } (see src/Root.tsx).
mkdirSync("out", { recursive: true });
const propsPath = `out/.props-${name}.json`;
writeFileSync(propsPath, JSON.stringify({ plan }));

const cliArgs = ["remotion", "render", "src/index.ts", "RestoEdit", output, `--props=${propsPath}`, "--timeout=120000"];
if (preview) cliArgs.push("--scale=0.5");
if (browser) cliArgs.push(`--browser-executable=${browser}`);

// Run the Remotion CLI with this Node directly (npx is a .cmd on Windows, which needs a shell).
const child = spawn(process.execPath, ["node_modules/@remotion/cli/remotion-cli.js", ...cliArgs.slice(1)], { stdio: "inherit" });
child.on("close", (code) => {
  if (code === 0) console.log(`\nRendu : ${output}`);
  process.exit(code ?? 1);
});
