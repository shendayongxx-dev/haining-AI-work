import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { generateQwenImage, validateImageTextRequest } from './qwen-image.mjs';

const port = Number(process.env.PORT || 8787);
const assetDir = join(process.cwd(), '.local-assets');
const endpoint = process.env.QWEN_IMAGE_ENDPOINT;
const apiKey = process.env.DASHSCOPE_API_KEY;

createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/image-text/generate') {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 14 * 1024 * 1024) throw new Error('请求图片过大。');
        chunks.push(chunk);
      }
      const input = validateImageTextRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const generated = await generateQwenImage(input, { apiKey, endpoint });
      let imageResponse;
      try {
        imageResponse = await fetch(generated.url, { signal: AbortSignal.timeout(90_000) });
      } catch (error) {
        if (error?.name === 'TimeoutError') throw new Error('模型已生成图片，但保存时下载超时；请勿直接重复生成。');
        throw error;
      }
      if (!imageResponse.ok) throw new Error('生成图片保存失败。');
      let imageBytes;
      try {
        imageBytes = Buffer.from(await imageResponse.arrayBuffer());
      } catch (error) {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('模型已生成图片，但保存时下载超时；请勿直接重复生成。');
        throw error;
      }
      if (!imageBytes.length || imageBytes.length > 15 * 1024 * 1024) throw new Error('生成图片大小无效。');
      await mkdir(assetDir, { recursive: true });
      const sourceAssetId = randomUUID();
      const assetId = randomUUID();
      const sourceExt = input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
      await writeFile(join(assetDir, `${sourceAssetId}.${sourceExt}`), input.image);
      await writeFile(join(assetDir, `${assetId}.png`), imageBytes);
      return json(response, 200, {
        sourceAssetId,
        sourceImageUrl: `/api/assets/${sourceAssetId}.${sourceExt}`,
        assetId,
        imageUrl: `/api/assets/${assetId}.png`,
        model: 'qwen-image-2.1-turbo',
        providerRequestId: generated.providerRequestId,
        resultType: input.carrier === 'fan' ? 'surface_pattern' : 'carrier_shape',
        structureStatus: 'pending',
      });
    }
    const asset = /^\/api\/assets\/([a-f0-9-]{36})\.(png|jpg|webp)$/.exec(request.url || '');
    if (request.method === 'GET' && asset) {
      const bytes = await readFile(join(assetDir, `${asset[1]}.${asset[2]}`));
      const mime = asset[2] === 'jpg' ? 'image/jpeg' : `image/${asset[2]}`;
      response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'private, no-store' });
      return response.end(bytes);
    }
    return json(response, 404, { error: '接口不存在。' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务发生错误。';
    return json(response, 400, { error: message });
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Image API listening on http://127.0.0.1:${port}`);
});

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}
