import { useState } from "react";
import { CandidateResultPreview } from "./CandidateResultPreview";
import { DrawingInput } from "./DrawingInput";
import { ReferenceImageInput } from "./ReferenceImageInput";
import { TextInput } from "./TextInput";
import { NORMALIZED_DRAWING_SPACE } from "./types";
import type { CandidateResult, CreativeInput, GenerateCandidate, GenerationRequest, InputChannel } from "./types";

interface Props {
  carrier: GenerationRequest["carrier"];
  generateCandidate: GenerateCandidate;
  createAssetRef: (file: File) => Promise<string>;
  onConfirm: (candidate: CandidateResult) => Promise<void> | void;
}

export function CreativeInputPanel({ carrier, generateCandidate, createAssetRef, onConfirm }: Props) {
  const [channel, setChannel] = useState<InputChannel>("drawing");
  const [input, setInput] = useState<CreativeInput>({ channel: "drawing", captureMethod: "pointer", drawingSpace: NORMALIZED_DRAWING_SPACE, strokes: [] });
  const [candidate, setCandidate] = useState<CandidateResult | null>(null);
  const [status, setStatus] = useState<"editing" | "generating" | "confirming" | "error">("editing");
  const [message, setMessage] = useState("");

  function choose(next: InputChannel) {
    setChannel(next);
    setCandidate(null);
    setMessage("");
    if (next === "drawing") setInput({ channel: "drawing", captureMethod: "pointer", drawingSpace: NORMALIZED_DRAWING_SPACE, strokes: [] });
    if (next === "text") setInput({ channel: "text", text: "", language: "zh-CN" });
    if (next === "referenceImage") setInput({ channel: "referenceImage", assetRef: "", fileName: "", mimeType: "image/png", sizeBytes: 0 });
  }

  async function generate() {
    setStatus("generating");
    setMessage("");
    try {
      const next = await generateCandidate({ carrier, input });
      setCandidate(next);
      setStatus("editing");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "生成失败，请保留输入后重试。");
    }
  }

  async function confirm(next: CandidateResult) {
    setStatus("confirming");
    try {
      await onConfirm(next);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "确认失败，请重试。");
    }
  }

  if (candidate) {
    return <CandidateResultPreview candidate={candidate} confirming={status === "confirming"} onConfirm={confirm} onRevise={() => setCandidate(null)} />;
  }

  return (
    <section aria-label="创意输入">
      <div role="tablist" aria-label="选择输入通道">
        {(["drawing", "text", "referenceImage"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={channel === item} onClick={() => choose(item)}>{label(item)}</button>
        ))}
      </div>
      {input.channel === "drawing" && <DrawingInput disabled={status === "generating"} onChange={(strokes) => setInput({ channel: "drawing", captureMethod: "pointer", drawingSpace: NORMALIZED_DRAWING_SPACE, strokes })} />}
      {input.channel === "text" && <TextInput value={input.text} disabled={status === "generating"} onChange={(text) => setInput({ channel: "text", text, language: "zh-CN" })} />}
      {input.channel === "referenceImage" && <ReferenceImageInput disabled={status === "generating"} createAssetRef={createAssetRef} onChange={(value) => value && setInput(value)} />}
      {message && <p role="alert">{message}</p>}
      <button type="button" disabled={status === "generating" || !ready(input)} onClick={() => void generate()}>
        {status === "generating" ? "生成中…" : "生成候选结果"}
      </button>
    </section>
  );
}

function ready(input: CreativeInput) {
  if (input.channel === "drawing") return input.strokes.length > 0;
  if (input.channel === "text") return input.text.trim().length > 0;
  return input.assetRef.length > 0;
}

function label(channel: InputChannel) {
  return { drawing: "直接绘制", text: "文字描述", referenceImage: "参考图" }[channel];
}
