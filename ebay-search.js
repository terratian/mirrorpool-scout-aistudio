// Mirror Pool Scout: eBay search-results overlay.
// Only runs on searches opened from Scout (they carry mpmax / mpmkt in the URL). eBay's own price filter
// ignores shipping, so a "$1.35" listing with "+$0.78 delivery" really costs $2.13. This grades every listing
// by price + shipping against the delivered target (default 85% of market) and says so on the card.
(function () {
    "use strict";
    let params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }
    const target = parseFloat(params.get("mpmax"));
    const market = parseFloat(params.get("mpmkt"));
    if (!(target > 0)) return; // a normal eBay search: leave the page alone

    const money = (n) => "$" + n.toFixed(2);
    const toNum = (s) => parseFloat(String(s).replace(/,/g, ""));
    let hideNonDeals = false;

    function parseListing(text) {
        const t = String(text || "").replace(/ /g, " ");
        const priceM = /\$\s?([\d,]+(?:\.\d{1,2})?)/.exec(t);
        if (!priceM) return null;
        const price = toNum(priceM[1]);
        const range = /\$\s?[\d,.]+\s+to\s+\$/i.test(t); // variation listing: the first price is only the low end
        let ship = null, shipKnown = false;
        const sm = /\+\s*\$\s?([\d,]+(?:\.\d{1,2})?)\s*(?:delivery|shipping|postage)/i.exec(t);
        if (sm) { ship = toNum(sm[1]); shipKnown = true; }
        else if (/free\s+(?:international\s+)?(?:delivery|shipping|postage)/i.test(t)) { ship = 0; shipKnown = true; }
        const pickup = /(?:local\s+)?pick-?up\s+only/i.test(t);
        const auction = /\b\d+\s+bids?\b|\bbid\b/i.test(t) && !/buy it now/i.test(t);
        return { price, ship, shipKnown, range, pickup, auction };
    }

    function grade(l) {
        if (l.pickup) return { cls: "na", text: "Local pickup only" };
        const total = l.price + (l.ship || 0);
        const vs = market > 0 ? (total - market) / market : 0;
        const pct = market > 0 ? `${vs >= 0 ? "+" : ""}${Math.round(vs * 100)}% vs market` : "";
        const prefix = l.auction ? "Bid now " : "";
        const shipTxt = l.shipKnown ? (l.ship === 0 ? "free shipping" : `+${money(l.ship)} shipping`) : "shipping not shown";
        const base = `${prefix}${money(l.price)} ${shipTxt} = ${money(total)} delivered`;
        if (l.range) return { cls: "na", text: `Multiple options. Lowest ${base}` };
        if (total <= target) return { cls: "deal", text: `✅ DEAL: ${base} (${pct})`, deal: true };
        if (market > 0 && total <= market) return { cls: "ok", text: `${base} (${pct}), not under your ${money(target)} target`, ok: true };
        return { cls: "bad", text: `${base} (${pct}), over market` };
    }

    const COLORS = {
        deal: ["#052e16", "#4ade80", "#16a34a"], ok: ["#422006", "#fbbf24", "#d97706"],
        bad: ["#450a0a", "#fca5a5", "#dc2626"], na: ["#1e293b", "#cbd5e1", "#475569"]
    };

    function badgeFor(g) {
        const b = document.createElement("div");
        b.className = "mp-deal-badge";
        const c = COLORS[g.cls];
        b.style.cssText = `display:block;margin:6px 0 0;padding:5px 8px;border-radius:6px;font:700 12px/1.3 system-ui,sans-serif;background:${c[0]};color:${c[1]};border:1px solid ${c[2]};`;
        b.textContent = g.text;
        return b;
    }

    function items() {
        const sel = 'li.s-item, li.s-card, li[class*="s-item"], li[class*="s-card"], ul.srp-results > li[data-viewport], li[data-listingid]';
        return Array.from(document.querySelectorAll(sel)).filter((li, i, arr) => !arr.some((o) => o !== li && o.contains(li)));
    }

    const mpname = (params.get("mpname") || "").trim();
    let lastReported = "";
    // Tell the dashboard which card has a real delivered deal on this page, so its Buy List row can light up.
    function reportDeal(best) {
        if (!mpname || !(window.chrome && chrome.storage && chrome.storage.local)) return;
        const sig = best ? [best.total, best.url].join("|") : "none:" + (stats.seen >= 3 ? "seen" : "few");
        if (sig === lastReported) return;
        lastReported = sig;
        const key = mpname.toLowerCase();
        chrome.storage.local.get({ mpDeals: {} }, (r) => {
            const d = Object.assign({}, r.mpDeals || {});
            if (best) d[key] = { total: best.total, price: best.price, ship: best.ship, url: best.url, title: best.title, target: target, at: Date.now() };
            else if (stats.seen >= 3) delete d[key];
            chrome.storage.local.set({ mpDeals: d });
        });
    }

    let stats = { deals: 0, seen: 0 };
    function scan() {
        stats = { deals: 0, seen: 0 };
        let best = null;
        items().forEach((li) => {
            const clone = li.cloneNode(true);
            clone.querySelectorAll(".mp-deal-badge").forEach((n) => n.remove());
            const l = parseListing(clone.innerText || clone.textContent);
            if (!l) return;
            stats.seen++;
            const g = grade(l);
            if (g.deal) {
                stats.deals++;
                const total = l.price + (l.ship || 0);
                if (!best || total < best.total) {
                    const a = li.querySelector('a[href*="/itm/"]');
                    let url = "";
                    try { if (a) { const u = new URL(a.href); url = u.origin + u.pathname; } } catch (e) { /* no link */ }
                    const ttl = (li.querySelector('.s-item__title, [class*="title"], img[alt]') || {});
                    best = { total, price: l.price, ship: l.ship || 0, url, title: String(ttl.innerText || ttl.alt || "").trim().slice(0, 100) };
                }
            }
            const sig = [l.price, l.ship, l.shipKnown, l.auction, l.pickup, l.range].join("|");
            if (li.dataset.mpSig !== sig || !li.querySelector(".mp-deal-badge")) {
                li.querySelectorAll(".mp-deal-badge").forEach((n) => n.remove());
                const info = li.querySelector(".s-item__info, .s-card__content, .su-card-container__content") || li;
                info.appendChild(badgeFor(g));
                li.dataset.mpSig = sig;
            }
            li.dataset.mpGrade = g.cls;
            li.classList.toggle("mp-foil-deal", !!g.deal);
            const bd = li.querySelector(".mp-deal-badge"); if (bd) bd.classList.toggle("mp-foil-badge", !!g.deal);
            li.style.opacity = hideNonDeals && !g.deal ? "0.28" : "";
        });
        renderBar();
        reportDeal(best);
    }

    function renderBar() {
        let bar = document.getElementById("mirrorpool-search-bar");
        if (!bar) {
            bar = document.createElement("div");
            bar.id = "mirrorpool-search-bar";
            bar.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483000;max-width:340px;background:#0b1120;color:#e2e8f0;border:1px solid #10b981;border-radius:10px;padding:10px 12px;font:600 12px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)";
            document.body.appendChild(bar);
        }
        const sig = [stats.deals, stats.seen, hideNonDeals].join("|");
        if (bar.dataset.sig === sig) return;
        bar.dataset.sig = sig;
        bar.innerHTML = "";
        const h = document.createElement("div");
        h.style.cssText = "color:#00ffcc;font-weight:800;margin-bottom:4px";
        h.textContent = "◈ Mirror Pool Scout";
        const p = document.createElement("div");
        p.textContent = `Grading listings by price + shipping. Target: ${money(target)} delivered` + (market > 0 ? ` (market ${money(market)}).` : ".");
        const r = document.createElement("div");
        r.style.cssText = "margin-top:4px;color:" + (stats.deals ? "#4ade80" : "#fbbf24");
        r.textContent = stats.seen ? `${stats.deals} deal${stats.deals === 1 ? "" : "s"} among ${stats.seen} listings on this page.` : "Waiting for listings…";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.cssText = "margin-top:6px;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:4px 8px;font:700 11px system-ui,sans-serif;cursor:pointer";
        btn.textContent = hideNonDeals ? "Show all listings" : "Dim non-deals";
        btn.addEventListener("click", () => { hideNonDeals = !hideNonDeals; scan(); });
        bar.append(h, p, r, btn);
    }

    // eBay loads results lazily; re-scan quietly (debounced) when the list changes. The scan only touches
    // our own badge nodes, and skips work when nothing changed, so it cannot loop.
    let timer = null;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(scan, 450); };
    new MutationObserver((muts) => {
        if (muts.every((m) => Array.from(m.addedNodes).concat(Array.from(m.removedNodes)).every((n) => n.nodeType === 1 && (n.classList.contains("mp-deal-badge") || n.id === "mirrorpool-search-bar")))) return;
        schedule();
    }).observe(document.body, { childList: true, subtree: true });
    scan();
    setTimeout(scan, 1500);
})();
