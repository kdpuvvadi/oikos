import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pngPath = path.join(root, 'public', 'img', 'apple-touch-icon.png');
const b64 = fs.readFileSync(pngPath).toString('base64');

const jsPath = path.join(root, 'src', 'lib', 'emailLogo.js');
fs.writeFileSync(
  jsPath,
  [
    '/** Embedded Oikos logo for digest emails (no remote fetch). */',
    `export const OIKOS_LOGO_DATA_URI = "data:image/png;base64,${b64}";`,
    ''
  ].join('\n')
);

const b64Path = path.join(root, 'pb_hooks', 'oikos-logo.b64');
fs.writeFileSync(b64Path, `${b64}\n`);

console.log(`Wrote ${jsPath} and ${b64Path} (${b64.length} base64 chars)`);
