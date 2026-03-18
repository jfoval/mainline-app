// Simple HTTPS reverse proxy for iPhone access
// Forwards https://192.168.4.31:3001 → http://localhost:3000
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, 'certificates');
const options = {
  key: fs.readFileSync(path.join(certDir, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'localhost.pem')),
};

const proxy = https.createServer(options, (req, res) => {
  const proxyReq = http.request(
    {
      hostname: 'localhost',
      port: 3000,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: 'localhost:3000' },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end('Proxy error: ' + err.message);
  });
  req.pipe(proxyReq);
});

proxy.listen(3001, '0.0.0.0', () => {
  console.log('HTTPS proxy running on https://192.168.4.31:3001 → http://localhost:3000');
});
