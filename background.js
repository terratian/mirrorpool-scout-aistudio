// --- Mirror Pool Scout: Background Router & Scryfall Pricing Engine ---

try { importScripts("affiliate.js", "scryfall.js"); } catch (e) { /* optional: only used to tag eBay links in notifications */ }

// ---------------- Price alerts ----------------
// Storage: mpAlerts { [cardKey]: { name, target, lastPrice, lastAt } }, mpAlertSettings { enabled, intervalMin },
//          mpAlertStatus { checkedAt, checked, hits }, mpAlertLinks { [notificationId]: url }
const MP_ALARM = "mp-price-check";

function mpScheduleAlarm() {
    chrome.storage.local.get({ mpAlertSettings: { enabled: false, intervalMin: 360 } }, (r) => {
        const st = r.mpAlertSettings || {};
        chrome.alarms.clear(MP_ALARM, () => {
            if (st.enabled) chrome.alarms.create(MP_ALARM, { delayInMinutes: 1, periodInMinutes: Math.max(30, Number(st.intervalMin) || 360) });
        });
    });
}
chrome.runtime.onInstalled.addListener(mpScheduleAlarm);
// Before an update changes anything, keep a copy of the user's lists so nothing can be lost (restorable in Settings > Backup).
chrome.runtime.onInstalled.addListener((d) => {
    if (!d || d.reason !== "update") return;
    const KEEP = ["savedChaseLists", "mpBookmarks", "mpCollection", "procurementTargets", "watchlist", "watchlist_cards", "card_chase", "deckMeta", "currentDecklist", "mpAlerts", "mpLanded", "mpFlipSettings", "mpShipSettings"];
    chrome.storage.local.get(KEEP, (all) => {
        chrome.storage.local.set({ mpPreUpdateSnapshot: { from: d.previousVersion || "", at: Date.now(), data: all } });
    });
});
chrome.runtime.onStartup.addListener(mpScheduleAlarm);
chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.mpAlertSettings) mpScheduleAlarm(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === MP_ALARM) mpRunPriceCheck(false); });

chrome.notifications.onClicked.addListener((id) => {
    chrome.storage.local.get({ mpAlertLinks: {} }, (r) => {
        const url = (r.mpAlertLinks || {})[id];
        if (url) chrome.tabs.create({ url });
        chrome.notifications.clear(id);
    });
});

