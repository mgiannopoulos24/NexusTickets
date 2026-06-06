import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const certFile = resolve(root, 'localhost.pem');
const keyFile = resolve(root, 'localhost-key.pem');
const cacheDir = resolve(root, 'node_modules/.cache');
const caKey = resolve(cacheDir, 'dev-ca-key.pem');
const caCert = resolve(cacheDir, 'dev-ca.pem');

if (existsSync(certFile) && existsSync(keyFile)) {
  process.exit(0);
}

try {
  execSync('openssl version', { stdio: 'pipe' });
} catch {
  console.error('openssl not found. Install it or run: mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost 127.0.0.1 ::1');
  process.exit(1);
}

const subj = '/CN=NexusTickets Dev CA';
const days = '3650';

if (!existsSync(caCert)) {
  mkdirSync(cacheDir, { recursive: true });
  execSync(
    `openssl req -x509 -nodes -newkey rsa:2048 -keyout "${caKey}" -out "${caCert}" -days ${days} -subj "${subj}"`,
    { stdio: 'pipe' },
  );
}

execSync(
  `openssl req -new -newkey rsa:2048 -nodes -keyout "${keyFile}" -out /tmp/dev-csr.pem -subj "/CN=localhost"`,
  { stdio: 'pipe' },
);

const extFile = '/tmp/dev-ca-ext.cnf';
execSync(
  `echo "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1" > "${extFile}" && openssl x509 -req -in /tmp/dev-csr.pem -CA "${caCert}" -CAkey "${caKey}" -CAcreateserial -out "${certFile}" -days ${days} -extfile "${extFile}"`,
  { stdio: 'pipe' },
);

execSync('rm -f /tmp/dev-csr.pem /tmp/dev-ca-ext.cnf', { stdio: 'pipe' });
console.log('Dev TLS certs generated: localhost.pem + localhost-key.pem');
