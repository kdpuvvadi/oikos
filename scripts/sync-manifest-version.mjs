import { readFile, writeFile } from 'node:fs/promises';

const packageJsonPath = new URL('../package.json', import.meta.url);
const manifestPath = new URL('../public/manifest.json', import.meta.url);

async function main() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  manifest.version = packageJson.version;

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Synced manifest version to ${packageJson.version}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
