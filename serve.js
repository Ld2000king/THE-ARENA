/* שרת סטטי קטן לצפייה מקומית במשחק: node serve.js  →  http://localhost:5177 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5177;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(__dirname, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(__dirname)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('לא נמצא'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(PORT, () => console.log('הזירה רצה על http://localhost:' + PORT));
