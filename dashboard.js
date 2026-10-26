// --- Mirror Pool Scout: Full 5-Tab Controller (Buy List, Saved Lists, Price Sorting & Synergy Trend Radar) ---

const TIX_TO_USD = 0.92;
let currentSortMode = "price-desc"; // Default sort: Highest price chase targets at the top!

// Curated High-Velocity Metagame & Cross-Archetype Breakout Database (Synced with Live Scryfall Prices)
const META_TREND_RADAR_DB = [
    {
        cardName: "Astral Dragon",
        trendDir: "up",
        trendDeltaPct: "+30.0%",
        baselineUsd: 18.58,
        synergyTags: ["#NoncreatureCopy", "#TokenMultiplier", "#PlaneswalkerSynergy", "#ETBAbuse"],
        triggersOn: ["doubling season", "extravagant replication", "oath of teferi", "rhystic study", "mana reflection", "shadow of the second sun", "sphere of safety", "psychic corrosion", "parallel lives", "anointed procession", "cursed mirror", "panharmonicon"],
        archetypes: ["Commander Superfriends / Mill", "Blue-Based Token Copy", "Duel Commander Control", "Izzet Artifact Combo"],
        whyTrending: "Project Image creates two 3/3 flying Dragon copies of ANY noncreature permanent (Enchantments, Planeswalkers, Artifacts). Explodes with Doubling Season, Extravagant Replication, Rhystic Study, and Oath of Teferi."
    },
    {
        cardName: "Teferi's Protection",
        trendDir: "up",
        trendDeltaPct: "+14.2%",
        baselineUsd: 32.00,
        synergyTags: ["#BoardProtection", "#Superfriends", "#ControlLock"],
        triggersOn: ["oath of teferi", "sphere of safety", "smothering tithe", "rhystic study", "farewell"],
        archetypes: ["Azorius /Esper Control", "Superfriends Planeswalkers", "High-Power Commander"],
        whyTrending: "Phases out all your permanents (protecting high-loyalty Planeswalkers and Enchantment engines) while your life total cannot change."
    },
    {
        cardName: "The One Ring",
        trendDir: "up",
        trendDeltaPct: "+18.5%",
        baselineUsd: 58.00,
        synergyTags: ["#CardDrawEngine", "#Protection", "#UntapAbuse"],
        triggersOn: ["manifold key", "voltaic key", "sheoldred, the apocalypse", "orcish bowmasters", "teferi, time raveler"],
        archetypes: ["Modern Ring Control", "Dimir / Esper Midrange", "cEDH / Commander Staples"],
        whyTrending: "Universal colorless draw engine across Modern and Commander; massive lifegain synergy with Sheoldred, the Apocalypse."
    },
    {
        cardName: "Orcish Bowmasters",
        trendDir: "down",
        trendDeltaPct: "-8.4%",
        baselineUsd: 48.00,
        synergyTags: ["#DrawPunisher", "#WheelSynergy", "#FlashThreat"],
        triggersOn: ["thoughtseize", "sheoldred, the apocalypse", "rhystic study", "peer into the abyss", "windfall"],
        archetypes: ["Dimir Midrange", "Legacy / Timeless Tempo", "Black Control"],
        whyTrending: "Slight cooldown in paper floor creating an under-market buy window; pairs directly with Thoughtseize and punishes Rhystic Study."
    },
    {
        cardName: "Roaming Throne",
        trendDir: "up",
        trendDeltaPct: "+21.6%",
        baselineUsd: 21.50,
        synergyTags: ["#TriggeredAbilityDoubler", "#TribalEngine", "#DragonWizardCleric"],
        triggersOn: ["astral dragon", "starscape cleric", "hinterland sanctifier", "voice of victory", "azusa, lost but seeking"],
        archetypes: ["Cleric / Lifegain Tribal", "Dragon ETB Combo", "Commander Value Shells"],
        whyTrending: "Doubles all triggered abilities of your chosen creature type (including Astral Dragon's Project Image ETB or Cleric lifegain triggers)."
    },
    {
        cardName: "Professor Onyx",
        trendDir: "up",
        trendDeltaPct: "+16.8%",
        baselineUsd: 4.80,
        synergyTags: ["#MagecraftDrain", "#GraveyardTutor", "#LilianaBrawl"],
        triggersOn: ["thoughtseize", "chain of smog", "liliana", "go for the throat", "dark ritual"],
        archetypes: ["Liliana Historic Brawl", "Mono-Black Burn / Discard", "Magecraft Storm"],
        whyTrending: "Rising demand in Brawl and Commander Superfriends; instant-win combo with Chain of Smog and elite top-deck selection."
    }
];

function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Only http(s) URLs may reach an href; anything else (javascript:, data:) falls back to the caller's default.
function safeHttpUrl(u) {
    try {
        const x = new URL(String(u || ""));
        return (x.protocol === "http:" || x.protocol === "https:") ? x.href : "";
    } catch (e) { return ""; }
}

const GUMROAD_URL = "https://mrjoshua.gumroad.com/l/mirrorpoolscout";
const GUMROAD_PERMALINK = "mirrorpoolscout";
// Gumroad requires the product id (not the permalink) for products created after Jan 2023.
// Gumroad > Product > Content > License key section shows it. Paste it here if verification says it is required.
const GUMROAD_PRODUCT_ID = "qiBDJZkdUdSY9QBLV_Ya2g==";

function parsePrice(val) {
    if (typeof val === "number") return isFinite(val) ? val : 0;
    const m = String(val || "").match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
}

document.addEventListener("DOMContentLoaded", () => {
    initTabNavigation();
    initArmedToggle();
    initChaseHuntControls();
    initMetaTracker();
    initSettingsPanel();
    syncAllPanels();
});

// 1. Sidebar Tab Switching
function initTabNavigation() {
    const panels = ["tab-watchlist", "tab-procurement", "tab-arbitrage", "tab-meta", "tab-mydecks", "tab-collection", "tab-bookmarks", "tab-settings"];
    const navItems = document.querySelectorAll(".sidebar .nav-item, .nav-item, [data-tab], [data-target]");

    navItems.forEach((item) => {
        if (item.innerText.includes("Procurement")) {
            item.innerHTML = item.innerHTML.replace(/Procurement Hunter/g, "Buy List");
        }
        item.addEventListener("click", (e) => {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove("active"));
            item.classList.add("active");

            const explicitTarget = item.getAttribute("data-tab") || item.getAttribute("data-target") || item.getAttribute("href")?.replace("#", "");
            const text = item.innerText.toLowerCase();

            let targetId = explicitTarget;
            if (!targetId || !document.getElementById(targetId)) {
                if (text.includes("watch")) targetId = "tab-watchlist";
                else if (text.includes("buy list") || text.includes("chase") || text.includes("procure") || text.includes("hunt")) targetId = "tab-procurement";
                else if (text.includes("arbitrage")) targetId = "tab-arbitrage";
                else if (text.includes("meta") || text.includes("insight")) targetId = "tab-meta";
                else if (text.includes("setting") || text.includes("pref")) targetId = "tab-settings";
            }

            if (targetId && document.getElementById(targetId)) {
                panels.forEach(pid => {
                    const el = document.getElementById(pid);
                    if (el) el.classList.toggle("active", pid === targetId);
                });
            }
        });
    });
}

// 2. Sync & Render All Storage Buckets
// How many copies of a card the user already owns (from the imported collection), 0 when the toggle is off.
function ownedQty(name) {
    if (!window.mpUseCollection || !window.mpCollectionCards) return 0;
    const key = String(name || "").toLowerCase().trim();
    const c = window.mpCollectionCards;
    const hit = c[key] || c[key.split(" // ")[0]];
    return hit ? (hit.q || 0) : 0;
}

function syncAllPanels() {
    chrome.storage.local.get(
        ["watchlist", "watchlist_cards", "card_chase", "procurementTargets", "currentDecklist", "deckMeta", "savedChaseLists", "priceBaselineMap", "mpCollection", "useCollection", "hideOwned", "mpShipSettings"],
        (res) => {
            const sh = res.mpShipSettings || {};
            window.mpShip = { ship: isFinite(parseFloat(sh.ship)) ? parseFloat(sh.ship) : 0.78, perOrder: Math.max(1, parseInt(sh.perOrder, 10) || 1) };
            window.mpCollectionCards = (res.mpCollection && res.mpCollection.cards) || {};
            window.mpUseCollection = res.useCollection === true;
            window.mpHideOwned = res.hideOwned === true;
            const combinedWatchlist = [
                ...(Array.isArray(res.watchlist) ? res.watchlist : []),
                ...(Array.isArray(res.watchlist_cards) ? res.watchlist_cards : []),
                ...(Array.isArray(res.card_chase) ? res.card_chase : [])
            ];

            if (res.deckMeta) {
                const nameInput = document.getElementById("deck-name-input");
                const printSelect = document.getElementById("printing-target-select");
                const condSelect = document.getElementById("condition-floor-select");
                if (nameInput && res.deckMeta.deckName) nameInput.value = res.deckMeta.deckName;
                if (printSelect && res.deckMeta.printingTarget) printSelect.value = res.deckMeta.printingTarget;
                if (condSelect && res.deckMeta.conditionFloor) condSelect.value = res.deckMeta.conditionFloor;
            }

            const targets = Array.isArray(res.procurementTargets) && res.procurementTargets.length > 0
                ? res.procurementTargets
                : (Array.isArray(res.currentDecklist) ? res.currentDecklist : []);

            renderSavedListsToolbar(res.savedChaseLists || {}, res.deckMeta?.deckName || "");
            renderWatchlistPanel(combinedWatchlist);
            renderChaseHuntAndArbitrage(targets, combinedWatchlist, res.deckMeta || {}, res.priceBaselineMap || {});
        }
    );
}

// 3. Inject Saved Chase Lists Manager & Sort Control Bar in #tab-procurement (Buy List)
function renderSavedListsToolbar(savedLists, activeDeckName) {
    const procTab = document.getElementById("tab-procurement");
    if (!procTab) return;

    // Rename heading inside #tab-procurement to Buy List
    procTab.querySelectorAll("h1, h2, h3").forEach(h => {
        if (h.innerText.includes("Procurement")) {
            h.innerText = h.innerText.replace(/Procurement Hunter/g, "Buy List").replace(/Procurement/g, "Buy List");
        }
    });

    let toolbar = document.getElementById("chase-hunt-saved-toolbar");
    if (!toolbar) {
        toolbar = document.createElement("div");
        toolbar.id = "chase-hunt-saved-toolbar";
        toolbar.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:10px; background:#0b1120; border:1px solid #1e293b; border-radius:8px; padding:10px 14px; margin-bottom:12px; flex-wrap:wrap;";
        const procContainer = document.getElementById("procurement-container") || procTab.firstElementChild;
        if (procContainer && procContainer.parentNode === procTab) {
            procTab.insertBefore(toolbar, procContainer);
        } else {
            procTab.appendChild(toolbar);
        }
    }

    const listNames = Object.keys(savedLists);
    const optionsHtml = `<option value="">📂 Saved Lists (${listNames.length})...</option>` +
        listNames.map(name => `<option value="${escapeHtml(name)}" ${name === activeDeckName ? "selected" : ""}>${escapeHtml(name)} (${savedLists[name].cards?.length || 0} unique)</option>`).join("");

    toolbar.innerHTML = `
        <div style="display:flex; gap:8px; align-items:center; flex:1; min-width:260px;">
            <select id="saved-chase-list-select" style="flex:1; background:#070d17; color:#f8fafc; border:1px solid #334155; border-radius:6px; padding:7px 10px; font-size:12px; font-weight:600; cursor:pointer;">
                ${optionsHtml}
            </select>
            <button id="btn-new-chase-list" style="background:#1e293b; color:#38bdf8; border:1px solid #334155; border-radius:6px; padding:7px 10px; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap;">+ New List</button>
            <button id="btn-delete-chase-list" style="background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid #ef4444; border-radius:6px; padding:7px 10px; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap;">🗑 Delete</button>
            <a href="https://mtgscavenger.com/" target="_blank" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid #f59e0b; border-radius:6px; padding:7px 10px; font-size:11px; font-weight:800; text-decoration:none; white-space:nowrap;" title="Open MTGScavenger with Mirror Pool Scout Adapter">🦴 Open MTGScavenger ↗</a>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
            <span style="font-size:11px; color:#94a3b8; font-weight:600;">Sort:</span>
            <select id="chase-sort-select" style="background:#070d17; color:#10b981; border:1px solid #10b981; border-radius:6px; padding:7px 10px; font-size:12px; font-weight:700; cursor:pointer;">
                <option value="price-desc" ${currentSortMode === "price-desc" ? "selected" : ""}>💰 Paper Price: High ➔ Low</option>
                <option value="price-asc" ${currentSortMode === "price-asc" ? "selected" : ""}>💵 Paper Price: Low ➔ High</option>
                <option value="tix-desc" ${currentSortMode === "tix-desc" ? "selected" : ""}>💻 MTGO TIX: High ➔ Low</option>
                <option value="trend-desc" ${currentSortMode === "trend-desc" ? "selected" : ""}>📈 Meta Trend / Spiking First</option>
                <option value="name-asc" ${currentSortMode === "name-asc" ? "selected" : ""}>🔤 Card Name: A ➔ Z</option>
            </select>
        </div>
    `;

    const sel = document.getElementById("saved-chase-list-select");
    const newBtn = document.getElementById("btn-new-chase-list");
    const delBtn = document.getElementById("btn-delete-chase-list");
    const sortSel = document.getElementById("chase-sort-select");

    if (sel) {
        sel.addEventListener("change", () => {
            const chosen = sel.value;
            if (!chosen || !savedLists[chosen]) return;
            const entry = savedLists[chosen];
            const decklistInput = document.getElementById("decklist-input");
            const deckNameInput = document.getElementById("deck-name-input");
            if (deckNameInput) deckNameInput.value = chosen;
            if (decklistInput) {
                decklistInput.value = (entry.cards || []).map(c => `${c.quantity || 1} ${c.cardName}`).join("\n");
            }
            chrome.storage.local.set({
                procurementTargets: entry.cards || [],
                currentDecklist: entry.cards || [],
                deckMeta: entry.meta || { deckName: chosen, printingTarget: "normal", conditionFloor: "any" }
            }, syncAllPanels);
        });
    }

    if (newBtn) {
        newBtn.addEventListener("click", () => {
            const decklistInput = document.getElementById("decklist-input");
            const deckNameInput = document.getElementById("deck-name-input");
            if (deckNameInput) {
                deckNameInput.value = "";
                deckNameInput.focus();
            }
            if (decklistInput) decklistInput.value = "";
        });
    }

    if (delBtn) {
        delBtn.addEventListener("click", () => {
            const chosen = sel?.value || activeDeckName;
            if (!chosen || !savedLists[chosen]) return;
            delete savedLists[chosen];
            chrome.storage.local.set({ savedChaseLists: savedLists }, syncAllPanels);
        });
    }

    if (sortSel) {
        sortSel.addEventListener("change", () => {
            currentSortMode = sortSel.value;
            syncAllPanels();
        });
    }
}

