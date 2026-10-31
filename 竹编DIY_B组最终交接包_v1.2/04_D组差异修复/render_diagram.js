const path = require('path');
const sharp = require('sharp');

const source = path.join(__dirname, '外侧基础竹编正确示意.svg');
const target = path.join(__dirname, '外侧基础竹编正确示意.png');

sharp(source, { density: 180 }).png().toFile(target).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
