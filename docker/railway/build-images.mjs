// Local build only. Never pushes, provisions resources, starts services or reads .env.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const images = JSON.parse(readFileSync(new URL('./deployment-images.json', import.meta.url)));
const requested = process.argv.slice(2);
if (!requested.length || requested.some(name => !Object.hasOwn(images, name))) {
  console.error(`Choose image names: ${Object.keys(images).join(', ')}`); process.exit(1);
}
for (const name of requested) {
  const spec = images[name];
  const args = ['build', '-f', `${spec.context}/${spec.dockerfile}`, '-t', `fayq-deployment-${name}:local`];
  if (spec.target) args.push('--target', spec.target);
  args.push(spec.context);
  const result = spawnSync(process.env.DOCKER_EXE || 'docker', args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