// 4. Render #tab-watchlist
function renderWatchlistPanel(items) {
    const grid = document.getElementById("watchlist-grid");
    const mktEl = document.getElementById("wl-market-total");
    const spentEl = document.getElementById("wl-total-spent");
    const varEl = document.getElementById("wl-net-variance");

    if (!grid) return;

    if (!items || items.length === 0) {
        grid.innerHTML = `<div style="color:#94a3b8; font-size:12px; padding:16px; border:1px dashed #1e293b; border-radius:6px;">No active targets in Watchlist yet. Bookmark cards from eBay, MTGGoldfish, or TCGplayer to track live deals and trigger Synergy Radar alerts.</div>`;
        if (mktEl) mktEl.innerText = "$0.00";
        if (spentEl) spentEl.innerText = "$0.00";
        if (varEl) varEl.innerText = "$0.00";
        return;
    }

    let marketTotal = 0;
    let spentTotal = 0;

    grid.innerHTML = items.map((item, idx) => {
        const title = item.cardName || item.title || "Tracked Listing";
        const marketFloor = parsePrice(item.marketFloor || item.paperPrice || item.usd || item.valueA);
        const currentCost = parsePrice(item.totalCost || item.currentPrice || item.price || item.valueA);
        const timeText = item.timeLeft || item.metricB || "Active";
        const activityText = item.activity || (item.valueB ? `${item.metricB || "Info"}: ${item.valueB}` : `${item.bidders || 0} Bidders / ${item.watchers || 0} Watchers`);

        marketTotal += marketFloor;
        spentTotal += currentCost;

        const maxSnipe = Math.max(0.99, (marketFloor || currentCost || 5) * 0.85).toFixed(2);
        const encoded = encodeURIComponent(`MTG "${title}" -proxy -custom`);
        const ebayBinUrl = `https://www.ebay.com/sch/i.html?_nkw=${encoded}&_sacat=19107&LH_BIN=1&_sop=15&_udhi=${maxSnipe}`;

        return `
            <div class="watchlist-card" style="background:#0b1120; border:1px solid #1e293b; border-radius:8px; padding:14px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <a href="${escapeHtml(safeHttpUrl(item.url) || ebayBinUrl)}" target="_blank" style="color:#10b981; font-weight:700; font-size:14px; text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(title)}">${escapeHtml(title)}</a>
                    <span style="font-size:11px; color:#f59e0b; background:#1e293b; padding:2px 6px; border-radius:4px; white-space:nowrap;">⏱ ${escapeHtml(timeText)}</span>
                </div>
                <div style="background:#070d17; border:1px solid #1e293b; border-radius:6px; padding:10px; font-size:12px; display:flex; flex-direction:column; gap:4px;">
                    <div style="display:flex; justify-content:space-between;"><span style="color:#94a3b8;">Market Price:</span><strong style="color:#f59e0b;">${marketFloor > 0 ? "$" + marketFloor.toFixed(2) : "$--"}</strong></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#94a3b8;">Listing Price:</span><strong style="color:#00ffcc;">$${currentCost.toFixed(2)}</strong></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#94a3b8;">Activity:</span><span style="color:#10b981;">${escapeHtml(activityText)}</span></div>
                </div>
                <div style="display:flex; gap:6px;">
                    <a href="${escapeHtml(safeHttpUrl(item.url) || ebayBinUrl)}" target="_blank" style="flex:1; text-align:center; background:#10b981; color:#030712; text-decoration:none; padding:6px; border-radius:4px; font-size:11px; font-weight:800;">🎯 Listing ($${currentCost.toFixed(2)}) ↗</a>
                    <button class="btn drop-wl-btn" data-index="${idx}" style="background:transparent; border:1px solid #ef4444; color:#ef4444; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:600;">✖ Drop</button>
                </div>
            </div>
        `;
    }).join("");

    const netVariance = marketTotal - spentTotal;
    if (mktEl) mktEl.innerText = "$" + marketTotal.toFixed(2);
    if (spentEl) spentEl.innerText = "$" + spentTotal.toFixed(2);
    if (varEl) {
        varEl.innerText = (netVariance >= 0 ? "+$" : "-$") + Math.abs(netVariance).toFixed(2);
        varEl.style.color = netVariance >= 0 ? "#10b981" : "#ef4444";
    }

    grid.querySelectorAll(".drop-wl-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = parseInt(btn.getAttribute("data-index"), 10);
            const updated = items.filter((_, i) => i !== idx);
            chrome.storage.local.set({ watchlist: updated, watchlist_cards: [], card_chase: [] }, syncAllPanels);
        });
    });
}

// 5. Wire Buy List Controls (Save to Named Lists + Scrape + Clean Export)
function initChaseHuntControls() {
    const saveDeckBtn = document.getElementById("save-deck-btn");
    const scrapeDeckBtn = document.getElementById("scrape-deck-btn");
    const exportManifestBtn = document.getElementById("export-manifest-btn");
    const decklistInput = document.getElementById("decklist-input");
    const deckNameInput = document.getElementById("deck-name-input");
    const printingSelect = document.getElementById("printing-target-select");
    const conditionSelect = document.getElementById("condition-floor-select");

    if (saveDeckBtn) saveDeckBtn.innerText = "⚡ Save List & Get Prices";

    if (saveDeckBtn && decklistInput) {
        saveDeckBtn.addEventListener("click", () => {
            const raw = decklistInput.value.trim();
            if (!raw) {
                alert("Paste a decklist or card list into the box first (e.g. 4 Thoughtseize).");
                return;
            }
            const parsed = MPLists.parse(raw);
            const list = parsed.cards;
            if (list.length === 0) {
                alert("Could not read any cards. Paste a list like '4 Lightning Bolt', or import a CSV/.txt/.dek file from MTGGoldfish, ManaBox, TCGplayer, Moxfield, Arena or MTGO.");
                return;
            }
            if (parsed.deckName && deckNameInput && !deckNameInput.value.trim()) deckNameInput.value = parsed.deckName;

            const deckName = (deckNameInput && deckNameInput.value.trim())
                ? deckNameInput.value.trim()
                : `My List (${list.length} cards)`;
            if (deckNameInput) deckNameInput.value = deckName;

            const deckMeta = {
                deckName,
                printingTarget: printingSelect ? printingSelect.value : "normal",
                conditionFloor: conditionSelect ? conditionSelect.value : "any"
            };

            saveDeckBtn.innerText = "⏳ Saving & Querying Scryfall...";
            chrome.storage.local.get({ savedChaseLists: {} }, (res) => {
                const savedLists = res.savedChaseLists || {};
                savedLists[deckName] = { cards: list, meta: deckMeta, updatedAt: Date.now() };
                chrome.storage.local.set({
                    procurementTargets: list,
                    currentDecklist: list,
                    deckMeta,
                    savedChaseLists: savedLists
                }, () => {
                    syncAllPanels();
                    setTimeout(() => { saveDeckBtn.innerText = "✅ Saved to My Decks!"; }, 400);
                    setTimeout(() => { saveDeckBtn.innerText = "⚡ Save List & Get Prices"; }, 2200);
                });
            });
        });
    }

    if (scrapeDeckBtn) {
        const DECK_URLS = ["*://*.mtggoldfish.com/*", "*://*.mtgdecks.net/*", "*://*.moxfield.com/*", "*://*.archidekt.com/*", "*://*.tappedout.net/*",
            "*://*.deckstats.net/*", "*://scryfall.com/*", "*://*.mtgtop8.com/*", "*://*.edhrec.com/*", "*://*.aetherhub.com/*", "*://*.magic.gg/*", "*://*.wizards.com/*"];
        scrapeDeckBtn.addEventListener("click", () => {
            const origText = scrapeDeckBtn.innerText;
            scrapeDeckBtn.innerText = "⏳ Looking for a deck…";
            const finish = (msg) => { scrapeDeckBtn.innerText = origText; if (msg) alert(msg); };
            chrome.tabs.query({ url: DECK_URLS }, async (tabs) => {
                if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
                    return finish("No deck page is open. Open a deck on MTGGoldfish, MTGDecks, Moxfield, Archidekt, TappedOut, Deckstats, Scryfall, MTGTop8, EDHREC or AetherHub, then try again.");
                }
                tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
                for (const tab of tabs.slice(0, 6)) {
                    try {
                        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["listformats.js", "deckextract.js"] });
                        const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.MPDeck.extract() });
                        const r = res && res[0] && res[0].result;
                        if (r && r.ok) {
                            if (deckNameInput && r.title) deckNameInput.value = r.title;
                            if (decklistInput) { decklistInput.value = r.text; decklistInput.dispatchEvent(new Event("input", { bubbles: true })); }
                            scrapeDeckBtn.innerText = `✓ Read ${r.count} cards from ${r.source}`;
                            setTimeout(() => { scrapeDeckBtn.innerText = origText; }, 2500);
                            if (saveDeckBtn) saveDeckBtn.click();
                            return;
                        }
                    } catch (e) { /* tab not scriptable (e.g. still loading): try the next one */ }
                }
                finish("Found open deck sites, but none of the tabs showed a decklist. Open the deck itself (not a search page) and try again.");
            });
        });
    }

    if (exportManifestBtn) {
        exportManifestBtn.addEventListener("click", () => {
            chrome.storage.local.get(["procurementTargets", "currentDecklist"], (res) => {
                const list = res.procurementTargets || res.currentDecklist || [];
                if (list.length === 0) {
                    alert("No Buy List loaded to export.");
                    return;
                }
                const fmtSel = document.getElementById("mp-export-format");
                const onlyNeeded = !document.getElementById("mp-export-needed") || document.getElementById("mp-export-needed").checked;
                const rows = list.map(c => ({ cardName: c.cardName, set: c.set, cn: c.cn, foil: c.foil,
                    qty: onlyNeeded ? Math.max(0, (c.quantity || 1) - (c.acquired || 0) - ownedQty(c.cardName)) : (c.quantity || 1) }));
                const manifestText = MPLists.format(rows, fmtSel ? fmtSel.value : "plain");
                if (!manifestText.trim() || rows.every(r => r.qty <= 0)) { alert("Nothing left to buy on this list."); return; }

                navigator.clipboard.writeText(manifestText).then(() => {
                    const orig = exportManifestBtn.innerText;
                    exportManifestBtn.innerText = "✅ Copied!";
                    setTimeout(() => { exportManifestBtn.innerText = orig; }, 2000);
                });
            });
        });
    }

    if (printingSelect) printingSelect.addEventListener("change", syncAllPanels);
    if (conditionSelect) conditionSelect.addEventListener("change", syncAllPanels);

    // Live "what did Scout understand" line + file import (ManaBox / Goldfish / TCGplayer / MTGO files).
    if (decklistInput) {
        let status = document.getElementById("mp-import-status");
        if (!status) {
            status = document.createElement("div");
            status.id = "mp-import-status";
            status.style.cssText = "font-size:11px; color:#94a3b8; margin:6px 0; min-height:15px;";
            (document.getElementById("mp-import-status-slot") || decklistInput).insertAdjacentElement(document.getElementById("mp-import-status-slot") ? "beforeend" : "afterend", status);
        }
        const detect = () => {
            const v = decklistInput.value.trim();
            if (!v) { status.textContent = "Paste a list or import a file. Works with MTGGoldfish, MTGDecks, ManaBox, TCGplayer, Moxfield, Archidekt, Deckbox, Arena and MTGO."; return; }
            const r = MPLists.parse(v);
            status.textContent = r.cards.length
                ? `Detected: ${r.format} · ${r.total} cards (${r.cards.length} unique)` + (r.skipped.length ? ` · ${r.skipped.length} line(s) skipped` : "")
                : "No cards recognised yet.";
            status.style.color = r.cards.length ? "#10b981" : "#f59e0b";
        };
        decklistInput.addEventListener("input", detect);
        decklistInput.addEventListener("change", detect);
        detect();
        const file = document.getElementById("mp-import-file");
        const btn = document.getElementById("mp-import-file-btn");
        if (file && btn) {
            btn.addEventListener("click", () => file.click());
            file.addEventListener("change", () => {
                const f = file.files && file.files[0]; if (!f) return;
                const rd = new FileReader();
                rd.onload = () => {
                    decklistInput.value = String(rd.result || "");
                    if (deckNameInput && !deckNameInput.value.trim()) deckNameInput.value = f.name.replace(/\.[^.]+$/, "");
                    detect();
                    file.value = "";
                };
                rd.readAsText(f);
            });
        }
    }
}

