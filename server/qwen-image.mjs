const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validateImageTextRequest(body) {
  if (!body || typeof body !== 'object') throw new Error('请求内容无效。');
  if (body.carrier !== 'fan' && body.carrier !== 'custom') throw new Error('载体类型无效。');
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 500) throw new Error('请填写不超过 500 字的描述。');
  if (!ALLOWED_MIME.has(body.mimeType)) throw new Error('参考图仅支持 PNG、JPEG 或 WebP。');
  if (typeof body.imageBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.imageBase64)) throw new Error('参考图数据无效。');
  const image = Buffer.from(body.imageBase64, 'base64');
  if (!image.length || image.length > MAX_IMAGE_BYTES) throw new Error('参考图大小须在 10 MB 以内。');
  return { carrier: body.carrier, prompt: body.prompt.trim(), mimeType: body.mimeType, image };
}

export function buildQwenRequest(input) {
  const goal = input.carrier === 'fan'
    ? '提取并改造参考图中的主体，生成适合圆形竹编扇面使用的简洁平面纹样参考图。'
    : '把参考图作为素材，按照用户文字要求重新塑造单个清晰闭合的竹编载体外轮廓。保留主体可辨认的大形与重要特征（例如耳尖），省略毛发、细小突起和浅凹；外边缘应连续、平顺、适合后续几何转译。文字描述优先于参考图的原始外形；不要因为原图是圆形或椭圆形就保留圆钝轮廓。';
  const requestedDetails = input.carrier === 'custom' && /叶|leaf/i.test(input.prompt)
    ? '目标是明确可辨的叶片剪影：上下两端收成尖点，中段较宽，两侧平滑弯曲；不能画成圆形、椭圆形或卵形。'
    : '';
  return {
    model: 'qwen-image-2.1-turbo',
    prompt: `${goal} 用户要求：${input.prompt}。${requestedDetails} 输出单色主体、纯白背景、正视平面剪影；外边缘清晰，避免阴影、渐变和装饰。不要加入文字、竹条结构、工艺通过标记或制作说明。`,
    image: `data:${input.mimeType};base64,${input.image.toString('base64')}`,
    n: 1,
    watermark: false,
  };
}

export async function generateQwenImage(input, { apiKey, endpoint, fetchImpl = fetch }) {
  if (!apiKey || !endpoint) throw new Error('模型服务尚未配置。');
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildQwenRequest(input)),
      signal: AbortSignal.timeout(600_000),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') throw new Error('模型生成等待超时，请先在百炼控制台核对调用记录，再决定是否重试。');
    throw error;
  }
  if (!response.ok) throw new Error(`模型生成失败（HTTP ${response.status}）。`);
  let result;
  try {
    result = await response.json();
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('模型生成等待超时，请先在百炼控制台核对调用记录，再决定是否重试。');
    throw error;
  }
  const url = result?.data?.[0]?.url;
  if (typeof url !== 'string') throw new Error('模型未返回有效图片。');
  const imageUrl = new URL(url);
  if (imageUrl.protocol !== 'https:' || !imageUrl.hostname.endsWith('.aliyuncs.com')) throw new Error('模型返回了无效的图片地址。');
  return { url, providerRequestId: response.headers.get('x-request-id') ?? null };
}
