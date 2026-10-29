export const TEXT_INPUT_LIMITS = Object.freeze({ minimumLength: 2, maximumLength: 500 });

export function createTextInputVersion({ inputVersionId, inputRevision, text, language = "zh-CN", parentInputVersionId }) {
  const normalizedText = normalizeText(text);
  const issues = validateTextInput(normalizedText);
  return {
    inputVersionId,
    inputRevision,
    ...(parentInputVersionId ? { parentInputVersionId } : {}),
    channel: "text",
    source: { channel: "text", text: normalizedText, language },
    issues,
  };
}

export function validateTextInput(text, limits = TEXT_INPUT_LIMITS) {
  const normalizedText = normalizeText(text);
  const issues = [];
  if (normalizedText.length < limits.minimumLength) {
    issues.push(issue("TEXT_TOO_SHORT", "blocking", `描述至少需要 ${limits.minimumLength} 个字符。`));
  }
  if (normalizedText.length > limits.maximumLength) {
    issues.push(issue("TEXT_TOO_LONG", "blocking", `描述不能超过 ${limits.maximumLength} 个字符。`));
  }
  if (isAmbiguousText(normalizedText)) {
    issues.push(issue("TEXT_TOO_AMBIGUOUS", "warning", "请补充主体、数量、位置、形状或颜色等信息。"));
  }
  return issues;
}

export function createTextGenerationClient(adapter) {
  if (typeof adapter?.generate !== "function") throw new TypeError("Text adapter must provide generate(request)");
  return {
    async generate(request) {
      const inputIssues = validateTextInput(request.input?.text ?? "");
      if (inputIssues.some((entry) => entry.severity === "blocking")) {
        return failedRecord(request, inputIssues);
      }
      try {
        const result = await adapter.generate(structuredClone(request));
        return { ...result, issues: [...inputIssues, ...(result.issues ?? [])] };
      } catch (cause) {
        return failedRecord(request, [issue("GENERATION_FAILED", "blocking", safeFailureMessage(cause))]);
      }
    },
  };
}

export function createDemoTextAdapter() {
  return {
    async generate(request) {
      const { width, height } = request.carrier.coordinateSpace;
      const generationId = request.generationId;
      if (request.carrier.type === "fan") {
        return {
          designId: request.designId,
          inputVersionId: request.inputVersionId,
          generationId,
          generationRevision: request.generationRevision,
          generatorVersion: "c-text-demo-v0.1",
          status: "succeeded",
          result: {
            resultType: "surface_pattern",
            patternId: `${generationId}-pattern`,
            coordinateSpace: request.carrier.coordinateSpace,
            palette: [{ id: "primary", color: "#315f3a", role: "pattern" }],
            elements: [{
              id: `${generationId}-element-001`,
              type: "polygon",
              pointsMm: [
                { x: width * 0.35, y: height * 0.62 },
                { x: width * 0.5, y: height * 0.35 },
                { x: width * 0.65, y: height * 0.62 },
                { x: width * 0.35, y: height * 0.62 },
              ],
              paletteId: "primary",
              zIndex: 1,
            }],
            transform: { scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 } },
          },
          issues: [issue("DEMO_GENERATOR", "info", "当前结果由演示适配器生成，不代表已接入正式自然语言模型。")],
        };
      }
      return failedRecord(request, [issue("DEMO_CUSTOM_SHAPE_NOT_SUPPORTED", "blocking", "演示自然语言适配器尚不生成自定义形状。")]);
    },
  };
}

function failedRecord(request, issues) {
  return {
    designId: request.designId,
    inputVersionId: request.inputVersionId,
    generationId: request.generationId,
    generationRevision: request.generationRevision,
    generatorVersion: "c-text-client-v0.1",
    status: "failed",
    issues,
  };
}

function normalizeText(text) {
  return String(text ?? "").trim().replace(/\s+/g, " ");
}

function isAmbiguousText(text) {
  return /^(好看一点|随便设计|自由发挥|帮我设计|做一个图案|好看的图案)[。！!]?$/u.test(text);
}

function issue(code, severity, message) {
  return { id: `issue-${code.toLowerCase()}`, code, severity, stage: "input", message, source: { module: "C" } };
}

function safeFailureMessage(cause) {
  return cause instanceof Error && cause.message ? `生成服务失败：${cause.message}` : "生成服务失败，请保留输入后重试。";
}