// ---- Price loading: show saved prices instantly, refresh in the background, retry quietly, say what happened ----
let priceRenderToken = 0, priceRetryTimer = null, priceRetryCount = 0;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function sendMessageOnce(msg) {
    return new Promise((resolve) => {
        try { chrome.runtime.sendMessage(msg, (r) => { resolve(chrome.runtime.lastError ? null : (r || null)); }); }
        catch (e) { resolve(null); }
    });
}

function setPriceStatus(kind, detail) {
    const el = document.getElementById("mp-price-status");
    if (!el) return;
    const t = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (kind === "ok") { el.style.color = "#10b981"; el.textContent = `✓ Prices updated ${t} (Scryfall / TCGplayer market)`; el.title = ""; }
    else if (kind === "partial") { el.style.color = "#f59e0b"; el.textContent = `✓ Updated ${t}. ${detail.length} card name(s) not found: ${detail.slice(0, 3).join(", ")}${detail.length > 3 ? "…" : ""}`; el.title = detail.join(", "); }
    else if (kind === "stale") { el.style.color = "#f59e0b"; el.innerHTML = `⚠ Couldn't reach Scryfall, showing saved prices. <a href="#" id="mp-price-retry" style="color:#38bdf8">Retry now</a>`; el.title = detail || ""; }
    else { el.style.color = "#94a3b8"; el.textContent = "Loading prices…"; }
}
document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "mp-price-retry") { e.preventDefault(); priceRetryCount = 0; syncAllPanels(); }
});

async function loadPricesRobust(cardNames, paint) {
    const names = Array.from(new Set(cardNames.map((n) => String(n).trim()).filter(Boolean)));
    const store = await new Promise((r) => chrome.storage.local.get({ scryfallPriceCache: {} }, r));
    const cache = store.scryfallPriceCache || {};
    const hasCache = names.some((n) => cache[n.toLowerCase()]);
    paint(hasCache ? cache : {}); // draw right away (saved prices if we have them) so the page never feels empty
    setPriceStatus("loading");

    let r = null;
    for (let a = 0; a < 3 && !r; a++) {
        r = await sendMessageOnce({ action: "fetchCollectionPrices", cardNames: names });
        if (!r) await delay(500 * (a + 1)); // no answer: the service worker may still be waking up
    }
    if (!r) {
        // Background didn't answer: ask Scryfall directly from this page.
        try {
            const d = await MPScry.fetchPrices(names);
            r = { prices: d.prices, missing: d.missing, error: d.error };
            if (Object.keys(d.prices).length) chrome.storage.local.set({ scryfallPriceCache: Object.assign({}, cache, d.prices) });
        } catch (e) { r = { prices: {}, missing: names, error: String(e) }; }
    }
    const fresh = (r && r.prices) || {};
    const got = Object.keys(fresh).length > 0;
    paint(Object.assign({}, cache, fresh));
    if (!got) {
        setPriceStatus(hasCache ? "stale" : "stale", r && r.error);
    } else if (r.missing && r.missing.length) setPriceStatus("partial", r.missing);
    else setPriceStatus("ok");

    clearTimeout(priceRetryTimer);
    if ((!got || (r.missing && r.missing.length && priceRetryCount < 1)) && priceRetryCount < 3) {
        priceRetryCount++;
        priceRetryTimer = setTimeout(syncAllPanels, [5000, 15000, 45000][priceRetryCount - 1]);
    } else if (got) priceRetryCount = 0;
}

