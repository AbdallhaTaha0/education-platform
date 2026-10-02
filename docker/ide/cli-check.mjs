import { spawnSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';
const host = (await lookup('host.docker.internal')).address;
function cli(args) {
  const r = spawnSync('agent-browser', ['--args', `--no-sandbox,--disable-dev-shm-usage,--host-resolver-rules=MAP localhost ${host}`, ...args], { encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0) { console.error(r.stderr?.slice(0, 2000)); throw new Error('Browser verification CLI failed.'); } return r.stdout;
}
try {
  cli(['open', 'http://localhost:8084']);
  const snapshot = cli(['snapshot', '-i']);
  if (!snapshot.includes('button') || !snapshot.includes('link')) throw new Error('Page has no usable controls.');
  const overlay = cli(['eval', 'document.querySelector(".vite-error-overlay") ? "ERROR" : document.body.innerText.trim().length > 0 ? "OK" : "BLANK"']);
  if (!overlay.includes('OK')) throw new Error('Page did not render.');
  const errors = cli(['errors']); if (!/No page errors|No errors|\[\]/i.test(errors.trim()) && errors.trim()) throw new Error('Page errors detected.');
  cli(['screenshot', '/evidence/m9-home.png']);
  console.log('PASS browser CLI: page, navigation controls, error check, screenshot');
} finally { cli(['close']); }
