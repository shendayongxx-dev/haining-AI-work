import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQwenRequest, generateQwenImage, validateImageTextRequest } from './qwen-image.mjs';

const request = { carrier: 'fan', prompt: '提取叶片', mimeType: 'image/png', imageBase64: Buffer.from('image').toString('base64') };

test('image and prompt become one low-cost image-edit request', () => {
  const input = validateImageTextRequest(request);
  const body = buildQwenRequest(input);
  assert.equal(body.model, 'qwen-image-2.1-turbo');
  assert.equal(body.n, 1);
  assert.match(body.prompt, /提取叶片/);
  assert.match(body.image, /^data:image\/png;base64,/);
  assert.equal('response_format' in body, false);
});

test('invalid image and carrier are rejected before model call', () => {
  assert.throws(() => validateImageTextRequest({ ...request, carrier: 'box' }), /载体/);
  assert.throws(() => validateImageTextRequest({ ...request, mimeType: 'image/svg+xml' }), /参考图/);
});

test('custom leaf request prioritizes pointed silhouette over an oval reference', () => {
  const body = buildQwenRequest(validateImageTextRequest({ ...request, carrier: 'custom', prompt: '提取叶片外轮廓' }));
  assert.match(body.prompt, /上下两端收成尖点/);
  assert.match(body.prompt, /不能画成圆形、椭圆形/);
});

test('model response requires an HTTPS generated image', async () => {
  let sent;
  const result = await generateQwenImage(validateImageTextRequest(request), {
    apiKey: 'test-key', endpoint: 'https://example.test/images/generations',
    fetchImpl: async (_url, options) => {
      sent = JSON.parse(options.body);
      return new Response(JSON.stringify({ data: [{ url: 'https://example.oss-cn-beijing.aliyuncs.com/generated.png' }] }), { headers: { 'x-request-id': 'req-1' } });
    },
  });
  assert.equal(sent.n, 1);
  assert.equal(result.providerRequestId, 'req-1');
  assert.equal(result.url, 'https://example.oss-cn-beijing.aliyuncs.com/generated.png');
});

test('model timeout asks for call-record check instead of automatic retry', async () => {
  await assert.rejects(generateQwenImage(validateImageTextRequest(request), {
    apiKey: 'test-key', endpoint: 'https://example.test/images/generations',
    fetchImpl: async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); },
  }), /核对调用记录/);
});
