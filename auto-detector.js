// --- Mirror Pool Scout: Site-Specific Cross-Platform Intelligence Adapters ---
(() => {
    const host = window.location.hostname;
    const path = window.location.pathname;

    // eBay item listings are handled by content.js Auction Tracker badge
    if (host.includes("ebay.com") && path.includes("/itm/")) return;
    if (document.getElementById("mirrorpool-site-adapter")) return;

    const TIX_RATE = 0.92;

    // 1. Site-Specific Deck & Card Extractors
    function extractGoldfishData() {
        const isDeck = path.includes("/archetype/") || path.includes("/deck/");
        const h1 = document.querySelector("h1.deck-view-title, .card-name-header h1, main h1, h1");
        let title = h1 ? (h1.childNodes[0]?.textContent?.trim() || h1.innerText.split("\n")[0].trim()) : document.title.split("|")[0].trim();
        title = title.replace(/\s*Price$/i, "").trim();

        const bodyText = document.body.innerText;
        const paperMatch = bodyText.match(/Tabletop\s*\$\s*([\d,]+(?:\.\d{2})?)/i);
        const tixMatch = bodyText.match(/MTGO\s*([\d,]+(?:\.\d{2})?)\s*tix/i);
        const paperVal = paperMatch ? parseFloat(paperMatch[1].replace(/,/g, "")) : 0;
        const tixVal = tixMatch ? parseFloat(tixMatch[1].replace(/,/g, "")) : 0;

        const deckMap = new Map();
        let highestCard = { name: "", price: 0 };

        if (isDeck) {
            // Only parse the FIRST visible deck table (#tab-paper or primary table) so quantities aren't doubled by #tab-online
            const primaryTable = document.querySelector("#tab-paper table.deck-view-deck-table, table.deck-view-deck-table") || document;
            primaryTable.querySelectorAll("tr").forEach(tr => {
                if (tr.classList.contains("deck-category-header") || tr.querySelector("th")) return;
                const link = tr.querySelector("a[href*='/price/'], td.deck-col-card a, a.card_id");
                const qtyTd = tr.querySelector("td.deck-col-qty, td:first-child");
                const priceTd = tr.querySelector("td.deck-col-price, td:nth-last-child(2), td:last-child");
                if (link && qtyTd) {
                    const name = link.innerText.trim();
                    const qMatch = qtyTd.innerText.trim().match(/^(\d{1,2})\b/);
                    const pMatch = priceTd ? priceTd.innerText.replace(/,/g, "").match(/\$\s*(\d+(?:\.\d+)?)/) : null;
                    if (name && qMatch) {
                        const qty = parseInt(qMatch[1], 10);
                        const rowPrice = pMatch ? parseFloat(pMatch[1]) : 0;
                        const unitPrice = qty > 0 ? rowPrice / qty : rowPrice;
                        if (unitPrice > highestCard.price) {
                            highestCard = { name, price: unitPrice };
                        }
                        const key = name.toLowerCase();
                        if (deckMap.has(key)) {
                            deckMap.get(key).quantity += qty;
                        } else {
                            deckMap.set(key, { cardName: name, quantity: qty, unitPrice, acquired: 0, basis: 0 });
                        }
                    }
                }
            });
        }

        const anchor = document.querySelector(".deck-view-description, h1.deck-view-title, .card-name-header, main h1, h1");
        return {
            site: "MTGGoldfish",
            isDeck,
            title,
            paperVal,
            tixVal,
            winRate: null,
            highestCard,
            decklist: Array.from(deckMap.values()),
            anchor
        };
    }

    function extractMtgDecksData() {
        const h1 = document.querySelector("h1");
        const title = h1 ? h1.innerText.trim() : document.title.split("|")[0].trim();
        const bodyText = document.body.innerText;
        const wrMatch = bodyText.match(/(\d{2}(?:\.\d)?)\s*%\s*(?:Winrate|Win\s*Rate)/i);
        const winRate = wrMatch ? wrMatch[1] + "%" : null;

        const deckMap = new Map();
        document.querySelectorAll("table tr, .card-item").forEach(row => {
            const qtyEl = row.querySelector(".td-qty, td:first-child, .qty");
            const nameEl = row.querySelector(".td-card a, .card-name, a[href*='/prices/'], a");
            if (qtyEl && nameEl) {
                const qMatch = qtyEl.innerText.trim().match(/^(\d{1,2})\b/);
                const name = nameEl.innerText.trim();
                if (qMatch && name && name.length > 2 && !/^(Lands|Creatures|Spells|Sideboard|Total)/i.test(name)) {
                    const qty = parseInt(qMatch[1], 10);
                    const key = name.toLowerCase();
                    if (!deckMap.has(key)) {
                        deckMap.set(key, { cardName: name, quantity: qty, acquired: 0, basis: 0 });
                    }
                }
            }
        });

        const anchor = document.querySelector("h1, .deck-header");
        return {
            site: "MTGDecks",
            isDeck: deckMap.size >= 3,
            title,
            paperVal: 0,
            tixVal: 0,
            winRate,
            highestCard: { name: "", price: 0 },
            decklist: Array.from(deckMap.values()),
            anchor
        };
    }

    function extractMarketplaceCardData() {
        const h1 = document.querySelector(".product-details__name, h1");
        const rawTitle = h1 ? h1.innerText.trim() : document.title.split("|")[0].trim();
        const cleanTitle = rawTitle.split(/[\(\[#|]/)[0].replace(/\s*-\s*Magic:.*$/i, "").trim();
        const pEl = document.querySelector(".product-details__price, .spotlight__price, .price-box-price");
        const pMatch = pEl ? pEl.innerText.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/) : null;
        const paperVal = pMatch ? parseFloat(pMatch[1]) : 0;
        const anchor = document.querySelector(".product-details__name, h1");

        return {
            site: host.includes("tcgplayer.com") ? "TCGplayer" : "Cardmarket",
            isDeck: false,
            title: cleanTitle,
            paperVal,
            tixVal: 0,
            winRate: null,
            highestCard: { name: cleanTitle, price: paperVal },
            decklist: [],
            anchor
        };
    }

    function buildSiteAdapter() {
        chrome.storage.local.get({ scoutArmed: true, procurementTargets: [], watchlist: [] }, (store) => {
            if (!store.scoutArmed) return;

            let data = null;
            if (host.includes("mtggoldfish.com")) data = extractGoldfishData();
            else if (host.includes("mtgdecks.net") || host.includes("magic.gg") || host.includes("wizards.com")) data = extractMtgDecksData();
            else if (host.includes("tcgplayer.com") || host.includes("cardmarket.com")) data = extractMarketplaceCardData();

            if (!data || (!data.isDeck && !data.title)) return;

            // Cross-reference against user's existing Mirror Pool Inventory & Watchlist!
            const ownedMap = new Map();
            (store.procurementTargets || []).forEach(t => {
                if (t.cardName) ownedMap.set(t.cardName.toLowerCase().trim(), t);
            });

            let alreadyAcquiredCount = 0;
            let ownedSavingsUsd = 0;
            let totalCards = 0;

            if (data.isDeck) {
                data.decklist.forEach(c => {
                    totalCards += c.quantity;
                    const match = ownedMap.get(c.cardName.toLowerCase().trim());
                    if (match && match.acquired > 0) {
                        const used = Math.min(c.quantity, match.acquired);
                        alreadyAcquiredCount += used;
                        ownedSavingsUsd += used * (c.unitPrice || 0);
                    }
                });
            }

            // Update extension toolbar badge count
            chrome.runtime.sendMessage({
                action: "verifyDetectedCandidates",
                deckCandidates: data.decklist,
                titleCandidates: [data.title]
            });

            // Compute What Goldfish/TCGplayer DOESN'T Show: Net Arbitrage Cash-Out Spread & True Cost to Complete
            const mtgoCashOutUsd = data.tixVal * TIX_RATE;
            const netArbSpread = data.paperVal > 0 && data.tixVal > 0 ? (data.paperVal - mtgoCashOutUsd) : 0;
            const netArbPct = data.paperVal > 0 ? (netArbSpread / data.paperVal) * 100 : 0;
            const trueCostToComplete = Math.max(0, data.paperVal - ownedSavingsUsd);

            const sniperCardName = data.highestCard?.name || data.title;
            const ebaySniperUrl = `https://www.ebay.com/sch/i.html?_nkw=MTG+${encodeURIComponent(sniperCardName)}&LH_BIN=1&_sop=15`;

            const container = document.createElement("div");
            container.id = "mirrorpool-site-adapter";
            container.style.cssText = "background:#0b1120; border:1px solid #00ffcc; border-radius:8px; padding:12px 16px; margin:14px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#f8fafc; box-shadow:0 10px 25px rgba(0,0,0,0.65); position:relative; z-index:9999;";

            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #1e293b; padding-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="color:#00ffcc; font-weight:800; font-size:12px; letter-spacing:0.5px;">◈ MIRROR POOL™ SCOUT</span>
                        <span style="background:#1e293b; color:#38bdf8; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">${data.site.toUpperCase()} ADAPTER</span>
                    </div>
                    <span style="font-size:10px; font-weight:700; color:#10b981;">
                        ${data.isDeck ? `✓ ${totalCards} Cards (${data.decklist.length} Unique) Ready` : "✓ Live Cross-Market Comp"}
                    </span>
                </div>

                <!-- Value-Add Intelligence Row (Metrics Host Site Does NOT Compute) -->
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:10px; background:#070d17; padding:10px; border-radius:6px; border:1px solid #1e293b; text-align:left;">
                    <div>
                        <div style="font-size:9px; color:#94a3b8; text-transform:uppercase;">${data.isDeck ? "Your Cost to Complete" : "Scryfall Paper Floor"}</div>
                        <div id="mp-val-1" style="color:#00ffcc; font-size:13px; font-weight:800;">
                            ${data.isDeck
                                ? (trueCostToComplete > 0 ? `$${trueCostToComplete.toFixed(2)} (${alreadyAcquiredCount} Owned)` : "⏳ Calc via Scryfall...")
                                : (data.paperVal > 0 ? `$${data.paperVal.toFixed(2)}` : "⏳ Querying...")}
                        </div>
                    </div>
                    <div>
                        <div style="font-size:9px; color:#94a3b8; text-transform:uppercase;">MTGO Cash-Out ($0.92/TIX)</div>
                        <div id="mp-val-2" style="color:#38bdf8; font-size:13px; font-weight:800;">
                            ${data.tixVal > 0 ? `$${mtgoCashOutUsd.toFixed(2)} (${data.tixVal.toFixed(1)} TIX)` : "⏳ Querying TIX..."}
                        </div>
                    </div>
                    <div>
                        <div style="font-size:9px; color:#94a3b8; text-transform:uppercase;">Net Paper/MTGO Spread</div>
                        <div id="mp-val-3" style="color:${netArbSpread >= 0 ? "#f59e0b" : "#10b981"}; font-size:13px; font-weight:800;">
                            ${data.paperVal > 0 && data.tixVal > 0
                                ? `${netArbSpread >= 0 ? "+" : "-"}$${Math.abs(netArbSpread).toFixed(2)} (${netArbPct.toFixed(0)}%)`
                                : (data.winRate ? `Win Rate: ${data.winRate}` : "⏳ Computing...")}
                        </div>
                    </div>
                    <div>
                        <div style="font-size:9px; color:#94a3b8; text-transform:uppercase;">${data.isDeck ? "Top Chase Target (eBay Sniper)" : "Active Deck Status"}</div>
                        <div id="mp-val-4" style="color:#eab308; font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${data.isDeck ? "⏳ Ranking Chase Cards..." : (ownedMap.has(data.title.toLowerCase()) ? "🎯 In Your Procurement List!" : "Ready to Snipe")}
                        </div>
                    </div>
                </div>

                <!-- Unified Action Bar -->
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button id="mp-act-primary" style="flex:1.2; padding:8px 10px; border-radius:5px; background:#10b981; border:none; color:#030712; font-weight:800; font-size:11px; cursor:pointer;">
                        ${data.isDeck ? `⚡ Import ${data.decklist.length} Cards` : "📥 + Watchlist"}
                    </button>
                    <button id="mp-act-secondary" style="flex:0.9; padding:8px 10px; border-radius:5px; background:#1e293b; border:1px solid #334155; color:#f8fafc; font-weight:700; font-size:11px; cursor:pointer;">
                        ${data.isDeck ? "📋 Copy MTGA" : "🎯 + Buy List"}
                    </button>
                    <a id="mp-snipe-bin" href="${ebaySniperUrl}" target="_blank" style="flex:1.2; padding:8px 10px; border-radius:5px; background:#1e293b; border:1px solid #f59e0b; color:#f59e0b; font-weight:700; font-size:11px; text-decoration:none; text-align:center;">
                        🎯 Snipe <85% Floor BIN ↗
                    </a>
                    <a id="mp-snipe-auc" href="${ebaySniperUrl}" target="_blank" style="flex:1; padding:8px 10px; border-radius:5px; background:#1e293b; border:1px solid #38bdf8; color:#38bdf8; font-weight:700; font-size:11px; text-decoration:none; text-align:center;">
                        ⏱ Ending Auctions ↗
                    </a>
                    <button id="mp-act-dash" style="flex:0.7; padding:8px 10px; border-radius:5px; background:rgba(0,255,204,0.08); border:1px solid #00ffcc; color:#00ffcc; font-weight:700; font-size:11px; cursor:pointer;">
                        ⛶ Dashboard
                    </button>
                </div>
            `;

            // Insert directly after the visible page header (or top of main content so hidden tabs never clip it)
            if (data.anchor && data.anchor.parentElement) {
                data.anchor.parentElement.insertBefore(container, data.anchor.nextSibling);
            } else {
                document.body.prepend(container);
            }

            // If on TCGplayer / MTGDecks where TIX or Paper Floor isn't on page, pull live Scryfall pricing automatically
            if (!data.isDeck && data.title) {
                chrome.runtime.sendMessage({ action: "fetchComps", cardName: data.title, cardTitle: data.title }, (comp) => {
                    if (comp && comp.found) {
                        const scryUsd = parseFloat(comp.usd || 0);
                        const scryTix = parseFloat(comp.tix || 0);
                        const tixUsd = scryTix * TIX_RATE;
                        const delta = (data.paperVal || scryUsd) - tixUsd;
                        const v1 = container.querySelector("#mp-val-1");
                        const v2 = container.querySelector("#mp-val-2");
                        const v3 = container.querySelector("#mp-val-3");
                        if (v1) v1.innerText = `$${scryUsd.toFixed(2)} (Scryfall)`;
                        if (v2) v2.innerText = `$${tixUsd.toFixed(2)} (${scryTix.toFixed(2)} TIX)`;
                        if (v3) v3.innerText = `${delta >= 0 ? "+" : "-"}$${Math.abs(delta).toFixed(2)} Spread`;
                        const maxSnipe = Math.max(0.99, scryUsd * 0.85).toFixed(2);
                        const q = encodeURIComponent(`MTG "${data.title}" -proxy -custom`);
                        const binL = container.querySelector("#mp-snipe-bin");
                        const aucL = container.querySelector("#mp-snipe-auc");
                        if (binL) {
                            binL.href = `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=19107&LH_BIN=1&_sop=15&_udhi=${maxSnipe}`;
                            binL.innerText = `🎯 Snipe <$${maxSnipe} BIN ↗`;
                        }
                        if (aucL) {
                            aucL.href = `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=19107&LH_Auction=1&_sop=1&_udhi=${maxSnipe}`;
                            aucL.innerText = `⏱ Auctions <$${maxSnipe} ↗`;
                        }
                    }
                });
            } else if (data.isDeck && data.decklist.length > 0) {
                // Always query Scryfall for the deck so we get exact Spread + Top 5 Expensive Chase Cards for eBay Sniping!
                const names = data.decklist.map(c => c.cardName);
                chrome.runtime.sendMessage({ action: "fetchCollectionPrices", cardNames: names }, (res) => {
                    const priceMap = (res && res.prices) ? res.prices : {};
                    let sumUsd = 0, sumTix = 0;
                    const pricedCards = [];

                    data.decklist.forEach(c => {
                        const p = priceMap[c.cardName.toLowerCase()] || { usd: 0, tix: 0 };
                        const unitUsd = p.usd || 0;
                        sumUsd += unitUsd * c.quantity;
                        sumTix += (p.tix || 0) * c.quantity;
                        if (unitUsd > 0) {
                            pricedCards.push({ name: c.cardName, usd: unitUsd, tix: p.tix || 0 });
                        }
                    });

                    // Sort descending by Scryfall USD price to find true Top Chase Targets
                    pricedCards.sort((a, b) => b.usd - a.usd);
                    const top5 = pricedCards.slice(0, 5);

                    const cashOut = sumTix * TIX_RATE;
                    const spreadUsd = sumUsd - cashOut;
                    const spreadPct = sumUsd > 0 ? (spreadUsd / sumUsd) * 100 : 0;

                    const v1 = container.querySelector("#mp-val-1");
                    const v2 = container.querySelector("#mp-val-2");
                    const v3 = container.querySelector("#mp-val-3");
                    const v4 = container.querySelector("#mp-val-4");
                    const binLink = container.querySelector("#mp-snipe-bin");
                    const aucLink = container.querySelector("#mp-snipe-auc");

                    if (v1) v1.innerText = `$${Math.max(0, sumUsd - ownedSavingsUsd).toFixed(2)}`;
                    if (v2) v2.innerText = `$${cashOut.toFixed(2)} (${sumTix.toFixed(1)} TIX)`;
                    if (v3) {
                        v3.innerText = `${spreadUsd >= 0 ? "+" : "-"}$${Math.abs(spreadUsd).toFixed(2)} (${spreadPct.toFixed(0)}%)`;
                        v3.style.color = spreadUsd >= 0 ? "#f59e0b" : "#10b981";
                    }

                    function updateSniperLinks(cardObj) {
                        if (!cardObj) return;
                        // Cap eBay search at 85% of Scryfall Floor inside MTG Individual Cards (_sacat=19107)
                        const maxSnipePrice = Math.max(0.99, cardObj.usd * 0.85).toFixed(2);
                        const minBinPrice = cardObj.usd >= 8.0 ? Math.max(2.50, cardObj.usd * 0.40).toFixed(2) : "0.99";
                        const minAucPrice = cardObj.usd >= 15.0 ? Math.max(1.99, cardObj.usd * 0.18).toFixed(2) : "0.99";
                        const exactQuery = encodeURIComponent(`MTG "${cardObj.name}" -proxy -proxies -playtest -fanart -alter -alters -altered -custom -placeholder -token`);
                        const shortName = cardObj.name.split(",")[0];
                        if (binLink) {
                            binLink.href = `https://www.ebay.com/sch/i.html?_nkw=${exactQuery}&_sacat=19107&LH_BIN=1&_sop=15&_udlo=${minBinPrice}&_udhi=${maxSnipePrice}`;
                            binLink.innerText = `🎯 Snipe ${shortName} ($${minBinPrice}–$${maxSnipePrice} BIN) ↗`;
                        }
                        if (aucLink) {
                            aucLink.href = `https://www.ebay.com/sch/i.html?_nkw=${exactQuery}&_sacat=19107&LH_Auction=1&_sop=1&_udlo=${minAucPrice}&_udhi=${maxSnipePrice}`;
                            aucLink.innerText = `⏱ ${shortName} Auctions (<$${maxSnipePrice}) ↗`;
                        }
                    }

                    if (top5.length > 0 && v4) {
                        v4.innerHTML = `<select id="mp-chase-select" style="background:#0b1120; color:#eab308; border:1px solid #334155; border-radius:4px; font-size:11px; font-weight:700; padding:2px 4px; width:100%; cursor:pointer;">` +
                            top5.map((c, i) => `<option value="${i}">${c.name} (Floor: $${c.usd.toFixed(2)})</option>`).join("") +
                            `</select>`;
                        updateSniperLinks(top5[0]);
                        const sel = v4.querySelector("#mp-chase-select");
                        if (sel) {
                            sel.addEventListener("change", () => {
                                updateSniperLinks(top5[parseInt(sel.value, 10)]);
                            });
                        }
                    }
                });
            }

            // Wire Buttons
            const priBtn = container.querySelector("#mp-act-primary");
            const secBtn = container.querySelector("#mp-act-secondary");
            const dashBtn = container.querySelector("#mp-act-dash");

            priBtn.addEventListener("click", () => {
                priBtn.innerText = "⏳ Syncing...";
                chrome.runtime.sendMessage({
                    action: "importDetectedToScout",
                    mode: data.isDeck ? "deck" : "single",
                    decklist: data.decklist,
                    deckName: data.title,
                    cardName: data.title,
                    url: window.location.href
                }, () => {
                    priBtn.innerText = data.isDeck ? `✓ Imported ${data.decklist.length} Cards!` : "✓ In Watchlist!";
                    priBtn.style.background = "#059669";
                    priBtn.style.color = "#fff";
                });
            });

            secBtn.addEventListener("click", () => {
                if (data.isDeck) {
                    const mtga = data.decklist.map(c => `${c.quantity} ${c.cardName}`).join("\n");
                    navigator.clipboard.writeText(mtga).then(() => {
                        secBtn.innerText = "✓ MTGA Copied!";
                        setTimeout(() => { secBtn.innerText = "📋 Copy Clean MTGA List"; }, 2000);
                    });
                } else {
                    chrome.runtime.sendMessage({
                        action: "importDetectedToScout",
                        mode: "procurement_single",
                        cardName: data.title
                    }, () => {
                        secBtn.innerText = "✓ In Buy List!";
                        secBtn.style.borderColor = "#10b981";
                        secBtn.style.color = "#10b981";
                    });
                }
            });

            dashBtn.addEventListener("click", () => {
                chrome.runtime.sendMessage({ action: "openDashboard" });
            });
        });
    }


    // --- Dedicated MTGScavenger.com Live Under-Market Auction Parser ---
    function initMtgScavengerAdapter() {
        chrome.storage.local.get({ scoutArmed: true, procurementTargets: [], watchlist: [] }, (store) => {
            if (!store.scoutArmed) return;

            const chaseSet = new Set(
                (store.procurementTargets || []).map(t => (t.cardName || "").toLowerCase().trim()).filter(Boolean)
            );

            function scanScavengerDOM() {
                const deals = [];
                const seenTitles = new Set();

                // MTGScavenger renders auction cards with Market Price, Current Bid, Title ("Wizards Of The Coast ..."), and "Ends in HH:MM:SS"
                const candidateBlocks = document.querySelectorAll("div, article, li");
                candidateBlocks.forEach(el => {
                    const txt = (el.innerText || "").trim();
                    if (!txt || txt.length > 420 || !txt.includes("Ends in")) return;

                    // Look for two dollar amounts ($Market and$Bid) + "Ends in HH:MM:SS"
                    const prices = txt.match(/\$\d+(?:\.\d{2})?/g);
                    const timeMatch = txt.match(/Ends in\s+(\d{2}:\d{2}:\d{2})/i);
                    if (!prices || prices.length < 2 || !timeMatch) return;

                    const p1 = parseFloat(prices[0].replace("$", ""));
                    const p2 = parseFloat(prices[1].replace("$", ""));
                    const marketFloor = Math.max(p1, p2);
                    const currentBid = Math.min(p1, p2);
                    if (marketFloor <= 0 || currentBid <= 0 || marketFloor === currentBid) return;

                    // Extract listing title line
                    const lines = txt.split("\n").map(l => l.trim()).filter(l => l.length > 6 && !l.startsWith("$") && !l.startsWith("Ends in"));
                    const rawListingTitle = lines[0] || "";
                    if (!rawListingTitle || seenTitles.has(rawListingTitle)) return;
                    seenTitles.add(rawListingTitle);

                    // Clean "Wizards Of The Coast " prefix and trailing set/collector tokens
                    const cleanTitle = rawListingTitle
                        .replace(/^(?:\d+x\s+)?(?:Wizards Of The Coast|Magic:?\s*The\s*Gathering|MTG)\s+/i, "")
                        .split(/\s+(?:\d{1,4}\/\d{1,4}|#\d+|Regular|Foil|Borderless|Showcase|Extended|Mythic|Rare|Uncommon|Revised|Double Masters|Commander|Special Guests|Jumpstart|Ravnica|Modern|Outlaws|Bloomburrow)/i)[0]
                        .trim();

                    if (cleanTitle.length < 3) return;

                    const linkEl = el.querySelector("a[href*='ebay.com'], a[href]");
                    const url = linkEl ? linkEl.href : `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent("MTG " + cleanTitle)}&_sacat=19107&LH_Auction=1&_sop=1`;
                    const spreadUsd = marketFloor - currentBid;
                    const spreadPct = (spreadUsd / marketFloor) * 100;
                    const inChaseList = chaseSet.has(cleanTitle.toLowerCase());

                    // Highlight matching Buy List cards directly on MTGScavenger!
                    if (inChaseList) {
                        el.style.outline = "2px solid #00ffcc";
                        el.style.boxShadow = "0 0 15px rgba(0,255,204,0.35)";
                    }

                    deals.push({
                        title: cleanTitle,
                        cardName: cleanTitle,
                        rawListingTitle,
                        marketFloor: marketFloor.toFixed(2),
                        price: currentBid.toFixed(2),
                        totalCost: currentBid.toFixed(2),
                        spreadUsd,
                        spreadPct,
                        timeLeft: timeMatch[1],
                        activity: `MTGScavenger Deal (-${spreadPct.toFixed(0)}%)`,
                        inChaseList,
                        url,
                        savedAt: Date.now()
                    });
                });

                deals.sort((a, b) => (b.inChaseList - a.inChaseList) || (b.spreadUsd - a.spreadUsd));
                return deals;
            }

            function renderScavengerBanner() {
                const deals = scanScavengerDOM();
                const chaseMatches = deals.filter(d => d.inChaseList);
                const topDeal = deals[0];

                let bar = document.getElementById("mirrorpool-scavenger-bar");
                if (!bar) {
                    bar = document.createElement("div");
                    bar.id = "mirrorpool-scavenger-bar";
                    bar.style.cssText = "position:sticky; top:0; z-index:2147483646; background:#0b1120; border-bottom:2px solid #00ffcc; padding:10px 18px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#f8fafc; box-shadow:0 10px 25px rgba(0,0,0,0.8);";
                    document.body.prepend(bar);
                }

                bar.innerHTML = `
                    <div style="max-width:1280px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="color:#00ffcc; font-weight:800; font-size:13px;">◈ MIRROR POOL™ SCOUT</span>
                            <span style="background:#1e293b; color:#f59e0b; font-size:10px; font-weight:800; padding:3px 7px; border-radius:4px;">MTGSCAVENGER LIVE ARBITRAGE HARVESTER</span>
                            <span style="font-size:12px; color:#cbd5e1;">
                                Scanned <strong>${deals.length}</strong> Under-Market Auctions |
                                <strong style="color:#00ffcc;">${chaseMatches.length}</strong> Match Your Buy List
                                ${topDeal ? ` | Top Spread: <strong style="color:#10b981;">${topDeal.cardName} ($${topDeal.price} vs $${topDeal.marketFloor} Floor / +$${topDeal.spreadUsd.toFixed(2)})</strong>` : ""}
                            </span>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button id="mp-scav-rescan" style="background:#1e293b; color:#38bdf8; border:1px solid #334155; padding:6px 10px; border-radius:5px; font-size:11px; font-weight:700; cursor:pointer;">🔄 Re-Scan Page</button>
                            <button id="mp-scav-import-top" style="background:#10b981; color:#030712; border:none; padding:6px 12px; border-radius:5px; font-size:11px; font-weight:800; cursor:pointer;">
                                ⚡ Push Top ${Math.min(15, deals.length)} Arbitrage Deals to Scout
                            </button>
                            <button id="mp-scav-dash" style="background:rgba(0,255,204,0.1); color:#00ffcc; border:1px solid #00ffcc; padding:6px 10px; border-radius:5px; font-size:11px; font-weight:700; cursor:pointer;">⛶ Dashboard</button>
                        </div>
                    </div>
                `;

                bar.querySelector("#mp-scav-rescan").addEventListener("click", renderScavengerBanner);
                bar.querySelector("#mp-scav-dash").addEventListener("click", () => {
                    chrome.runtime.sendMessage({ action: "openDashboard" });
                });
                const impBtn = bar.querySelector("#mp-scav-import-top");
                impBtn.addEventListener("click", () => {
                    const batch = deals.slice(0, 15);
                    if (batch.length === 0) return;
                    impBtn.innerText = "⏳ Syncing Deals...";
                    chrome.runtime.sendMessage({
                        action: "importDetectedToScout",
                        mode: "scavenger_batch",
                        deals: batch
                    }, () => {
                        impBtn.innerText = `✓ Pushed ${batch.length} Deals to Watchlist & Arbitrage (Paper vs TIX)!`;
                        impBtn.style.background = "#059669";
                        impBtn.style.color = "#fff";
                    });
                });
            }

            setTimeout(renderScavengerBanner, 1800);
        });
    }

    if (host.includes("mtgscavenger.com")) {
        initMtgScavengerAdapter();
        return;
    }

    setTimeout(buildSiteAdapter, 900);
})();
