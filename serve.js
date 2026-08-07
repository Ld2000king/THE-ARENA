/* שרת סטטי קטן לצפייה מקומית במשחק: node serve.js  →  http://localhost:5177
   כלי פיתוח בלבד — אינו חלק מהאתר החי ב-GitHub Pages. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5177;
const HOST = '127.0.0.1';          // loopback בלבד — לא חשוף לרשת המקומית
const ROOT = path.resolve(__dirname);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.svg': 'image/svg+xml'
};

function deny(res, code, msg) {
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(msg);
}

http.createServer((req, res) => {
    let rel;
    try {
        rel = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
        // נתיב מקודד באופן פגום — לא מפילים את השרת
        return deny(res, 400, 'בקשה לא תקינה');
    }

    if (rel === '/' || rel === '') rel = '/index.html';

    // פותרים תמיד יחסית לשורש, כך ש-".." לא יכול לצאת ממנה
    const file = path.resolve(ROOT, '.' + (rel.startsWith('/') ? rel : '/' + rel));

    // גבול השורש נבדק עם מפריד נתיב מפורש. בלעדיו, תיקייה אחות
    // בשם "new game.bak" הייתה עוברת בדיקת startsWith על "new game".
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        return deny(res, 403, 'אסור');
    }

    // לא מגישים קבצים ותיקיות נסתרים (‎.git, ‎.claude וכדומה)
    const parts = path.relative(ROOT, file).split(path.sep);
    if (parts.some(seg => seg.startsWith('.'))) {
        return deny(res, 403, 'אסור');
    }

    fs.readFile(file, (err, data) => {
        if (err) return deny(res, 404, 'לא נמצא');
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(PORT, HOST, () => console.log(`הזירה רצה על http://${HOST}:${PORT}`));
