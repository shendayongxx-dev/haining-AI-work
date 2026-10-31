const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const sourceDir = path.join(__dirname, '..', '01_核心编法', '01_十字编', '步骤图片');
  const names = fs.readdirSync(sourceDir).filter((n) => /\.(png|jpe?g)$/i.test(n)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const tileW = 360, tileH = 300, cols = 3;
  const composites = [];
  for (let i = 0; i < names.length; i++) {
    const img = await sharp(path.join(sourceDir, names[i])).rotate().resize(330, 245, { fit: 'inside', background: 'white' }).flatten({ background: 'white' }).png().toBuffer();
    const x = (i % cols) * tileW + 15;
    const y = Math.floor(i / cols) * tileH + 40;
    composites.push({ input: img, left: x, top: y });
    composites.push({ input: Buffer.from(`<svg width="330" height="35"><text x="0" y="25" font-size="22" font-family="Arial">${names[i]}</text></svg>`), left: x, top: y - 35 });
  }
  const rows = Math.ceil(names.length / cols);
  await sharp({ create: { width: cols * tileW, height: rows * tileH, channels: 3, background: 'white' } }).composite(composites).png().toFile(path.join(__dirname, '十字编图片联系表.png'));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
