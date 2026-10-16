// Usage: node scripts/timeline-info.mjs edits/plan.json
// Prints when each segment starts on the final timeline (transition overlaps
// included), so cuts, SFX and text can be placed on exact beats.
import { readFileSync } from "node:fs";
import { describeTimeline } from "./lib/timeline.mjs";

console.log(describeTimeline(JSON.parse(readFileSync(process.argv[2], "utf8"))));