async function mpRunPriceCheck(manual) {
    const st = await chrome.storage.local.get({
        mpAlerts: {}, mpAlertSettings: { enabled: false }, procurementTargets: [], mpCollection: null, useCollection: false, scryfallPriceCache: {}
    });
    if (!manual && !(st.mpAlertSettings && st.mpAlertSettings.enabled)) return { checked: 0, hits: [] };

    const targets = Array.isArray(st.procurementTargets) ? st.procurementTargets : [];
    const owned = (name) => {
        if (!st.useCollection || !st.mpCollection || !st.mpCollection.cards) return 0;
        const k = String(name).toLowerCase().trim();
        const hit = st.mpCollection.cards[k] || st.mpCollection.cards[k.split(" // ")[0]];
        return hit ? (hit.q || 0) : 0;
    };
    // Only cards that are still on the Buy List and still needed.
    const watch = [];
    targets.forEach((t) => {
        const key = String(t.cardName || "").toLowerCase().trim();
        const a = st.mpAlerts[key];
        if (!a || !(Number(a.target) > 0)) return;
        const need = (t.quantity || 1) - (t.acquired || 0) - owned(t.cardName);
        if (need > 0) watch.push({ key, name: t.cardName, target: Number(a.target), last: a });
    });
    if (!watch.length) {
        await chrome.storage.local.set({ mpAlertStatus: { checkedAt: Date.now(), checked: 0, hits: [] } });
        return { checked: 0, hits: [] };
    }

    let prices = {};
    try { prices = (await self.MPScry.fetchPrices(watch.map((w) => w.name))).prices; } catch (e) { /* offline: try again next alarm */ }
    if (Object.keys(prices).length) {
        const old = await chrome.storage.local.get({ scryfallPriceCache: {} });
        await chrome.storage.local.set({ scryfallPriceCache: Object.assign({}, old.scryfallPriceCache || {}, prices) });
    }

    const alerts = Object.assign({}, st.mpAlerts);
    const links = {};
    const hits = [];
    const DAY = 24 * 3600 * 1000;
    watch.forEach((w) => {
        const p = prices[w.key] || prices[w.key.split(" // ")[0]];
        if (!p || !(p.usd > 0)) return;
        alerts[w.key] = Object.assign({}, alerts[w.key], { price: p.usd });
        if (p.usd > w.target) return;
        const seen = w.last.lastPrice, at = w.last.lastAt || 0;
        if (!manual && seen === p.usd && Date.now() - at < DAY) return; // don't repeat the same alert all day
        hits.push({ name: w.name, price: p.usd, target: w.target });
        alerts[w.key] = Object.assign({}, alerts[w.key], { lastPrice: p.usd, lastAt: Date.now() });
        const q = encodeURIComponent('MTG "' + w.name + '" -proxy -proxies -playtest -custom -token -replica');
        let url = "https://www.ebay.com/sch/i.html?_nkw=" + q + "&_sacat=19107&LH_BIN=1&_sop=15&_udhi=" + (w.target * 0.95).toFixed(2);
        try { if (self.MPAffiliate) url = self.MPAffiliate.decorate(url); } catch (e) { /* keep plain url */ }
        const id = "mp-alert-" + w.key.replace(/[^a-z0-9]+/g, "-").slice(0, 40) + "-" + Date.now();
        links[id] = url;
        chrome.notifications.create(id, {
            type: "basic", iconUrl: "icon128.png", priority: 1,
            title: "📉 " + w.name + " is now $" + p.usd.toFixed(2),
            message: "At or under your $" + w.target.toFixed(2) + " target. Click to search eBay Buy It Now."
        });
    });
    const oldLinks = (await chrome.storage.local.get({ mpAlertLinks: {} })).mpAlertLinks || {};
    const keepKeys = Object.keys(oldLinks).slice(-30);
    const mergedLinks = {}; keepKeys.forEach((k) => { mergedLinks[k] = oldLinks[k]; }); Object.assign(mergedLinks, links);
    await chrome.storage.local.set({ mpAlerts: alerts, mpAlertLinks: mergedLinks, mpAlertStatus: { checkedAt: Date.now(), checked: watch.length, hits } });
    return { checked: watch.length, hits };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === "runPriceCheckNow") {
        mpRunPriceCheck(true).then((r) => sendResponse({ status: "success", ...r })).catch((e) => sendResponse({ status: "error", message: String(e) }));
        return true;
    }
});
// ---------------- end price alerts ----------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. Route migrated datasets from Popup / Content Scripts into Storage
    if (message.action === "sync_to_dashboard") {
        const payload = message.payload || message.cardData || message.data;
        if (!payload) {
            sendResponse({ status: "error", message: "Empty payload received" });
            return;
        }

        let dataStoreKey = payload.targetKey || "general_scout_logs";
        if (!payload.targetKey && payload.actionType) {
            switch (payload.actionType) {
                case "goldfish_card":
                case "watchlist":
                    dataStoreKey = "watchlist_cards";
                    break;
                case "tcg_product":
                    dataStoreKey = "card_chase";
                    break;
                case "decklist_scrape":
                    dataStoreKey = "currentDecklist";
                    break;
                default:
                    dataStoreKey = "general_scout_logs";
            }
        }

        chrome.storage.local.get([dataStoreKey], (result) => {
            let existingData = result[dataStoreKey] || [];
            if (!Array.isArray(existingData)) existingData = [existingData];
            existingData.unshift(payload);

            chrome.storage.local.set({ [dataStoreKey]: existingData }, () => {
                sendResponse({ status: "success", storedKey: dataStoreKey });
            });
        });
        return true;
    }

    // 2. Single Card Fuzzy Lookup (for eBay Content Script Badge)
        if (message.action === "fetchComps") {
            const rawTitle = (message.cardName || message.cardTitle || "").trim();

            function sanitizeEbayCardTitle(raw) {
                let s = raw
                    // Strip leading prefixes like MTG, MGT, Magic: The Gathering, NM, Foil
                    .replace(/^(?:MTG|MGT|Magic:?\s*The\s*Gathering|NM|LP|MP|HP|Mint|Near\s*Mint|Foil|Non-?Foil|1x|2x|3x|4x|x?\d+x?)\b[\s\-|:•]*/ig, "")
                    .trim();

                // If the card name is followed by (Set/Number) or [Set/Number], e.g. "Thoughtseize (M 0020) NM R..."
                const beforeParen = s.split(/\s*[\(\[#]/)[0].trim();
                if (beforeParen.length >= 3 && !/^(?:MTG|MGT|Magic|Commander|Standard|Modern)$/i.test(beforeParen)) {
                    s = beforeParen;
                }

                // Cut off at the first condition / rarity / set-code marker in the remaining title
                s = s.split(/\b(?:NM|LP|MP|HP|DMG|Near\s*Mint|Lightly\s*Played|MTG|MGT|Foil|Non-?Foil|Outlaws\s*of|Commander|Secret\s*Lair|Borderless|Extended\s*Art|Showcase|Retro\s*Frame|[A-Z]{3}-\d+|#?\d{2,4}\/\d{2,4}|\b[MRUC]\s+\d{3,4})\b/i)[0];

                // Strip trailing single-letter rarity/condition tokens (e.g. " NM", " R", " M")
                s = s.replace(/\s+\b(?:NM|LP|MP|HP|M|R|U|C)\b\s*$/ig, "").trim();
                return s.replace(/[\-|:\/]+$/, "").trim();
            }

            const cleanName = sanitizeEbayCardTitle(rawTitle);
            if (!cleanName) {
                sendResponse({ found: false, error: "Empty card name after cleanup" });
                return;
            }

            (async () => {
                try {
                    // Attempt 1: Exact/Fuzzy named lookup on sanitized name
                    let res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cleanName)}`);
                    let card = await res.json();

                    // Attempt 2: If still noisy, try the first 1-3 words via fuzzy lookup
                    if (card.object === "error") {
                        const words = cleanName.split(/\s+/);
                        for (let len = Math.min(3, words.length); len >= 1; len--) {
                            const candidate = words.slice(0, len).join(" ");
                            if (candidate.length < 3) continue;
                            res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(candidate)}`);
                            card = await res.json();
                            if (card.object !== "error") break;
                        }
                    }

                    if (card.object === "error") {
                        sendResponse({ found: false, error: card.details || "Could not match card" });
                    } else {
                        const isFoilListing = typeof message.foil === "boolean"
                            ? message.foil
                            : (/\bfoil\b/i.test(rawTitle) && !/\bnon[-\s]?foil\b/i.test(rawTitle));
                        const bestUsd = isFoilListing
                            ? (card.prices?.usd_foil || card.prices?.usd || "0.00")
                            : (card.prices?.usd || card.prices?.usd_foil || "0.00");

                        sendResponse({
                            found: true,
                            name: card.name,
                            usd: bestUsd,
                            usd_foil: card.prices?.usd_foil || "0.00",
                            tix: card.prices?.tix || "0.00",
                            eur: card.prices?.eur || "N/A",
                            prices: { usd: bestUsd, usd_foil: card.prices?.usd_foil || "0.00", tix: card.prices?.tix || "0.00", eur: card.prices?.eur || "N/A" },
                            uri: card.scryfall_uri,
                            tcgplayer_url: card.purchase_uris?.tcgplayer || "",
                            tcg_url: card.purchase_uris?.tcgplayer || `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(card.name)}`,
                            cm_url: card.purchase_uris?.cardmarket || `https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}`
                        });
                    }
                } catch (err) {
                    sendResponse({ found: false, error: err.message });
                }
            })();
            return true;
        }

        // 3. Batch Collection Lookup (Up to 75 cards per request for Decklists & Arbitrage)
    if (message.action === "fetchCollectionPrices") {
        const cardNames = message.cardNames || [];
        if (cardNames.length === 0) {
            sendResponse({ status: "empty", prices: {}, missing: [] });
            return;
        }
        (async () => {
            try {
                const r = await self.MPScry.fetchPrices(cardNames);
                // Merge into the cache (never replace it) so My Decks / alerts can use every saved card.
                const old = await chrome.storage.local.get({ scryfallPriceCache: {} });
                const merged = Object.assign({}, old.scryfallPriceCache || {}, r.prices);
                if (Object.keys(r.prices).length) await chrome.storage.local.set({ scryfallPriceCache: merged });
                sendResponse({ status: r.failed ? "error" : (r.partial || r.missing.length ? "partial" : "success"), prices: r.prices, missing: r.missing, error: r.error });
            } catch (e) {
                sendResponse({ status: "error", prices: {}, missing: [], error: String(e && e.message || e) });
            }
        })();
        return true;
    }

    // 4. Open Full-Tab Dashboard
    if (message.action === "openDashboard") {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
        sendResponse({ status: "dashboard_opened" });
        return true;
    }
});

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});


