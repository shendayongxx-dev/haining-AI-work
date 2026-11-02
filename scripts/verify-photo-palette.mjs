import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { extractPhotoPalette } = await server.ssrLoadModule('/src/data/photoPalette.ts');
  const pixels = new Uint8ClampedArray([
    ...Array(12).fill([196, 168, 121, 255]).flat(),
    ...Array(7).fill([49, 95, 58, 255]).flat(),
    ...Array(5).fill([14, 102, 82, 255]).flat(),
    255, 0, 0, 0,
  ]);
  const palette = extractPhotoPalette(pixels);
  assert.deepEqual(palette, ['#C4A879', '#315F3A', '#0E6652']);
  assert.deepEqual(extractPhotoPalette(pixels, 2), ['#C4A879', '#315F3A']);
  assert.deepEqual(extractPhotoPalette(new Uint8ClampedArray([255, 0, 0, 0])), []);
  const { default: MaterialColorControls } = await server.ssrLoadModule('/src/MaterialColorControls.tsx');
  const markup = renderToStaticMarkup(React.createElement(MaterialColorControls, {
    baseColor: '#C4A879', patternColors: [{ paletteId: 'motif-a', color: '#315F3A' }, { paletteId: 'motif-b', color: '#B65B43' }],
    onBaseColorChange() {}, onPatternColorChange() {},
  }));
  assert.match(markup, /图样色 1/);
  assert.match(markup, /图样色 2/);
  assert.match(markup, /用于底色/);
  assert.match(markup, /用于图样色 2/);
  assert.doesNotMatch(markup, /取作底色|取作图样色/);
  console.log('PASS photo colors extracted by frequency; transparent pixels ignored');
} finally {
  await server.close();
}
