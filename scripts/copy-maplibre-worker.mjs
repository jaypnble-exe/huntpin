// Copies MapLibre's web worker into public/ so the browser can load it.
// Runs before `npm run dev` and `npm run build`. The output is git-ignored.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/maplibre-gl-worker.mjs");
