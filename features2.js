// Mirror Pool Scout v1.5: My Collection (diff), Flip Calculator, Price Alerts, "More" menu behaviour.
// Loaded after dashboard.js, features.js, listformats.js and flipcalc.js. Renders from chrome.storage.local and
// re-renders on storage.onChanged (no page-wide MutationObservers).
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const esc = (s) => escapeHtml(String(s == null ? "" : s));
    const money = (n) => "$" + (Number(n) || 0).toFixed(2);
    const getStore = (keys) => new Promise((r) => chrome.storage.local.get(keys, r));
    const setStore = (obj) => new Promise((r) => chrome.storage.local.set(obj, r));
    const keyOf = (name) => String(name || "").toLowerCase().trim();
    const gotoTab = (id) => { const nav = document.querySelector(`[data-tab="${id}"]`); if (nav) nav.click(); };

    (function css() {
        const st = document.createElement("style");
        st.id = "mp-features2-css";
        st.textContent = `
        .mp-more{position:relative}
        .mp-more-sum{list-style:none;cursor:pointer;color:#cbd5e1;background:#1e293b;border:1px solid #475569;padding:4px 7px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap}
        .mp-more-sum::-webkit-details-marker{display:none}
        .mp-more[open] .mp-more-sum{border-color:#00ffcc;color:#00ffcc}
        .mp-more-menu{position:absolute;right:0;top:calc(100% + 4px);z-index:50;min-width:250px;background:#0b1120;border:1px solid #334155;border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:2px;box-shadow:0 8px 24px rgba(0,0,0,.5)}
        .mp-more-link{display:block;text-align:left;background:transparent;border:0;color:#e2e8f0;font-size:12px;font-weight:600;padding:6px 8px;border-radius:5px;text-decoration:none;cursor:pointer}
        .mp-more-link:hover{background:#1e293b;color:#00ffcc}
        #procurement-container,#mp-targets-card{overflow:visible}
        .mp-flip-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
        .mp-flip-grid label{font-size:11px;color:#94a3b8;font-weight:600;display:flex;flex-direction:column;gap:4px}
        .mp-flip-out{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px}
        .mp-flash{animation:mpflash 1.4s ease-out}
        @keyframes mpflash{0%{box-shadow:0 0 0 3px #00ffcc}100%{box-shadow:0 0 0 0 transparent}}
        @keyframes mpfoilrow{0%{background-position:0% 50%}100%{background-position:250% 50%}}
        @keyframes mpfoilsheen2{0%{background-position:160% 0}100%{background-position:-100% 0}}
        tr.mp-foil{background-image:linear-gradient(110deg,rgba(255,0,128,0) 0%,rgba(255,80,160,.16) 18%,rgba(0,255,200,.20) 36%,rgba(255,230,0,.16) 54%,rgba(120,90,255,.18) 72%,rgba(255,0,128,0) 90%);background-size:250% 100%;animation:mpfoilrow 3.4s linear infinite;box-shadow:inset 3px 0 0 #00ffcc}
        .mp-foil-card{position:relative;overflow:hidden}
        .mp-foil-card::after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:8px;background:linear-gradient(115deg,transparent 25%,rgba(255,255,255,.10) 38%,rgba(0,255,200,.16) 48%,rgba(255,0,170,.14) 58%,rgba(255,230,0,.12) 66%,transparent 78%);background-size:260% 100%;animation:mpfoilsheen2 3.2s linear infinite;mix-blend-mode:screen}
        .mp-hot-pill{display:inline-block;margin-bottom:6px;font-size:11px;font-weight:800;padding:3px 8px;border-radius:999px;color:#ecfdf5;background:linear-gradient(110deg,#052e16,#0e7490,#6d28d9);border:1px solid #4ade80;text-decoration:none;white-space:nowrap}
        @media (prefers-reduced-motion:reduce){tr.mp-foil,.mp-foil-card::after{animation:none}}
        .mp-toast{position:fixed;left:50%;bottom:70px;transform:translateX(-50%);background:#0b1120;color:#e2e8f0;border:1px solid #10b981;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;z-index:99999}
        `;
        document.head.appendChild(st);
    })();

    function toast(msg) {
        const t = document.createElement("div");
        t.className = "mp-toast"; t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2600);
    }

    // close any open "More" menu when clicking elsewhere
    document.addEventListener("click", (e) => {
        document.querySelectorAll("details.mp-more[open]").forEach((d) => { if (!d.contains(e.target)) d.removeAttribute("open"); });
    });

    // ================================================================ My Collection
    async function renderCollection() {
        const body = $("mp-collection-body");
        if (!body) return;
        const st = await getStore({ mpCollection: null, useCollection: false, hideOwned: false });
        const col = st.mpCollection && st.mpCollection.cards ? st.mpCollection : null;
        const names = col ? Object.keys(col.cards) : [];
        const upd = col && col.updatedAt ? new Date(col.updatedAt).toLocaleDateString() : "";
        const keep = {};
        ["mp-col-text", "mp-col-filter"].forEach((id) => { if ($(id)) keep[id] = $(id).value; });
        const html = `
            <div class="card-box" style="margin-bottom:14px">
                <div style="font-weight:700;font-size:14px;color:var(--accent-teal);margin-bottom:6px">Import your collection</div>
                <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">In ManaBox open your collection, choose Export, then CSV. Import that file here. Works with ManaBox, TCGplayer, Moxfield and Deckbox CSV files and plain "4 Card Name" lists. Your collection stays in this browser.</div>
                <div class="mp-tools">
                    <button class="mp-btn go" id="mp-col-file-btn" type="button">📁 Choose collection file</button>
                    <input type="file" id="mp-col-file" accept=".csv,.txt,.tsv,text/plain,text/csv" style="display:none">
                    <label style="font-size:12px;color:#cbd5e1;display:flex;gap:6px;align-items:center"><input type="radio" name="mp-col-mode" value="replace" checked> Replace my collection</label>
                    <label style="font-size:12px;color:#cbd5e1;display:flex;gap:6px;align-items:center"><input type="radio" name="mp-col-mode" value="add"> Add to my collection</label>
                </div>
                <textarea id="mp-col-text" placeholder="...or paste your collection here" style="width:100%;min-height:90px;background:#070d17;border:1px solid #334155;color:#f8fafc;border-radius:6px;padding:8px;font-family:monospace;font-size:12px;box-sizing:border-box"></textarea>
                <div class="mp-tools" style="margin-top:8px">
                    <button class="mp-btn go" id="mp-col-import" type="button">Import</button>
                    <span id="mp-col-msg" style="font-size:12px;color:#94a3b8"></span>
                </div>
            </div>
            <div class="card-box">
                <div class="mp-tools">
                    <strong style="font-size:13px">${col ? `${col.total} cards · ${names.length} unique · ${esc(col.source || "imported")} · ${esc(upd)}` : "No collection imported yet."}</strong>
                    <label style="font-size:12px;color:#cbd5e1;display:flex;gap:6px;align-items:center"><input type="checkbox" id="mp-col-use" ${st.useCollection ? "checked" : ""}> Subtract it on the Buy List</label>
                    <label style="font-size:12px;color:#cbd5e1;display:flex;gap:6px;align-items:center"><input type="checkbox" id="mp-col-hide" ${st.hideOwned ? "checked" : ""}> Hide cards I already have</label>
                    ${col ? `<input class="mp-field" id="mp-col-filter" placeholder="Search my collection..." style="width:220px"><button class="mp-btn danger" id="mp-col-clear" type="button">Delete collection</button>` : ""}
                </div>
                <div id="mp-col-list"></div>
            </div>`;
        if (body.dataset.sig === html) return;
        body.dataset.sig = html;
        body.innerHTML = html;
        Object.keys(keep).forEach((id) => { if ($(id)) $(id).value = keep[id]; });

        const drawList = () => {
            const q = ($("mp-col-filter") ? $("mp-col-filter").value : "").toLowerCase();
            const rows = names.filter((n) => !q || n.includes(q)).sort().slice(0, 300);
            $("mp-col-list").innerHTML = col ? `<table class="mp-uv-table"><thead><tr><th>Card</th><th>Copies owned</th></tr></thead><tbody>${rows.map((n) => `<tr><td>${esc(col.cards[n].n)}</td><td>${col.cards[n].q}</td></tr>`).join("")}</tbody></table>${names.length > rows.length && !q ? `<div style="font-size:11px;color:#64748b;margin-top:6px">Showing the first 300. Use search to find a card.</div>` : ""}` : "";
        };
        drawList();
        if ($("mp-col-filter")) $("mp-col-filter").addEventListener("input", drawList);

        const importText = async (text, source) => {
            const msg = $("mp-col-msg");
            const parsed = MPLists.parse(text);
            if (!parsed.cards.length) { msg.style.color = "#f59e0b"; msg.textContent = "No cards recognised. Export a CSV from ManaBox, or paste lines like '3 Lightning Bolt'."; return; }
            const mode = (document.querySelector('input[name="mp-col-mode"]:checked') || {}).value;
            const prev = (mode === "add" && col) ? col.cards : {};
            const cards = Object.assign({}, prev);
            parsed.cards.forEach((c) => {
                const k = keyOf(c.cardName);
                cards[k] = { n: c.cardName, q: (cards[k] ? cards[k].q : 0) + c.quantity };
            });
            const total = Object.values(cards).reduce((n, c) => n + c.q, 0);
            await setStore({ mpCollection: { cards, total, unique: Object.keys(cards).length, updatedAt: Date.now(), source: parsed.format }, useCollection: true });
            toast(`Collection imported: ${total} cards`);
        };
        $("mp-col-file-btn").addEventListener("click", () => $("mp-col-file").click());
        $("mp-col-file").addEventListener("change", () => {
            const f = $("mp-col-file").files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = () => importText(String(rd.result || ""), f.name);
            rd.readAsText(f);
        });
        $("mp-col-import").addEventListener("click", () => importText($("mp-col-text").value, "paste"));
        $("mp-col-use").addEventListener("change", (e) => setStore({ useCollection: e.target.checked }));
        $("mp-col-hide").addEventListener("change", (e) => setStore({ hideOwned: e.target.checked }));
        if ($("mp-col-clear")) $("mp-col-clear").addEventListener("click", async () => {
            if (!window.confirm("Delete your imported collection from this browser?")) return;
            await setStore({ mpCollection: null, useCollection: false });
        });
    }

    async function syncOwnedBar() {
        const st = await getStore({ mpCollection: null, useCollection: false, hideOwned: false });
        const use = $("mp-use-collection"), hide = $("mp-hide-owned"), cnt = $("mp-owned-count");
        if (!use) return;
        use.checked = st.useCollection === true; hide.checked = st.hideOwned === true;
        cnt.textContent = st.mpCollection && st.mpCollection.cards ? `(${st.mpCollection.total} cards imported)` : "(no collection imported yet)";
    }
    function wireOwnedBar() {
        const use = $("mp-use-collection"), hide = $("mp-hide-owned"), go = $("mp-go-collection");
        if (!use) return;
        use.addEventListener("change", async () => {
            const st = await getStore({ mpCollection: null });
            if (use.checked && !(st.mpCollection && st.mpCollection.cards)) { use.checked = false; toast("Import your collection first"); gotoTab("tab-collection"); return; }
            setStore({ useCollection: use.checked });
        });
        hide.addEventListener("change", () => setStore({ hideOwned: hide.checked }));
        go.addEventListener("click", (e) => { e.preventDefault(); gotoTab("tab-collection"); });
    }

    // ================================================================ Flip calculator
    const FLIP_DEFAULTS = { platform: "ebay", shipCharged: 1.0, shipCost: 0.78, packaging: 0.15, targetRoi: 20, qty: 1, fee: null };
    let flipState = Object.assign({}, FLIP_DEFAULTS);

    function ensureFlipCard() {
        let card = $("mp-flip-card");
        if (card) return card;
        const tab = $("tab-arbitrage");
        if (!tab) return null;
        card = document.createElement("div");
        card.id = "mp-flip-card";
        card.className = "card-box";
        card.style.marginBottom = "20px";
        const title = tab.querySelector(".page-title");
        if (title && title.nextSibling) tab.insertBefore(card, title.nextSibling); else tab.prepend(card);
        return card;
    }

    function feeFromState() {
        const p = MPFlip.PRESETS[flipState.platform] || MPFlip.PRESETS.custom;
        return flipState.platform === "custom" && flipState.fee ? flipState.fee : p;
    }

    function renderFlip() {
        const card = ensureFlipCard();
        if (!card) return;
        const f = feeFromState();
        const opts = Object.keys(MPFlip.PRESETS).map((k) => `<option value="${k}" ${k === flipState.platform ? "selected" : ""}>${esc(MPFlip.PRESETS[k].label)}</option>`).join("");
        const v = (k, d) => esc(flipState[k] != null ? flipState[k] : d);
        card.innerHTML = `
            <div style="font-weight:700;font-size:14px;color:var(--accent-teal);margin-bottom:4px">📈 Flip Calculator: profit after fees and shipping</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Enter what you pay and what you expect to sell for. Fees come from the platform you sell on. Click 📈 Flip in the Buy List's "More" menu to fill this in for a card.</div>
            <div class="mp-flip-grid">
                <label>Card<input class="mp-field" id="fl-name" value="${v("name", "")}" placeholder="optional"></label>
                <label>Buy price (each) $<input class="mp-field" id="fl-buy" type="number" step="0.01" min="0" value="${v("buy", "")}"></label>
                <label>Shipping you pay to buy $<input class="mp-field" id="fl-buyship" type="number" step="0.01" min="0" value="${v("buyShip", 0.78)}"></label>
                <label>Sell price (each) $<input class="mp-field" id="fl-sell" type="number" step="0.01" min="0" value="${v("sell", "")}"></label>
                <label>Copies<input class="mp-field" id="fl-qty" type="number" step="1" min="1" value="${v("qty", 1)}"></label>
                <label>Sell on<select class="mp-field" id="fl-platform">${opts}</select></label>
                <label>Shipping the buyer pays $<input class="mp-field" id="fl-shipc" type="number" step="0.01" min="0" value="${v("shipCharged", 1)}"></label>
                <label>Your real shipping cost $<input class="mp-field" id="fl-shipcost" type="number" step="0.01" min="0" value="${v("shipCost", 0.78)}"></label>
                <label>Sleeve, toploader, mailer $<input class="mp-field" id="fl-pack" type="number" step="0.01" min="0" value="${v("packaging", 0.15)}"></label>
                <label>Profit target (ROI %)<input class="mp-field" id="fl-roi" type="number" step="1" value="${v("targetRoi", 20)}"></label>
            </div>
            <details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;color:#38bdf8">Fee rates (editable) · <a href="https://www.ebay.com/sellercenter/resources/seller-updates/2025-january/final-value-fee" target="_blank" rel="noopener" style="color:#38bdf8">eBay fees</a> · <a href="https://help.tcgplayer.com/hc/en-us/articles/201357836-Fees" target="_blank" rel="noopener" style="color:#38bdf8">TCGplayer fees</a></summary>
                <div class="mp-flip-grid" style="margin-top:8px">
                    <label title="Charged on the sale price only">Item commission %<input class="mp-field" id="fl-ip" type="number" step="0.01" value="${f.itemPct}"></label>
                    <label title="Charged on sale price + shipping">Order-total fee %<input class="mp-field" id="fl-tp" type="number" step="0.01" value="${f.totalPct}"></label>
                    <label>Flat fee per order $<input class="mp-field" id="fl-flat" type="number" step="0.01" value="${f.flat}"></label>
                    <label>Commission cap $ (0 = none)<input class="mp-field" id="fl-cap" type="number" step="1" value="${f.cap}"></label>
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:6px">Starting rates as published by each site when this was written. Fees change, so confirm yours (stores, categories and seller levels differ). Editing a rate switches to Custom.</div>
            </details>
            <div class="mp-flip-out" id="fl-out"></div>`;
        const ids = { "fl-name": "name", "fl-buy": "buy", "fl-buyship": "buyShip", "fl-sell": "sell", "fl-qty": "qty", "fl-shipc": "shipCharged", "fl-shipcost": "shipCost", "fl-pack": "packaging", "fl-roi": "targetRoi" };
        Object.keys(ids).forEach((id) => $(id).addEventListener("input", () => { flipState[ids[id]] = id === "fl-name" ? $(id).value : $(id).value; calcFlip(); persistFlip(); }));
        $("fl-platform").addEventListener("change", () => { flipState.platform = $("fl-platform").value; flipState.fee = null; renderFlip(); persistFlip(); });
        ["fl-ip", "fl-tp", "fl-flat", "fl-cap"].forEach((id) => $(id).addEventListener("input", () => {
            flipState.platform = "custom";
            flipState.fee = { itemPct: $("fl-ip").value, totalPct: $("fl-tp").value, flat: $("fl-flat").value, cap: $("fl-cap").value };
            $("fl-platform").value = "custom"; calcFlip(); persistFlip();
        }));
        calcFlip();
    }

    function calcFlip() {
        const out = $("fl-out"); if (!out) return;
        const r = MPFlip.compute(flipState, feeFromState());
        const haveInputs = parseFloat(flipState.buy) > 0 && parseFloat(flipState.sell) > 0;
        const good = r.profit >= 0;
        const tile = (l, vv, color, sub) => `<div class="mp-stat"><div class="l">${l}</div><div class="v" style="color:${color || "#e2e8f0"}">${vv}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
        out.innerHTML = !haveInputs ? `<div style="color:#94a3b8;font-size:12px;grid-column:1/-1">Enter a buy price and a sell price to see your profit.</div>` : [
            tile("Net profit", (r.profit >= 0 ? "+" : "-") + money(Math.abs(r.profit)), good ? "#10b981" : "#ef4444", good ? "after fees, shipping and packaging" : "you lose money at these prices"),
            tile("Return on cost (ROI)", r.roi.toFixed(1) + "%", good ? "#10b981" : "#ef4444", "margin " + r.margin.toFixed(1) + "% of sales"),
            tile("Fees taken", money(r.fees), "#f59e0b", `commission ${money(r.itemFee)} + order fee ${money(r.totalFee)} + flat ${money(r.flat)}`),
            tile("Break-even sell price", isFinite(r.breakeven) ? money(r.breakeven) : "n/a", "#e2e8f0", "per copy, to make $0"),
            tile(`Max buy price for ${flipState.targetRoi || 0}% ROI`, isFinite(r.maxBuy) && r.maxBuy > 0 ? money(r.maxBuy) : "none", "#38bdf8", "per copy, at this sell price")
        ].join("");
    }

    let persistTimer = null;
    function persistFlip() {
        clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
            const { name, buy, sell, ...keep } = flipState; // card + prices are per-flip; the rest is remembered
            setStore({ mpFlipSettings: keep });
        }, 400);
    }

    async function loadFlip() {
        const st = await getStore({ mpFlipSettings: null });
        if (st.mpFlipSettings) flipState = Object.assign({}, FLIP_DEFAULTS, st.mpFlipSettings);
        renderFlip();
    }

    function fillFlip(name, buy, sell) {
        flipState.name = name; flipState.buy = buy; flipState.sell = sell;
        renderFlip();
        gotoTab("tab-arbitrage");
        const c = $("mp-flip-card"); if (c) { c.classList.remove("mp-flash"); void c.offsetWidth; c.classList.add("mp-flash"); c.scrollIntoView({ block: "start", behavior: "smooth" }); }
    }

    // ================================================================ Price alerts
    function ensureAlertsCard() {
        let card = $("mp-alerts-card");
        if (card) return card;
        const anchor = $("mp-targets-card");
        if (!anchor) return null;
        card = document.createElement("div");
        card.id = "mp-alerts-card";
        card.className = "card-box";
        card.style.marginTop = "20px";
        anchor.insertAdjacentElement("afterend", card);
        return card;
    }

    async function renderAlerts() {
        const card = ensureAlertsCard();
        if (!card) return;
        if (card.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return; // don't steal focus while typing
        const st = await getStore({ procurementTargets: [], mpAlerts: {}, mpAlertSettings: { enabled: false, intervalMin: 360 }, mpAlertStatus: null, scryfallPriceCache: {}, mpCollection: null, useCollection: false });
        const settings = st.mpAlertSettings || { enabled: false, intervalMin: 360 };
        const alerts = st.mpAlerts || {};
        const cache = st.scryfallPriceCache || {};
        const targets = (Array.isArray(st.procurementTargets) ? st.procurementTargets : []);
        const rows = targets.map((t) => {
            const k = keyOf(t.cardName);
            const owned = st.useCollection && st.mpCollection && st.mpCollection.cards ? ((st.mpCollection.cards[k] || st.mpCollection.cards[k.split(" // ")[0]] || {}).q || 0) : 0;
            const need = (t.quantity || 1) - (t.acquired || 0) - owned;
            const p = cache[k] || cache[k.split(" // ")[0]];
            return { k, name: t.cardName, need, price: p ? p.usd : 0, target: alerts[k] ? alerts[k].target : "" };
        }).filter((r) => r.need > 0);
        const status = st.mpAlertStatus;
        const statusTxt = status ? `Last check ${new Date(status.checkedAt).toLocaleString()}: ${status.checked} card(s) watched, ${status.hits.length} at or under target${status.hits.length ? " (" + status.hits.map((h) => h.name).join(", ") + ")" : ""}.` : "Not checked yet.";
        const intervals = [[60, "every hour"], [180, "every 3 hours"], [360, "every 6 hours"], [720, "every 12 hours"], [1440, "once a day"]];
        const html = `
            <div style="font-weight:700;font-size:14px;color:var(--accent-teal);margin-bottom:4px">🔔 Price alerts</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Get a desktop notification when a card you still need drops to your target price. It checks Scryfall's TCGplayer market price in the background while Chrome is open. Clicking the notification opens an eBay search for that card.</div>
            <div class="mp-tools">
                <label style="font-size:12px;color:#cbd5e1;display:flex;gap:6px;align-items:center"><input type="checkbox" id="al-enabled" ${settings.enabled ? "checked" : ""}> Alerts on</label>
                <select class="mp-field" id="al-interval">${intervals.map(([m, l]) => `<option value="${m}" ${Number(settings.intervalMin) === m ? "selected" : ""}>Check ${l}</option>`).join("")}</select>
                <button class="mp-btn" id="al-now" type="button">Check now</button>
                <button class="mp-btn" id="al-test" type="button">Send test notification</button>
                <button class="mp-btn" id="al-85" type="button" title="Sets every target to 85% of today's market price">Targets: 85% of market</button>
                <button class="mp-btn" id="al-70" type="button">70% of market</button>
                <button class="mp-btn danger" id="al-clear" type="button">Clear targets</button>
            </div>
            <div id="al-status" style="font-size:11px;color:#94a3b8;margin-bottom:8px">${esc(statusTxt)}</div>
            ${rows.length ? `<table class="mp-uv-table"><thead><tr><th>Card</th><th>Market now</th><th>Alert me at or under</th><th>Status</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td style="color:#10b981;font-weight:700">${esc(r.name)}</td><td>${r.price > 0 ? money(r.price) : "…"}</td><td><input class="mp-field al-target" data-k="${esc(r.k)}" data-name="${esc(r.name)}" type="number" step="0.01" min="0" value="${esc(r.target)}" style="width:90px" placeholder="$"></td><td>${r.target > 0 && r.price > 0 ? (r.price <= r.target ? '<span class="mp-pill g">at or under target</span>' : `<span class="mp-pill b">${money(r.price - r.target)} above target</span>`) : '<span style="color:#64748b">no target</span>'}</td></tr>`).join("")}</tbody></table>` : `<div class="mp-empty">Nothing to watch yet. Add cards to your Buy List first.</div>`}`;
        if (card.dataset.sig === html) return;
        card.dataset.sig = html;
        card.innerHTML = html;

        $("al-enabled").addEventListener("change", () => setStore({ mpAlertSettings: { enabled: $("al-enabled").checked, intervalMin: Number($("al-interval").value) } }));
        $("al-interval").addEventListener("change", () => setStore({ mpAlertSettings: { enabled: $("al-enabled").checked, intervalMin: Number($("al-interval").value) } }));
        $("al-test").addEventListener("click", () => {
            try {
                chrome.notifications.create("mp-test-" + Date.now(), { type: "basic", iconUrl: "icon128.png", title: "Mirror Pool Scout", message: "Alerts are working. You'll see a message like this when a card hits your target." }, () => {
                    toast(chrome.runtime.lastError ? "Chrome or your system blocked the notification" : "Test notification sent");
                });
            } catch (e) { toast("Notifications unavailable"); }
        });
        $("al-now").addEventListener("click", () => {
            $("al-now").textContent = "Checking…";
            chrome.runtime.sendMessage({ action: "runPriceCheckNow" }, (r) => {
                $("al-now").textContent = "Check now";
                if (chrome.runtime.lastError || !r || r.status !== "success") { toast("Couldn't check right now. Try again."); return; }
                toast(r.hits.length ? `${r.hits.length} card(s) at or under target` : `Checked ${r.checked} card(s), none at target yet`);
            });
        });
        const setAll = async (f) => {
            const cur = (await getStore({ mpAlerts: {} })).mpAlerts || {};
            rows.forEach((r) => { if (r.price > 0) cur[r.k] = Object.assign({}, cur[r.k], { name: r.name, target: Math.round(r.price * f * 100) / 100 }); });
            await setStore({ mpAlerts: cur });
        };
        $("al-85").addEventListener("click", () => setAll(0.85));
        $("al-70").addEventListener("click", () => setAll(0.70));
        $("al-clear").addEventListener("click", () => setStore({ mpAlerts: {} }));
        card.querySelectorAll(".al-target").forEach((inp) => inp.addEventListener("change", async () => {
            const cur = (await getStore({ mpAlerts: {} })).mpAlerts || {};
            const v = parseFloat(inp.value);
            if (v > 0) cur[inp.dataset.k] = Object.assign({}, cur[inp.dataset.k], { name: inp.dataset.name, target: v });
            else delete cur[inp.dataset.k];
            await setStore({ mpAlerts: cur });
        }));
    }

    async function alertForCard(name, price) {
        const cur = (await getStore({ mpAlerts: {} })).mpAlerts || {};
        const p = parseFloat(price);
        cur[keyOf(name)] = Object.assign({}, cur[keyOf(name)], { name, target: p > 0 ? Math.round(p * 0.85 * 100) / 100 : "" });
        await setStore({ mpAlerts: cur });
        const c = $("mp-alerts-card"); if (c) { c.classList.remove("mp-flash"); void c.offsetWidth; c.classList.add("mp-flash"); c.scrollIntoView({ block: "center", behavior: "smooth" }); }
        toast(`Alert set for ${name} at ${money(p * 0.85)} (85% of market). Adjust it below.`);
    }

    // ---- delegated clicks from the Buy List rows
    document.addEventListener("click", (e) => {
        const flip = e.target.closest && e.target.closest(".mp-flip-btn");
        if (flip) { e.preventDefault(); document.querySelectorAll("details.mp-more[open]").forEach((d) => d.removeAttribute("open")); fillFlip(flip.dataset.name, flip.dataset.buy, flip.dataset.sell); return; }
        const al = e.target.closest && e.target.closest(".mp-alert-btn");
        if (al) { e.preventDefault(); document.querySelectorAll("details.mp-more[open]").forEach((d) => d.removeAttribute("open")); alertForCard(al.dataset.name, al.dataset.price); }
    });

    // ================================================================ Backup & restore
    function download(filename, text, type) {
        const blob = new Blob([text], { type: type || "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    const stamp = () => new Date().toISOString().slice(0, 10);

    async function renderBackup() {
        const tab = $("tab-settings");
        if (!tab) return;
        let card = $("mp-backup-card");
        if (!card) { card = document.createElement("div"); card.id = "mp-backup-card"; card.className = "card-box"; card.style.marginTop = "20px"; tab.appendChild(card); }
        const st = await getStore({ mpPreUpdateSnapshot: null, mpLastBackup: 0, savedChaseLists: {}, mpBookmarks: [] });
        const stale = (Object.keys(st.savedChaseLists || {}).length + (st.mpBookmarks || []).length > 0) && (!st.mpLastBackup || Date.now() - st.mpLastBackup > 30 * 86400000);
        if (!card.isConnected) tab.appendChild(card); // settings panel may have been rebuilt while we waited
        card.innerHTML = `
            <div style="font-weight:700;font-size:14px;color:var(--accent-teal);margin-bottom:4px">💾 Backup &amp; restore</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">One file holds your decks, bookmarks, collection, alerts and settings. Keep it somewhere safe (Drive, email to yourself). It restores on a new computer, after a reinstall, and later in a phone or web version of Scout. Licence keys are never included.</div>
            <div class="mp-tools">
                <button class="mp-btn go" id="bk-download" type="button">💾 Download backup</button>
                <button class="mp-btn" id="bk-restore-btn" type="button">📂 Restore from backup…</button>
                <input type="file" id="bk-file" accept=".json,application/json" style="display:none">
                <span style="font-size:11px;color:${stale ? "#f59e0b" : "#94a3b8"}">${st.mpLastBackup ? "Last backup: " + esc(new Date(st.mpLastBackup).toLocaleDateString()) : "No backup yet"}${stale ? ". It has been over a month." : ""}</span>
            </div>
            <div class="mp-tools">
                <button class="mp-btn" id="bk-bm-html" type="button" title="Import this into Chrome, Firefox, Safari or Edge bookmarks">🔖 Bookmarks → browser bookmarks file (.html)</button>
                <button class="mp-btn" id="bk-bm-csv" type="button">Bookmarks → spreadsheet (.csv)</button>
            </div>
            ${st.mpPreUpdateSnapshot ? `<div class="mp-tools"><span style="font-size:11px;color:#94a3b8">Automatic copy taken before the last update${st.mpPreUpdateSnapshot.from ? " (from v" + esc(st.mpPreUpdateSnapshot.from) + ")" : ""}, ${esc(new Date(st.mpPreUpdateSnapshot.at).toLocaleString())}.</span> <button class="mp-btn" id="bk-snap-restore" type="button">Restore that copy</button></div>` : ""}
            <div id="bk-restore-panel"></div>`;
        $("bk-download").addEventListener("click", async () => {
            const all = await getStore(null);
            const man = chrome.runtime.getManifest ? chrome.runtime.getManifest() : { version: "" };
            const bk = MPBackup.build(all, man.version);
            download(`mirrorpool-backup-${stamp()}.json`, JSON.stringify(bk, null, 2));
            await setStore({ mpLastBackup: Date.now() });
            const sm = MPBackup.summary(bk.data);
            toast(`Backup saved: ${sm.decks} decks, ${sm.bookmarks} bookmarks`);
            renderBackup();
        });
        const snapBtn = $("bk-snap-restore");
        if (snapBtn) snapBtn.addEventListener("click", async () => {
            if (!confirm("Replace your current lists, bookmarks and settings with the automatic copy from before the last update?")) return;
            await setStore(st.mpPreUpdateSnapshot.data || {});
            toast("Restored. Reloading…"); setTimeout(() => location.reload(), 700);
        });
        $("bk-bm-html").addEventListener("click", async () => { const l = (await getStore({ mpBookmarks: [] })).mpBookmarks || []; download(`mirrorpool-bookmarks-${stamp()}.html`, MPBackup.bookmarksHtml(l), "text/html"); toast(`${l.length} bookmarks exported`); });
        $("bk-bm-csv").addEventListener("click", async () => { const l = (await getStore({ mpBookmarks: [] })).mpBookmarks || []; download(`mirrorpool-bookmarks-${stamp()}.csv`, MPBackup.bookmarksCsv(l), "text/csv"); toast(`${l.length} bookmarks exported`); });
        $("bk-restore-btn").addEventListener("click", () => $("bk-file").click());
        $("bk-file").addEventListener("change", () => {
            const f = $("bk-file").files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = () => {
                let obj = null;
                try { obj = JSON.parse(String(rd.result || "")); } catch (e) { /* handled below */ }
                const v = MPBackup.validate(obj);
                const panel = $("bk-restore-panel");
                if (!v.ok) { panel.innerHTML = `<div style="color:#f59e0b;font-size:12px;margin-top:8px">${esc(v.reason)}</div>`; return; }
                const sm = MPBackup.summary(obj.data);
                panel.innerHTML = `<div class="mp-empty" style="margin-top:10px">
                    Backup from ${esc((obj.exportedAt || "").slice(0, 10))}: <strong>${sm.decks}</strong> decks, <strong>${sm.bookmarks}</strong> bookmarks, <strong>${sm.collection}</strong> collection cards, <strong>${sm.alerts}</strong> alerts.
                    <div class="mp-tools" style="margin:8px 0 0">
                        <label style="font-size:12px;color:#cbd5e1;display:flex;gap:6px;align-items:center"><input type="radio" name="bk-mode" value="merge" checked> Merge with what I have (recommended)</label>
                        <label style="font-size:12px;color:#cbd5e1;display:flex;gap:6px;align-items:center"><input type="radio" name="bk-mode" value="replace"> Replace everything</label>
                        <button class="mp-btn go" id="bk-apply" type="button">Restore</button>
                    </div></div>`;
                $("bk-apply").addEventListener("click", async () => {
                    const mode = (document.querySelector('input[name="bk-mode"]:checked') || {}).value;
                    if (mode === "replace") {
                        if (!window.confirm("Replace your current decks, bookmarks, collection and settings with this backup?")) return;
                        await setStore(obj.data);
                    } else {
                        const cur = await getStore(MPBackup.KEYS);
                        await setStore(MPBackup.merge(cur, obj.data));
                    }
                    panel.innerHTML = `<div style="color:#10b981;font-size:12px;margin-top:8px">✓ Restored.</div>`;
                    toast("Backup restored");
                    if (typeof syncAllPanels === "function") syncAllPanels();
                });
            };
            rd.readAsText(f);
            $("bk-file").value = "";
        });
    }

    document.addEventListener("click", (e) => {
        const g = e.target.closest && e.target.closest("[data-goto-backup]");
        if (!g) return;
        e.preventDefault();
        gotoTab("tab-settings");
        const c = $("mp-backup-card"); if (c) { c.classList.remove("mp-flash"); void c.offsetWidth; c.classList.add("mp-flash"); c.scrollIntoView({ block: "center", behavior: "smooth" }); }
    });

    // ================================================================ "Hot deal" foil on Buy List rows
    let hot = {};
    async function loadHot() {
        const st = await getStore({ mpDeals: {}, mpAlerts: {}, mpAlertStatus: null, scryfallPriceCache: {}, mpScanFound: {} });
        const now = Date.now(), DAY = 86400000;
        const h = {};
        Object.keys(st.mpScanFound || {}).forEach((k) => {
            const x = st.mpScanFound[k];
            if (now - (x.at || 0) < DAY && x.gap >= 0.12) h[k] = { kind: "print", text: `🌈 Cheaper printing: ${x.set} ${money(x.usd)}` };
        });
        Object.keys(st.mpAlerts || {}).forEach((k) => {
            const a = st.mpAlerts[k], p = (st.scryfallPriceCache || {})[k];
            if (a && a.target > 0 && p && p.usd > 0 && p.usd <= a.target) h[k] = { kind: "alert", text: `🔔 At your price: ${money(p.usd)} (target ${money(a.target)})` };
        });
        Object.keys(st.mpDeals || {}).forEach((k) => {
            const d = st.mpDeals[k];
            if (d && now - (d.at || 0) < 2 * DAY) h[k] = { kind: "deal", text: `🔥 eBay deal: ${money(d.total)} delivered`, url: safeHttpUrl(d.url) || "" };
        });
        hot = h;
        applyHot();
    }

    function applyHot() {
        document.querySelectorAll("#procurement-tbody tr[data-card-key]").forEach((tr) => {
            const k = tr.getAttribute("data-card-key");
            const cell = tr.querySelector("td:last-child");
            const h = hot[k] || hot[k.split(" // ")[0]];
            const old = tr.querySelector(".mp-hot-pill");
            if (!h) { tr.classList.remove("mp-foil"); if (old) old.remove(); return; }
            tr.classList.add("mp-foil");
            if (old && old.dataset.sig === h.text) return;
            if (old) old.remove();
            if (!cell) return;
            const pill = document.createElement(h.url ? "a" : "span");
            pill.className = "mp-hot-pill";
            pill.dataset.sig = h.text;
            pill.textContent = h.text;
            if (h.url) { pill.href = h.url; pill.target = "_blank"; pill.rel = "noopener"; pill.title = "Open the listing"; }
            cell.insertBefore(pill, cell.firstChild);
        });
    }
    window.MPFeatures2 = { applyHot, renderBackup: () => renderBackup() };

    // ================================================================ boot
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes.mpCollection || changes.useCollection || changes.hideOwned) { renderCollection(); syncOwnedBar(); if (typeof syncAllPanels === "function") syncAllPanels(); }
        if (changes.mpShipSettings && typeof syncAllPanels === "function") syncAllPanels();
        if (changes.mpAlerts || changes.mpAlertSettings || changes.mpAlertStatus || changes.procurementTargets || changes.scryfallPriceCache) renderAlerts();
        if (changes.mpDeals || changes.mpScanFound || changes.mpAlerts || changes.scryfallPriceCache) loadHot();
    });

    function boot() {
        wireOwnedBar();
        syncOwnedBar();
        renderCollection();
        loadFlip();
        renderAlerts();
        renderBackup();
        loadHot();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
