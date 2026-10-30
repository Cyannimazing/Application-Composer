import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

const root = path.resolve(import.meta.dirname, '..');
const stage = path.join(root, '.local', 'desktop-build', 'bundle-stage');
const reserve = net.createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
let errors = '', lastResponse = '';
const isolatedEnvironment = { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), NODE_ENV: 'production', COMPOSER_DATA_DIR: path.join(root, '.local', 'desktop-build', 'staged-test-data') };
delete isolatedEnvironment.NODE_PATH;
isolatedEnvironment.PATH = path.join(process.env.WINDIR || 'C:/Windows', 'System32');
const child = spawn(path.join(stage, 'runtime', 'node.exe'), [path.join(stage, 'app', 'server.js')], { cwd: os.tmpdir(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: isolatedEnvironment });
child.stderr.on('data', data => { errors = (errors + data).slice(-5000); });
child.stdout.on('data', data => { errors = (errors + data).slice(-5000); });
const statusRequest = () => new Promise((resolve,reject) => {
  const request = http.get({hostname:'127.0.0.1',port,path:'/api/desktop/status',headers:{Host:'127.0.0.1:32187'}}, response => { let body=''; response.on('data',data=>{body+=data}); response.on('end',()=>{lastResponse=response.statusCode+': '+body.slice(0,500);try{resolve(JSON.parse(body))}catch(error){reject(error)}}); });
  request.setTimeout(1000,()=>request.destroy(new Error('timeout'))); request.on('error',reject);
});
try {
  let ready = false;
  for (let i = 0; i < 60 && child.exitCode === null; i++) {
    try { const json = await statusRequest(); if (json.application === 'application-composer') { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Staged standalone server failed: ' + lastResponse + '\n' + errors);
  const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
  if (!html.includes('<title>Application Composer</title>')) throw new Error('Staged application UI did not render');
  console.log('PASS: staged standalone server and UI work outside the project without Node/pnpm/NODE_PATH before archiving.');
} finally {
  const exited = once(child, 'exit');
  if (child.exitCode === null) child.kill();
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
}
