/* Format exports of the approved mark, without redrawing or changing it.
 * Requires Sharp from the workspace runtime. No network requests.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

(async () => {
  const root = path.resolve(__dirname, '..');
  const mark = await fs.readFile(path.join(root, 'assets/aeterna-sidera-mark.png'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" role="img" aria-label="Aeterna Sidera">\n  <image width="300" height="300" href="data:image/png;base64,${mark.toString('base64')}"/>\n</svg>\n`;
  await fs.writeFile(path.join(root, 'assets/favicon.svg'), svg);
  await sharp(mark).resize(256, 256).png().toFile(path.join(root, 'assets/favicon.png'));

  // An ICO directory with PNG-encoded frames for modern browser/OS fallbacks.
  const sizes = [16, 32, 48, 64];
  const frames = await Promise.all(sizes.map(size => sharp(mark).resize(size, size).png().toBuffer()));
  const directory = Buffer.alloc(6 + 16 * frames.length);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(frames.length, 4);
  let offset = directory.length;
  frames.forEach((frame, index) => {
    const entry = 6 + 16 * index;
    directory[entry] = sizes[index];
    directory[entry + 1] = sizes[index];
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(frame.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  await fs.writeFile(path.join(root, 'favicon.ico'), Buffer.concat([directory, ...frames]));
  console.log('Generated SVG, PNG, and ICO favicons from the approved Aeterna mark.');
})().catch(error => { console.error(error); process.exitCode = 1; });