// 6. Fetch Live Scryfall Prices, Sort Buy List Table, Show Prices on Buttons & Run Synergy Trend Algorithm
function renderChaseHuntAndArbitrage(targets, watchlistItems, deckMeta, baselineMap) {
    const tbody = document.getElementById("procurement-tbody");
    const arbPaperEl = document.getElementById("arb-paper-total");
    const arbMtgoEl = document.getElementById("arb-mtgo-total");
    const arbSpreadEl = document.getElementById("arb-spread-total");
    const arbGrid = document.getElementById("arbitrage-spread-grid");

    // Include radar breakout cards (like Astral Dragon) in batch Scryfall lookup so their live USD/TIX are always current!
    const radarNames = META_TREND_RADAR_DB.map(r => r.cardName);
    const cardNames = [
        ...targets.map(t => t.cardName),
        ...watchlistItems.map(w => w.cardName || w.title),
        ...radarNames
    ].filter(Boolean);

    if (targets.length === 0 && watchlistItems.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:16px; color:#94a3b8;">Paste a decklist above and click ⚡ Save List & Get Prices.</td></tr>`;
        if (arbGrid) arbGrid.innerHTML = `<div style="color:#94a3b8; font-size:12px; padding:16px;">Load a decklist in Buy List to compute live Paper vs. MTGO TIX arbitrage spreads.</div>`;
        renderSynergyAndTrendRadar([], [], {});
        return;
    }

    const token = ++priceRenderToken;
    const paint = (priceMap) => {
        if (token !== priceRenderToken) return; // a newer render started; drop this one
        window.mpPriceMap = priceMap;
        const preferFoil = (document.getElementById("printing-target-select")?.value || deckMeta.printingTarget || "").toLowerCase().includes("foil");

        // Update local baseline map to track real price movement over time
        const updatedBaselines = { ...baselineMap };
        Object.keys(priceMap).forEach(k => {
            const cur = priceMap[k].usd || 0;
            if (cur > 0 && !updatedBaselines[k]) {
                updatedBaselines[k] = cur;
            }
        });
        chrome.storage.local.set({ priceBaselineMap: updatedBaselines });

        let totalPaperRemaining = 0;
        let totalMtgoTixRemaining = 0;

        // Enrich targets with live Scryfall pricing + trend velocity before sorting
        const enrichedTargets = targets.map((item, originalIndex) => {
            const name = item.cardName || "Unknown Card";
            const key = name.toLowerCase().trim();
            const scry = priceMap[key] || { usd: 0, usd_foil: 0, tix: 0, oracle_text: "", type_line: "", edhrec_rank: 99999 };
            const unitPaper = preferFoil && scry.usd_foil > 0 ? scry.usd_foil : (scry.usd || 0);
            const unitTix = scry.tix || 0;
            const qty = item.quantity || 1;
            const acquired = item.acquired || 0;
            const owned = ownedQty(name);
            const have = Math.min(qty, acquired + owned);
            const remaining = Math.max(0, qty - have);

            totalPaperRemaining += unitPaper * remaining;
            totalMtgoTixRemaining += unitTix * remaining;

            // Compute trend indicator (from radar DB or baseline comparison)
            const radarEntry = META_TREND_RADAR_DB.find(r => r.cardName.toLowerCase() === key);
            const basePrice = radarEntry ? radarEntry.baselineUsd : (updatedBaselines[key] || unitPaper);
            const deltaPct = basePrice > 0 ? ((unitPaper - basePrice) / basePrice) * 100 : 0;

            return {
                ...item,
                originalIndex,
                owned,
                have,
                unitPaper,
                eur: scry.eur || 0,
                unitTix,
                remaining,
                deltaPct,
                oracle_text: scry.oracle_text || "",
                type_line: scry.type_line || ""
            };
        });

        // Sort enrichedTargets according to user's selected sort mode
        enrichedTargets.sort((a, b) => {
            if (currentSortMode === "price-desc") return b.unitPaper - a.unitPaper;
            if (currentSortMode === "price-asc") return a.unitPaper - b.unitPaper;
            if (currentSortMode === "tix-desc") return b.unitTix - a.unitTix;
            if (currentSortMode === "trend-desc") return Math.abs(b.deltaPct) - Math.abs(a.deltaPct) || (b.unitPaper - a.unitPaper);
            if (currentSortMode === "name-asc") return a.cardName.localeCompare(b.cardName);
            return 0;
        });

        if (window.MPFeatures) window.MPFeatures.renderTotals(enrichedTargets);

        const shownTargets = window.mpHideOwned ? enrichedTargets.filter(t => t.remaining > 0) : enrichedTargets;
        if (tbody && window.mpHideOwned && shownTargets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:16px; color:#10b981;">You already have every card on this list. Nothing to buy.</td></tr>`;
        } else if (tbody) {
            tbody.innerHTML = shownTargets.map((item) => {
                const name = item.cardName || "Unknown Card";
                const idx = item.originalIndex;
                const unitPaper = item.unitPaper;
                const unitTix = item.unitTix;
                const qty = item.quantity || 1;
                const acquired = item.acquired || 0;

                // Deal rule: what you pay DELIVERED should be at most 85% of market. Shipping comes out of that budget,
                // so the item-price cap on eBay is (85% of market) minus this card's share of shipping.
                const shipCfg = window.mpShip || { ship: 0.78, perOrder: 1 };
                const shipShare = shipCfg.ship / Math.max(1, shipCfg.perOrder);
                const dealDelivered = unitPaper > 0 ? unitPaper * 0.85 : 0;
                const itemCapNum = unitPaper > 0 ? dealDelivered - shipShare : 0;
                const bundleOnly = unitPaper > 0 && itemCapNum < 0.25;
                const itemCap = Math.max(0.25, itemCapNum).toFixed(2);
                const dealTxt = dealDelivered.toFixed(2);
                const tcgLabel = unitPaper > 0 ? `TCGplayer $${unitPaper.toFixed(2)}` : "TCGplayer Search";
                const binLabel = unitPaper <= 0 ? "eBay Buy It Now" : (bundleOnly ? `eBay free-ship ≤$${dealTxt}` : `eBay BIN ≤$${itemCap} + ship`);
                const aucLabel = unitPaper <= 0 ? "eBay Auction" : (bundleOnly ? "eBay Auction" : `eBay Auction ≤$${itemCap} + ship`);
                const binTitle = unitPaper <= 0 ? "Price not loaded yet. Searches eBay Buy It Now without a price cap."
                    : (bundleOnly
                        ? `Shipping ($${shipShare.toFixed(2)}) is too big a share of this $${unitPaper.toFixed(2)} card. Shows free-shipping Buy It Now listings up to $${dealTxt} (85% of market), or buy it in a bundle.`
                        : `Buy It Now items up to $${itemCap}. With ~$${shipShare.toFixed(2)} shipping that is $${dealTxt} delivered, 85% of the $${unitPaper.toFixed(2)} market price.`);

                const minBinFloor = unitPaper >= 8.0 ? Math.min(Math.max(2.50, unitPaper * 0.40), Math.max(0.25, itemCapNum * 0.5)).toFixed(2) : "0.25";
                const minAucFloor = unitPaper >= 15.0 ? Math.min(Math.max(1.99, unitPaper * 0.18), Math.max(0.25, itemCapNum * 0.5)).toFixed(2) : "0.25";
                const exactQuery = encodeURIComponent(`MTG "${name}" -proxy -proxies -playtest -fanart -alter -alters -altered -custom -placeholder -token -replica`);
                const tcgUrl = `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(name)}`;
                // mpmax/mpmkt are ignored by eBay; the Scout overlay on the results page reads them to grade each listing delivered.
                const scoutParams = unitPaper > 0 ? `&mpmax=${dealTxt}&mpmkt=${unitPaper.toFixed(2)}&mpname=${encodeURIComponent(name)}` : "";
                const priceCap = unitPaper > 0 ? `&_udhi=${bundleOnly ? dealTxt : itemCap}` : "";
                const ebayBinUrl = `https://www.ebay.com/sch/i.html?_nkw=${exactQuery}&_sacat=19107&LH_BIN=1&_sop=15${bundleOnly ? "&LH_FS=1" : ""}${unitPaper > 0 ? `&_udlo=${minBinFloor}` : ""}${priceCap}${scoutParams}`;
                const ebayAuctionUrl = `https://www.ebay.com/sch/i.html?_nkw=${exactQuery}&_sacat=19107&LH_Auction=1&_sop=1${unitPaper > 0 ? `&_udlo=${minAucFloor}` : ""}${unitPaper > 0 ? `&_udhi=${bundleOnly ? dealTxt : itemCap}` : ""}${scoutParams}`;
                const ebaySoldUrl = `https://www.ebay.com/sch/i.html?_nkw=${exactQuery}&_sacat=19107&LH_Sold=1&LH_Complete=1&_sop=13`;
                const enc = encodeURIComponent(name);
                const moreLinks = [
                    ["📊 eBay sold prices (what it really sells for)", ebaySoldUrl],
                    ["Card Kingdom", `https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=${enc}`],
                    ["Cardmarket (Europe)", `https://www.cardmarket.com/en/Magic/Products/Search?searchString=${enc}`],
                    ["CoolStuffInc", `https://www.coolstuffinc.com/main_search.php?pa=searchOnName&page=1&resultsPerPage=25&q=${enc}`],
                    ["Star City Games", `https://starcitygames.com/search/?search_query=${enc}`],
                    ["Troll and Toad", `https://www.trollandtoad.com/category.php?selected-cat=0&search-words=${enc}`],
                    ["Cardhoarder (MTGO tickets)", `https://www.cardhoarder.com/cards?data%5Bsearch%5D=${enc}`]
                ].map(([t, u]) => `<a class="mp-more-link" href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`).join("");
                const eurNote = item.eur > 0 ? ` · Cardmarket €${item.eur.toFixed(2)}` : "";

                let trendPill = "";
                if (item.deltaPct >= 5) {
                    trendPill = `<span style="margin-left:6px; font-size:10px; background:rgba(16,185,129,0.15); color:#10b981; padding:1px 5px; border-radius:4px; font-weight:700;">📈 +${item.deltaPct.toFixed(0)}%</span>`;
                } else if (item.deltaPct <= -5) {
                    trendPill = `<span style="margin-left:6px; font-size:10px; background:rgba(56,189,248,0.15); color:#38bdf8; padding:1px 5px; border-radius:4px; font-weight:700;">📉 ${item.deltaPct.toFixed(0)}% Buy Dip</span>`;
                }

                return `
                    <tr data-card-key="${escapeHtml(name.toLowerCase().trim())}" style="border-bottom:1px solid #1e293b; font-size:12px;">
                        <td style="padding:10px; color:#10b981; font-weight:700;">${escapeHtml(name)}${trendPill}${bundleOnly ? ` <span class="mp-pill" style="background:rgba(245,158,11,0.15);color:#f59e0b;" title="Shipping would eat more than 30% of this card's price. Buy it in a bundle or on TCGplayer.">📦 ship-heavy</span>` : ""}</td>
                        <td style="padding:10px; color:#cbd5e1;">${item.have} / ${qty}${item.owned > 0 ? ` <span class="mp-pill b" title="Copies found in your imported collection">${item.owned} owned</span>` : ""}</td>
                        <td style="padding:10px; color:#f59e0b; font-weight:700;">$${unitPaper.toFixed(2)}</td>
                        <td style="padding:10px; color:#38bdf8;">${unitTix.toFixed(2)} TIX</td>
                        <td style="padding:10px; color:#94a3b8;">$${(item.basis || 0).toFixed(2)}</td>
                        <td style="padding:10px;">
                            <div style="display:flex; gap:4px; align-items:center;">
                                <input type="number" step="0.01" placeholder="Paid $" class="basis-input" data-idx="${idx}" style="width:65px; background:#070d17; border:1px solid #334155; color:#f8fafc; padding:4px; border-radius:4px; font-size:11px;">
                                <button class="log-basis-btn" data-idx="${idx}" style="background:#10b981; color:#030712; border:none; padding:4px 8px; border-radius:4px; font-weight:700; font-size:11px; cursor:pointer;">+1</button>
                            </div>
                        </td>
                        <td style="padding:10px;">
                            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                                <a href="${tcgUrl}" target="_blank" rel="noopener" style="color:#f8fafc; background:#1e293b; border:1px solid #475569; padding:4px 7px; border-radius:4px; text-decoration:none; font-size:11px; font-weight:700; white-space:nowrap;" title="TCGplayer search. Market price from Scryfall${eurNote}.">${tcgLabel}</a>
                                <a href="${ebayBinUrl}" target="_blank" rel="noopener" style="color:#10b981; background:rgba(16,185,129,0.1); border:1px solid #10b981; padding:4px 7px; border-radius:4px; text-decoration:none; font-size:11px; font-weight:700; white-space:nowrap;" title="${escapeHtml(binTitle)}">${binLabel}</a>
                                <a href="${ebayAuctionUrl}" target="_blank" rel="noopener" style="color:#f59e0b; background:rgba(245,158,11,0.1); border:1px solid #f59e0b; padding:4px 7px; border-radius:4px; text-decoration:none; font-size:11px; font-weight:700; white-space:nowrap;" title="eBay auctions ending soonest, item price cap ${bundleOnly ? dealTxt : itemCap}. Remember to add shipping.">${aucLabel}</a>
                                <details class="mp-more">
                                    <summary class="mp-more-sum" title="More stores, eBay sold prices, flip calculator and price alert">More ▾</summary>
                                    <div class="mp-more-menu">
                                        <button class="mp-flip-btn mp-more-link" data-name="${escapeHtml(name)}" data-buy="${dealTxt}" data-sell="${unitPaper.toFixed(2)}">📈 Flip calculator (profit after fees)</button>
                                        <button class="mp-alert-btn mp-more-link" data-name="${escapeHtml(name)}" data-price="${unitPaper.toFixed(2)}">🔔 Alert me when the price drops</button>
                                        ${moreLinks}
                                    </div>
                                </details>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");

            tbody.querySelectorAll(".log-basis-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    const idx = parseInt(btn.getAttribute("data-idx"), 10);
                    const input = tbody.querySelector(`.basis-input[data-idx="${idx}"]`);
                    const paid = parsePrice(input ? input.value : 0);
                    if (targets[idx]) {
                        targets[idx].acquired = Math.min(targets[idx].quantity, (targets[idx].acquired || 0) + 1);
                        targets[idx].basis = (targets[idx].basis || 0) + paid;
                        chrome.storage.local.set({ procurementTargets: targets }, syncAllPanels);
                    }
                });
            });
        }

        // Update #tab-arbitrage HUD & Spread Grid
        const mtgoUsd = totalMtgoTixRemaining * TIX_TO_USD;
        const spreadUsd = totalPaperRemaining - mtgoUsd;
        const spreadPct = totalPaperRemaining > 0 ? (spreadUsd / totalPaperRemaining) * 100 : 0;

        if (arbPaperEl) arbPaperEl.innerText = `$${totalPaperRemaining.toFixed(2)}`;
        if (arbMtgoEl) arbMtgoEl.innerText = `${totalMtgoTixRemaining.toFixed(2)} TIX ($${mtgoUsd.toFixed(2)})`;
        if (arbSpreadEl) {
            arbSpreadEl.innerText = `${spreadUsd >= 0 ? "+" : "-"}$${Math.abs(spreadUsd).toFixed(2)} (${spreadPct.toFixed(1)}%)`;
            arbSpreadEl.style.color = spreadUsd >= 0 ? "#10b981" : "#ef4444";
        }

        if (arbGrid) {
            const watchlistByCard = {};
            (watchlistItems || []).forEach(w => {
                const k = (w.cardName || w.title || "").toLowerCase().trim();
                if (k) watchlistByCard[k] = w;
            });

            const combinedArbItems = [...enrichedTargets];
            (watchlistItems || []).forEach(w => {
                const wName = (w.cardName || w.title || "").trim();
                if (wName && !combinedArbItems.some(t => (t.cardName || "").toLowerCase().trim() === wName.toLowerCase())) {
                    combinedArbItems.push({ cardName: wName, quantity: 1, fromWatchlist: true, watchRecord: w });
                }
            });

            arbGrid.innerHTML = combinedArbItems.map(item => {
                const name = item.cardName || "Unknown Card";
                const key = name.toLowerCase().trim();
                const scry = priceMap[key] || { usd: 0, tix: 0 };
                const wMatch = item.watchRecord || watchlistByCard[key];

                const paperFloor = scry.usd > 0 ? scry.usd : parsePrice(wMatch?.marketFloor);
                const tix = scry.tix || 0;
                const tixUsd = tix * TIX_TO_USD;
                const unitSpread = paperFloor - tixUsd;
                const spreadPctCard = paperFloor > 0 ? (unitSpread / paperFloor) * 100 : 0;

                const listedCost = wMatch ? parsePrice(wMatch.price || wMatch.totalCost || wMatch.valueA) : 0;
                const hasLiveFlip = wMatch && listedCost > 0 && paperFloor > listedCost;
                const flipProfit = hasLiveFlip ? (paperFloor - listedCost) : 0;
                const flipPct = hasLiveFlip && paperFloor > 0 ? (flipProfit / paperFloor) * 100 : 0;

                let signalBadge = "";
                let borderColor = "#1e293b";

                let hotCard = false;
                if (hasLiveFlip && flipPct >= 15) {
                    hotCard = true;
                    borderColor = "#10b981";
                    signalBadge = `<div style="background:rgba(16,185,129,0.18); border:1px solid #10b981; color:#10b981; padding:5px 8px; border-radius:4px; font-size:11px; font-weight:800; margin-bottom:8px; text-align:center;">🔥 LIVE EBAY ARBITRAGE: +$${flipProfit.toFixed(2)}/ea (${flipPct.toFixed(0)}% UNDER FLOOR)</div>`;
                } else if (unitSpread >= 5.0 && spreadPctCard >= 25) {
                    hotCard = unitSpread >= 8.0 && spreadPctCard >= 40; // only a big paper-vs-MTGO gap gets the foil treatment
                    borderColor = "#f59e0b";
                    signalBadge = `<div style="background:rgba(245,158,11,0.15); border:1px solid #f59e0b; color:#f59e0b; padding:5px 8px; border-radius:4px; font-size:11px; font-weight:800; margin-bottom:8px; text-align:center;">💎 DIGITAL ➔ PAPER ARB: +$${unitSpread.toFixed(2)}/ea (${spreadPctCard.toFixed(0)}% SPREAD)</div>`;
                } else if (unitSpread <= -1.0) {
                    borderColor = "#38bdf8";
                    signalBadge = `<div style="background:rgba(56,189,248,0.15); border:1px solid #38bdf8; color:#38bdf8; padding:5px 8px; border-radius:4px; font-size:11px; font-weight:800; margin-bottom:8px; text-align:center;">⚡ PAPER UNDER DIGITAL: BUY PAPER / SELL MTGO ($${Math.abs(unitSpread).toFixed(2)} EDGE)</div>`;
                } else {
                    signalBadge = `<div style="background:#070d17; border:1px solid #1e293b; color:#64748b; padding:5px 8px; border-radius:4px; font-size:11px; font-weight:700; margin-bottom:8px; text-align:center;">⚖️ PARITY MARKET (LOW ARBITRAGE SPREAD)</div>`;
                }

                const maxSnipe = Math.max(0.99, paperFloor * 0.85).toFixed(2);
                const minSnipe = paperFloor >= 8.0 ? Math.max(2.50, paperFloor * 0.40).toFixed(2) : "0.99";
                const encoded = encodeURIComponent(`MTG "${name}" -proxy -proxies -playtest -fanart -alter -alters -altered -custom -placeholder -token`);
                const actionUrl = safeHttpUrl(wMatch?.url) || `https://www.ebay.com/sch/i.html?_nkw=${encoded}&_sacat=19107&LH_BIN=1&_sop=15&_udlo=${minSnipe}&_udhi=${maxSnipe}`;
                const actionLabel = wMatch?.url
                    ? `🎯 Open Bookmarked Deal ($${listedCost.toFixed(2)} vs $${paperFloor.toFixed(2)} Floor) ↗`
                    : `🎯 eBay Buy It Now under $${maxSnipe} (Market $${paperFloor.toFixed(2)}) ↗`;

                return `
                    <div class="${hotCard ? "mp-foil-card" : ""}" style="background:#0b1120; border:1px solid ${borderColor}; border-radius:8px; padding:14px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="font-weight:700; color:#38bdf8; font-size:14px;">${escapeHtml(name)} (x${item.quantity || 1})</span>
                                ${wMatch ? `<span style="font-size:10px; background:#065f46; color:#10b981; padding:2px 6px; border-radius:4px; font-weight:700;">BOOKMARKED</span>` : ""}
                            </div>
                            ${signalBadge}
                            <div style="font-size:12px; color:#94a3b8; display:flex; justify-content:space-between; margin-bottom:3px;"><span>Paper Floor:</span><strong style="color:#10b981;">$${paperFloor.toFixed(2)}</strong></div>
                            ${hasLiveFlip ? `<div style="font-size:12px; color:#94a3b8; display:flex; justify-content:space-between; margin-bottom:3px;"><span>Bookmarked eBay Cost:</span><strong style="color:#00ffcc;">$${listedCost.toFixed(2)} (Save$${flipProfit.toFixed(2)})</strong></div>` : ""}
                            <div style="font-size:12px; color:#94a3b8; display:flex; justify-content:space-between; margin-bottom:3px;"><span>MTGO TIX:</span><strong style="color:#3b82f6;">${tix.toFixed(2)} ($${tixUsd.toFixed(2)})</strong></div>
                            <div style="font-size:12px; color:#94a3b8; display:flex; justify-content:space-between; margin-top:4px; padding-top:4px; border-top:1px solid #1e293b;"><span>Paper vs. MTGO Delta:</span><strong style="color:${unitSpread >= 0 ? "#f59e0b" : "#38bdf8"};">${unitSpread >= 0 ? "+" : "-"}$${Math.abs(unitSpread).toFixed(2)}</strong></div>
                        </div>
                        <a href="${escapeHtml(actionUrl)}" target="_blank" style="margin-top:10px; display:block; text-align:center; background:#1e293b; color:#f8fafc; text-decoration:none; padding:7px; border-radius:4px; font-size:11px; font-weight:700; border:1px solid #10b981;">${actionLabel}</a>
                    </div>
                `;
            }).join("");
        }

        // Run Algorithmic Synergy & Metagame Trend Radar across user's Buy List + Watchlist
        renderSynergyAndTrendRadar(enrichedTargets, watchlistItems, priceMap);
        if (window.MPFeatures2 && window.MPFeatures2.applyHot) window.MPFeatures2.applyHot();
    };
    loadPricesRobust(cardNames, paint);
}

