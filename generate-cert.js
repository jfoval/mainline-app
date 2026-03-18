// Generate a self-signed certificate for local HTTPS development
// Run once: node generate-cert.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, 'certificates');
fs.mkdirSync(certDir, { recursive: true });

const keyFile = path.join(certDir, 'localhost-key.pem');
const certFile = path.join(certDir, 'localhost.pem');

if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
  console.log('Certificates already exist in', certDir);
  process.exit(0);
}

// Generate self-signed cert valid for localhost + local network IPs
// Valid for 365 days, includes SAN for common local addresses
execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" \
  -days 365 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.4.31,IP:0.0.0.0"`, {
  stdio: 'inherit'
});

console.log('Self-signed certificates generated in', certDir);
console.log('On iPhone: visit https://192.168.4.31:3000 and accept the certificate warning');
