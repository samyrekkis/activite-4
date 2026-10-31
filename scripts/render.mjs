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
  globSync("/opt/pw-browsers/chromium_headless_shell-*/*/headless_shell").find(existsSync);

// The composition takes { plan } (see src/Root.tsx).
mkdirSync("out", { recursive: true });
const propsPath = `out/.props-${name}.json`;
writeFileSync(propsPath, JSON.stringify({ plan }));

const cliArgs = ["remotion", "render", "src/index.ts", "RestoEdit", output, `--props=${propsPath}`];
if (preview) cliArgs.push("--scale=0.5");
if (browser) cliArgs.push(`--browser-executable=${browser}`);

// On Windows npx is npx.cmd, which only starts through a shell.
const child = spawn("npx", cliArgs, { stdio: "inherit", shell: process.platform === "win32" });
child.on("close", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  console.log(`\nRendu : ${output}`);
  if (!plan.output?.story) process.exit(0);
  // Story version: the landscape edit turned 90° clockwise to fill a vertical story.
  const story = output.replace(/\.mp4$/, "-story.mp4");
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", output, "-vf", "transpose=1", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "copy", "-movflags", "+faststart", story], { stdio: "inherit" });
  ff.on("close", (c) => {
    if (c === 0) console.log(`Story (à regarder téléphone tourné) : ${story}`);
    process.exit(c ?? 1);
  });
});
