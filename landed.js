// Mirror Pool Scout: landed-cost estimates (pure functions).
// Landed cost = items + shipping + tax, per store. Prices are ESTIMATES: Scryfall gives TCGplayer-based USD and Cardmarket EUR;
// other stores are priced as "% of TCGplayer market" which the user can edit. Shipping rules are editable assumptions.
(function (root) {
    "use strict";
    const DEFAULTS = {
        taxPct: 0, eurUsd: 1.08,
        stores: {
            tcg:   { label: "TCGplayer",       on: true, pricePct: 100, ship: 1.31, freeOver: 5,  perOrder: 4,   src: "usd" },
            ebay:  { label: "eBay",            on: true, pricePct: 100, ship: 0.78, freeOver: 0,  perOrder: 1,   src: "usd" },
            ck:    { label: "Card Kingdom",    on: true, pricePct: 100, ship: 4.99, freeOver: 0,  perOrder: 999, src: "usd" },
            csi:   { label: "CoolStuffInc",    on: true, pricePct: 100, ship: 4.99, freeOver: 0,  perOrder: 999, src: "usd" },
            scg:   { label: "Star City Games", on: true, pricePct: 100, ship: 4.99, freeOver: 0,  perOrder: 999, src: "usd" },
            cm:    { label: "Cardmarket (EUR)", on: false, pricePct: 100, ship: 6.00, freeOver: 0, perOrder: 999, src: "eur" }
        }
    };
    const n = (v, d) => { const x = parseFloat(v); return isFinite(x) ? x : (d || 0); };

    function merge(saved) {
        const out = JSON.parse(JSON.stringify(DEFAULTS));
        if (!saved) return out;
        out.taxPct = n(saved.taxPct, 0); out.eurUsd = n(saved.eurUsd, 1.08) || 1.08;
        Object.keys(out.stores).forEach((k) => { if (saved.stores && saved.stores[k]) Object.assign(out.stores[k], saved.stores[k]); });
        return out;
    }

    // unit price of one card at a store (USD), or 0 if unknown
    function unitPrice(card, s, eurUsd) {
        const base = s.src === "eur" ? (card.eur > 0 ? card.eur * eurUsd : 0) : (card.usd > 0 ? card.usd : 0);
        return base * n(s.pricePct, 100) / 100;
    }

    function shipFor(items, cards, s) {
        if (cards <= 0) return { ship: 0, orders: 0 };
        const orders = Math.ceil(cards / Math.max(1, n(s.perOrder, 1)));
        const each = items / orders;
        const per = n(s.freeOver) > 0 && each >= n(s.freeOver) ? 0 : n(s.ship);
        return { ship: per * orders, orders };
    }

    // cards: [{ name, qty, usd, eur }]
    function compute(cards, cfg) {
        cfg = merge(cfg);
        const need = cards.filter((c) => c.qty > 0);
        const keys = Object.keys(cfg.stores).filter((k) => cfg.stores[k].on);
        const tax = cfg.taxPct / 100;
        const total = need.reduce((a, c) => a + c.qty, 0);
        const rows = keys.map((k) => {
            const s = cfg.stores[k];
            let items = 0, cardsPriced = 0, missing = 0;
            need.forEach((c) => { const u = unitPrice(c, s, cfg.eurUsd); if (u > 0) { items += u * c.qty; cardsPriced += c.qty; } else missing += c.qty; });
            const sh = shipFor(items, cardsPriced, s);
            const t = items * tax;
            return { key: k, label: s.label, items, ship: sh.ship, tax: t, total: items + sh.ship + t, orders: sh.orders, cards: cardsPriced, missing,
                perCard: cardsPriced ? (items + sh.ship + t) / cardsPriced : 0 };
        });
        const complete = rows.filter((r) => r.missing === 0 && r.cards > 0);
        const bestSingle = complete.length ? complete.reduce((a, b) => (b.total < a.total ? b : a)) : null;

        // Best split: try every combination of stores, give each card to the cheapest store in the set, pay shipping once per store used.
        let bestSplit = null;
        const m = keys.length;
        for (let mask = 1; mask < (1 << m); mask++) {
            const set = keys.filter((_, i) => mask & (1 << i));
            const buckets = {}; let ok = true;
            for (const c of need) {
                let best = null, bu = Infinity;
                set.forEach((k) => { const u = unitPrice(c, cfg.stores[k], cfg.eurUsd); if (u > 0 && u < bu) { bu = u; best = k; } });
                if (!best) { ok = false; break; }
                const b = buckets[best] || (buckets[best] = { items: 0, cards: 0 });
                b.items += bu * c.qty; b.cards += c.qty;
            }
            if (!ok) continue;
            let sum = 0; const parts = [];
            Object.keys(buckets).forEach((k) => {
                const b = buckets[k], sh = shipFor(b.items, b.cards, cfg.stores[k]);
                const t = b.items * tax; sum += b.items + sh.ship + t;
                parts.push({ key: k, label: cfg.stores[k].label, cards: b.cards, items: b.items, ship: sh.ship, tax: t, total: b.items + sh.ship + t });
            });
            if (!bestSplit || sum < bestSplit.total - 1e-9) bestSplit = { total: sum, parts };
        }
        return { cfg, rows, bestSingle, bestSplit, totalCards: total };
    }

    const api = { DEFAULTS, merge, compute, unitPrice, shipFor };
    root.MPLanded = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
