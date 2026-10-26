// Mirror Pool Scout: flip profit maths (pure functions, no DOM).
// Fee model: fee = min(itemPct% x sale, cap) + totalPct% x (sale + shipping charged) + flat per order.
//  - eBay charges its final value fee on item + shipping.
//  - TCGplayer charges commission on the item subtotal (capped per product) and processing on the order total.
// Rates change. The presets are starting points the user can edit; the UI links to the official fee pages.
(function (root) {
    "use strict";

    const PRESETS = {
        ebay:       { label: "eBay (no store)",         itemPct: 0,     totalPct: 13.25, flat: 0.40, cap: 0 },
        ebay_store: { label: "eBay (Basic+ store)",     itemPct: 0,     totalPct: 12.35, flat: 0.40, cap: 0 },
        tcg:        { label: "TCGplayer (standard)",    itemPct: 10.75, totalPct: 2.5,   flat: 0.30, cap: 75 },
        tcg_pro:    { label: "TCGplayer (Pro)",         itemPct: 11.75, totalPct: 2.5,   flat: 0.30, cap: 75 },
        custom:     { label: "Custom",                  itemPct: 0,     totalPct: 0,     flat: 0,    cap: 0 }
    };

    const n = (v) => { const x = parseFloat(v); return isFinite(x) ? x : 0; };

    // i: { buy, buyShip, sell, shipCharged, shipCost, packaging, qty, targetRoi }   fee: { itemPct, totalPct, flat, cap }
    function compute(i, fee) {
        const qty = Math.max(1, Math.round(n(i.qty)) || 1);
        const buy = n(i.buy) * qty, buyShip = n(i.buyShip);
        const sale = n(i.sell) * qty, shipCharged = n(i.shipCharged);
        const shipCost = n(i.shipCost), pack = n(i.packaging);
        const ip = n(fee.itemPct) / 100, tp = n(fee.totalPct) / 100, flat = n(fee.flat), cap = n(fee.cap);

        const itemFee = cap > 0 ? Math.min(ip * sale, cap * qty) : ip * sale;
        const totalFee = tp * (sale + shipCharged);
        const fees = itemFee + totalFee + flat;
        const cost = buy + buyShip;
        const revenue = sale + shipCharged;
        const profit = revenue - fees - shipCost - pack - cost;

        // Break-even sale price per unit (ignores the cap, which only matters on very expensive cards).
        const denom = (1 - ip - tp) * qty;
        const breakeven = denom > 0 ? (cost + shipCost + pack + flat - shipCharged * (1 - tp)) / denom : NaN;

        // Highest price per unit you can pay and still reach the target ROI at this sale price.
        const r = n(i.targetRoi) / 100;
        const netBeforeCost = revenue - fees - shipCost - pack;
        const maxCostTotal = netBeforeCost / (1 + r);
        const maxBuy = (maxCostTotal - buyShip) / qty;

        return {
            qty, cost, revenue, fees, itemFee, totalFee, flat, shipCost, pack, profit,
            roi: cost > 0 ? (profit / cost) * 100 : 0,
            margin: revenue > 0 ? (profit / revenue) * 100 : 0,
            breakeven: isFinite(breakeven) ? breakeven : NaN,
            maxBuy: isFinite(maxBuy) ? maxBuy : NaN
        };
    }

    const api = { PRESETS, compute };
    root.MPFlip = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
