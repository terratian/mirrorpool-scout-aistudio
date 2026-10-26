
function extractBestEbayCardName(rawTitle) {
    // 1. Check eBay Item Specifics table for explicit "Card Name" label
    const labels = Array.from(document.querySelectorAll(".ux-labels-values__labels, .ux-labels-values__labels-content, dt"));
    for (const lbl of labels) {
        if (/^card\s*name:?$/i.test(lbl.innerText.trim())) {
            const container = lbl.closest(".ux-labels-values, dl, tr") || lbl.parentElement;
            const valEl = container ? container.querySelector(".ux-labels-values__values, dd, td:last-child") : lbl.nextElementSibling;
            if (valEl && valEl.innerText.trim()) {
                return valEl.innerText.trim();
            }
        }
    }
    return rawTitle;
}

// Mirror Pool Scout - Marketplace Inspector & Overlay

(() => {
    if (document.getElementById("mirrorpool-badge-root")) return;

    const MAX_ATTEMPTS = 10;
    const escHtml = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

    function initScoutBadge(attempt) {
        if (document.getElementById("mirrorpool-badge-root")) return;
        const priceContainer = document.querySelector(".x-price-primary") || 
                               document.querySelector(".x-bin-price") || 
                               document.querySelector(".x-bid-price") ||
                               document.querySelector(".main-price");
        if (!priceContainer) {
            // eBay renders the price block late; keep trying for ~8s before giving up.
            if (attempt < MAX_ATTEMPTS) setTimeout(() => initScoutBadge(attempt + 1), 800);
            return;
        }

        const titleEl = document.querySelector(".x-item-title__mainTitle") || document.querySelector("h1");
        let rawTitle = titleEl ? titleEl.innerText.trim() : document.title;

        // 1. Precise Item Specifics Extraction
        let searchTitle = "";
        const labels = document.querySelectorAll(".ux-labels-values__labels");
        for (let label of labels) {
            if (label.innerText.trim().toLowerCase().includes("card name")) {
                const val = label.nextElementSibling;
                if (val) {
                    searchTitle = val.innerText.trim();
                    break;
                }
            }
        }

        // Fallback Sanitizer
        if (!searchTitle) {
            searchTitle = rawTitle.replace(/\b(MTG|MAGIC THE GATHERING|MAGIC|COMMANDER|DUSKMOURN|BLOOMBURROW|LEGENDS|BALDUR'S GATE|NM|MINT|LP|SP|MP|HP|FOIL|NF|EN|ENGLISH|PSA|BGS|CGC|TCG|WOTC)\b/gi, '');
            searchTitle = searchTitle.replace(/\b[A-Z0-9]{3,4}\b/g, '');
            searchTitle = searchTitle.replace(/#\d+/g, '');
            searchTitle = searchTitle.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '');
            searchTitle = searchTitle.replace(/[^a-zA-Z\s\-',]/g, ' ').replace(/\s+/g, ' ').trim();
            if (searchTitle.length < 3) searchTitle = rawTitle.split("|")[0].trim();
        }

        // Foil: item-specific "Finish" wins, else the title (but not "non-foil"/"NF").
        let finishText = "";
        for (const label of labels) {
            if (label.innerText.trim().toLowerCase().includes("finish") && label.nextElementSibling) { finishText = label.nextElementSibling.innerText.trim(); break; }
        }
        const isFoil = finishText
            ? /foil/i.test(finishText) && !/non-?\s?foil/i.test(finishText)
            : /\bfoil\b/i.test(rawTitle) && !/\bnon-?\s?foil\b|\bNF\b/i.test(rawTitle);

        // 2. Financial Metrics Parsing
        const rawPriceText = priceContainer.innerText || "";
        // Require a "$" and reject C $ / AU $ / GBP / EUR so a foreign-currency listing never reads as USD.
        const parseUsd = (txt) => {
            const t = String(txt || "").replace(/,/g, "");
            if (/[£€¥]|\b(?:C|AU|NZ|HK|CA|MX)\s?\$|\b(?:EUR|GBP|CAD|AUD)\b/i.test(t)) return null;
            const m = t.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
            return m ? parseFloat(m[1]) : null;
        };
        const parsedPrice = parseUsd(rawPriceText);
        const priceOk = parsedPrice != null;
        const listedPrice = priceOk ? parsedPrice : 0;

        // Shipping is read only from shipping-specific nodes (the old .ux-textspans--BOLD fallback matched any bold text).
        let shippingCost = 0;
        let shippingKnown = false;
        const shippingEl = document.querySelector('.ux-labels-values--shipping') || document.querySelector('.sh-str');
        if (shippingEl) {
            const shipText = shippingEl.innerText || "";
            if (/\bfree\b/i.test(shipText)) { shippingKnown = true; }
            else {
                const c = parseUsd(shipText);
                if (c != null) { shippingCost = c; shippingKnown = true; }
            }
        }
        const totalCost = listedPrice + shippingCost;

        const bidCountEl = document.querySelector(".x-bid-count");
        const bidCount = bidCountEl ? parseInt(bidCountEl.innerText.replace(/\D/g, ""), 10) || 0 : 0;
        const isAuction = bidCountEl !== null || document.body.innerText.includes("Current bid:");

        let watchers = 0;
        const watchMatch = document.body.innerText.match(/(\d+)\s+(?:people are|person is) watching/i) || 
                           document.body.innerText.match(/(\d+)\s+watchers?/i);
        if (watchMatch) watchers = parseInt(watchMatch[1]);

        const timerEl = document.querySelector(".ux-timer") || document.querySelector(".x-end-time");
        let timeLeft = isAuction ? "Ending Soon" : "Buy It Now";
        if (timerEl) {
            const timeStr = timerEl.innerText.replace(/Ends\s*in/i, "").replace(/Ends/i, "").trim();
            const timeMatch = timeStr.match(/(\d+d\s+\d+h|\d+h\s+\d+m|\d+m\s+\d+s)/);
            timeLeft = timeMatch ? timeMatch[0] : timeStr.split(/Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i)[0].trim();
        }

        // 3. Inject Inspector Badge
        const badge = document.createElement("div");
        badge.id = "mirrorpool-badge-root";
        badge.style.cssText = "background:#0b1120; border:1px solid #1e293b; border-radius:8px; padding:12px; margin-top:14px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#f8fafc; box-shadow:0 10px 15px -3px rgba(0,0,0,0.5);";

        badge.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #1e293b; padding-bottom:6px;">
                <span style="color:#00ffcc; font-weight:800; font-size:12px; letter-spacing:0.5px;">◈ MIRROR POOL™ SCOUT</span>
                <span style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase;">${isAuction ? "AUCTION TRACKER" : "FIXED LISTING"}</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-bottom:8px; text-align:left;">
                <div>
                    <div style="font-size:9px; color:#8b949e; text-transform:uppercase;">${isAuction ? "Bid" : "Price"}</div>
                    <div style="color:#00ffcc; font-size:13px; font-weight:700;">${priceOk ? "$" + listedPrice.toFixed(2) : "—"}</div>
                </div>
                <div>
                    <div style="font-size:9px; color:#8b949e; text-transform:uppercase;">Shipping</div>
                    <div style="color:#8b949e; font-size:11px; font-weight:700;">${!shippingKnown ? "—" : shippingCost === 0 ? "Free" : "+$" + shippingCost.toFixed(2)}</div>
                </div>
                <div>
                    <div style="font-size:9px; color:#8b949e; text-transform:uppercase;">Activity</div>
                    <div style="color:#3fb950; font-size:11px; font-weight:700;">${bidCount}B / ${watchers}W</div>
                </div>
                <div>
                    <div style="font-size:9px; color:#8b949e; text-transform:uppercase;">Time Left</div>
                    <div style="color:#eab308; font-size:11px; font-weight:700;">${escHtml(timeLeft)}</div>
                </div>
            </div>
            <div id="mp-deal-verdict-container">
                <div style="font-size:11px; color:#94a3b8; padding:4px 0;">⏳ Querying Scryfall API benchmarks...</div>
            </div>
            <div style="display:flex; gap:6px; margin-top:8px;">
                <button id="mp-btn-save" style="flex:1; padding:7px 5px; border-radius:4px; background:#10b981; border:none; color:#030712; font-weight:800; font-size:11px; cursor:pointer;">📥 + Watchlist</button>
                <button id="mp-btn-procure" style="flex:1; padding:7px 5px; border-radius:4px; background:#1e293b; border:1px solid #334155; color:#f8fafc; font-weight:700; font-size:11px; cursor:pointer;">🎯 + Buy List</button>
                <button id="mp-btn-dash" style="flex:1; padding:7px 5px; border-radius:4px; background:rgba(0,255,204,0.06); border:1px solid #00ffcc; color:#00ffcc; font-weight:700; font-size:11px; cursor:pointer;">⛶ Dashboard</button>
            </div>
        `;

        const targetParent = priceContainer.closest(".x-price-section") || priceContainer.parentElement;
        targetParent.parentNode.insertBefore(badge, targetParent.nextSibling);

        let trueMarketFloor = "";

        // 4. Query Background Scryfall Engine
        chrome.runtime.sendMessage({ action: "fetchComps", cardName: searchTitle, foil: isFoil }, (res) => {
            const verdictContainer = badge.querySelector('#mp-deal-verdict-container');
            const warn = (msg) => {
                verdictContainer.innerHTML = `
                    <div style="background:rgba(218,54,51,0.1); border:1px solid #da3633; color:#ff7b72; padding:6px; border-radius:4px; font-size:11px; text-align:center;">
                        ⚠️ ${msg}
                    </div>`;
            };
            if (chrome.runtime.lastError || !res) { warn("Scout background not responding. Reload the page."); return; }
            if (!res.found) {
                const err = String(res.error || "");
                if (/429|rate/i.test(err)) warn("Scryfall is rate-limiting requests. Try again in a minute.");
                else if (/fetch|network|failed to/i.test(err)) warn("Couldn't reach Scryfall. Check your connection.");
                else warn(`No Scryfall match for “${escHtml(searchTitle)}”. The title may not be a single card.`);
                return;
            }

            const rawMarketPrice = parseFloat(res.prices ? res.prices.usd : res.usd) || 0;
            if (rawMarketPrice <= 0) { warn(`Scryfall has no ${isFoil ? "foil " : ""}price for ${escHtml(res.name || searchTitle)}.`); return; }
            if (!priceOk) {
                verdictContainer.innerHTML = `<div style="background:#30363d; color:#c9d1d9; padding:5px; text-align:center; border-radius:4px; font-weight:700; font-size:11px;">Non-USD or unreadable price — no verdict</div>`;
                return;
            }
            const tcgShipping = rawMarketPrice >= 50.00 ? 0.00 : 1.22;
            trueMarketFloor = (rawMarketPrice + tcgShipping).toFixed(2);
            const discountPct = ((parseFloat(trueMarketFloor) - totalCost) / parseFloat(trueMarketFloor)) * 100;

            let dealBanner = '';
            if (discountPct >= 20) dealBanner = `<div style="background:#238636; color:#fff; padding:5px; text-align:center; border-radius:4px; font-weight:700; font-size:11px; margin-bottom:6px;">🔥 S-TIER DEAL: ${discountPct.toFixed(0)}% UNDER MARKET</div>`;
            else if (discountPct >= 5) dealBanner = `<div style="background:#1f6feb; color:#fff; padding:5px; text-align:center; border-radius:4px; font-weight:700; font-size:11px; margin-bottom:6px;">✅ GOOD DEAL: ${discountPct.toFixed(0)}% UNDER MARKET</div>`;
            else if (discountPct >= -5) dealBanner = `<div style="background:#eab308; color:#000; padding:5px; text-align:center; border-radius:4px; font-weight:700; font-size:11px; margin-bottom:6px;">⚖️ FAIR MARKET VALUE</div>`;
            else dealBanner = `<div style="background:#da3633; color:#fff; padding:5px; text-align:center; border-radius:4px; font-weight:700; font-size:11px; margin-bottom:6px;">⚠️ OVERPRICED: ${Math.abs(discountPct).toFixed(0)}% OVER MARKET</div>`;

            verdictContainer.innerHTML = `
                ${dealBanner}
                <div style="display:flex; justify-content:space-between; font-size:11px; color:#8b949e; border-top:1px solid #1e293b; padding-top:4px;">
                    <span>Scryfall Floor: <strong style="color:#00ffcc;">$${trueMarketFloor}</strong></span>
                    <span>MTGO: <strong style="color:#38bdf8;">${res.prices ? res.prices.tix : 'N/A'} TIX</strong></span>
                </div>
            `;
        });

        // 5. Button Listeners
        const procureBtn = document.getElementById("mp-btn-procure");
        if (procureBtn) {
            procureBtn.addEventListener("click", () => {
                chrome.runtime.sendMessage({
                    action: "importDetectedToScout",
                    mode: "procurement_single",
                    cardName: searchTitle
                }, (r) => {
                    if (chrome.runtime.lastError || !r || r.status !== "success") { procureBtn.innerText = "⚠ Failed"; return; }
                    procureBtn.innerText = "✓ In Buy List";
                    procureBtn.style.borderColor = "#10b981";
                    procureBtn.style.color = "#10b981";
                });
            });
        }
        document.getElementById("mp-btn-dash").addEventListener("click", () => {
            chrome.runtime.sendMessage({ action: "openDashboard" });
        });

        const saveBtn = document.getElementById("mp-btn-save");
        saveBtn.addEventListener("click", () => {
            // Key by origin+path so tracking params / reloads don't create duplicate bookmarks of one listing.
            const bookmarkKey = window.location.origin + window.location.pathname;
            const cardRecord = {
                title: searchTitle,
                price: priceOk ? totalCost.toFixed(2) : "",
                bidders: bidCount,
                watchers: watchers,
                timeLeft: timeLeft,
                marketFloor: trueMarketFloor,
                foil: isFoil,
                url: bookmarkKey,
                savedAt: Date.now()
            };

            chrome.storage.local.get({ watchlist: [], mpBookmarks: [] }, (res) => {
                const updated = [cardRecord, ...res.watchlist.filter(x => x.url !== cardRecord.url)];
                // Also keep a persistent copy for the dashboard's Bookmarks menu (survives "Drop" in the Watchlist).
                const bm = Array.isArray(res.mpBookmarks) ? res.mpBookmarks : [];
                const bmNext = [{ id: "bm" + Date.now(), title: cardRecord.title, url: cardRecord.url, price: cardRecord.price, source: "eBay", note: "", savedAt: cardRecord.savedAt }]
                    .concat(bm.filter(x => x.url !== cardRecord.url));
                chrome.storage.local.set({ watchlist: updated, mpBookmarks: bmNext }, () => {
                    saveBtn.innerText = "✓ Bookmarked";
                    saveBtn.style.borderColor = "#10b981";
                    saveBtn.style.color = "#10b981";
                });
            });
        });
    }

    setTimeout(() => initScoutBadge(0), 600);
})();