// 7. Algorithmic Metagame Trend & Cross-Archetype Synergy Radar (Populates on Buy List & Meta Trends)
function renderSynergyAndTrendRadar(enrichedTargets, watchlistItems, priceMap) {
    const procTab = document.getElementById("tab-procurement");
    const metaTab = document.getElementById("tab-meta");

    const userCardSet = new Set([
        ...enrichedTargets.map(t => (t.cardName || "").toLowerCase().trim()),
        ...watchlistItems.map(w => (w.cardName || w.title || "").toLowerCase().trim())
    ]);

    // Detect synergy clusters in user's active Buy List / Watchlist
    const scoredRecommendations = META_TREND_RADAR_DB.map(entry => {
        const matchedCards = entry.triggersOn.filter(trig => userCardSet.has(trig));
        const scry = priceMap[entry.cardName.toLowerCase()] || { usd: entry.baselineUsd, tix: 0 };
        const liveUsd = scry.usd > 0 ? scry.usd : entry.baselineUsd;
        const liveTix = scry.tix || 0;
        const snipeCeiling = Math.max(0.99, liveUsd * 0.85).toFixed(2);
        const alreadyInDeck = userCardSet.has(entry.cardName.toLowerCase());

        return {
            ...entry,
            matchedCards,
            matchScore: matchedCards.length,
            liveUsd,
            liveTix,
            snipeCeiling,
            alreadyInDeck
        };
    }).sort((a, b) => b.matchScore - a.matchScore || b.liveUsd - a.liveUsd);

    const radarHtml = `
        <div style="background:#0b1120; border:1px solid #00ffcc; border-radius:8px; padding:14px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
                <div>
                    <span style="color:#00ffcc; font-weight:800; font-size:13px;">🔮 TRENDING CARDS & COMBOS</span>
                    <span style="margin-left:8px; font-size:11px; color:#94a3b8;">Trending Breakouts, Price Movers & Cross-Archetype Fits for Your Active Cards</span>
                </div>
                <span style="font-size:10px; background:#065f46; color:#10b981; padding:3px 8px; border-radius:4px; font-weight:700;">LIVE TRENDS</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap:12px;">
                ${scoredRecommendations.map(rec => {
                    const isTrendingUp = rec.trendDir === "up";
                    const trendBadgeColor = isTrendingUp ? "#10b981" : "#38bdf8";
                    const trendLabel = isTrendingUp ? `📈 TRENDING UP (${rec.trendDeltaPct})` : `📉 DIP BUY WINDOW (${rec.trendDeltaPct})`;
                    const matchBanner = rec.matchedCards.length > 0
                        ? `<div style="background:rgba(16,185,129,0.14); border:1px solid #10b981; color:#10b981; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700; margin-bottom:6px;">⚡ SYNERGY MATCH WITH YOUR LIST: ${rec.matchedCards.map(c => c.replace(/\b\w/g, l => l.toUpperCase())).join(", ")}</div>`
                        : `<div style="background:#070d17; border:1px solid #1e293b; color:#f59e0b; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700; margin-bottom:6px;">🔥 HIGH-VELOCITY FORMAT MOVER</div>`;

                    const minRadarFloor = rec.liveUsd >= 8.0 ? Math.max(2.50, rec.liveUsd * 0.40).toFixed(2) : "0.99";
                    const exactQuery = encodeURIComponent(`MTG "${rec.cardName}" -proxy -proxies -playtest -fanart -alter -alters -altered -custom -placeholder -token`);
                    const ebaySnipeUrl = `https://www.ebay.com/sch/i.html?_nkw=${exactQuery}&_sacat=19107&LH_BIN=1&_sop=15&_udlo=${minRadarFloor}&_udhi=${rec.snipeCeiling}`;

                    return `
                        <div style="background:#070d17; border:1px solid ${rec.matchedCards.length > 0 ? "#10b981" : "#1e293b"}; border-radius:8px; padding:12px; display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                    <strong style="color:#38bdf8; font-size:14px;">${escapeHtml(rec.cardName)}</strong>
                                    <span style="font-size:10px; color:${trendBadgeColor}; background:#0b1120; border:1px solid ${trendBadgeColor}; padding:2px 6px; border-radius:4px; font-weight:800;">${trendLabel}</span>
                                </div>
                                ${matchBanner}
                                <div style="font-size:11px; color:#cbd5e1; line-height:1.4; margin-bottom:6px;">${escapeHtml(rec.whyTrending)}</div>
                                <div style="font-size:11px; color:#94a3b8; margin-bottom:4px;"><strong>Cross-Archetypes:</strong> ${rec.archetypes.map(a => `<span style="color:#eab308;">${escapeHtml(a)}</span>`).join(" • ")}</div>
                                <div style="font-size:10px; color:#64748b; margin-bottom:6px;">${rec.synergyTags.join("  ")}</div>
                                <div style="display:flex; justify-content:space-between; font-size:12px; padding-top:6px; border-top:1px solid #1e293b;">
                                    <span>Paper Floor: <strong style="color:#f59e0b;">$${rec.liveUsd.toFixed(2)}</strong> <span style="font-size:10px; color:#64748b;">(was $${rec.baselineUsd.toFixed(2)})</span></span>
                                    <span>MTGO: <strong style="color:#38bdf8;">${rec.liveTix.toFixed(2)} TIX</strong></span>
                                </div>
                            </div>
                            <div style="display:flex; gap:6px; margin-top:4px;">
                                <button class="add-radar-card-btn" data-card="${escapeHtml(rec.cardName)}" style="flex:1; background:${rec.alreadyInDeck ? "#1e293b" : "#10b981"}; color:${rec.alreadyInDeck ? "#94a3b8" : "#030712"}; border:none; padding:6px 8px; border-radius:4px; font-size:11px; font-weight:800; cursor:pointer;">
                                    ${rec.alreadyInDeck ? "✓ In Buy List" : `🎯 + Buy List ($${rec.liveUsd.toFixed(2)})`}
                                </button>
                                <a href="${ebaySnipeUrl}" target="_blank" style="flex:1; text-align:center; background:#1e293b; border:1px solid #f59e0b; color:#f59e0b; text-decoration:none; padding:6px 8px; border-radius:4px; font-size:11px; font-weight:700;"> Snipe BIN <$${rec.snipeCeiling} ↗
                                </a>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;

    // Mount inside Buy List (#tab-procurement) AND Meta Trends (#tab-meta)
    [procTab, metaTab].forEach((tab, idx) => {
        if (!tab) return;
        const containerId = idx === 0 ? "chase-synergy-radar-box" : "meta-synergy-radar-box";
        let box = document.getElementById(containerId);
        if (!box) {
            box = document.createElement("div");
            box.id = containerId;
            tab.appendChild(box);
        }
        box.innerHTML = radarHtml;

        box.querySelectorAll(".add-radar-card-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const cName = btn.getAttribute("data-card");
                if (!cName) return;
                chrome.runtime.sendMessage({
                    action: "importDetectedToScout",
                    mode: "procurement_single",
                    cardName: cName
                }, () => {
                    syncAllPanels();
                });
            });
        });
    });
}

// 8. Wire #tab-meta Archetype Cards
function initMetaTracker() {
    const filterSelect = document.getElementById("meta-format-filter");
    const metaGrid = document.getElementById("meta-tracker-grid");
    if (!metaGrid) return;

    const sampleArchetypes = [
        { format: "commander", name: "Mill & Copy Superfriends (Astral Dragon / Doubling Season)", share: "14.2%", winrate: "56.8%", staples: ["1 Astral Dragon", "1 Doubling Season", "1 Rhystic Study", "1 Oath of Teferi", "1 Extravagant Replication", "1 Psychic Corrosion"] },
        { format: "standard", name: "Dimir Midrange", share: "18.4%", winrate: "55.2%", staples: ["4 Thoughtseize", "4 Go for the Throat", "2 Sheoldred, the Apocalypse"] },
        { format: "modern", name: "Dimir Murktide / Ring Control", share: "12.1%", winrate: "53.8%", staples: ["4 Thoughtseize", "4 Counterspell", "4 Orcish Bowmasters", "2 The One Ring"] },
        { format: "commander", name: "Liliana Graveyard Burn & Discard", share: "9.4%", winrate: "56.0%", staples: ["1 Thoughtseize", "1 Professor Onyx", "1 Inkshield", "1 Roaming Throne"] }
    ];

    function renderMeta() {
        const selected = (filterSelect ? filterSelect.value : "all").toLowerCase();
        const filtered = selected === "all" ? sampleArchetypes : sampleArchetypes.filter(a => a.format === selected);
        metaGrid.innerHTML = filtered.map((arch, idx) => `
            <div style="background:#0b1120; border:1px solid #1e293b; border-radius:8px; padding:14px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#38bdf8; font-size:14px;">${escapeHtml(arch.name)}</strong>
                    <span style="font-size:11px; color:#10b981; background:#1e293b; padding:2px 6px; border-radius:4px;">WR: ${arch.winrate}</span>
                </div>
                <div style="font-size:11px; color:#94a3b8;">Meta Share: <strong>${arch.share}</strong> | Format: <strong style="text-transform:uppercase;">${arch.format}</strong></div>
                <div style="font-size:11px; color:#cbd5e1; background:#070d17; padding:8px; border-radius:4px; font-family:monospace;">${arch.staples.join("<br>")}</div>
                <button class="load-meta-sample-btn" data-idx="${idx}" style="background:#10b981; color:#030712; border:none; padding:7px; border-radius:4px; font-size:11px; font-weight:800; cursor:pointer;">⚡ Load Staples into Buy List</button>
            </div>
        `).join("");

        metaGrid.querySelectorAll(".load-meta-sample-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const arch = filtered[parseInt(btn.getAttribute("data-idx"), 10)];
                const decklistInput = document.getElementById("decklist-input");
                const deckNameInput = document.getElementById("deck-name-input");
                const saveBtn = document.getElementById("save-deck-btn");
                if (deckNameInput) deckNameInput.value = arch.name;
                if (decklistInput) decklistInput.value = arch.staples.join("\n");
                if (saveBtn) saveBtn.click();
            });
        });
    }

    if (filterSelect) filterSelect.addEventListener("change", renderMeta);
    renderMeta();
}

// 9. Armed / Disarmed Master Toggle
function initArmedToggle() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar || document.getElementById("scout-armed-toggle")) return;

    const btn = document.createElement("button");
    btn.id = "scout-armed-toggle";
    btn.style.cssText = "width:100%; margin-bottom:14px; padding:8px 10px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:space-between; border:1px solid #10b981; background:rgba(16,185,129,0.12); color:#10b981;";

    function renderState(isArmed) {
        btn.style.borderColor = isArmed ? "#10b981" : "#475569";
        btn.style.background = isArmed ? "rgba(16,185,129,0.12)" : "#0b1120";
        btn.style.color = isArmed ? "#10b981" : "#94a3b8";
        btn.innerHTML = isArmed
            ? `<span>🟢 SCOUT ARMED</span><span style="font-size:9px; opacity:0.85;">AUTO-DETECT ON</span>`
            : `<span>⚪ DISARMED</span><span style="font-size:9px; opacity:0.85;">QUIET MODE</span>`;
    }

    chrome.storage.local.get({ scoutArmed: true }, (res) => {
        renderState(Boolean(res.scoutArmed));
    });

    btn.addEventListener("click", () => {
        chrome.storage.local.get({ scoutArmed: true }, (res) => {
            const nextState = !res.scoutArmed;
            chrome.storage.local.set({ scoutArmed: nextState }, () => {
                renderState(nextState);
            });
        });
    });

    const firstSection = sidebar.querySelector(".nav-section") || sidebar.firstElementChild?.nextSibling;
    sidebar.insertBefore(btn, firstSection);
}

// 10. Standalone Watermark (`mpsbanner1mb.png`) & $9 Lifetime Key Settings
function applyWatermarkState(isLicensed) {
    const wmSelectors = [".watermark", ".watermark-overlay", "#mp-watermark", ".support-banner", "#mp-support-banner"];
    wmSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            el.style.display = isLicensed ? "none" : "";
        });
    });

    let wm = document.getElementById("mp-watermark");
    if (!wm && !document.querySelector(".watermark, .watermark-overlay")) {
        wm = document.createElement("div");
        wm.id = "mp-watermark";
        wm.style.cssText = "position:fixed; inset:0; pointer-events:none; z-index:0; display:flex; align-items:center; justify-content:center; opacity:0.16;";
        wm.innerHTML = `<img src="mpsbanner1mb.png" style="width:560px; max-width:70vw; filter:grayscale(10%);" alt="">`;
        document.body.appendChild(wm);
    }
    if (wm) wm.style.display = isLicensed ? "none" : "flex";

    let banner = document.getElementById("mp-support-banner");
    if (!banner && !document.querySelector(".support-banner")) {
        banner = document.createElement("div");
        banner.id = "mp-support-banner";
        banner.style.cssText = "position:fixed; bottom:0; left:0; right:0; z-index:999; background:linear-gradient(90deg,#052e2b,#0b1120 40%,#1e1b4b); border-top:2px solid #10b981; padding:10px 16px; text-align:center; font-size:13px; line-height:1.5; color:#e2e8f0; box-shadow:0 -6px 24px rgba(0,0,0,.45);";
        banner.innerHTML = `<div id="mp-banner-full"><strong style="color:#4ade80;">I'm a disabled MTG player, building this since Alpha for players like me.</strong> $9 goes a long way, and I hope you stick around for the full suite coming soon. Until then you get the full power of this extension free. The watermark is just a reminder of the effort and resources behind this tool for your chase. <a href="https://mrjoshua.gumroad.com/l/mirrorpoolscout" target="_blank" rel="noopener" style="color:#10b981; font-weight:800; text-decoration:underline;">Get the $9 Lifetime Key</a> &middot; <a href="#" id="banner-key-link" style="color:#93c5fd; text-decoration:underline;">I already have a key</a> &middot; <a href="https://terratian.github.io/mirrorpool-scout/help.html" target="_blank" rel="noopener" style="color:#93c5fd; text-decoration:underline;">Help</a> &middot; <a href="#" id="banner-min-link" style="color:#94a3b8; text-decoration:underline;">Shrink</a></div><div id="mp-banner-mini" style="display:none;"><strong style="color:#4ade80;">Mirror Pool Scout, free alpha.</strong> A solo disabled-player build. <a href="https://mrjoshua.gumroad.com/l/mirrorpoolscout" target="_blank" rel="noopener" style="color:#10b981; font-weight:800; text-decoration:underline;">$9 Lifetime Key</a> &middot; <a href="#" id="banner-max-link" style="color:#94a3b8; text-decoration:underline;">Read more</a></div>`;
        const reserve = () => { document.body.style.paddingBottom = (banner.offsetHeight + 8) + "px"; };
        document.body.appendChild(banner);
        const full = banner.querySelector("#mp-banner-full"), mini = banner.querySelector("#mp-banner-mini");
        const setMini = (m) => { full.style.display = m ? "none" : ""; mini.style.display = m ? "" : "none"; try { sessionStorage.setItem("mpBannerMini", m ? "1" : ""); } catch (e) {} reserve(); };
        banner.querySelector("#banner-min-link").addEventListener("click", (e) => { e.preventDefault(); setMini(true); });
        banner.querySelector("#banner-max-link").addEventListener("click", (e) => { e.preventDefault(); setMini(false); });
        try { setMini(sessionStorage.getItem("mpBannerMini") === "1"); } catch (e) { setMini(false); }
        const link = banner.querySelector("#banner-key-link");
        if (link) {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === "tab-settings"));
            });
        }
    }
    if (banner) { banner.style.display = isLicensed ? "none" : "block"; document.body.style.paddingBottom = isLicensed ? "" : (banner.offsetHeight + 8) + "px"; }
}

