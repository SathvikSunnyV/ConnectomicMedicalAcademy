// Installs frontend deps and builds the frontend into frontend/dist.
//
//   npm start      -> runs this via "prestart" (same behaviour as before),
//                     unless SKIP_FRONTEND_BUILD=true is set -- use that in a
//                     deployment pipeline that builds the frontend in its own
//                     step, so a plain restart doesn't rebuild.
//   npm run build  -> always builds (--force).
const { spawnSync } = require('child_process');
const path = require('path');

const force = process.argv.includes('--force');
if (!force && process.env.SKIP_FRONTEND_BUILD === 'true') {
  console.log('SKIP_FRONTEND_BUILD=true -- not rebuilding the frontend.');
  process.exit(0);
}

const frontend = path.join(__dirname, '..', '..', 'frontend');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const opts = { cwd: frontend, stdio: 'inherit', shell: process.platform === 'win32' };
for (const args of [['install', '--include=dev', '--no-audit', '--no-fund'], ['run', 'build']]) {
  const r = spawnSync(npm, args, opts);
  if (r.status !== 0) process.exit(r.status || 1);
}
