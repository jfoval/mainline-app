const { fork, execFileSync } = require('child_process');
const path = require('path');

process.chdir(__dirname);

// Start HTTPS proxy for iPhone access (port 3001 → 3000)
const proxyPath = path.join(__dirname, 'https-proxy.js');
try {
  const proxy = fork(proxyPath, { stdio: 'inherit' });
  proxy.on('error', () => {}); // ignore if certs don't exist yet
} catch {}

// Start Next.js dev server on HTTP (port 3000)
execFileSync(
  process.argv[0],
  [require.resolve('next/dist/bin/next'), 'dev'],
  { stdio: 'inherit', env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin' } }
);
