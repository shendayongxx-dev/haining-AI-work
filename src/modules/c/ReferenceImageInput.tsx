import type { CreativeInput } from "./types";

interface Props {
  disabled?: boolean;
  maxBytes?: number;
  onChange: (input: Extract<CreativeInput, { channel: "referenceImage" }> | null) => void;
  createAssetRef: (file: File) => Promise<string>;
}

const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);

export function ReferenceImageInput({ disabled = false, maxBytes = 10 * 1024 * 1024, onChange, createAssetRef }: Props) {
  async function select(file?: File) {
    if (!file) return onChange(null);
    if (!ACCEPTED.has(file.type)) throw new Error("仅支持 PNG、JPEG 或 WebP 图片。");
    if (file.size > maxBytes) throw new Error("参考图超过允许大小。");
    const assetRef = await createAssetRef(file);
    onChange({
      channel: "referenceImage",
      assetRef,
      fileName: file.name,
      mimeType: file.type as "image/png" | "image/jpeg" | "image/webp",
      sizeBytes: file.size,
    });
  }

  return (
    <label>
      上传参考图
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled}
        onChange={(event) => void select(event.target.files?.[0])}
      />
      <span>图片原件只通过 assetRef 引用，不写入设计 JSON。</span>
    </label>
  );
}

