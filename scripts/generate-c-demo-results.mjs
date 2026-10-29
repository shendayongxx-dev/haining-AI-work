import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { translateDrawing } from "../src/modules/creative-input/core.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "..");

const demoPairs = [
  ["fan-drawing-input.demo.json", "fan-surface-pattern-output.demo.json"],
  ["custom-shape-input.demo.json", "custom-carrier-shape-output.demo.json"],
];

for (const [inputName, outputName] of demoPairs) {
  const inputPath = resolve(root, "examples", "c", inputName);
  const outputPath = resolve(root, "examples", "c", outputName);
  const request = JSON.parse(await readFile(inputPath, "utf8"));
  const result = translateDrawing(request);

  await writeFile(
    outputPath,
    `${JSON.stringify({ notice: request.notice, ...result }, null, 2)}\n`,
    "utf8",
  );
}
