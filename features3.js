// Mirror Pool Scout: "Landed cost by store" card on the Buy List (estimates, editable assumptions).
(function () {
    "use strict";
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const money = (n) => "$" + (isFinite(n) ? n : 0).toFixed(2);
    let rows = [], cfg = null, timer = null;

    function load() { return new Promise((r) => chrome.storage.local.get({ mpLanded: null }, (v) => r(v.mpLanded))); }
    function save(c) { return new Promise((r) => chrome.storage.local.set({ mpLanded: c }, r)); }

    function ensureCard() {
        let card = $("mp-landed-card");
        if (card) return card;
        const anchor = $("mp-targets-card");
        if (!anchor) return null;
        card = document.createElement("div");
        card.id = "mp-landed-card"; card.className = "card-box"; card.style.marginTop = "20px";
        anchor.insertAdjacentElement("afterend", card);
        return card;
    }

    async function render(force) {
        const card = ensureCard();
        if (!card || !window.MPLanded) return;
        if (!force && card.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
        const wasOpen = !!card.querySelector("details[open]");
        cfg = MPLanded.merge(cfg || await load());
        const need = rows.map((r) => ({ name: r.cardName, qty: r.remaining != null ? r.remaining : (r.quantity || 1), usd: r.unitPaper || 0, eur: r.eur || 0 })).filter((c) => c.qty > 0);
        const res = MPLanded.compute(need, cfg);
        const best = res.bestSingle, split = res.bestSplit;
        const G = "display:grid;grid-template-columns:1.6fr .9fr 1.3fr .7fr 1fr .9fr;gap:6px;align-items:center;padding:7px 8px;font-size:12px;text-align:right;";
        const tr = res.rows.map((r) => {
            const isBest = best && r.key === best.key;
            return `<div style="${G}${isBest ? "background:rgba(74,222,128,.10);" : ""}border-top:1px solid #1e293b"><div style="text-align:left;font-weight:700;color:#10b981">${esc(r.label)}${isBest ? " ✅" : ""}${r.missing ? `<div style="color:#f59e0b;font-size:11px;font-weight:400">${r.missing} card(s) have no price here</div>` : ""}</div>
                <div>${money(r.items)}</div><div>${money(r.ship)}<span style="color:#64748b;font-size:11px"> (${r.orders} order${r.orders === 1 ? "" : "s"})</span></div>
                <div>${money(r.tax)}</div><div style="font-weight:800;color:#e2e8f0">${money(r.total)}</div><div style="color:#94a3b8">${r.cards ? money(r.perCard) : "n/a"}</div></div>`;
        }).join("");
        const head = `<div style="${G}color:#94a3b8;font-weight:700"><div style="text-align:left">Store</div><div>Items</div><div>Shipping</div><div>Tax</div><div>Landed total</div><div>Per card</div></div>`;
        const splitTxt = split ? `Best split order: <strong style="color:#4ade80">${money(split.total)}</strong> across ${split.parts.length} store${split.parts.length === 1 ? "" : "s"} (${split.parts.map((p) => `${esc(p.label)} ${p.cards} card${p.cards === 1 ? "" : "s"}`).join(", ")})${best && split.total < best.total - 0.005 ? `, saves ${money(best.total - split.total)} vs the best single store.` : "."}` : "";
        const IG = "display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr 1fr;gap:6px;align-items:center;padding:4px 8px;font-size:12px;";
        const inputs = `<div style="${IG}color:#94a3b8"><div>Store</div><div>Price vs TCGplayer</div><div>Shipping per order</div><div>Free over</div><div>Cards per order</div></div>` + Object.keys(cfg.stores).map((k) => {
            const s = cfg.stores[k];
            const f = (field, w, step) => `<input type="number" step="${step}" min="0" data-ls="${k}.${field}" value="${s[field]}" style="width:${w}px">`;
            return `<div style="${IG}"><label><input type="checkbox" data-ls="${k}.on" ${s.on ? "checked" : ""}> ${esc(s.label)}</label><div>${f("pricePct", 56, "1")}%</div><div>$${f("ship", 60, "0.01")}</div><div>$${f("freeOver", 56, "0.01")}</div><div>${f("perOrder", 52, "1")}</div></div>`;
        }).join("");
        card.innerHTML = `
            <div style="font-weight:700;font-size:14px;color:var(--accent-teal);margin-bottom:4px">🚚 Landed cost by store (estimate)</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">What the ${res.totalCards} card${res.totalCards === 1 ? "" : "s"} you still need would cost delivered: price + shipping + tax. These are estimates from Scryfall's TCGplayer market price and the shipping rules below. Check each store's cart before you pay.</div>
            ${res.totalCards ? `<div style="overflow-x:auto"><div style="min-width:560px">${head}${tr}</div></div>
            <div style="font-size:12px;color:#cbd5e1;margin:10px 0">${splitTxt}</div>` : `<div style="font-size:12px;color:#94a3b8">Add a deck or list and the totals appear here.</div>`}
            <details style="margin-top:6px"${wasOpen ? " open" : ""}><summary style="cursor:pointer;color:#93c5fd;font-size:12px">Edit shipping, tax and price assumptions</summary>
              <div style="font-size:11px;color:#94a3b8;margin:8px 0">Defaults are rough placeholders. Set each store to what you actually pay. "Price vs TCGplayer" is how that store's prices usually compare to TCGplayer market (e.g. 95 or 110). "Free over" is the order subtotal where shipping is free (0 = never). "Cards per order" is how many cards you expect to bundle in one order or seller.</div>
              <div style="overflow-x:auto"><div style="min-width:520px">${inputs}</div></div>
              <div style="margin-top:8px;font-size:12px">Sales tax % <input type="number" step="0.01" min="0" data-ls="taxPct" value="${cfg.taxPct}" style="width:64px"> &nbsp; EUR→USD <input type="number" step="0.01" min="0" data-ls="eurUsd" value="${cfg.eurUsd}" style="width:64px"> <button class="mp-btn" id="ls-reset" type="button" style="margin-left:8px">Reset to defaults</button></div>
            </details>`;
        card.querySelectorAll("[data-ls]").forEach((el) => el.addEventListener("change", async () => {
            const [a, b] = el.dataset.ls.split(".");
            const v = el.type === "checkbox" ? el.checked : parseFloat(el.value);
            if (b) cfg.stores[a][b] = el.type === "checkbox" ? v : (isFinite(v) ? v : 0); else cfg[a] = isFinite(v) ? v : 0;
            await save(cfg); render(true);
        }));
        const rs = $("ls-reset"); if (rs) rs.addEventListener("click", async () => { cfg = MPLanded.merge(null); await save(cfg); render(true); });
    }

    window.MPLandedUI = {
        update(r) { rows = r || []; clearTimeout(timer); timer = setTimeout(render, 150); }
    };
})();
