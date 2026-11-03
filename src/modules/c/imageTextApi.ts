import type { Carrier } from '../../model';

export type GeneratedImagePreview = {
  inputVersionId: string;
  sourceAssetId: string;
  sourceImageUrl: string;
  assetId: string;
  imageUrl: string;
  model: 'qwen-image-2.1-turbo';
  resultType: 'surface_pattern' | 'carrier_shape';
  structureStatus: 'pending';
};

export async function generateImageTextPreview(file: File, prompt: string, carrier: Carrier, inputVersionId: string): Promise<GeneratedImagePreview> {
  if (file.size > 10 * 1024 * 1024) throw new Error('参考图不能超过 10 MB。');
  const imageBase64 = await readBase64(file);
  const response = await fetch('/api/image-text/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ carrier, prompt, mimeType: file.type, imageBase64 }),
  });
  const data = await response.json() as { error?: string; sourceAssetId?: string; sourceImageUrl?: string; assetId?: string; imageUrl?: string; model?: string; resultType?: string; structureStatus?: string };
  if (!response.ok) throw new Error(data.error || '图片生成失败，请重试。');
  if (!data.sourceAssetId || !data.sourceImageUrl || !data.assetId || !data.imageUrl || data.model !== 'qwen-image-2.1-turbo' || data.structureStatus !== 'pending') throw new Error('图片生成响应不完整。');
  const expected = carrier === 'fan' ? 'surface_pattern' : 'carrier_shape';
  if (data.resultType !== expected) throw new Error('图片生成结果与当前载体不匹配。');
  return { inputVersionId, sourceAssetId: data.sourceAssetId, sourceImageUrl: data.sourceImageUrl, assetId: data.assetId, imageUrl: data.imageUrl, model: data.model, resultType: expected, structureStatus: 'pending' };
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('参考图读取失败。'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(file);
  });
}
