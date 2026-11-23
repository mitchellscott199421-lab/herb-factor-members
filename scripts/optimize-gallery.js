// Resize gallery originals for the members site.
// Longest edge: 1600px in web/, 600px in thumbs/. EXIF (including location) is dropped.
// Usage: npm run optimize-gallery
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '..', 'private', 'media', 'gallery');
const WEB = path.join(SRC, 'web');
const THUMB = path.join(SRC, 'thumbs');

async function resize(input, output, edge, quality) {
  return sharp(input)
    .rotate()
    .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true, progressive: true })
    .toFile(output);
}

async function main() {
  fs.mkdirSync(WEB, { recursive: true });
  fs.mkdirSync(THUMB, { recursive: true });
  const files = fs.readdirSync(SRC).filter((name) => /^photo-\d{2}\.jpg$/.test(name)).sort();
  if (files.length !== 13) {
    throw new Error(`Expected 13 gallery originals, found ${files.length}`);
  }
  const sizes = {};
  for (const name of files) {
    const id = name.slice('photo-'.length, 'photo-'.length + 2);
    const input = path.join(SRC, name);
    const web = await resize(input, path.join(WEB, name), 1600, 64);
    const thumb = await resize(input, path.join(THUMB, name), 600, 64);
    sizes[id] = {
      web: { width: web.width, height: web.height },
      thumb: { width: thumb.width, height: thumb.height },
    };
    const webKb = Math.round(web.size / 1024);
    const thumbKb = Math.round(thumb.size / 1024);
    console.log(`${name}  web ${web.width}x${web.height} ${webKb}KB   thumb ${thumb.width}x${thumb.height} ${thumbKb}KB`);
  }
  fs.writeFileSync(path.join(SRC, 'sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
