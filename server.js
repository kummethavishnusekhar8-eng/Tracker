const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tracker_store.json');

// Ensure data store exists
function initStore() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      athleteProfile: null,
      months: {}
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

function readStore() {
  try {
    initStore();
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading data store:', err);
    return { athleteProfile: null, months: {} };
  }
}

function writeStore(store) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving data store:', err);
    return false;
  }
}

// Discover local network IPv4 addresses
function getNetworkIps() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    // Exclude virtual adapters
    if (/virtual|vmnet|vbox|vethernet|hyper-v/i.test(name)) continue;
    for (const net of interfaces[name]) {
      // IPv4 and not internal loopback
      if (net.family === 'IPv4' || net.family === 4) {
        if (!net.internal && !net.address.startsWith('169.254.') && !net.address.startsWith('192.168.56.')) {
          addresses.push({ interface: name, address: net.address });
        }
      }
    }
  }

  // Sort preferred IPs: Wi-Fi first, then 192.168.x.x or 10.x.x.x
  addresses.sort((a, b) => {
    const isWifiA = /wi-fi|wifi|wireless|wlan/i.test(a.interface);
    const isWifiB = /wi-fi|wifi|wireless|wlan/i.test(b.interface);
    if (isWifiA && !isWifiB) return -1;
    if (!isWifiA && isWifiB) return 1;
    return 0;
  });

  return addresses;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2'
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // API Routes
  if (pathname === '/api/ip') {
    const ips = getNetworkIps();
    const primaryIp = ips.length > 0 ? ips[0].address : 'localhost';
    sendJson(res, 200, {
      primaryIp,
      ips,
      port: PORT,
      url: `http://${primaryIp}:${PORT}`
    });
    return;
  }

  if (pathname.startsWith('/api/sync')) {
    const code = parsedUrl.searchParams.get('code') || 
                 parsedUrl.searchParams.get('id') || 
                 pathname.replace(/^\/api\/sync\/?/, '') || 
                 'default';
    const store = readStore();
    if (!store.syncRooms) store.syncRooms = {};

    if (req.method === 'GET') {
      const roomEntry = store.syncRooms[code] || null;
      sendJson(res, 200, { success: true, code, data: roomEntry ? roomEntry.bundle : null, updatedAt: roomEntry ? roomEntry.updatedAt : 0 });
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await parseBody(req);
      const bundle = body.data || body;
      const now = Date.now();
      store.syncRooms[code] = {
        bundle: bundle,
        updatedAt: now
      };
      if (bundle && bundle.trackerData) {
        const ym = `${bundle.trackerData.year || 2026}_${bundle.trackerData.month || 'October'}`;
        if (!store.months) store.months = {};
        store.months[ym] = bundle.trackerData;
      }
      if (bundle && bundle.profile) {
        store.athleteProfile = bundle.profile;
      }
      writeStore(store);
      sendJson(res, 200, { success: true, message: 'Synced', code, updatedAt: now });
      return;
    }
  }

  if (pathname === '/api/data') {
    const year = parsedUrl.searchParams.get('year') || '2026';
    const month = parsedUrl.searchParams.get('month') || 'October';
    const key = `${year}_${month}`;
    const store = readStore();

    if (req.method === 'GET') {
      const data = (store.months && store.months[key]) ? store.months[key] : null;
      sendJson(res, 200, { success: true, data });
      return;
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      if (!store.months) store.months = {};
      store.months[key] = body.data || body;
      writeStore(store);
      sendJson(res, 200, { success: true, message: 'Saved successfully' });
      return;
    }

    if (req.method === 'DELETE') {
      if (store.months && store.months[key]) {
        delete store.months[key];
        writeStore(store);
      }
      sendJson(res, 200, { success: true, message: 'Deleted successfully' });
      return;
    }
  }

  if (pathname === '/api/profile') {
    const store = readStore();

    if (req.method === 'GET') {
      sendJson(res, 200, { success: true, profile: store.athleteProfile || null });
      return;
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      store.athleteProfile = body.profile || body;
      writeStore(store);
      sendJson(res, 200, { success: true, message: 'Profile saved' });
      return;
    }

    if (req.method === 'DELETE') {
      store.athleteProfile = null;
      writeStore(store);
      sendJson(res, 200, { success: true, message: 'Profile deleted' });
      return;
    }
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Default to index.html for unknown HTML paths
      filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content);
    });
  });
});

initStore();

server.listen(PORT, '0.0.0.0', () => {
  const ips = getNetworkIps();
  console.log('\n======================================================');
  console.log('⚡ TRACKER DISCIPLINE & HABIT OS SERVER ACTIVE ⚡');
  console.log('======================================================');
  console.log(`💻 Local (This PC):    http://localhost:${PORT}`);
  ips.forEach(({ interface: iface, address }) => {
    console.log(`📱 iPhone / Mobile:     http://${address}:${PORT}  (${iface})`);
  });
  console.log('------------------------------------------------------');
  console.log('✨ Any change made on your iPhone or PC is auto-synced!');
  console.log('======================================================\n');
});
