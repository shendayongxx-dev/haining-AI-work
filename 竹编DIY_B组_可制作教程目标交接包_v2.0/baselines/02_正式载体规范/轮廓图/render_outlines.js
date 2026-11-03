const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const dir = __dirname;
  const svgs = fs.readdirSync(dir).filter((name) => name.endsWith('.svg'));
  for (const name of svgs) {
    const input = path.join(dir, name);
    const output = path.join(dir, name.replace(/\.svg$/i, '.png'));
    await sharp(input, { density: 180 }).png().toFile(output);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
