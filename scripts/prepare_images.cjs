/* Derive web assets from retained originals. Requires Sharp; no network access. */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const assets = path.resolve(__dirname, '..', 'assets');

(async () => {
  const images = [
    { name: 'orbital-operations-concept', quality: 86 },
    { name: 'jesus-huizar-portrait', width: 560, quality: 90 },
  ];
  let originalBytes = 0;
  let servedBytes = 0;
  for (const { name, width, quality } of images) {
    const source = path.join(assets, `${name}.png`);
    const target = path.join(assets, `${name}.webp`);
    let pipeline = sharp(source);
    if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
    // Format conversion and proportional resizing only: no crop or retouching.
    await pipeline.webp({ quality, effort: 6 }).toFile(target);
    const before = (await fs.stat(source)).size;
    const after = (await fs.stat(target)).size;
    originalBytes += before;
    servedBytes += after;
    console.log(`${name}: ${before} -> ${after} bytes`);
  }
  console.log(`Homepage image total: ${originalBytes} -> ${servedBytes} bytes (${(100 * (1 - servedBytes / originalBytes)).toFixed(1)}% smaller)`);

  // Inline the approved mark for deterministic SVG rasterization. The editable
  // SVG keeps a relative reference so opening it in a browser also works.
  const sourceSvg = await fs.readFile(path.join(assets, 'og-card.svg'), 'utf8');
  const mark = await fs.readFile(path.join(assets, 'aeterna-sidera-mark.png'));
  const markReference = 'href="aeterna-sidera-mark.png"';
  if (!sourceSvg.includes(markReference)) throw new Error('Social card is missing the approved mark reference');
  const inlineSvg = sourceSvg.replace(markReference, `href="data:image/png;base64,${mark.toString('base64')}"`);
  await sharp(Buffer.from(inlineSvg)).png().toFile(path.join(assets, 'og-card.png'));
  console.log('Social card regenerated with the approved Aeterna mark');
})().catch(error => { console.error(error); process.exitCode = 1; });
