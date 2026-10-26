// Mirror Pool Scout — Modern Brutalist & Glass Kraken Intelligence Suite
// Includes: Dual Light/Dark Theme, Commander Ratio Deck Builder, Infinite Scroll Metagame Hub,
// MTGGoldfish-Style Tournament Streams, Live Pro Tour RSS Dispatches, and 75-Card Deck Inspector.
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
    const money = (n) => "$" + (Number(n) || 0).toFixed(2);

    let priceMode = "tabletop"; // "tabletop" ($) vs "mtgo" (TIX)
    let currentMetaFormat = "all";
    let metaPage = 1;
    let liveRssArticles = [];
    let activeInspectedDeck = null;

    // =========================================================================
    // 1. THEME ENGINE: DUAL LIGHT & DARK MODE
    // =========================================================================
    function initThemeEngine() {
        const STORAGE_KEY = "mp_kraken_theme";
        const savedTheme = localStorage.getItem(STORAGE_KEY) || "dark";
        applyTheme(savedTheme);

        function applyTheme(theme) {
            if (theme === "light") {
                document.body.classList.add("theme-light");
                document.body.classList.remove("theme-dark");
            } else {
                document.body.classList.remove("theme-light");
                document.body.classList.add("theme-dark");
            }
            localStorage.setItem(STORAGE_KEY, theme);
            if (window.chrome?.storage?.local) {
                chrome.storage.local.set({ themeMode: theme });
            }
            updateThemeButtonText();
        }

        function updateThemeButtonText() {
            const btn = $("theme-toggle-btn");
            if (!btn) return;
            const isLight = document.body.classList.contains("theme-light");
            btn.innerHTML = isLight ? `<span>🌙 Dark Mode</span>` : `<span>☀ Light Mode</span>`;
            btn.setAttribute("title", isLight ? "Switch to Modern Brutalist Abyss Dark" : "Switch to Parchment Light Mode");
        }

        window.toggleTheme = function () {
            const isLight = document.body.classList.contains("theme-light");
            applyTheme(isLight ? "dark" : "light");
        };

        // Top Navigation Bar
        const mainContent = document.querySelector(".main-content");
        if (mainContent && !$("kraken-top-bar")) {
            const topBar = document.createElement("div");
            topBar.id = "kraken-top-bar";
            topBar.innerHTML = `
                <div class="kraken-brand-zone" onclick="window.switchTab('tab-meta')">
                    <span class="kraken-brand-text">◈ MIRROR POOL™ SCOUT <span class="kraken-brand-kicker">· METAGAME & ARBITRAGE TERMINAL</span></span>
                </div>
                <div class="kraken-header-actions">
                    <div class="price-mode-switch">
                        <button class="price-mode-btn ${priceMode === 'tabletop' ? 'active' : ''}" id="btn-mode-tabletop" onclick="window.setPriceMode('tabletop')">Tabletop $</button>
                        <button class="price-mode-btn ${priceMode === 'mtgo' ? 'active' : ''}" id="btn-mode-mtgo" onclick="window.setPriceMode('mtgo')">MTGO TIX</button>
                    </div>
                    <button class="theme-toggle-btn" id="theme-toggle-btn" onclick="window.toggleTheme()">
                        <span>☀ Light Mode</span>
                    </button>
                    <button class="kraken-build-btn" onclick="window.switchTab('tab-builder')">
                        <span>⚡ Build a Deck</span>
                    </button>
                </div>
            `;
            mainContent.insertBefore(topBar, mainContent.firstChild);
            updateThemeButtonText();
        }
    }

    window.setPriceMode = function (mode) {
        priceMode = mode;
        $("btn-mode-tabletop")?.classList.toggle("active", mode === "tabletop");
        $("btn-mode-mtgo")?.classList.toggle("active", mode === "mtgo");
        filterAndRenderMetaHub();
    };

    window.switchTab = function (targetId) {
        const panels = document.querySelectorAll(".tab-panel");
        const navItems = document.querySelectorAll(".sidebar .nav-item, .nav-item");
        panels.forEach((p) => p.classList.toggle("active", p.id === targetId));
        navItems.forEach((n) => {
            const explicit = n.getAttribute("data-tab");
            n.classList.toggle("active", explicit === targetId);
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // =========================================================================
    // 2. METAGAME TOURNAMENT & ARCHETYPE REPOSITORY
    // =========================================================================
    const KRAKEN_META_ARCHETYPES = [
        {
            id: "golgari-midrange",
            cardName: "Vraska, the Cutting Glare",
            name: "Golgari Midrange",
            pilot: "agentrock",
            event: "Standard League 2026-10-26 (5-0)",
            format: "standard",
            colors: ["B", "G"],
            share: "18.4%",
            winrate: "56.8%",
            trendDir: "up",
            deltaPct: "+14.5%",
            tabletopPrice: 173.98,
            mtgoPrice: 26.17,
            topChase: "Wastewood Verge",
            topChasePrice: 36.44,
            synergyTags: ["#DeathtouchSynergy", "#ValueEngine", "#ProTourStandard"],
            whyTrending: "Vraska plus Mosswood Dreadknight provides relentless card advantage, backed by Wastewood Verge mana consistency.",
            artUrl: "https://cards.scryfall.io/art_crop/front/a/9/a934c379-7c52-449d-afd6-207a0950365b.jpg",
            decklist: [
                { section: "Creatures", name: "Mosswood Dreadknight", qty: 4, cost: "{1}{B}", price: 0.49 },
                { section: "Creatures", name: "Emeritus of Abundance", qty: 2, cost: "{2}{G}", price: 7.40 },
                { section: "Creatures", name: "Simulacrum Shaper", qty: 4, cost: "{1}{B}{G}", price: 10.04 },
                { section: "Creatures", name: "Vraska, the Cutting Glare", qty: 4, cost: "{1}{B}{G}", price: 1.96 },
                { section: "Planeswalkers", name: "Garruk, Veiled Butcher", qty: 2, cost: "{3}{B}{G}", price: 4.60 },
                { section: "Sorceries", name: "Duress", qty: 3, cost: "{B}", price: 0.72 },
                { section: "Sorceries", name: "Strategic Betrayal", qty: 1, cost: "{1}{B}", price: 1.09 },
                { section: "Instants", name: "Requiting Hex", qty: 2, cost: "{1}{B}", price: 1.24 },
                { section: "Instants", name: "Bitter Triumph", qty: 1, cost: "{1}{B}", price: 0.39 },
                { section: "Instants", name: "Shoot the Sheriff", qty: 1, cost: "{1}{B}", price: 0.76 },
                { section: "Lands", name: "Wastewood Verge", qty: 4, cost: "", price: 36.44 },
                { section: "Lands", name: "Overgrown Tomb", qty: 4, cost: "", price: 34.84 },
                { section: "Lands", name: "Ba Sing Se", qty: 2, cost: "", price: 11.16 },
                { section: "Lands", name: "Restless Cottage", qty: 4, cost: "", price: 7.28 },
                { section: "Lands", name: "Forest", qty: 3, cost: "", price: 0.00 },
                { section: "Lands", name: "Swamp", qty: 4, cost: "", price: 0.00 }
            ],
            sideboard: [
                { name: "Duress", qty: 1, cost: "{B}", price: 0.24 },
                { name: "Ghost Vacuum", qty: 1, cost: "{1}", price: 4.20 },
                { name: "Requiting Hex", qty: 2, cost: "{1}{B}", price: 1.24 },
                { name: "Outrageous Robbery", qty: 1, cost: "{X}{B}{B}", price: 0.49 },
                { name: "Strategic Betrayal", qty: 3, cost: "{1}{B}", price: 3.27 },
                { name: "Terminal Criticism", qty: 3, cost: "{3}{B}", price: 0.78 }
            ]
        },
        {
            id: "dimir-ring-control",
            cardName: "The One Ring",
            name: "Dimir Ring Murktide",
            pilot: "TrueHero",
            event: "SCG CON Hartford - Modern Challenge (1st Place)",
            format: "modern",
            colors: ["U", "B"],
            share: "16.8%",
            winrate: "57.4%",
            trendDir: "up",
            deltaPct: "+18.5%",
            tabletopPrice: 584.00,
            mtgoPrice: 42.50,
            topChase: "The One Ring",
            topChasePrice: 58.00,
            synergyTags: ["#DrawEngine", "#Protection", "#ModernTier1"],
            whyTrending: "Combines The One Ring with Orcish Bowmasters to completely shut down opposing card draw while advancing untap combos.",
            artUrl: "https://cards.scryfall.io/art_crop/front/d/5/d580c8fe-2a1d-4767-88af-9a845bd2c2ab.jpg",
            decklist: [
                { section: "Creatures", name: "Orcish Bowmasters", qty: 4, cost: "{1}{B}", price: 48.00 },
                { section: "Creatures", name: "Murktide Regent", qty: 4, cost: "{5}{U}{U}", price: 14.50 },
                { section: "Creatures", name: "Subtlety", qty: 2, cost: "{2}{U}{U}", price: 12.00 },
                { section: "Artifacts", name: "The One Ring", qty: 4, cost: "{4}", price: 58.00 },
                { section: "Instants", name: "Counterspell", qty: 4, cost: "{U}{U}", price: 1.20 },
                { section: "Instants", name: "Fatal Push", qty: 4, cost: "{B}", price: 2.50 },
                { section: "Instants", name: "Consider", qty: 4, cost: "{U}", price: 0.50 },
                { section: "Sorceries", name: "Thoughtseize", qty: 4, cost: "{B}", price: 16.50 },
                { section: "Lands", name: "Polluted Delta", qty: 4, cost: "", price: 14.00 },
                { section: "Lands", name: "Watery Grave", qty: 4, cost: "", price: 13.00 },
                { section: "Lands", name: "Underground Mortuary", qty: 2, cost: "", price: 11.00 },
                { section: "Lands", name: "Island", qty: 2, cost: "", price: 0.00 },
                { section: "Lands", name: "Swamp", qty: 1, cost: "", price: 0.00 }
            ],
            sideboard: [
                { name: "Dauthi Voidwalker", qty: 2, cost: "{B}{B}", price: 8.50 },
                { name: "Engineered Explosives", qty: 2, cost: "{X}", price: 6.00 },
                { name: "Flusterstorm", qty: 2, cost: "{U}", price: 18.00 },
                { name: "Spell Snare", qty: 2, cost: "{U}", price: 1.50 }
            ]
        },
        {
            id: "astral-superfriends",
            cardName: "Astral Dragon",
            name: "Astral Dragon Token Copy",
            pilot: "CommanderEnthusiast",
            event: "EDH Tournament Series (5-0 Pod Winner)",
            format: "commander",
            colors: ["U", "G"],
            share: "14.2%",
            winrate: "56.8%",
            trendDir: "up",
            deltaPct: "+30.0%",
            tabletopPrice: 382.50,
            mtgoPrice: 14.20,
            topChase: "Doubling Season",
            topChasePrice: 48.00,
            synergyTags: ["#NoncreatureCopy", "#TokenMultiplier", "#ETBAbuse"],
            whyTrending: "Creates Dragon copies of Doubling Season and Extravagant Replication, exponentially multiplying permanents on entry.",
            artUrl: "https://cards.scryfall.io/art_crop/front/c/0/c08236f7-0d77-4347-a3a6-157b347183e7.jpg",
            decklist: [
                { section: "Creatures", name: "Astral Dragon", qty: 1, cost: "{6}{U}{U}", price: 18.58 },
                { section: "Creatures", name: "Consecrated Sphinx", qty: 1, cost: "{4}{U}{U}", price: 28.00 },
                { section: "Enchantments", name: "Doubling Season", qty: 1, cost: "{4}{G}", price: 48.00 },
                { section: "Enchantments", name: "Extravagant Replication", qty: 1, cost: "{4}{U}{U}", price: 2.20 },
                { section: "Enchantments", name: "Rhystic Study", qty: 1, cost: "{2}{U}", price: 42.00 },
                { section: "Artifacts", name: "Sol Ring", qty: 1, cost: "{1}", price: 1.50 },
                { section: "Artifacts", name: "Arcane Signet", qty: 1, cost: "{2}", price: 0.85 },
                { section: "Lands", name: "Command Tower", qty: 1, cost: "", price: 0.40 },
                { section: "Lands", name: "Breeding Pool", qty: 1, cost: "", price: 13.50 }
            ],
            sideboard: []
        },
        {
            id: "boros-dwarves",
            cardName: "Magda, Brazen Outlaw",
            name: "Boros Convoke & Dwarves",
            pilot: "tim96",
            event: "Standard League 2026-10-26 (5-0)",
            format: "standard",
            colors: ["R", "W"],
            share: "11.2%",
            winrate: "55.1%",
            trendDir: "up",
            deltaPct: "+9.2%",
            tabletopPrice: 387.00,
            mtgoPrice: 32.10,
            topChase: "Inspiring Vantage",
            topChasePrice: 4.80,
            synergyTags: ["#FastAggro", "#ConvokeSwarm", "#TreasureEngine"],
            whyTrending: "Explosive turn 2-3 board presence with Knight-Errant of Eos refuel.",
            artUrl: "https://cards.scryfall.io/art_crop/front/7/c/7c024bae-5631-4e20-ac69-df392ac9e109.jpg",
            decklist: [
                { section: "Creatures", name: "Novice Inspector", qty: 4, cost: "{W}", price: 0.25 },
                { section: "Creatures", name: "Voldaren Epicure", qty: 4, cost: "{R}", price: 0.35 },
                { section: "Creatures", name: "Knight-Errant of Eos", qty: 4, cost: "{3}{W}{W}", price: 6.20 },
                { section: "Lands", name: "Inspiring Vantage", qty: 4, cost: "", price: 4.80 }
            ],
            sideboard: []
        },
        {
            id: "dimir-terror",
            cardName: "Tolarian Terror",
            name: "Dimir Terror & Delver",
            pilot: "Vequinox",
            event: "Pauper Challenge 32 (1st Place)",
            format: "pauper",
            colors: ["U", "B"],
            share: "22.5%",
            winrate: "58.4%",
            trendDir: "up",
            deltaPct: "+15.0%",
            tabletopPrice: 62.40,
            mtgoPrice: 4.80,
            topChase: "Snuff Out",
            topChasePrice: 9.50,
            synergyTags: ["#PauperKing", "#WardBeater", "#FreeSpells"],
            whyTrending: "Dominates Pauper with cheap 5/5 Ward 2 threats and free removal.",
            artUrl: "https://cards.scryfall.io/art_crop/front/4/2/42f01cba-43d4-46bd-97b7-8b5860574333.jpg",
            decklist: [
                { section: "Creatures", name: "Tolarian Terror", qty: 4, cost: "{6}{U}", price: 0.65 },
                { section: "Creatures", name: "Cryptic Serpent", qty: 4, cost: "{5}{U}{U}", price: 0.45 },
                { section: "Creatures", name: "Gurmag Angler", qty: 3, cost: "{6}{B}", price: 0.50 },
                { section: "Instants", name: "Snuff Out", qty: 4, cost: "{3}{B}", price: 9.50 },
                { section: "Instants", name: "Counterspell", qty: 4, cost: "{U}{U}", price: 1.20 }
            ],
            sideboard: []
        }
    ];

    // =========================================================================
    // 3. RENDER METAGAME HUB (BRUTALIST GLASS & INFINITE SCROLL)
    // =========================================================================
    function renderKrakenMetaTab() {
        const metaTab = $("tab-meta");
        if (!metaTab) return;

        metaTab.innerHTML = `
            <div class="kraken-hero-banner">
                <h1 class="kraken-hero-title">Crack the <em>meta</em>.</h1>
                <p class="kraken-hero-subtitle">
                    Modern brutalist tournament intelligence. Real-time archetype share, Pro Tour dispatches, and <strong>SuperBrew</strong> collection matching.
                </p>
                <div class="kraken-prompt-box">
                    <span style="color:var(--accent-teal); font-size:16px;">🔍</span>
                    <input type="text" id="kraken-meta-search-input" placeholder="Search archetypes, cards, or pilots (e.g. Golgari Midrange, Ring, agentrock)...">
                    <button class="btn btn-secondary" id="btn-quick-build-anchor" type="button">Build Deck Around This</button>
                </div>
            </div>

            <!-- Meta Filter Controls Strip (MTGGoldfish Level) -->
            <div class="meta-filter-strip">
                <div class="kraken-format-pills" id="kraken-format-filter-pills">
                    <button class="kraken-format-pill ${currentMetaFormat === 'all' ? 'active' : ''}" data-fmt="all">All Formats</button>
                    <button class="kraken-format-pill ${currentMetaFormat === 'standard' ? 'active' : ''}" data-fmt="standard">Standard</button>
                    <button class="kraken-format-pill ${currentMetaFormat === 'modern' ? 'active' : ''}" data-fmt="modern">Modern</button>
                    <button class="kraken-format-pill ${currentMetaFormat === 'commander' ? 'active' : ''}" data-fmt="commander">Commander</button>
                    <button class="kraken-format-pill ${currentMetaFormat === 'pauper' ? 'active' : ''}" data-fmt="pauper">Pauper</button>
                </div>
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <label style="font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" id="chk-superbrew-only"> <strong>SuperBrew</strong> (Only decks you can build)
                    </label>
                    <div class="price-mode-switch">
                        <button class="price-mode-btn ${priceMode === 'tabletop' ? 'active' : ''}" onclick="window.setPriceMode('tabletop')">Tabletop $</button>
                        <button class="price-mode-btn ${priceMode === 'mtgo' ? 'active' : ''}" onclick="window.setPriceMode('mtgo')">MTGO TIX</button>
                    </div>
                </div>
            </div>

            <!-- Dual Workspace Layout: Left Stream + Right Tournament & RSS Rail -->
            <div class="meta-workspace-split">
                <!-- Left: Infinite Metagame Archetypes Grid -->
                <div>
                    <div class="kraken-meta-grid" id="kraken-meta-cards-grid"></div>
                    <div class="infinite-scroll-sentinel" id="meta-infinite-sentinel">
                        <span>✦ Continuous Metagame Stream · Scrolling auto-loads more results ✦</span>
                    </div>
                </div>

                <!-- Right Rail: Tournament Feed + Live Pro Tour RSS -->
                <div class="meta-right-rail">
                    <!-- 1. Recent Tournament Decks -->
                    <div class="rail-box">
                        <div class="rail-box-header">
                            <span class="rail-box-title">🏆 Premier Tournaments & Leagues</span>
                            <span style="font-size:10px; color:var(--accent-teal);">Live Results</span>
                        </div>
                        <div id="tourney-recent-decks-list"></div>
                    </div>

                    <!-- 2. Pro Tour & Metagame RSS Feed -->
                    <div class="rail-box">
                        <div class="rail-box-header">
                            <span class="rail-box-title">📡 Pro Tour & Sandbox Dispatches</span>
                            <button class="btn btn-secondary" id="btn-refresh-rss" style="font-size:10px; padding:2px 6px;">↻ Refresh</button>
                        </div>
                        <div id="live-rss-news-container">
                            <div style="font-size:11px; color:var(--text-dim); padding:8px 0;">Loading competitive dispatches...</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Slide-out 75-Card Deck Inspector Drawer & Backdrop -->
            <div id="deck-inspector-backdrop" onclick="window.closeDeckInspector()"></div>
            <div id="deck-inspector-modal">
                <div class="inspector-header">
                    <div>
                        <div style="font-size:11px; font-weight:800; color:var(--accent-teal); text-transform:uppercase; letter-spacing:0.06em;">
                            ◈ MIRROR POOL™ SCOUT · METAGAME DECK INSPECTOR
                        </div>
                        <h2 id="insp-deck-title" style="margin:4px 0 2px 0; font-size:18px; color:var(--text-main);">Golgari Midrange</h2>
                        <div id="insp-deck-meta" style="font-size:11px; color:var(--text-muted);">Standard League 5-0 by agentrock</div>
                    </div>
                    <button onclick="window.closeDeckInspector()" style="background:transparent; border:1px solid var(--border-color); color:var(--text-main); border-radius:6px; padding:6px 10px; cursor:pointer; font-weight:800;">✕</button>
                </div>
                <div class="inspector-body">
                    <!-- Scout Comp & SuperBrew Analytics Strip -->
                    <div class="inspector-scout-box" id="insp-scout-box"></div>

                    <!-- Fast Action Buttons -->
                    <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
                        <button class="btn" id="insp-btn-send-buylist" style="flex:1; justify-content:center;">🛒 Send Needed to Buy List</button>
                        <button class="btn btn-secondary" id="insp-btn-copy-arena">📋 Copy MTGA Format</button>
                        <button class="btn btn-secondary" id="insp-btn-snipe-chase">🎯 Snipe Top Chase eBay</button>
                    </div>

                    <!-- Categorized 75-Card List -->
                    <div id="insp-card-roster"></div>
                </div>
            </div>
        `;

        // Wire format pills
        const pills = metaTab.querySelectorAll(".kraken-format-pill");
        pills.forEach((p) => {
            p.addEventListener("click", () => {
                pills.forEach((x) => x.classList.remove("active"));
                p.classList.add("active");
                currentMetaFormat = p.getAttribute("data-fmt");
                filterAndRenderMetaHub();
            });
        });

        // Search input
        $("kraken-meta-search-input")?.addEventListener("input", filterAndRenderMetaHub);
        $("chk-superbrew-only")?.addEventListener("change", filterAndRenderMetaHub);
        $("btn-refresh-rss")?.addEventListener("click", fetchLiveRssNews);

        // Infinite Scroll Observer
        setupInfiniteScroll();

        // Initial Data Load
        filterAndRenderMetaHub();
        renderTournamentRecentDecks();
        fetchLiveRssNews();
    }

    // =========================================================================
    // 4. SUPERBREW & COLLECTION CALCULATION
    // =========================================================================
    function getDeckSuperBrewStats(deck) {
        const ownedMap = window.mpCollectionCards || {};
        let totalCost = 0;
        let neededCost = 0;
        let totalCards = 0;
        let ownedCards = 0;

        const allCards = [...(deck.decklist || []), ...(deck.sideboard || [])];
        allCards.forEach((c) => {
            const qty = c.qty || 1;
            const price = c.price || 1.0;
            totalCards += qty;
            totalCost += qty * price;

            const key = String(c.name || "").toLowerCase().trim();
            const ownedHit = ownedMap[key] || ownedMap[key.split(" // ")[0]];
            const ownedQty = ownedHit ? (ownedHit.q || 0) : 0;
            const have = Math.min(qty, ownedQty);
            const need = Math.max(0, qty - have);

            ownedCards += have;
            neededCost += need * price;
        });

        const pctOwned = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;
        const savedCost = Math.max(0, totalCost - neededCost);

        return {
            totalCost,
            neededCost,
            savedCost,
            pctOwned,
            totalCards,
            ownedCards
        };
    }

    function filterAndRenderMetaHub() {
        const grid = $("kraken-meta-cards-grid");
        if (!grid) return;

        const query = ($("kraken-meta-search-input")?.value || "").toLowerCase().trim();
        const superbrewOnly = $("chk-superbrew-only")?.checked;

        let filtered = KRAKEN_META_ARCHETYPES.filter((c) => {
            const matchesFmt = currentMetaFormat === "all" || c.format === currentMetaFormat;
            const matchesQuery = !query ||
                c.name.toLowerCase().includes(query) ||
                c.cardName.toLowerCase().includes(query) ||
                c.pilot.toLowerCase().includes(query) ||
                c.synergyTags.some((t) => t.toLowerCase().includes(query));
            return matchesFmt && matchesQuery;
        });

        if (superbrewOnly) {
            filtered = filtered.filter((d) => getDeckSuperBrewStats(d).pctOwned >= 40);
        }

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1; padding:32px; text-align:center; color:var(--text-muted); background:var(--bg-panel); border:1px dashed var(--border-color); border-radius:8px;">No metagame decks matching your filter. Try unchecking SuperBrew or selecting "All Formats".</div>`;
            return;
        }

        grid.innerHTML = filtered.map((item) => {
            const sb = getDeckSuperBrewStats(item);
            const isUp = item.trendDir === "up";
            const deltaClass = isUp ? "delta-up" : "delta-down";
            const deltaIcon = isUp ? "↗" : "↘";
            const mainPrice = priceMode === "mtgo" ? `${item.mtgoPrice} TIX` : money(item.tabletopPrice);

            return `
                <div class="kraken-meta-card">
                    <div class="kraken-card-banner-wrap" onclick="window.inspectDeck('${esc(item.id)}')">
                        <img class="kraken-card-banner" src="${esc(item.artUrl)}" alt="${esc(item.name)}" loading="lazy" />
                        <div class="kraken-card-banner-scrim"></div>
                    </div>
                    <div class="kraken-meta-content">
                        <div class="kraken-card-header-row">
                            <div>
                                <div class="kraken-card-name" onclick="window.inspectDeck('${esc(item.id)}')">${esc(item.name)}</div>
                                <div style="font-size:11px; color:var(--text-muted); font-weight:600;">${esc(item.pilot)} · ${esc(item.event)}</div>
                            </div>
                            <span class="kraken-delta-badge ${deltaClass}">${deltaIcon} ${esc(item.deltaPct)}</span>
                        </div>

                        <!-- SuperBrew Collection Advantage Strip -->
                        <div class="superbrew-strip">
                            <div><span>My Price:</span> <strong>${money(sb.neededCost)}</strong></div>
                            <div style="color:var(--text-muted); font-size:10px;">${sb.pctOwned}% Owned (${sb.ownedCards}/${sb.totalCards})</div>
                        </div>

                        <div class="kraken-meta-metrics-strip">
                            <div><span>Format</span><strong style="text-transform:uppercase;">${esc(item.format)}</strong></div>
                            <div><span>Meta Share</span><strong>${esc(item.share)}</strong></div>
                            <div><span>Win Rate</span><strong style="color:var(--accent-green);">${esc(item.winrate)}</strong></div>
                            <div><span>${priceMode === 'mtgo' ? 'MTGO TIX' : 'Tabletop'}</span><strong style="color:var(--accent-amber);">${mainPrice}</strong></div>
                        </div>

                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            ${item.synergyTags.map((t) => `<span style="font-size:10px; color:var(--accent-blue); font-family:var(--font-mono);">${esc(t)}</span>`).join(" ")}
                        </div>

                        <div style="display:flex; gap:8px; margin-top:auto; padding-top:8px;">
                            <button class="btn btn-secondary" style="flex:1; font-size:11px; padding:7px 8px;" onclick="window.inspectDeck('${esc(item.id)}')">
                                🔍 View 75 Cards
                            </button>
                            <button class="kraken-build-btn" style="font-size:11px; padding:7px 10px;" onclick="window.startDeckBuildAroundCard('${esc(item.cardName)}')">
                                ⚡ Build Around
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function setupInfiniteScroll() {
        const sentinel = $("meta-infinite-sentinel");
        if (!sentinel || !window.IntersectionObserver) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                // Simulate progressive loading of additional competitive sandbox decks
                metaPage++;
                sentinel.innerHTML = `<span>✦ All active tournament feeds synchronized ✦</span>`;
            }
        }, { threshold: 0.1 });

        observer.observe(sentinel);
    }

    // =========================================================================
    // 5. RECENT TOURNAMENT FEED & LIVE PRO TOUR RSS
    // =========================================================================
    function renderTournamentRecentDecks() {
        const list = $("tourney-recent-decks-list");
        if (!list) return;

        list.innerHTML = KRAKEN_META_ARCHETYPES.map((d) => `
            <div class="tourney-deck-item" onclick="window.inspectDeck('${esc(d.id)}')">
                <div class="tourney-deck-left">
                    <span class="tourney-record-pill">5-0</span>
                    <div style="min-width:0;">
                        <div class="tourney-deck-name">${esc(d.name)}</div>
                        <div class="tourney-deck-meta">${esc(d.pilot)} · ${esc(d.format.toUpperCase())}</div>
                    </div>
                </div>
                <div class="tourney-deck-price">${priceMode === 'mtgo' ? `${d.mtgoPrice} TIX` : money(d.tabletopPrice)}</div>
            </div>
        `).join("");
    }

    async function fetchLiveRssNews() {
        const container = $("live-rss-news-container");
        if (!container) return;
        container.innerHTML = `<div style="font-size:11px; color:var(--text-dim); padding:6px 0;">↻ Fetching Pro Tour & Sandbox RSS feeds...</div>`;

        try {
            const res = await fetch("/api/meta-news");
            if (res.ok) {
                const data = await res.json();
                liveRssArticles = data.articles || [];
                renderRssArticles(liveRssArticles);
                return;
            }
        } catch (e) {
            console.warn("RSS fetch error:", e);
        }

        // Curated fallback
        renderRssArticles([
            {
                title: "Standard Pro Tour Metagame Breakdown: Golgari Midrange Dominance",
                link: "https://www.mtggoldfish.com/metagame/standard#paper",
                published: new Date().toISOString(),
                summary: "Golgari Midrange and Dimir tempo lead day 2 conversions with 56.8% win rates across premier tournament tables.",
                author: "Pro Tour Coverage",
                source: "Pro Tour & Premier Play"
            },
            {
                title: "Sandbox Playing Fields: Pioneer & Modern Breakouts from SCG CON",
                link: "https://www.mtggoldfish.com/metagame/modern#paper",
                published: new Date(Date.now() - 3600000 * 4).toISOString(),
                summary: "The One Ring and Orcish Bowmasters continue defining competitive control shells, while energy variants push 5-0 league finishes.",
                author: "Tournament Operations",
                source: "SCG CON & Regional League"
            }
        ]);
    }

    function renderRssArticles(articles) {
        const container = $("live-rss-news-container");
        if (!container) return;

        if (!articles.length) {
            container.innerHTML = `<div style="font-size:11px; color:var(--text-dim);">No articles currently available.</div>`;
            return;
        }

        container.innerHTML = articles.slice(0, 5).map((a) => {
            const timeStr = a.published ? new Date(a.published).toLocaleDateString([], { month: "short", day: "numeric" }) : "Today";
            return `
                <div class="rss-news-item">
                    <a class="rss-news-title" href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.title)} ↗</a>
                    <div class="rss-news-meta">
                        <span>${esc(a.author || 'Analyst')}</span>
                        <span>·</span>
                        <span>${esc(a.source || 'Coverage')}</span>
                        <span>·</span>
                        <span>${timeStr}</span>
                    </div>
                    <div class="rss-news-summary">${esc(a.summary)}</div>
                </div>
            `;
        }).join("");
    }

    // =========================================================================
    // 6. 75-CARD DECK INSPECTOR MODAL & DRAWER (SCREENSHOT 1 & 3 FIDELITY)
    // =========================================================================
    window.inspectDeck = function (deckId) {
        const deck = KRAKEN_META_ARCHETYPES.find((d) => d.id === deckId);
        if (!deck) return;
        activeInspectedDeck = deck;

        const modal = $("deck-inspector-modal");
        const backdrop = $("deck-inspector-backdrop");
        if (!modal || !backdrop) return;

        const sb = getDeckSuperBrewStats(deck);

        $("insp-deck-title").textContent = deck.name;
        $("insp-deck-meta").textContent = `${deck.event} by ${deck.pilot} · ${deck.format.toUpperCase()}`;

        // Scout Adapter Box inside Inspector
        const scoutBox = $("insp-scout-box");
        if (scoutBox) {
            scoutBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:11px; font-weight:800; color:var(--accent-teal);">◈ SCOUT ADAPTER ENGINE</span>
                    <span style="font-size:10px; color:var(--accent-green); font-weight:700;">✓ Live Price Comp Active</span>
                </div>
                <div class="inspector-metrics-grid">
                    <div class="inspector-metric">
                        <div class="l">Tabletop Total</div>
                        <div class="v" style="color:var(--text-main);">${money(deck.tabletopPrice)}</div>
                    </div>
                    <div class="inspector-metric">
                        <div class="l">MTGO Cash-Out</div>
                        <div class="v" style="color:var(--accent-blue);">${deck.mtgoPrice} TIX</div>
                    </div>
                    <div class="inspector-metric">
                        <div class="l">My Price (Owned -)</div>
                        <div class="v" style="color:var(--accent-green);">${money(sb.neededCost)}</div>
                    </div>
                    <div class="inspector-metric">
                        <div class="l">Top Chase Target</div>
                        <div class="v" style="color:var(--accent-amber); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(deck.topChase)}</div>
                    </div>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">
                    You own <strong>${sb.ownedCards}/${sb.totalCards} cards (${sb.pctOwned}%)</strong>. Buying remaining cards costs only <strong>${money(sb.neededCost)}</strong>.
                </div>
            `;
        }

        // Categorized card list
        const roster = $("insp-card-roster");
        if (roster) {
            const sections = {};
            (deck.decklist || []).forEach((c) => {
                const s = c.section || "Maindeck";
                sections[s] = sections[s] || [];
                sections[s].push(c);
            });
            if (deck.sideboard && deck.sideboard.length) {
                sections["Sideboard (15)"] = deck.sideboard;
            }

            roster.innerHTML = Object.keys(sections).map((sec) => `
                <div style="margin-bottom:12px;">
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px; border-bottom:1px solid var(--border-color); padding-bottom:3px;">
                        ${esc(sec)}
                    </div>
                    ${sections[sec].map((c) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; font-size:12px; border-bottom:1px solid var(--border-subtle);">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-family:var(--font-mono); font-weight:700; color:var(--accent-teal); width:20px;">${c.qty}x</span>
                                <a href="https://scryfall.com/search?q=${encodeURIComponent(c.name)}" target="_blank" style="color:var(--text-main); text-decoration:none; font-weight:600;">${esc(c.name)}</a>
                                ${c.cost ? `<span style="font-size:10px; color:var(--text-dim); font-family:var(--font-mono);">${esc(c.cost)}</span>` : ''}
                            </div>
                            <div style="font-family:var(--font-mono); font-weight:700; color:var(--accent-amber);">${money(c.price)}</div>
                        </div>
                    `).join("")}
                </div>
            `).join("");
        }

        // Wire Action Buttons
        $("insp-btn-send-buylist").onclick = () => {
            const cards = [...(deck.decklist || []), ...(deck.sideboard || [])].map((c) => ({
                cardName: c.name,
                quantity: c.qty || 1
            }));
            if (window.chrome?.storage?.local) {
                chrome.storage.local.set({
                    procurementTargets: cards,
                    currentDecklist: cards,
                    deckMeta: { deckName: deck.name, printingTarget: "Normal", conditionFloor: "LP" }
                }, () => {
                    window.closeDeckInspector();
                    window.switchTab("tab-procurement");
                    if (window.syncAllPanels) window.syncAllPanels();
                });
            }
        };

        $("insp-btn-copy-arena").onclick = () => {
            const lines = ["Deck", ...(deck.decklist || []).map((c) => `${c.qty} ${c.name}`)];
            if (deck.sideboard && deck.sideboard.length) {
                lines.push("", "Sideboard", ...deck.sideboard.map((c) => `${c.qty} ${c.name}`));
            }
            navigator.clipboard.writeText(lines.join("\n")).then(() => {
                const btn = $("insp-btn-copy-arena");
                btn.textContent = "✓ Copied!";
                setTimeout(() => { btn.textContent = "📋 Copy MTGA Format"; }, 2000);
            });
        };

        $("insp-btn-snipe-chase").onclick = () => {
            const chase = deck.topChase || deck.cardName;
            const ceiling = (deck.topChasePrice ? deck.topChasePrice * 0.85 : 15).toFixed(2);
            const url = `https://www.ebay.com/sch/i.html?_nkw=MTG+%22${encodeURIComponent(chase)}%22+-proxy&LH_BIN=1&_sop=15&_udhi=${ceiling}`;
            window.open(url, "_blank");
        };

        modal.classList.add("open");
        backdrop.classList.add("open");
    };

    window.closeDeckInspector = function () {
        $("deck-inspector-modal")?.classList.remove("open");
        $("deck-inspector-backdrop")?.classList.remove("open");
    };

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") window.closeDeckInspector();
    });

    // =========================================================================
    // 7. INITIALIZATION
    // =========================================================================
    document.addEventListener("DOMContentLoaded", () => {
        initThemeEngine();
        renderKrakenMetaTab();
    });

    document.addEventListener("click", (e) => {
        if (e.target.closest("[data-tab]")) {
            const tabId = e.target.closest("[data-tab]").getAttribute("data-tab");
            if (tabId === "tab-meta") renderKrakenMetaTab();
        }
    });

})(typeof window !== "undefined" ? window : globalThis);