// --- Mirror Pool Scout: Local Scryfall Card-Name Catalog & Auto-Detector ---
let scryfallNameSet = null;
let catalogLoadingPromise = null;

async function getScryfallCatalogSet() {
    if (scryfallNameSet && scryfallNameSet.size > 1000) return scryfallNameSet;
    if (catalogLoadingPromise) return catalogLoadingPromise;

    catalogLoadingPromise = new Promise((resolve) => {
        chrome.storage.local.get(["scryfallCatalogNames", "scryfallCatalogUpdatedAt"], async (res) => {
            const now = Date.now();
            const ageHours = res.scryfallCatalogUpdatedAt ? (now - res.scryfallCatalogUpdatedAt) / 3600000 : 999;

            if (Array.isArray(res.scryfallCatalogNames) && res.scryfallCatalogNames.length > 5000 && ageHours < 168) {
                scryfallNameSet = new Set(res.scryfallCatalogNames);
                resolve(scryfallNameSet);
                return;
            }

            try {
                const resp = await fetch("https://api.scryfall.com/catalog/card-names");
                const data = await resp.json();
                if (Array.isArray(data.data)) {
                    const lowerNames = [];
                    data.data.forEach(name => {
                        lowerNames.push(name.toLowerCase());
                        // Also index front face of double-faced / split cards (e.g. "Fable of the Mirror-Breaker // Reflection of Kiki-Jiki")
                        if (name.includes(" // ")) {
                            lowerNames.push(name.split(" // ")[0].trim().toLowerCase());
                        }
                    });
                    scryfallNameSet = new Set(lowerNames);
                    chrome.storage.local.set({
                        scryfallCatalogNames: lowerNames,
                        scryfallCatalogUpdatedAt: now
                    });
                    console.log(`[MPScout] Cached ${scryfallNameSet.size} Scryfall card names locally.`);
                    resolve(scryfallNameSet);
                    return;
                }
            } catch (err) {
                console.warn("[MPScout] Catalog fetch error:", err);
            }
            scryfallNameSet = new Set();
            resolve(scryfallNameSet);
        });
    });
    return catalogLoadingPromise;
}

