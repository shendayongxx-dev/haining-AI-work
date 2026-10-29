export const REFERENCE_IMAGE_LIMITS = Object.freeze({
  mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  maximumByteSize: 10 * 1024 * 1024,
  maximumPixelCount: 24_000_000,
  minimumDimension: 64,
});

export function createReferenceImageInputVersion({ inputVersionId, inputRevision, assetRef, crop, parentInputVersionId }, limits = REFERENCE_IMAGE_LIMITS) {
  const source = { channel: "referenceImage", assetRef: structuredClone(assetRef), ...(crop ? { crop: normalizeCrop(crop) } : {}) };
  return {
    inputVersionId,
    inputRevision,
    ...(parentInputVersionId ? { parentInputVersionId } : {}),
    channel: "referenceImage",
    source,
    issues: validateReferenceImageInput(source, limits),
  };
}

export function validateReferenceImageInput(input, limits = REFERENCE_IMAGE_LIMITS) {
  const issues = [];
  const asset = input?.assetRef;
  if (!asset?.assetId) issues.push(issue("MISSING_ASSET_ID", "blocking", "参考图缺少可读取的 assetId。"));
  if (!limits.mimeTypes.includes(asset?.mimeType)) issues.push(issue("UNSUPPORTED_IMAGE_TYPE", "blocking", "仅支持 PNG、JPEG 和 WebP。"));
  if (!(asset?.byteSize > 0) || asset.byteSize > limits.maximumByteSize) issues.push(issue("IMAGE_SIZE_OUT_OF_RANGE", "blocking", `图片大小必须大于 0 且不超过 ${limits.maximumByteSize} 字节。`));
  const width = asset?.pixelSize?.width;
  const height = asset?.pixelSize?.height;
  if (!(width >= limits.minimumDimension) || !(height >= limits.minimumDimension)) issues.push(issue("IMAGE_DIMENSIONS_TOO_SMALL", "blocking", `图片宽高至少为 ${limits.minimumDimension}px。`));
  if (Number.isFinite(width) && Number.isFinite(height) && width * height > limits.maximumPixelCount) issues.push(issue("IMAGE_PIXEL_COUNT_TOO_LARGE", "blocking", "图片像素总数超过允许上限。"));
  if (input?.crop && !isValidCrop(input.crop)) issues.push(issue("INVALID_IMAGE_CROP", "blocking", "裁切框必须位于 0～1 的归一化图像区域内。"));
  return issues;
}

export function createReferenceImageGenerationClient({ adapter, readAsset }) {
  if (typeof adapter?.generate !== "function") throw new TypeError("Image adapter must provide generate(request, blob)");
  if (typeof readAsset !== "function") throw new TypeError("readAsset(assetId) is required");
  return {
    async generate(request) {
      const issues = validateReferenceImageInput(request.input);
      if (issues.some((entry) => entry.severity === "blocking")) return failedRecord(request, issues);
      try {
        const blob = await readAsset(request.input.assetRef.assetId);
        const result = await adapter.generate(structuredClone(request), blob);
        return { ...result, issues: [...issues, ...(result.issues ?? [])] };
      } catch (cause) {
        return failedRecord(request, [issue("ASSET_READ_OR_GENERATION_FAILED", "blocking", safeFailureMessage(cause))]);
      }
    },
  };
}

function normalizeCrop(crop) {
  return { x: crop.x, y: crop.y, width: crop.width, height: crop.height, unit: "normalized" };
}

function isValidCrop(crop) {
  return crop.unit === "normalized" && crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0 && crop.x + crop.width <= 1 && crop.y + crop.height <= 1;
}

function failedRecord(request, issues) {
  return {
    designId: request.designId,
    inputVersionId: request.inputVersionId,
    generationId: request.generationId,
    generationRevision: request.generationRevision,
    generatorVersion: "c-image-client-v0.1",
    status: "failed",
    issues,
  };
}

function issue(code, severity, message) {
  return { id: `issue-${code.toLowerCase()}`, code, severity, stage: "input", message, source: { module: "C" } };
}

function safeFailureMessage(cause) {
  return cause instanceof Error && cause.message ? `参考图处理失败：${cause.message}` : "参考图处理失败，请保留输入后重试。";
}
