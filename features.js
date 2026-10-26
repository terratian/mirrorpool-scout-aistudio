// Mirror Pool Scout v1.4 features: BIN totals, undervalued-paper scan, My Decks, Bookmarks.
// Loaded after dashboard.js (uses its globals: escapeHtml, safeHttpUrl, syncAllPanels).
// Everything is rendered from chrome.storage.local and re-rendered via storage.onChanged
// (no page-wide MutationObservers, so no render loops).
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const esc = (s) => escapeHtml(String(s == null ? "" : s));
    const money = (n) => "$" + (Number(n) || 0).toFixed(2);
    const BIN_FACTOR = 0.85; // "snipe" target = 85% of market, same rule as the BIN buttons

    const getStore = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));
    const setStore = (obj) => new Promise((r) => chrome.storage.local.set(obj, r));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    (function injectCss() {
        const st = document.createElement("style");
        st.id = "mp-features-css";
        st.textContent = `
        .mp-stat-bar{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:0 0 12px}
        .mp-stat{background:#070d17;border:1px solid #1e293b;border-radius:8px;padding:8px 12px}
        .mp-stat .l{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;font-weight:700}
        .mp-stat .v{font-size:18px;font-weight:800;margin-top:2px}
        .mp-stat .s{font-size:10px;color:#64748b;margin-top:1px}
        .mp-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
        .mp-btn{background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;text-decoration:none;white-space:nowrap}
        .mp-btn:hover{border-color:#00ffcc;color:#00ffcc}
        .mp-btn.go{background:#10b981;color:#030712;border-color:#10b981}
        .mp-btn.danger{color:#ef4444;border-color:#ef4444;background:rgba(239,68,68,.1)}
        .mp-field{background:#070d17;border:1px solid #334155;color:#f8fafc;border-radius:6px;padding:7px 10px;font-size:12px}
        .mp-uv-grid{font-size:12px}
        .mp-uv-head,.mp-uv-row{display:grid;grid-template-columns:2fr 1fr 1.4fr 2.6fr;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #1e293b}
        .mp-uv-head{color:#94a3b8;font-size:10px;letter-spacing:.06em;text-transform:uppercase}
        .mp-pill{font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px}
        .mp-pill.g{background:rgba(16,185,129,.15);color:#10b981}
        .mp-pill.b{background:rgba(56,189,248,.15);color:#38bdf8}
        .mp-deck-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
        .mp-deck-card{background:#0b1120;border:1px solid #1e293b;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:8px}
        .mp-deck-card h3{margin:0;font-size:14px;color:#10b981;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .mp-row{display:flex;justify-content:space-between;font-size:12px;color:#94a3b8}
        .mp-row strong{color:#f8fafc}
        .mp-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
        .mp-bm-item{display:flex;gap:10px;align-items:center;justify-content:space-between;background:#0b1120;border:1px solid #1e293b;border-radius:8px;padding:10px 14px;margin-bottom:8px}
        .mp-bm-item a.t{color:#10b981;font-weight:700;font-size:13px;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
        .mp-bm-meta{font-size:11px;color:#64748b;margin-top:2px}
        .mp-empty{color:#94a3b8;font-size:12px;padding:16px;border:1px dashed #1e293b;border-radius:6px}
        `;
        document.head.appendChild(st);
    })();

    // ---------------------------------------------------------------- 1. BIN totals + undervalued scan
    let lastTargets = [];

    function ensureTotalsBar() {
        let bar = $("mp-bin-totals");
        if (bar) return bar;
        const card = $("mp-targets-card");
        const container = $("procurement-container");
        if (!card || !container) return null;
        bar = document.createElement("div");
        bar.id = "mp-bin-totals";
        card.insertBefore(bar, container);
        const results = document.createElement("div");
        results.id = "mp-uv-results";
        card.insertBefore(results, container);
        return bar;
    }

    function renderTotals(rows) {
        lastTargets = rows || [];
        if (window.MPLandedUI) window.MPLandedUI.update(lastTargets);
        const bar = ensureTotalsBar();
        if (!bar) return;
        const ship = window.mpShip || { ship: 0.78, perOrder: 1 };
        const shipShare = ship.ship / Math.max(1, ship.perOrder);
        let paperMkt = 0, dealBudget = 0, itemsBudget = 0, tixMkt = 0, tixBin = 0, unpriced = 0, cardsLeft = 0, heavy = 0, pricedLeft = 0;
        lastTargets.forEach((r) => {
            const rem = r.remaining != null ? r.remaining : (r.quantity || 1);
            if (rem <= 0) return;
            cardsLeft += rem;
            if (r.unitPaper > 0) {
                const deal = r.unitPaper * BIN_FACTOR;
                paperMkt += r.unitPaper * rem; dealBudget += deal * rem;
                itemsBudget += Math.max(0, deal - shipShare) * rem; pricedLeft += rem;
                if (shipShare > r.unitPaper * 0.30) heavy += rem;
            } else unpriced += rem;
            if (r.unitTix > 0) { tixMkt += r.unitTix * rem; tixBin += r.unitTix * BIN_FACTOR * rem; }
        });
        const pct = Math.round(BIN_FACTOR * 100);
        const orders = Math.ceil(cardsLeft / Math.max(1, ship.perOrder));
        const shipEst = orders * ship.ship;
        const note = unpriced ? `${unpriced} card(s) still without a price` : `${cardsLeft} cards still needed`;
        const html = `
            <div class="mp-stat-bar">
                <div class="mp-stat" title="What the cards you still need cost at Scryfall's TCGplayer market price"><div class="l">Market price total</div><div class="v" style="color:#f59e0b">${money(paperMkt)}</div><div class="s">${esc(note)}</div></div>
                <div class="mp-stat" title="85% of market, shipping included. This is the most you should pay per card, delivered."><div class="l">Deal budget, delivered (≤${pct}%)</div><div class="v" style="color:#10b981">${money(dealBudget)}</div><div class="s">≈ ${money(itemsBudget)} items + shipping · saves ${money(paperMkt - dealBudget)}</div></div>
                <div class="mp-stat" title="Estimated shipping if you buy on eBay, from the shipping settings below"><div class="l">Est. eBay shipping</div><div class="v" style="color:#e2e8f0">${money(shipEst)}</div><div class="s">${orders} order(s) × ${money(ship.ship)}</div></div>
                <div class="mp-stat" title="Cards where shipping would be more than 30% of the card's price. Buy these in bundles or from TCGplayer."><div class="l">Ship-heavy cards</div><div class="v" style="color:${heavy ? "#f59e0b" : "#10b981"}">${heavy}</div><div class="s">${heavy ? "bundle these or buy on TCGplayer" : "shipping is a small share"}</div></div>
                <div class="mp-stat"><div class="l">MTGO TIX total</div><div class="v" style="color:#38bdf8">${tixMkt.toFixed(2)} TIX</div><div class="s">remaining cards, market</div></div>
                <div class="mp-stat" title="85% of the TIX price, a reasonable bot-buy target"><div class="l">MTGO TIX target (≤${pct}%)</div><div class="v" style="color:#38bdf8">${tixBin.toFixed(2)} TIX</div><div class="s">≈ ${money(tixBin)} at $1 per TIX</div></div>
            </div>
            <div class="mp-tools">
                <label style="font-size:11px;color:#94a3b8;display:flex;align-items:center;gap:6px" title="Typical delivery charge on a cheap eBay single. Used to turn the 85% deal rule into an item-price cap.">📦 Shipping per eBay order $
                    <input class="mp-field" id="mp-ship-cost" type="number" step="0.01" min="0" value="${ship.ship}" style="width:72px;padding:4px 6px"></label>
                <label style="font-size:11px;color:#94a3b8;display:flex;align-items:center;gap:6px" title="How many cards you usually buy from one seller per order. More cards per order means less shipping per card.">cards per order
                    <input class="mp-field" id="mp-ship-per" type="number" step="1" min="1" value="${ship.perOrder}" style="width:60px;padding:4px 6px"></label>
                <button class="mp-btn go" id="mp-uv-scan" title="Looks at every printing of each card on Scryfall and flags cheaper printings and price dips">🔎 Find cheaper printings &amp; price dips</button>
                <span id="mp-uv-status" style="font-size:11px;color:#94a3b8"></span>
            </div>`;
        if (bar.dataset.sig === html) return;
        const prevStatus = $("mp-uv-status") ? $("mp-uv-status").textContent : "";
        bar.dataset.sig = html;
        bar.innerHTML = html;
        if ($("mp-uv-status")) $("mp-uv-status").textContent = prevStatus || "Prices are Scryfall's TCGplayer market price.";
        const btn = $("mp-uv-scan");
        if (btn) btn.addEventListener("click", scanUndervalued);
        const saveShip = () => {
            const v = parseFloat($("mp-ship-cost").value), per = parseInt($("mp-ship-per").value, 10);
            setStore({ mpShipSettings: { ship: isFinite(v) && v >= 0 ? v : 0.78, perOrder: per > 0 ? per : 1 } });
        };
        $("mp-ship-cost").addEventListener("change", saveShip);
        $("mp-ship-per").addEventListener("change", saveShip);
    }

    async function fetchPrintings(name, cache) {
        const key = name.toLowerCase();
        const hit = cache[key];
        if (hit && Date.now() - hit.t < 12 * 3600 * 1000) return hit;
        const q = encodeURIComponent('!"' + name + '"');
        const res = await fetch("https://api.scryfall.com/cards/search?q=" + q + "&unique=prints&order=released&dir=desc");
        if (!res.ok) throw new Error("scryfall " + res.status);
        const data = await res.json();
        const prints = (data.data || []).filter((c) => (c.games || []).includes("paper") && c.prices && parseFloat(c.prices.usd) > 0)
            .map((c) => ({ set: (c.set || "").toUpperCase(), setName: c.set_name, cn: c.collector_number, usd: parseFloat(c.prices.usd), promo: !!c.promo, uri: c.scryfall_uri }));
        const out = { t: Date.now(), prints: prints.slice(0, 120) };
        cache[key] = out;
        return out;
    }

    let scanning = false;
    async function scanUndervalued() {
        if (scanning) return;
        scanning = true;
        const status = $("mp-uv-status");
        const box = $("mp-uv-results");
        const btn = $("mp-uv-scan");
        if (btn) btn.disabled = true;
        try {
            const st = await getStore({ printingsCache: {}, priceBaselineMap: {} });
            const cache = st.printingsCache || {};
            const base = st.priceBaselineMap || {};
            const wanted = [];
            const seen = new Set();
            lastTargets.forEach((r) => {
                const n = r.cardName; if (!n || seen.has(n.toLowerCase())) return;
                if ((r.remaining != null ? r.remaining : 1) <= 0) return;
                seen.add(n.toLowerCase()); wanted.push(r);
            });
            const batch = wanted.slice(0, 40);
            const found = [];
            for (let i = 0; i < batch.length; i++) {
                const r = batch[i];
                if (status) status.textContent = `Scanning ${i + 1} / ${batch.length}: ${r.cardName}`;
                try {
                    const before = cache[r.cardName.toLowerCase()];
                    const info = await fetchPrintings(r.cardName, cache);
                    if (!before || before !== info) await sleep(110); // Scryfall asks for ~100ms between requests
                    const ps = info.prints.filter((p) => !p.promo || info.prints.length === 1);
                    if (!ps.length) continue;
                    const cheapest = ps.reduce((a, b) => (b.usd < a.usd ? b : a));
                    const ref = r.unitPaper > 0 ? r.unitPaper : 0;
                    const gap = ref > 0 ? (ref - cheapest.usd) / ref : 0;
                    const b0 = base[r.cardName.toLowerCase()] || 0;
                    const dip = b0 > 0 && ref > 0 ? (ref - b0) / b0 : 0;
                    if (gap >= 0.12 || dip <= -0.05) found.push({ name: r.cardName, ref, cheapest, gap, dip, tix: r.unitTix || 0, count: ps.length });
                } catch (e) {
                    if (status) status.textContent = "Scryfall is busy, partial results shown.";
                    break;
                }
            }
            const prevScan = (await getStore({ mpScanFound: {} })).mpScanFound || {};
            const scanNow = {};
            found.forEach((x) => { scanNow[x.name.toLowerCase().trim()] = { gap: x.gap, dip: x.dip, set: x.cheapest.set, usd: x.cheapest.usd, at: Date.now() }; });
            await setStore({ printingsCache: cache, mpScanFound: Object.assign({}, prevScan, scanNow) });
            found.sort((a, b) => (b.gap * b.ref) - (a.gap * a.ref));
            renderUndervalued(found, batch.length, wanted.length);
            if (status) status.textContent = `Done. ${found.length} of ${batch.length} cards have a cheaper printing or a price dip${wanted.length > batch.length ? " (first 40 cards)" : ""}.`;
        } finally {
            scanning = false;
            if (btn) btn.disabled = false;
        }
        void box;
    }

    function renderUndervalued(found, scanned) {
        const box = $("mp-uv-results");
        if (!box) return;
        if (!found.length) {
            box.innerHTML = `<div class="mp-empty" style="margin-bottom:12px">No cheaper printings or price dips across ${scanned} cards. Prices on every printing are within 12% of market.</div>`;
            return;
        }
        const rows = found.map((f, i) => {
            const ship = window.mpShip || { ship: 0.78, perOrder: 1 };
            const delivered = f.cheapest.usd * 0.90; // pay at most 90% of the cheapest printing's price, delivered
            const ceiling = Math.max(0.25, delivered - ship.ship / Math.max(1, ship.perOrder)).toFixed(2);
            const q = encodeURIComponent(`MTG "${f.name}" ${f.cheapest.setName} -proxy -proxies -playtest -fanart -alter -altered -custom -placeholder -token -replica`);
            const ebay = `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=19107&LH_BIN=1&_sop=15&_udhi=${ceiling}&mpmax=${delivered.toFixed(2)}&mpmkt=${f.cheapest.usd.toFixed(2)}&mpname=${encodeURIComponent(f.name)}`;
            const tcg = `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(f.name + " " + f.cheapest.setName)}`;
            const why = [];
            if (f.gap >= 0.12) why.push(`<span class="mp-pill g">${Math.round(f.gap * 100)}% cheaper printing</span>`);
            if (f.dip <= -0.05) why.push(`<span class="mp-pill b">📉 ${Math.round(f.dip * 100)}% vs your baseline</span>`);
            return `<div class="mp-uv-row">
                <div style="color:#10b981;font-weight:700"><span class="mp-uv-name">${esc(f.name)}</span><div style="margin-top:3px">${why.join(" ")}</div></div>
                <div style="color:#f59e0b;font-weight:700">${f.ref > 0 ? money(f.ref) : "—"}</div>
                <div><strong style="color:#f8fafc">${money(f.cheapest.usd)}</strong><div style="font-size:10px;color:#94a3b8">${esc(f.cheapest.set)} #${esc(f.cheapest.cn)} · ${f.count} printings</div></div>
                <div><div style="display:flex;gap:6px;flex-wrap:wrap">
                    <a class="mp-btn" style="color:#10b981;border-color:#10b981" href="${esc(ebay)}" target="_blank" rel="noopener">eBay BIN ≤$${ceiling} + ship</a>
                    <a class="mp-btn" href="${esc(tcg)}" target="_blank" rel="noopener">TCG</a>
                    <button class="mp-btn" data-uv-bm="${i}">★ Bookmark</button>
                </div></div></div>`;
        }).join("");
        box.innerHTML = `
            <div class="card-box" style="margin:0 0 14px;border-color:#10b981">
                <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#10b981">🎯 Cheaper printings and price dips (${found.length})</div>
                <div class="mp-uv-grid"><div class="mp-uv-head"><span>Card</span><span>Default price</span><span>Cheapest printing</span><span>Hunt</span></div>${rows}</div>
                <div style="font-size:10px;color:#64748b;margin-top:8px">Prices are Scryfall's TCGplayer market data. The eBay link searches Buy It Now listings up to 90% of that printing's price once shipping is added, cheapest first.</div>
            </div>`;
        box.querySelectorAll("[data-uv-bm]").forEach((b) => b.addEventListener("click", async () => {
            const f = found[parseInt(b.getAttribute("data-uv-bm"), 10)];
            if (!f) return;
            const delivered = f.cheapest.usd * 0.90;
            const ceiling = Math.max(0.25, delivered - (window.mpShip ? window.mpShip.ship / Math.max(1, window.mpShip.perOrder) : 0.78)).toFixed(2);
            const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent('MTG "' + f.name + '" ' + f.cheapest.setName + " -proxy -custom")}&_sacat=19107&LH_BIN=1&_sop=15&_udhi=${ceiling}&mpmax=${delivered.toFixed(2)}&mpmkt=${f.cheapest.usd.toFixed(2)}&mpname=${encodeURIComponent(f.name)}`;
            await addBookmark({ title: `${f.name} (${f.cheapest.set}) up to $${ceiling} + ship`, url, source: "Scan", note: `Cheapest printing ${money(f.cheapest.usd)}` });
            b.textContent = "✓ Saved";
        }));
    }

    // ---------------------------------------------------------------- 2. My Decks
    function deckStats(entry, priceCache) {
        const cards = (entry && entry.cards) || [];
        let qty = 0, mkt = 0, need = 0, unpriced = 0;
        cards.forEach((c) => {
            const q = c.quantity || c.required || 1;
            const acq = c.acquired || 0;
            qty += q;
            const rec = priceCache[String(c.cardName || "").toLowerCase()];
            const p = rec ? parseFloat(rec.usd) : NaN;
            if (!isFinite(p) || p <= 0) { unpriced++; return; }
            mkt += p * q; need += p * Math.max(0, q - acq);
        });
        return { unique: cards.length, qty, mkt, need, unpriced };
    }

    async function renderMyDecks() {
        const body = $("mp-mydecks-body");
        if (!body) return;
        const st = await getStore({ savedChaseLists: {}, scryfallPriceCache: {} });
        const lists = st.savedChaseLists || {};
        const names = Object.keys(lists).sort((a, b) => ((lists[b] && lists[b].updatedAt) || 0) - ((lists[a] && lists[a].updatedAt) || 0));
        const cache = st.scryfallPriceCache || {};
        let html = `<div class="mp-tools">
            <button class="mp-btn go" id="mp-deck-new">+ New deck (opens Buy List)</button>
            <input class="mp-field" id="mp-deck-filter" placeholder="Filter decks..." style="width:200px">
            <select class="mp-field" id="mp-decks-format" title="Format used by Copy list"><option value="plain">Copy as: plain list</option><option value="arena">Copy as: Arena / Moxfield</option><option value="manabox">Copy as: ManaBox CSV</option><option value="csv">Copy as: spreadsheet CSV</option></select>
            <button class="mp-btn" data-goto-backup type="button" title="Download a backup file of your decks and bookmarks">💾 Backup</button><span style="font-size:11px;color:#94a3b8">${names.length} saved. Decks are stored in this browser and survive restarts.</span></div>`;
        if (!names.length) {
            html += `<div class="mp-empty">No saved decks yet. Paste a list in Buy List and press "Save &amp; Compile". It will appear here.</div>`;
        } else {
            html += `<div class="mp-deck-grid">` + names.map((n, i) => {
                const s = deckStats(lists[n], cache);
                const ap = s.unpriced ? "~" : "";
                const when = lists[n] && lists[n].updatedAt ? new Date(lists[n].updatedAt).toLocaleDateString() : "";
                return `<div class="mp-deck-card" data-name="${esc(n.toLowerCase())}">
                    <h3 title="${esc(n)}">📑 ${esc(n)}</h3>
                    <div class="mp-row"><span>Cards</span><strong>${s.qty} (${s.unique} unique)</strong></div>
                    <div class="mp-row"><span>Market total</span><strong style="color:#f59e0b">${ap}${money(s.mkt)}</strong></div>
                    <div class="mp-row"><span>Still needed</span><strong style="color:#10b981">${ap}${money(s.need)}</strong></div>
                    <div class="mp-row"><span>Updated</span><strong>${esc(when)}</strong></div>
                    <div class="mp-actions">
                        <button class="mp-btn go" data-deck-load="${i}">Load in Buy List</button>
                        <button class="mp-btn" data-deck-copy="${i}">Copy list</button>
                        <button class="mp-btn" data-deck-ren="${i}">Rename</button>
                        <button class="mp-btn danger" data-deck-del="${i}">Delete</button>
                    </div></div>`;
            }).join("") + `</div>`;
        }
        if (body.dataset.sig === html) return;
        const keepFmt = $("mp-decks-format") ? $("mp-decks-format").value : "";
        body.dataset.sig = html;
        body.innerHTML = html;
        if (keepFmt && $("mp-decks-format")) $("mp-decks-format").value = keepFmt;

        $("mp-deck-new").addEventListener("click", () => {
            const nav = document.querySelector('[data-tab="tab-procurement"]');
            if (nav) nav.click();
            const nameEl = $("deck-name-input"); if (nameEl) { nameEl.value = ""; nameEl.focus(); }
            const ta = $("decklist-input"); if (ta) ta.value = "";
        });
        $("mp-deck-filter").addEventListener("input", (e) => {
            const q = e.target.value.toLowerCase();
            body.querySelectorAll(".mp-deck-card").forEach((c) => { c.style.display = c.dataset.name.includes(q) ? "" : "none"; });
        });
        const pick = (attr) => (e) => names[parseInt(e.currentTarget.getAttribute(attr), 10)];
        body.querySelectorAll("[data-deck-load]").forEach((b) => b.addEventListener("click", async (e) => {
            const n = pick("data-deck-load")(e); const entry = lists[n]; if (!entry) return;
            await setStore({
                procurementTargets: entry.cards || [], currentDecklist: entry.cards || [],
                deckMeta: entry.meta || { deckName: n, printingTarget: "normal", conditionFloor: "any" }
            });
            const nameEl = $("deck-name-input"); if (nameEl) nameEl.value = n;
            const ta = $("decklist-input"); if (ta) ta.value = (entry.cards || []).map((c) => `${c.quantity || 1} ${c.cardName}`).join("\n");
            const nav = document.querySelector('[data-tab="tab-procurement"]'); if (nav) nav.click();
            if (typeof syncAllPanels === "function") syncAllPanels();
        }));
        body.querySelectorAll("[data-deck-copy]").forEach((b) => b.addEventListener("click", async (e) => {
            const n = pick("data-deck-copy")(e); const entry = lists[n]; if (!entry) return;
            const fsel = $("mp-decks-format");
            const text = MPLists.format((entry.cards || []).map((c) => Object.assign({}, c, { qty: c.quantity || 1 })), fsel ? fsel.value : "plain");
            try { await navigator.clipboard.writeText(text); b.textContent = "✓ Copied"; } catch (err) { b.textContent = "Copy blocked"; }
        }));
        body.querySelectorAll("[data-deck-ren]").forEach((b) => b.addEventListener("click", async (e) => {
            const n = pick("data-deck-ren")(e); if (!lists[n]) return;
            const nn = (window.prompt("Rename deck", n) || "").trim();
            if (!nn || nn === n) return;
            if (lists[nn] && !window.confirm(`A deck named "${nn}" exists. Replace it?`)) return;
            lists[nn] = Object.assign({}, lists[n], { updatedAt: Date.now() });
            if (lists[nn].meta) lists[nn].meta = Object.assign({}, lists[nn].meta, { deckName: nn });
            delete lists[n];
            await setStore({ savedChaseLists: lists });
        }));
        body.querySelectorAll("[data-deck-del]").forEach((b) => b.addEventListener("click", async (e) => {
            const n = pick("data-deck-del")(e); if (!lists[n]) return;
            if (!window.confirm(`Delete deck "${n}"? This cannot be undone.`)) return;
            delete lists[n];
            await setStore({ savedChaseLists: lists });
        }));
    }

    // ---------------------------------------------------------------- 3. Bookmarks
    async function addBookmark(b) {
        const url = safeHttpUrl(b.url);
        if (!url) return false;
        const st = await getStore({ mpBookmarks: [] });
        const list = Array.isArray(st.mpBookmarks) ? st.mpBookmarks : [];
        const next = [{ id: "bm" + Date.now() + Math.floor(Math.random() * 1000), title: String(b.title || url).slice(0, 200), url, note: String(b.note || "").slice(0, 300), source: b.source || "Manual", price: b.price || "", savedAt: Date.now() }]
            .concat(list.filter((x) => x.url !== url));
        await setStore({ mpBookmarks: next });
        return true;
    }

    async function migrateBookmarks() {
        const st = await getStore({ mpBookmarks: [], watchlist: [], mpBookmarksMigrated: false });
        if (st.mpBookmarksMigrated) return;
        const list = Array.isArray(st.mpBookmarks) ? st.mpBookmarks.slice() : [];
        (Array.isArray(st.watchlist) ? st.watchlist : []).forEach((w) => {
            const url = safeHttpUrl(w && w.url);
            if (!url || list.some((x) => x.url === url)) return;
            list.push({ id: "bm" + (w.savedAt || Date.now()) + Math.floor(Math.random() * 1000), title: w.title || w.cardName || url, url, note: "", source: "eBay", price: w.price || "", savedAt: w.savedAt || Date.now() });
        });
        await setStore({ mpBookmarks: list, mpBookmarksMigrated: true });
    }

    async function renderBookmarks() {
        const body = $("mp-bookmarks-body");
        if (!body) return;
        const st = await getStore({ mpBookmarks: [] });
        const list = (Array.isArray(st.mpBookmarks) ? st.mpBookmarks : []).slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        let html = `<div class="card-box" style="margin-bottom:14px">
            <div style="font-weight:700;font-size:13px;margin-bottom:8px">+ Add a bookmark</div>
            <div style="display:grid;grid-template-columns:1.4fr 2fr 1.4fr auto;gap:8px">
                <input class="mp-field" id="mp-bm-title" placeholder="Title (e.g. Karn deck on MTGGoldfish)">
                <input class="mp-field" id="mp-bm-url" placeholder="https://...">
                <input class="mp-field" id="mp-bm-note" placeholder="Note (optional)">
                <button class="mp-btn go" id="mp-bm-add">Save</button>
            </div>
            <div id="mp-bm-msg" style="font-size:11px;color:#ef4444;margin-top:6px"></div>
        </div>
        <div class="mp-tools"><input class="mp-field" id="mp-bm-filter" placeholder="Filter bookmarks..." style="width:240px">
            <button class="mp-btn" data-goto-backup type="button" title="Back up or export your bookmarks">💾 Backup / export</button><span style="font-size:11px;color:#94a3b8">${list.length} saved. The ★ Bookmark button on eBay listings lands here too.</span></div>`;
        if (!list.length) {
            html += `<div class="mp-empty">No bookmarks yet. Use "★ Bookmark" on an eBay listing, from the undervalued scan, or add one above.</div>`;
        } else {
            html += list.map((b, i) => `<div class="mp-bm-item" data-text="${esc((b.title + " " + b.note + " " + b.source).toLowerCase())}">
                <div style="min-width:0;flex:1">
                    <a class="t" href="${esc(b.url)}" target="_blank" rel="noopener" title="${esc(b.title)}">${esc(b.title)}</a>
                    <div class="mp-bm-meta">${esc(b.source || "")}${b.price ? " · $" + esc(b.price) : ""}${b.note ? " · " + esc(b.note) : ""} · ${esc(b.savedAt ? new Date(b.savedAt).toLocaleDateString() : "")}</div>
                </div>
                <div class="mp-actions" style="margin:0">
                    <a class="mp-btn" href="${esc(b.url)}" target="_blank" rel="noopener">Open ↗</a>
                    <button class="mp-btn danger" data-bm-del="${i}">✖</button>
                </div></div>`).join("");
        }
        // Keep what the user is typing: only re-render when the list changed.
        if (body.dataset.sig === html) return;
        const active = document.activeElement && body.contains(document.activeElement) ? document.activeElement.id : "";
        const keep = {};
        ["mp-bm-title", "mp-bm-url", "mp-bm-note", "mp-bm-filter"].forEach((id) => { const el = $(id); if (el) keep[id] = el.value; });
        body.dataset.sig = html;
        body.innerHTML = html;
        Object.keys(keep).forEach((id) => { const el = $(id); if (el) el.value = keep[id]; });
        if (active && $(active)) $(active).focus();

        $("mp-bm-add").addEventListener("click", async () => {
            const msg = $("mp-bm-msg");
            const url = safeHttpUrl($("mp-bm-url").value.trim());
            if (!url) { msg.textContent = "Enter a full http(s) link."; return; }
            msg.textContent = "";
            await addBookmark({ title: $("mp-bm-title").value.trim() || url, url, note: $("mp-bm-note").value.trim(), source: "Manual" });
            ["mp-bm-title", "mp-bm-url", "mp-bm-note"].forEach((id) => { const el = $(id); if (el) el.value = ""; });
        });
        $("mp-bm-filter").addEventListener("input", (e) => {
            const q = e.target.value.toLowerCase();
            body.querySelectorAll(".mp-bm-item").forEach((it) => { it.style.display = it.dataset.text.includes(q) ? "" : "none"; });
        });
        body.querySelectorAll("[data-bm-del]").forEach((b) => b.addEventListener("click", async () => {
            const item = list[parseInt(b.getAttribute("data-bm-del"), 10)];
            if (!item) return;
            const cur = (await getStore({ mpBookmarks: [] })).mpBookmarks || [];
            await setStore({ mpBookmarks: cur.filter((x) => x.id !== item.id) });
        }));
    }

    // ---------------------------------------------------------------- boot
    window.MPFeatures = { renderTotals, addBookmark };

    async function boot() {
        await migrateBookmarks();
        renderMyDecks();
        renderBookmarks();
    }
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes.savedChaseLists || changes.scryfallPriceCache) renderMyDecks();
        if (changes.mpBookmarks) renderBookmarks();
    });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
