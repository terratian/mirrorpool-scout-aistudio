// Mirror Pool Scout: one Scryfall price/metadata loader, shared by the background worker and the dashboard.
// Why it exists: the old loader made one request per card with no retry, so a single 429 or a sleeping service
// worker left rows empty until the user refreshed a few times. This one retries, falls back to fuzzy matching,
// reports what it could not find, and returns art/set/mana so the table never needs extra per-card requests.
(function (root) {
    "use strict";

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const num = (v) => { const x = parseFloat(v); return isFinite(x) ? x : 0; };

    async function fetchJson(url, opts, tries) {
        let lastErr = null;
        for (let a = 0; a < (tries || 3); a++) {
            try {
                const res = await fetch(url, opts);
                if (res.ok) return { ok: true, status: res.status, data: await res.json() };
                if (res.status === 404) return { ok: false, status: 404, data: null };
                lastErr = "HTTP " + res.status;
                if (res.status === 429 || res.status >= 500) {
                    const ra = parseFloat(res.headers && res.headers.get && res.headers.get("Retry-After"));
                    await sleep(isFinite(ra) ? ra * 1000 : 600 * Math.pow(2, a));
                    continue;
                }
                return { ok: false, status: res.status, data: null };
            } catch (e) {
                lastErr = String(e && e.message || e);
                await sleep(500 * Math.pow(2, a));
            }
        }
        return { ok: false, status: 0, data: null, error: lastErr };
    }

    function toEntry(card) {
        const faces = card.card_faces || [];
        const f0 = faces[0] || {};
        const p = card.prices || {};
        const img = (card.image_uris && card.image_uris.art_crop) || (f0.image_uris && f0.image_uris.art_crop) || "";
        const oracle = card.oracle_text != null ? card.oracle_text : faces.map((f) => f.oracle_text || "").join("\n");
        return {
            name: card.name,
            usd: num(p.usd || p.usd_foil || p.usd_etched),
            usd_foil: num(p.usd_foil),
            eur: num(p.eur || p.eur_foil),
            tix: num(p.tix),
            oracle_text: oracle || "",
            type_line: card.type_line || f0.type_line || "",
            edhrec_rank: card.edhrec_rank || 99999,
            set: (card.set || "").toUpperCase(),
            set_name: card.set_name || "",
            cn: card.collector_number || "",
            mana: card.mana_cost || f0.mana_cost || "",
            art: img,
            uri: card.scryfall_uri || "",
            t: Date.now()
        };
    }

    function put(map, entry, requestedName) {
        const k = entry.name.toLowerCase();
        map[k] = entry;
        const front = k.split(" // ")[0];
        if (front !== k && !map[front]) map[front] = entry;
        if (requestedName) map[String(requestedName).toLowerCase().trim()] = entry;
    }

    // Returns { prices, missing: [names], failed: bool, error }
    async function fetchPrices(cardNames, opts) {
        const names = Array.from(new Set((cardNames || []).map((n) => String(n || "").trim()).filter(Boolean)));
        const prices = {};
        let failedBatches = 0, lastError = "";
        const notFound = [];
        for (let i = 0; i < names.length; i += 75) {
            const batch = names.slice(i, i + 75);
            const r = await fetchJson("https://api.scryfall.com/cards/collection", {
                method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ identifiers: batch.map((name) => ({ name })) })
            }, 3);
            if (!r.ok) { failedBatches++; lastError = r.error || ("HTTP " + r.status); continue; }
            (r.data.data || []).forEach((c) => put(prices, toEntry(c)));
            (r.data.not_found || []).forEach((nf) => { if (nf && nf.name) notFound.push(nf.name); });
            await sleep(100);
        }
        // Names Scryfall's exact matcher didn't know (typos, "Fire" for "Fire // Ice", punctuation): try fuzzy, a few at most.
        for (const nm of notFound.slice(0, 25)) {
            const key = nm.toLowerCase().trim();
            if (prices[key]) continue;
            const r = await fetchJson("https://api.scryfall.com/cards/named?fuzzy=" + encodeURIComponent(nm), {}, 2);
            if (r.ok && r.data) put(prices, toEntry(r.data), nm);
            await sleep(100);
        }
        const missing = names.filter((n) => !prices[n.toLowerCase()]);
        return { prices, missing, failed: failedBatches > 0 && Object.keys(prices).length === 0, partial: failedBatches > 0, error: lastError };
    }

    const api = { fetchPrices, fetchJson };
    root.MPScry = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