function initSettingsPanel() {
    const settingsPanel = document.getElementById("tab-settings");
    chrome.storage.local.get(["licenseKey", "licenseValid"], (res) => {
        const isLicensed = Boolean(res.licenseValid);
        const savedKey = res.licenseKey || "";

        applyWatermarkState(isLicensed);
        if (!settingsPanel) return;
        // innerHTML below wipes anything appended earlier (the backup card), so re-mount it right after.
        setTimeout(() => { if (window.MPFeatures2 && window.MPFeatures2.renderBackup) window.MPFeatures2.renderBackup(); }, 0);

        settingsPanel.innerHTML = `
            <div style="background:#0b1120; border:1px solid #1e293b; border-radius:8px; padding:18px; max-width:540px; display:flex; flex-direction:column; gap:14px; position:relative; z-index:2;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#10b981; font-size:15px;">🔑 Mirror Pool Scout (Standalone) — Lifetime Key</strong>
                    <span style="font-size:11px; padding:3px 8px; border-radius:4px; font-weight:700; background:${isLicensed ? "#065f46" : "#1e293b"}; color:${isLicensed ? "#10b981" : "#f59e0b"};">
                        ${isLicensed ? "✅ WATERMARK REMOVED (LIFETIME)" : "💧 WATERMARKED ALPHA BUILD"}
                    </span>
                </div>
                <div style="font-size:12px; color:#94a3b8; line-height:1.5;">
                    All standalone features in <strong>Mirror Pool Scout</strong> are 100% unlocked. Enter your <strong>$9.00 Lifetime Key</strong> below to permanently remove the background watermark and bottom supporter banner.
                </div>
                <div style="display:flex; gap:8px;">
                    <input type="text" id="gumroad-key-input" value="${escapeHtml(savedKey)}" placeholder="Enter $9 Lifetime Key (e.g. MPSCOUT-XXXX-XXXX)" style="flex:1; background:#070d17; border:1px solid #334155; color:#f8fafc; padding:8px; border-radius:4px; font-size:12px;">
                    <button id="verify-key-btn" style="background:#10b981; color:#030712; border:none; padding:8px 14px; border-radius:4px; font-weight:700; font-size:12px; cursor:pointer;">${isLicensed ? "Update Key" : "Remove Watermark"}</button>
                </div>
                <div id="lic-status-msg" style="font-size:11px; color:#94a3b8;"></div>
                <hr style="border:none; border-top:1px solid #1e293b; margin:4px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; color:#cbd5e1;">Support solo development & strip the watermark:</span>
                    <a href="${GUMROAD_URL}" target="_blank" rel="noopener" style="background:#10b981; color:#030712; text-decoration:none; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:700;">Snag $9 Lifetime Key ↗</a>
                </div>
            </div>
        `;

        const verifyBtn = document.getElementById("verify-key-btn");
        const keyInput = document.getElementById("gumroad-key-input");
        const statusMsg = document.getElementById("lic-status-msg");
        const say = (msg, color) => { if (statusMsg) { statusMsg.textContent = msg; statusMsg.style.color = color || "#94a3b8"; } };

        if (verifyBtn && keyInput) {
            verifyBtn.addEventListener("click", async () => {
                const key = keyInput.value.trim();
                if (key.length < 8) { say("Please enter your Gumroad license key.", "#ef4444"); return; }
                verifyBtn.disabled = true;
                say("Checking license with Gumroad…");
                try {
                    const form = new URLSearchParams();
                    if (GUMROAD_PRODUCT_ID) form.set("product_id", GUMROAD_PRODUCT_ID);
                    else form.set("product_permalink", GUMROAD_PERMALINK);
                    form.set("license_key", key);
                    form.set("increment_uses_count", "false");
                    const resp = await fetch("https://api.gumroad.com/v2/licenses/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: form.toString()
                    });
                    const data = await resp.json().catch(() => ({}));
                    const purchase = data.purchase || {};
                    if (data.success && !purchase.refunded && !purchase.chargebacked) {
                        chrome.storage.local.set({ licenseKey: key, licenseValid: true, licenseVerifiedAt: Date.now() }, () => {
                            applyWatermarkState(true);
                            initSettingsPanel();
                        });
                        return;
                    }
                    if (data.success) say("That license was refunded or charged back.", "#ef4444");
                    else if (/product_id/i.test(data.message || "")) say("Setup needed: Gumroad requires the product ID for this product (see GUMROAD_PRODUCT_ID in dashboard.js).", "#f59e0b");
                    else say("That key wasn't recognized for Mirror Pool Scout. Check it and try again.", "#ef4444");
                } catch (err) {
                    say("Couldn't reach Gumroad. Check your connection and try again.", "#f59e0b");
                }
                verifyBtn.disabled = false;
            });
        }

        // Affiliate disclosure + opt-out
        settingsPanel.insertAdjacentHTML("beforeend", `
            <div style="background:#0b1120; border:1px solid #1e293b; border-radius:8px; padding:18px; max-width:540px; margin-top:16px; display:flex; flex-direction:column; gap:10px; position:relative; z-index:2;">
                <strong style="color:#38bdf8; font-size:14px;">🤝 Affiliate links</strong>
                <div style="font-size:12px; color:#94a3b8; line-height:1.5;">
                    Some eBay and TCGplayer links in Mirror Pool Scout are affiliate links (eBay Partner Network and Impact).
                    If you click one and buy something, the developer may earn a commission at no extra cost to you.
                    Links are only tagged at the moment you click them, and prices are never affected.
                </div>
                <label style="font-size:12px; color:#cbd5e1; display:flex; gap:8px; align-items:center; cursor:pointer;">
                    <input type="checkbox" id="affiliate-toggle"> Use affiliate links to support development
                </label>
            </div>
        `);
        const affToggle = document.getElementById("affiliate-toggle");
        if (affToggle) {
            chrome.storage.local.get({ affiliateEnabled: true }, (r) => { affToggle.checked = r.affiliateEnabled !== false; });
            affToggle.addEventListener("change", () => chrome.storage.local.set({ affiliateEnabled: affToggle.checked }));
        }
    });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== "local") return;
    // Only inputs that change what the Buy List shows. Price caches are written BY the render, so listening to them loops.
    const WATCH = ["watchlist","watchlist_cards","card_chase","procurementTargets","currentDecklist","deckMeta","savedChaseLists","mpCollection","useCollection","hideOwned","mpShipSettings"];
    if (Object.keys(changes).some((k) => WATCH.includes(k))) syncAllPanels();
});