// Pre-warm catalog on service worker startup
getScryfallCatalogSet();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "verifyDetectedCandidates") {
        chrome.storage.local.get({ scoutArmed: true }, async (cfg) => {
            if (!cfg.scoutArmed) {
                if (sender.tab?.id) chrome.action.setBadgeText({ tabId: sender.tab.id, text: "" });
                sendResponse({ armed: false });
                return;
            }

            const nameSet = await getScryfallCatalogSet();
            const rawDeckLines = Array.isArray(message.deckCandidates) ? message.deckCandidates : [];
            const rawTitleCandidates = Array.isArray(message.titleCandidates) ? message.titleCandidates : [];

            // 1. Verify Decklist Candidates against exact Scryfall Catalog Set
            const verifiedMap = new Map();
            for (const item of rawDeckLines) {
                const rawName = String(item.cardName || "").trim();
                const cleanKey = rawName.toLowerCase().split(" // ")[0].trim();
                if (cleanKey.length >= 2 && nameSet.has(cleanKey)) {
                    const prev = verifiedMap.get(cleanKey);
                    if (prev) {
                        prev.quantity += (item.quantity || 1);
                    } else {
                        verifiedMap.set(cleanKey, {
                            cardName: rawName,
                            quantity: item.quantity || 1,
                            acquired: 0,
                            basis: 0
                        });
                    }
                }
            }

            const verifiedDeck = Array.from(verifiedMap.values());
            const totalCards = verifiedDeck.reduce((sum, c) => sum + c.quantity, 0);

            // 2. Verify Single-Card Title Candidates if not a full deck page
            let verifiedSingleCard = null;
            for (const candidate of rawTitleCandidates) {
                const clean = String(candidate || "").trim();
                const key = clean.toLowerCase().split(" // ")[0].trim();
                if (key.length >= 3 && nameSet.has(key)) {
                    verifiedSingleCard = clean;
                    break;
                }
            }

            if (sender.tab?.id) {
                const badgeText = verifiedDeck.length >= 3
                    ? String(totalCards)
                    : (verifiedSingleCard ? "1" : "");
                chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#10b981" });
                chrome.action.setBadgeText({ tabId: sender.tab.id, text: badgeText });
            }

            sendResponse({
                armed: true,
                decklist: verifiedDeck,
                totalCards,
                singleCard: verifiedSingleCard
            });
        });
        return true;
    }

    if (message.action === "importDetectedToScout") {
        const mode = message.mode;
        if (mode === "deck" && Array.isArray(message.decklist) && message.decklist.length > 0) {
            const deckName = String(message.deckName || "Imported Deck").slice(0, 80);
            const cards = message.decklist.map((c) => ({ cardName: c.cardName, quantity: c.quantity || 1, acquired: c.acquired || 0, basis: c.basis || 0, set: c.set || "", cn: c.cn || "", foil: !!c.foil }));
            const meta = { deckName, printingTarget: "normal", conditionFloor: "any" };
            chrome.storage.local.get({ savedChaseLists: {} }, (r) => {
                // Keep the deck in My Decks (persistent) as well as making it the active Buy List.
                const lists = Object.assign({}, r.savedChaseLists || {});
                lists[deckName] = { cards, meta, updatedAt: Date.now(), source: message.url || "" };
                chrome.storage.local.set({ procurementTargets: cards, currentDecklist: cards, deckMeta: meta, savedChaseLists: lists }, () => {
                    sendResponse({ status: "success", count: cards.length });
                });
            });
            return true;
        }
                                if (mode === "scavenger_batch" && Array.isArray(message.deals)) {
                chrome.storage.local.get({ watchlist: [] }, (res) => {
                    const existing = Array.isArray(res.watchlist) ? res.watchlist : [];
                    const merged = [...message.deals, ...existing];
                    const seen = new Set();
                    const deduped = merged.filter(item => {
                        const k = ((item.cardName || item.title || "") + "_" + (item.price || "")).toLowerCase();
                        if (seen.has(k)) return false;
                        seen.add(k);
                        return true;
                    });
                    chrome.storage.local.set({ watchlist: deduped }, () => {
                        sendResponse({ status: "success", count: message.deals.length });
                    });
                });
                return true;
            }
            if (mode === "procurement_single" && message.cardName) {
                chrome.storage.local.get({ procurementTargets: [] }, (res) => {
                    const list = Array.isArray(res.procurementTargets) ? res.procurementTargets : [];
                    const key = message.cardName.toLowerCase().trim();
                    const existing = list.find(c => (c.cardName || "").toLowerCase().trim() === key);
                    if (existing) {
                        existing.quantity = (existing.quantity || 1) + 1;
                    } else {
                        list.unshift({ cardName: message.cardName.trim(), quantity: 1, acquired: 0, basis: 0 });
                    }
                    chrome.storage.local.set({ procurementTargets: list, currentDecklist: list }, () => {
                        sendResponse({ status: "success", count: list.length });
                    });
                });
                return true;
            }
            if (mode === "single" && message.cardName) {
            fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(message.cardName)}`)
                .then(r => r.json())
                .then(card => {
                    const floor = parseFloat(card.prices?.usd || card.prices?.usd_foil || 0);
                    const record = {
                        title: card.name || message.cardName,
                        cardName: card.name || message.cardName,
                        price: floor.toFixed(2),
                        marketFloor: floor.toFixed(2),
                        timeLeft: "Spot Price",
                        activity: `MTGO: ${card.prices?.tix || "0.00"} TIX`,
                        url: message.url || card.scryfall_uri,
                        savedAt: Date.now()
                    };
                    chrome.storage.local.get({ watchlist: [] }, (res) => {
                        const updated = [record, ...res.watchlist.filter(x => (x.cardName || x.title) !== record.cardName)];
                        chrome.storage.local.set({ watchlist: updated }, () => {
                            sendResponse({ status: "success", card: record });
                        });
                    });
                })
                .catch(err => sendResponse({ status: "error", error: err.message }));
            return true;
        }
    }
});
