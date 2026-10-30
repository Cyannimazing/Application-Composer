import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { excludedBundlePath } from './bundle-policy.mjs';

const root = path.resolve(import.meta.dirname, '..');
const build = path.join(root, '.local', 'desktop-build');
const stage = path.join(build, 'bundle-stage');
if (path.dirname(stage) !== build || path.basename(stage) !== 'bundle-stage') throw new Error('Invalid bundle staging path');
await rm(stage, { recursive: true, force: true });
await mkdir(path.join(stage, 'runtime'), { recursive: true });
const standalone = path.join(root, '.next-desktop', 'standalone');
await cp(standalone, path.join(stage, 'app'), { recursive: true, dereference: true, filter: file => !excludedBundlePath(path.relative(standalone, file)) });
// Node 24 selects module-sync exports; NFT can trace only the helpers package manifest.
await cp(path.join(root, 'node_modules', '@swc', 'helpers'), path.join(stage, 'app', 'node_modules', '@swc', 'helpers'), { recursive: true, dereference: true });
// pnpm's root aliases can be traced as manifest-only even when the real .pnpm package has files.
// Complete those aliases so relocation does not depend on the original checkout or node_modules store.
const modules = path.join(stage, 'app', 'node_modules');
for (const entry of await readdir(modules, { withFileTypes: true })) {
  if (entry.name.startsWith('.')) continue;
  const names = entry.name.startsWith('@') ? (await readdir(path.join(modules, entry.name))).map(name => path.join(entry.name, name)) : [entry.name];
  for (const name of names) {
    const source = path.join(root, 'node_modules', name);
    try { await cp(source, path.join(modules, name), { recursive: true, dereference: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
await cp(path.join(root, 'extension'), path.join(stage, 'app', 'extension'), { recursive: true });
await cp(path.join(root, 'public'), path.join(stage, 'app', 'public'), { recursive: true });
await cp(path.join(root, '.next-desktop', 'static'), path.join(stage, 'app', '.next-desktop', 'static'), { recursive: true });
await cp(process.execPath, path.join(stage, 'runtime', 'node.exe'));
async function verify(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const relative = path.relative(path.join(stage, 'app'), path.join(folder, item.name));
    if (excludedBundlePath(relative) || item.isSymbolicLink()) throw new Error('Private data or nonportable link in bundle: ' + item.name);
    if (item.isDirectory()) await verify(path.join(folder, item.name));
  }
}
await verify(stage);
console.log('Bundled standalone app + Node. No private .local files, .env files or symlinks.');