// === MP_CHASE_PORTFOLIO_START ===
(function() {
    // Sanitize card name by stripping leading quantities, set codes like (FRA), and collector numbers
    function cleanCardName(raw) {
        if (!raw) return "";
        return raw
            .replace(/^\d+[xX]?\s+/, "")           // Strip leading "1 " or "4x "
            .replace(/\s*\([A-Za-z0-9]{2,5}\)\s*\d*.*$/, "") // Strip "(FRA) 273" or "(WOE) 234"
            .replace(/\s*\[.*?\]/g, "")           // Strip "[NEC - 93]"
            .split("|")[0]
            .trim();
    }

    // Read current table rows from Cards to Buy to compute live totals
    function scrapeDOMTargets() {
        const rows = document.querySelectorAll("table tbody tr, tr");
        const items = [];
        rows.forEach(tr => {
            const cells = tr.querySelectorAll("td");
            if (cells.length >= 4) {
                const name = cleanCardName(cells[0].dataset.cardName || cells[0].innerText);
                const reqText = cells[1].innerText.trim(); // e.g., "0 / 1" or "0 / 2"
                const priceText = cells[2].innerText.replace(/[^0-9.]/g, "");
                const parts = reqText.split("/").map(s => parseInt(s.trim(), 10));
                const acquired = !isNaN(parts[0]) ? parts[0] : 0;
                const required = !isNaN(parts[1]) ? parts[1] : 1;
                const unitPrice = parseFloat(priceText) || 0;
                if (name && unitPrice >= 0) {
                    items.push({ name, acquired, required, unitPrice, rowEl: tr });
                }
            }
        });
        return items;
    }

    // Inject Whatnot & Live Auction Snipe buttons into each row Actions cell
    function enhanceChaseActionButtons() {
        const items = scrapeDOMTargets();
        items.forEach(item => {
            const actionCell = item.rowEl.querySelector("td:last-child");
            if (actionCell && !actionCell.querySelector(".mp-whatnot-snipe")) {
                const snipeCeiling = (item.unitPrice * 0.85).toFixed(2);
                const q = encodeURIComponent("MTG " + item.name);
                
                const wnBtn = document.createElement("a");
                wnBtn.className = "mp-snipe-btn mp-whatnot-snipe";
                wnBtn.href = `https://www.whatnot.com/search?query=${q}&type=livestreams`;
                wnBtn.target = "_blank";
                wnBtn.title = `Search live Whatnot streams for ${item.name} under $${snipeCeiling}`;
                wnBtn.innerText = `⚡ Whatnot Live`;

                const ebAucBtn = actionCell.querySelector("button:last-child, a:last-child");
                if (ebAucBtn && ebAucBtn.innerText.includes("Auc")) {
                    ebAucBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        MPAffiliate.open(`https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Auction=1&_sop=1&_udhi=${snipeCeiling}`);
                    });
                }
                actionCell.appendChild(wnBtn);
            }
        });
    }

    // Render Saved Decks & Total Portfolio in Left Sidebar
    function renderSidebarPortfolio() {
        const listEl = document.getElementById("mp-saved-decks-list");
        const marketEl = document.getElementById("mp-total-market");
        const chaseEl = document.getElementById("mp-total-chase");
        if (!listEl || !marketEl || !chaseEl) return;

        const domTargets = scrapeDOMTargets();
        let domMarketSum = 0;
        let domChaseSum = 0;
        domTargets.forEach(t => {
            domMarketSum += t.unitPrice * t.required;
            const needed = Math.max(0, t.required - t.acquired);
            domChaseSum += t.unitPrice * needed;
        });

        chrome.storage.local.get(["savedChaseLists", "scryfallPriceCache"], (store) => {
            // Saved lists are stored as { [deckName]: { cards: [...] } } under savedChaseLists.
            const savedLists = (store.savedChaseLists && typeof store.savedChaseLists === "object") ? store.savedChaseLists : {};
            const priceCache = store.scryfallPriceCache || {};
            const deckTitleInput = document.getElementById("deck-name-input");
            const activeDeckName = (deckTitleInput && deckTitleInput.value.trim()) ? deckTitleInput.value.trim() : "Active Chase Sheet";

            let html = "";
            let grandMarket = domMarketSum;
            let grandChase = domChaseSum;
            let anyUnpriced = false;

            // Always show the active loaded sheet first
            html += `
                <div class="mp-deck-summary-item" title="Currently loaded in Buy List">
                    <div class="mp-deck-name">🟢 ${escapeHtml(activeDeckName)}</div>
                    <div class="mp-deck-metrics">
                        <span>Market: <strong class="mp-val-market">$${domMarketSum.toFixed(2)}</strong></span>
                        <span>Need: <strong class="mp-val-chase">$${domChaseSum.toFixed(2)}</strong></span>
                    </div>
                </div>
            `;

            Object.keys(savedLists).forEach(dName => {
                if (dName === activeDeckName) return;
                const cards = (savedLists[dName] && savedLists[dName].cards) || [];
                let dMkt = 0, dChase = 0, unpriced = 0;
                cards.forEach(c => {
                    const qty = c.quantity || c.required || 1;
                    const acq = c.acquired || 0;
                    const rec = priceCache[String(c.cardName || "").toLowerCase()];
                    const p = rec ? parseFloat(rec.usd) : NaN;
                    if (!isFinite(p) || p <= 0) { unpriced++; return; }
                    dMkt += p * qty;
                    dChase += p * Math.max(0, qty - acq);
                });
                if (unpriced) anyUnpriced = true;
                grandMarket += dMkt;
                grandChase += dChase;
                const approx = unpriced ? `<span title="${unpriced} card(s) have no price yet. Load this list to price them.">~</span>` : "";
                html += `
                    <div class="mp-deck-summary-item">
                        <div class="mp-deck-name">📑 ${escapeHtml(dName)}</div>
                        <div class="mp-deck-metrics">
                            <span>Market: <strong class="mp-val-market">${approx}$${dMkt.toFixed(2)}</strong></span>
                            <span>Need: <strong class="mp-val-chase">${approx}$${dChase.toFixed(2)}</strong></span>
                        </div>
                    </div>
                `;
            });

            // Only touch the DOM when something changed: the page-wide MutationObservers re-run this function
            // on every DOM change, so an unconditional rewrite here is an infinite loop.
            const marketTxt = `${anyUnpriced ? "~" : ""}$${grandMarket.toFixed(2)}`;
            const chaseTxt = `${anyUnpriced ? "~" : ""}$${grandChase.toFixed(2)}`;
            const sig = html + "|" + marketTxt + "|" + chaseTxt;
            if (listEl.dataset.mpSig === sig) return;
            listEl.dataset.mpSig = sig;
            listEl.innerHTML = html;
            marketEl.textContent = marketTxt;
            chaseEl.textContent = chaseTxt;
        });
    }

    // Position and Display Card Rollover Overlay safely inside Viewport
    const fallbackSvg = "data:image/svg+xml;utf8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="220" height="300" viewBox="0 0 220 300">
            <rect width="220" height="300" rx="12" fill="#0f172a" stroke="#334155" stroke-width="2"/>
            <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#38bdf8" font-family="sans-serif" font-size="14" font-weight="bold">MIRROR POOL™</text>
            <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="11">Custom / Unindexed Set</text>
        </svg>
    `);

    function showCardOverlay(cardName, priceVal, clientX, clientY) {
        const overlay = document.getElementById("mp-card-hover-overlay");
        const img = document.getElementById("mp-hover-card-img");
        const title = document.getElementById("mp-hover-card-title");
        const tcg = document.getElementById("mp-hover-tcg");
        const snipe = document.getElementById("mp-hover-snipe");
        if (!overlay || !cardName) return;

        const clean = cleanCardName(cardName);
        if (!clean || clean.length < 2) return;

        if (title.innerText !== clean) {
            title.innerText = clean;
            img.onerror = () => { img.src = fallbackSvg; };
            img.src = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(clean)}&format=image&version=normal`;
        }

        const numPrice = parseFloat(priceVal);
        const hasPrice = isFinite(numPrice) && numPrice > 0;
        tcg.innerText = hasPrice ? `$${numPrice.toFixed(2)}` : "—";
        snipe.innerText = hasPrice ? `< $${(numPrice * 0.85).toFixed(2)}` : "—";

        overlay.style.display = "block";
        const rect = overlay.getBoundingClientRect();
        const pad = 16;
        let left = clientX + pad;
        let top = clientY + pad;

        if (left + rect.width > window.innerWidth - 10) {
            left = clientX - rect.width - pad;
        }
        if (top + rect.height > window.innerHeight - 10) {
            top = Math.max(10, window.innerHeight - rect.height - 10);
        }
        overlay.style.left = `${left}px`;
        overlay.style.top = `${top}px`;
    }

    function hideCardOverlay() {
        const overlay = document.getElementById("mp-card-hover-overlay");
        if (overlay) overlay.style.display = "none";
    }

    // Event Delegation for Table Rows & Decklist Textarea
    document.addEventListener("mousemove", (e) => {
        // 1. Check if hovering over the first column (Card Target) in the Procurement table
        const td = e.target.closest("table tbody tr td:first-child, tr td:first-child");
        if (td) {
            const tr = td.parentElement;
            const cells = tr.querySelectorAll("td");
            const priceText = cells.length >= 3 ? cells[2].innerText.replace(/[^0-9.]/g, "") : "";
            showCardOverlay(td.dataset.cardName || td.innerText, priceText, e.clientX, e.clientY);
            return;
        }

        // 2. Check if hovering over a line inside the Deck Target textarea
        if (e.target.tagName === "TEXTAREA" && e.target.value.trim()) {
            const ta = e.target;
            const rect = ta.getBoundingClientRect();
            const relY = e.clientY - rect.top + ta.scrollTop - 8;
            const lineHeight = parseInt(window.getComputedStyle(ta).lineHeight, 10) || 18;
            const lineIndex = Math.floor(relY / lineHeight);
            const lines = ta.value.split("\n");
            if (lineIndex >= 0 && lineIndex < lines.length && lines[lineIndex].trim()) {
                const cName = cleanCardName(lines[lineIndex]);
                // Match price from table if present
                const domMatch = scrapeDOMTargets().find(t => t.name.toLowerCase() === cName.toLowerCase());
                const price = domMatch ? domMatch.unitPrice : "";
                showCardOverlay(cName, price, e.clientX, e.clientY);
                return;
            }
        }

        hideCardOverlay();
    });

    // Initialize and observe DOM mutations so newly scraped or compiled decks automatically update
    function initMirrorPoolEnhancements() {
        enhanceChaseActionButtons();
        renderSidebarPortfolio();
        let t1 = null;
        const observer = new MutationObserver(() => {
            clearTimeout(t1);
            t1 = setTimeout(() => {
                enhanceChaseActionButtons();
                renderSidebarPortfolio();
            }, 150);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initMirrorPoolEnhancements);
    } else {
        initMirrorPoolEnhancements();
    }
})();
// === MP_CHASE_PORTFOLIO_END ===

