import assert from "node:assert/strict";
import test from "node:test";

import { createReferenceImageGenerationClient, createReferenceImageInputVersion, validateReferenceImageInput } from "./reference-image.mjs";
import { createDemoTextAdapter, createTextGenerationClient, createTextInputVersion, validateTextInput } from "./text-input.mjs";

const carrier = { type: "fan", coordinateSpace: { unit: "mm", width: 200, height: 120, origin: "topLeft", xAxis: "right", yAxis: "down" } };

test("normalizes and versions natural-language input", () => {
  const input = createTextInputVersion({ inputVersionId: "text-1", inputRevision: 1, text: "  三个   绿色叶片  " });
  assert.equal(input.source.text, "三个 绿色叶片");
  assert.deepEqual(input.issues, []);
});

test("flags empty and ambiguous natural-language input", () => {
  assert.equal(validateTextInput("")[0].severity, "blocking");
  assert.equal(validateTextInput("帮我设计").some((entry) => entry.code === "TEXT_TOO_AMBIGUOUS"), true);
});

test("text generation client preserves request identity and uses an injected adapter", async () => {
  const client = createTextGenerationClient(createDemoTextAdapter());
  const result = await client.generate({
    designId: "design",
    inputVersionId: "input",
    generationId: "generation",
    generationRevision: 1,
    carrier,
    input: { channel: "text", text: "扇面中央生成绿色三角形", language: "zh-CN" },
  });
  assert.equal(result.status, "succeeded");
  assert.equal(result.result.resultType, "surface_pattern");
  assert.equal(result.issues.some((entry) => entry.code === "DEMO_GENERATOR"), true);
});

test("text client returns a recoverable failed record when adapter throws", async () => {
  const client = createTextGenerationClient({ generate: async () => { throw new Error("offline"); } });
  const result = await client.generate({ designId: "design", inputVersionId: "input", generationId: "generation", generationRevision: 1, carrier, input: { text: "绿色叶片" } });
  assert.equal(result.status, "failed");
  assert.match(result.issues[0].message, /offline/);
});

const assetRef = {
  assetId: "asset-001",
  mimeType: "image/png",
  pixelSize: { width: 800, height: 600 },
  byteSize: 1000,
};

test("creates a valid versioned reference-image input with normalized crop", () => {
  const input = createReferenceImageInputVersion({ inputVersionId: "image-1", inputRevision: 1, assetRef, crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } });
  assert.equal(input.source.crop.unit, "normalized");
  assert.deepEqual(input.issues, []);
});

test("rejects unsupported or oversized reference-image metadata", () => {
  const issues = validateReferenceImageInput({ assetRef: { ...assetRef, mimeType: "image/gif", byteSize: 20 * 1024 * 1024 } });
  const codes = issues.map((entry) => entry.code);
  assert.equal(codes.includes("UNSUPPORTED_IMAGE_TYPE"), true);
  assert.equal(codes.includes("IMAGE_SIZE_OUT_OF_RANGE"), true);
});

test("reference-image client reads assets through A's injected service", async () => {
  let readAssetId;
  const client = createReferenceImageGenerationClient({
    readAsset: async (assetId) => { readAssetId = assetId; return { kind: "mock-blob" }; },
    adapter: { generate: async (request) => ({ designId: request.designId, inputVersionId: request.inputVersionId, generationId: request.generationId, generationRevision: request.generationRevision, status: "succeeded", result: { resultType: "surface_pattern" }, issues: [] }) },
  });
  const result = await client.generate({ designId: "design", inputVersionId: "input", generationId: "generation", generationRevision: 1, carrier, input: { channel: "referenceImage", assetRef } });
  assert.equal(readAssetId, "asset-001");
  assert.equal(result.status, "succeeded");
});