// === MP_ECOSYSTEM_UI_START ===
(function() {
    const scryfallMetaCache = {};

    function sanitizeCardTitle(raw) {
        if (!raw) return "";
        return raw
            .replace(/^\d+[xX]?\s+/, "")
            .replace(/\s*\([A-Za-z0-9]{2,5}\)\s*\d*.*$/, "")
            .replace(/\s*\[.*?\]/g, "")
            .split("|")[0]
            .trim();
    }

    function extractSetCode(raw) {
        if (!raw) return "MTG";
        const m = raw.match(/\(([A-Za-z0-9]{3,5})\)/);
        return m ? m[1].toUpperCase() : "STD";
    }

    function formatManaPips(manaCost) {
        if (!manaCost) return "";
        const symbols = manaCost.match(/\{([^}]+)\}/g) || [];
        return symbols.slice(0, 5).map(sym => {
            const code = sym.replace(/[{}]/g, "").toUpperCase();
            const colorClass = ["W","U","B","R","G"].includes(code) ? `mp-pip-${code}` : "mp-pip-C";
            return `<span class="mp-mana-pip ${colorClass}">${code}</span>`;
        }).join("");
    }

    // 1. Inject Top Ecosystem Ribbon (Scryfall Quick Search + Goldfish Price Mode Switcher)
    function ensureEcosystemRibbon() {
        if (document.getElementById("mp-ecosystem-ribbon")) return;
        const mainArea = document.querySelector(".main-content, main, body > div:nth-of-type(2)");
        if (!mainArea) return;

        const ribbon = document.createElement("div");
        ribbon.id = "mp-ecosystem-ribbon";
        ribbon.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="mp-omni-search-wrap">
                    <span style="color:#10b981; font-size:12px;">🔍</span>
                    <input type="text" id="mp-scryfall-omni" placeholder="Scryfall Instant Lookup (Press Enter to add to Chase)..." />
                </div>
                <span id="mp-omni-status" style="font-size:11px; color:#94a3b8;"></span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="mp-mode-pills" id="mp-deck-view-switcher" title="Switch Decklist Display Mode">
                    <button type="button" class="mp-mode-pill active" data-view="raw">📝 Text List</button>
                    <button type="button" class="mp-mode-pill" data-view="visual">🖼️ Visual Grid</button>
                </div>
                <div class="mp-mode-pills" id="mp-currency-switcher" title="MTGGoldfish Style Ecosystem Filter">
                    <button type="button" class="mp-mode-pill active" data-curr="all">Paper + MTGO</button>
                    <button type="button" class="mp-mode-pill" data-curr="snipe">⚡ Deals Under 85%</button>
                </div>
            </div>
        `;
        mainArea.prepend(ribbon);

        // Wire Scryfall Omni-Search to append directly to active Decklist Textarea
        const omniInput = document.getElementById("mp-scryfall-omni");
        const omniStatus = document.getElementById("mp-omni-status");
        omniInput.addEventListener("keydown", async (e) => {
            if (e.key === "Enter" && omniInput.value.trim()) {
                const query = omniInput.value.trim();
                omniStatus.innerText = "Querying Scryfall...";
                try {
                    const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(query)}`);
                    if (res.ok) {
                        const card = await res.json();
                        const setTag = (card.set || "MTG").toUpperCase();
                        const colNum = card.collector_number || "";
                        const price = (card.prices && card.prices.usd) ? `$${card.prices.usd}` : "N/A";
                        const ta = document.querySelector("textarea");
                        if (ta) {
                            const prefix = ta.value.trim() ? ta.value.trim() + "\n" : "";
                            ta.value = `${prefix}1 ${card.name} (${setTag}) ${colNum}`.trim();
                        }
                        omniStatus.innerHTML = `<span style="color:#10b981;">✔ Added ${card.name} (${price})</span>`;
                        omniInput.value = "";
                        renderVisualDeckGrid();
                    } else {
                        omniStatus.innerHTML = `<span style="color:#f59e0b;">Card not found on Scryfall</span>`;
                    }
                } catch (err) {
                    omniStatus.innerText = "Lookup error";
                }
            }
        });

        // Wire Visual Grid vs. Raw Textarea Switcher
        ribbon.querySelectorAll("#mp-deck-view-switcher .mp-mode-pill").forEach(btn => {
            btn.addEventListener("click", () => setDeckView(btn.getAttribute("data-view")));
        });
    }

    // Single place that flips between the pasteable Text List and the Visual Grid preview.
    function setDeckView(mode) {
        const ta = document.getElementById("decklist-input");
        const grid = ensureVisualDeckGrid();
        document.querySelectorAll("#mp-deck-view-switcher .mp-mode-pill").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-view") === mode);
        });
        if (!ta || !grid) return;
        if (mode === "visual") {
            ta.style.display = "none";
            grid.style.display = "grid";
            renderVisualDeckGrid();
        } else {
            ta.style.display = "block";
            grid.style.display = "none";
        }
    }

    // 2. Build Scryfall/Moxfield Visual Deck Grid right below the Textarea (Non-Destructive)
    function ensureVisualDeckGrid() {
        let grid = document.getElementById("mp-visual-deck-grid");
        if (!grid) {
            const ta = document.querySelector("textarea");
            if (!ta) return null;
            grid = document.createElement("div");
            grid.id = "mp-visual-deck-grid";
            ta.insertAdjacentElement("afterend", grid);
        }
        return grid;
    }

    function renderVisualDeckGrid() {
        const grid = ensureVisualDeckGrid();
        const ta = document.querySelector("textarea");
        if (!grid || !ta) return;

        const lines = ta.value.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1; color:#94a3b8; text-align:center; padding:20px; display:flex; flex-direction:column; align-items:center; gap:10px;">
                <div>Nothing to preview yet. Paste or scrape a decklist, then switch back here to see card art.</div>
                <button type="button" class="btn mp-empty-to-text">✏️ Paste a decklist (Text List)</button>
            </div>`;
            return;
        }

        grid.innerHTML = lines.map(line => {
            const qtyMatch = line.match(/^(\d+)[xX]?\s+/);
            const qty = qtyMatch ? qtyMatch[1] : "1";
            const clean = sanitizeCardTitle(line);
            const setCode = extractSetCode(line);
            const imgUrl = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(clean)}&format=image&version=normal`;
            const eBayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent("MTG " + clean)}&LH_Auction=1&_sop=1`;
            return `
                <div class="mp-visual-card-tile" data-card-name="${escapeHtml(clean)}" data-ebay-url="${escapeHtml(eBayUrl)}" title="Click to search live eBay Auctions for ${escapeHtml(clean)}">
                    <span class="mp-tile-qty-badge">${qty}x</span>
                    <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(clean)}" loading="lazy" />
                    <div class="mp-tile-price-ribbon">
                        <span style="font-weight:700; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:95px;">${escapeHtml(clean)}</span>
                        <span class="mp-set-badge">${escapeHtml(setCode)}</span>
                    </div>
                </div>
            `;
        }).join("");

        // MV3 pages block inline on* handlers, so wire these up here.
        grid.querySelectorAll("img").forEach(im => im.addEventListener("error", () => { im.style.opacity = "0.25"; }, { once: true }));
    }

    // "Paste a decklist" button inside the empty Visual Grid -> back to the Text List and focus it.
    document.addEventListener("click", (e) => {
        if (e.target.closest && e.target.closest(".mp-empty-to-text")) {
            setDeckView("raw");
            const ta = document.getElementById("decklist-input");
            if (ta) ta.focus();
        }
    });

    // Pasting a decklist anywhere on the Buy List tab (outside a text field) loads it into the Text List.
    document.addEventListener("paste", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        const panel = document.getElementById("tab-procurement");
        const ta = document.getElementById("decklist-input");
        if (!panel || !ta || !panel.classList.contains("active")) return;
        const text = (e.clipboardData && e.clipboardData.getData("text")) || "";
        if (!MPLists.parse(text).cards.length) return; // only things Scout can read as a card list
        e.preventDefault();
        setDeckView("raw");
        ta.value = ta.value.trim() ? ta.value.replace(/\s+$/, "") + "\n" + text.trim() : text.trim();
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.focus();
    });

    // Tile click -> live eBay auctions (delegated once).
    document.addEventListener("click", (e) => {
        const tile = e.target.closest && e.target.closest(".mp-visual-card-tile");
        if (tile && tile.dataset.ebayUrl) MPAffiliate.open(tile.dataset.ebayUrl);
    });

    // 3. Hydrate Cards to Buy Table Rows with Scryfall Art Crop, Set Badge & Mana Pips
    async function hydrateTableRowsWithScryfall() {
        const rows = document.querySelectorAll("table tbody tr, tr");
        for (const tr of rows) {
            const firstTd = tr.querySelector("td:first-child");
            if (!firstTd || firstTd.querySelector(".mp-card-cell-wrap")) continue;

            const rawName = firstTd.innerText.trim();
            const cleanName = sanitizeCardTitle(rawName);
            if (!cleanName || cleanName.length < 2) continue;
            firstTd.dataset.cardName = cleanName; // keep the real name; the cell text gains badges below
            const safeName = escapeHtml(cleanName);

            // Art, set and mana cost come from the same batched Scryfall response as the prices (window.mpPriceMap),
            // so there is no per-card request to rate-limit or to fail silently.
            const pm = window.mpPriceMap || {};
            const meta = pm[cleanName.toLowerCase()] || pm[cleanName.toLowerCase().split(" // ")[0]];
            const artUrl = (meta && meta.art) ? meta.art : `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cleanName)}&format=image&version=art_crop`;
            firstTd.innerHTML = `
                <div class="mp-card-cell-wrap">
                    <img class="mp-art-thumb" src="${escapeHtml(artUrl)}" alt="" loading="lazy" />
                    <div>
                        <div style="color:#10b981; font-weight:600; font-size:13px;">${safeName}</div>
                        <div class="mp-card-meta-sub" data-meta-for="${safeName}">
                            ${meta ? `<span class="mp-set-badge" title="${escapeHtml(meta.set_name || "")}">${escapeHtml(meta.set || "MTG")}</span>${formatManaPips(meta.mana || "")}` : `<span class="mp-set-badge">…</span>`}
                        </div>
                    </div>
                </div>
            `;
            const thumb = firstTd.querySelector(".mp-art-thumb");
            if (thumb) thumb.addEventListener("error", () => { thumb.style.display = "none"; }, { once: true });
        }
    }

    // 4. Upgrade Left Sidebar Saved Deck Cards with Completion Progress & Quick Snipe Links
    function upgradeSidebarDeckCards() {
        const items = document.querySelectorAll("#mp-saved-decks-list .mp-deck-summary-item");
        if (!items.length) return;

        // Calculate active completion ratio from table
        const rows = document.querySelectorAll("table tbody tr, tr");
        let totalReq = 0, totalAcq = 0;
        rows.forEach(tr => {
            const cells = tr.querySelectorAll("td");
            if (cells.length >= 2) {
                const parts = cells[1].innerText.split("/").map(s => parseInt(s.trim(), 10));
                if (!isNaN(parts[0]) && !isNaN(parts[1])) {
                    totalAcq += parts[0];
                    totalReq += parts[1];
                }
            }
        });
        const pct = totalReq > 0 ? Math.min(100, Math.round((totalAcq / totalReq) * 100)) : 0;

        items.forEach((card, idx) => {
            if (card.querySelector(".mp-deck-progress-track")) return;
            const deckTitle = card.querySelector(".mp-deck-name")?.innerText.replace(/^(?:🟢|📑)\s*/u, "").trim() || "MTG Deck";
            const ratioPct = idx === 0 ? pct : 0;

            const prog = document.createElement("div");
            prog.innerHTML = `
                <div class="mp-deck-progress-track" title="${totalAcq} / ${totalReq} Cards Acquired (${ratioPct}%)">
                    <div class="mp-deck-progress-fill" style="width:${ratioPct}%;"></div>
                </div>
                <div class="mp-deck-quick-snipe">
                    <a class="mp-mini-pill" href="https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent("MTG " + deckTitle + " lot")}&LH_Auction=1&_sop=1" target="_blank" title="Find live eBay auctions for this deck">🎯 eBay Auctions</a>
                    <a class="mp-mini-pill" href="https://www.whatnot.com/search?query=${encodeURIComponent("MTG " + deckTitle)}&type=livestreams" target="_blank" title="Search live Whatnot streams">⚡ Whatnot</a>
                    <a class="mp-mini-pill" href="https://www.tcgplayer.com/massentry" target="_blank" title="Open TCGplayer Mass Entry">🛒 TCG Mass Entry</a>
                </div>
            `;
            card.appendChild(prog);
        });
    }

    function bootEcosystemUI() {
        ensureEcosystemRibbon();
        hydrateTableRowsWithScryfall();
        upgradeSidebarDeckCards();

        let timer = null;
        const obs = new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                ensureEcosystemRibbon();
                hydrateTableRowsWithScryfall();
                upgradeSidebarDeckCards();
            }, 180);
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootEcosystemUI);
    } else {
        bootEcosystemUI();
    }
})();
// === MP_ECOSYSTEM_UI_END ===

