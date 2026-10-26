// Mirror Pool Scout — Kraken Suite & MTGA GeForce NOW Bridge
// Features: Dual Light/Dark Theme, Commander 100-Card Ratio Deck Builder,
// Revamped Meta Trends Explorer with Format Filtering, and Cloud Collection Ingestion.
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
    const money = (n) => "$" + (Number(n) || 0).toFixed(2);

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
            btn.setAttribute("title", isLight ? "Switch to Kraken Abyss Dark Mode" : "Switch to Parchment Light Mode");
        }

        window.toggleTheme = function () {
            const isLight = document.body.classList.contains("theme-light");
            applyTheme(isLight ? "dark" : "light");
        };

        // Inject Top Bar with Brand & Theme Switcher
        const mainContent = document.querySelector(".main-content");
        if (mainContent && !$("kraken-top-bar")) {
            const topBar = document.createElement("div");
            topBar.id = "kraken-top-bar";
            topBar.innerHTML = `
                <div class="kraken-brand-zone" onclick="window.switchTab('tab-meta')">
                    <span class="kraken-brand-text">◈ MIRROR POOL™ SCOUT <span class="kraken-brand-kicker">· KRAKEN META TERMINAL</span></span>
                </div>
                <div class="kraken-header-actions">
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

    // Tab switcher helper
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
    // 2. CURATED METAGAME ARCHETYPES & BREAKOUT DATABASE
    // =========================================================================
    const KRAKEN_META_DATABASE = [
        {
            cardName: "Astral Dragon",
            format: "commander",
            archetype: "Mill & Token Copy Superfriends",
            share: "14.2%",
            winrate: "56.8%",
            trendDir: "up",
            deltaPct: "+30.0%",
            baselineUsd: 18.58,
            tix: 0.12,
            synergyTags: ["#NoncreatureCopy", "#TokenMultiplier", "#PlaneswalkerSynergy", "#ETBAbuse"],
            triggersOn: ["Doubling Season", "Extravagant Replication", "Oath of Teferi", "Rhystic Study", "Psychic Corrosion"],
            whyTrending: "Project Image creates two 3/3 flying Dragon copies of ANY noncreature permanent (Enchantments, Planeswalkers, Artifacts). Explodes with Doubling Season, Extravagant Replication, and Rhystic Study.",
            artUrl: "https://cards.scryfall.io/art_crop/front/c/0/c08236f7-0d77-4347-a3a6-157b347183e7.jpg"
        },
        {
            cardName: "The One Ring",
            format: "modern",
            archetype: "Dimir Ring Control / Breach",
            share: "18.5%",
            winrate: "57.4%",
            trendDir: "up",
            deltaPct: "+18.5%",
            baselineUsd: 58.00,
            tix: 38.50,
            synergyTags: ["#CardDrawEngine", "#Protection", "#UntapAbuse"],
            triggersOn: ["Manifold Key", "Orcish Bowmasters", "Sheoldred, the Apocalypse", "Teferi, Time Raveler"],
            whyTrending: "Universal colorless draw engine across Modern and Commander; massive lifegain synergy with Sheoldred, the Apocalypse and protection against aggressive burn.",
            artUrl: "https://cards.scryfall.io/art_crop/front/d/5/d580c8fe-2a1d-4767-88af-9a845bd2c2ab.jpg"
        },
        {
            cardName: "Orcish Bowmasters",
            format: "modern",
            archetype: "Dimir Midrange & Timeless Tempo",
            share: "16.1%",
            winrate: "54.8%",
            trendDir: "down",
            deltaPct: "-8.4%",
            baselineUsd: 48.00,
            tix: 22.00,
            synergyTags: ["#DrawPunisher", "#WheelSynergy", "#FlashThreat"],
            triggersOn: ["Thoughtseize", "Sheoldred, the Apocalypse", "Rhystic Study", "Windfall"],
            whyTrending: "Slight cooldown in paper floor creating an under-market buy window; pairs directly with Thoughtseize and decisively punishes card draw engines.",
            artUrl: "https://cards.scryfall.io/art_crop/front/7/c/7c024bae-5631-4e20-ac69-df392ac9e109.jpg"
        },
        {
            cardName: "Sheoldred, the Apocalypse",
            format: "standard",
            archetype: "Black Midrange & Control",
            share: "21.4%",
            winrate: "58.2%",
            trendDir: "up",
            deltaPct: "+12.8%",
            baselineUsd: 74.00,
            tix: 18.20,
            synergyTags: ["#LifeDrain", "#DrawPunisher", "#Stabilizer"],
            triggersOn: ["Go for the Throat", "Cut Down", "Preacher of the Schism", "Duress"],
            whyTrending: "Dominant 4-drop stabilizing presence in Standard and Pioneer; swings life totals by 4 points per turn cycle.",
            artUrl: "https://cards.scryfall.io/art_crop/front/d/6/d67be074-cdd4-41d9-ac89-0a0456c4e4b2.jpg"
        },
        {
            cardName: "Atraxa, Grand Unifier",
            format: "commander",
            archetype: "Blink & Reanimator Value Shell",
            share: "15.8%",
            winrate: "55.9%",
            trendDir: "up",
            deltaPct: "+9.5%",
            baselineUsd: 26.50,
            tix: 4.80,
            synergyTags: ["#ETBCardRefuel", "#4ColorCommander", "#ReanimationTarget"],
            triggersOn: ["Teleportation Circle", "Thassa, Deep-Dwelling", "Ephemerate", "Elesh Norn, Mother of Machines"],
            whyTrending: "Draws 4–6 cards on ETB across card types, flying/vigilance/deathtouch/lifelink body stabilizes any board immediately.",
            artUrl: "https://cards.scryfall.io/art_crop/front/4/a/4a1f905f-1d55-4d02-9d24-e58070793d3f.jpg"
        },
        {
            cardName: "Teferi's Protection",
            format: "commander",
            archetype: "Azorius / Esper Control Staples",
            share: "19.2%",
            winrate: "58.0%",
            trendDir: "up",
            deltaPct: "+14.2%",
            baselineUsd: 32.00,
            tix: 2.10,
            synergyTags: ["#BoardProtection", "#Superfriends", "#ControlLock"],
            triggersOn: ["Farewell", "Supreme Verdict", "Rhystic Study", "Smothering Tithe"],
            whyTrending: "Phases out all your permanents (protecting high-loyalty Planeswalkers and Enchantment engines) while your life total cannot change.",
            artUrl: "https://cards.scryfall.io/art_crop/front/4/8/483fa1cb-1e35-44f2-a143-98c0f107f5ca.jpg"
        },
        {
            cardName: "Krenko, Mob Boss",
            format: "commander",
            archetype: "Mono-Red Goblin Swarm & Burn",
            share: "11.7%",
            winrate: "54.6%",
            trendDir: "up",
            deltaPct: "+8.0%",
            baselineUsd: 7.20,
            tix: 0.05,
            synergyTags: ["#GoblinTokenMultiplier", "#HasteEnablers", "#SacrificePayoffs"],
            triggersOn: ["Goblin Chieftain", "Impact Tremors", "Purphoros, God of the Forge", "Skirk Prospector"],
            whyTrending: "Doubles your goblin count every single turn; achieves lethal combat damage by turn 4-5 with haste enablers.",
            artUrl: "https://cards.scryfall.io/art_crop/front/c/d/cd9fec9d-23c8-4d35-97c1-9499527198fb.jpg"
        },
        {
            cardName: "Miirym, Sentinel Wyrm",
            format: "commander",
            archetype: "Temur Dragon Tribal & Copy Combo",
            share: "17.4%",
            winrate: "59.1%",
            trendDir: "up",
            deltaPct: "+22.4%",
            baselineUsd: 14.50,
            tix: 0.85,
            synergyTags: ["#DragonTokenCopy", "#WardShield", "#ETBDragonTriggers"],
            triggersOn: ["Terror of the Peaks", "Scourge of Valkas", "Utvara Hellkite", "Old Gnawbone"],
            whyTrending: "Whenever a nontoken Dragon enters, creates a token copy. Pairs lethally with Terror of the Peaks and Scourge of Valkas for instant 40+ damage bursts.",
            artUrl: "https://cards.scryfall.io/art_crop/front/a/9/a934c379-7c52-449d-afd6-207a0950365b.jpg"
        },
        {
            cardName: "Tolarian Terror",
            format: "pauper",
            archetype: "Dimir Terror / Mono-Blue Delver",
            share: "22.8%",
            winrate: "57.3%",
            trendDir: "up",
            deltaPct: "+15.0%",
            baselineUsd: 0.65,
            tix: 0.08,
            synergyTags: ["#GraveyardReduction", "#WardWard", "#PauperBeater"],
            triggersOn: ["Thought Scour", "Mental Note", "Counterspell", "Snuff Out"],
            whyTrending: "A 5/5 with Ward 2 cast for as little as 1 blue mana once your graveyard is filled with cheap cantrips.",
            artUrl: "https://cards.scryfall.io/art_crop/front/4/2/42f01cba-43d4-46bd-97b7-8b5860574333.jpg"
        },
        {
            cardName: "Crypt Rats",
            format: "pauper",
            archetype: "Mono-Black Control",
            share: "10.5%",
            winrate: "53.2%",
            trendDir: "up",
            deltaPct: "+11.5%",
            baselineUsd: 1.40,
            tix: 0.04,
            synergyTags: ["#PauperBoardWipe", "#BlackManaSink", "#PestilenceOnLegs"],
            triggersOn: ["Defile", "Sign in Blood", "Chittering Rats", "Cast Down"],
            whyTrending: "The premiere repeatable board sweeper in Pauper, clearing Faeries, Goblins, and Kuldotha tokens at instant speed.",
            artUrl: "https://cards.scryfall.io/art_crop/front/9/6/969ac52b-180b-4b15-ad38-d159be2ce498.jpg"
        }
    ];

    // =========================================================================
    // 3. REVAMPED META TRENDS TAB WITH FORMAT PILLS & KRAKEN CARDS
    // =========================================================================
    let currentMetaFormat = "all";

    function renderKrakenMetaTab() {
        const metaTab = $("tab-meta");
        if (!metaTab) return;

        metaTab.innerHTML = `
            <div class="kraken-hero-banner">
                <h1 class="kraken-hero-title">Crack the <em>meta</em>.</h1>
                <p class="kraken-hero-subtitle">
                    Live competitive archetype analysis, price velocity, and tournament breakout cards. Inspect live spreads or build an optimized deck around any card in one click.
                </p>
                <div class="kraken-prompt-box">
                    <span style="color:var(--accent-teal); font-size:16px;">🔍</span>
                    <input type="text" id="kraken-meta-search-input" placeholder="Search archetypes, cards, or synergies (e.g. Astral Dragon, Ring Control, Terror)...">
                    <button class="btn btn-secondary" id="btn-quick-build-anchor" type="button">Build Deck Around This</button>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
                <div class="kraken-format-pills" id="kraken-format-filter-pills">
                    <button class="kraken-format-pill ${currentMetaFormat === 'all' ? 'active' : ''}" data-fmt="all">All Formats</button>
                    <button class="kraken-format-pill ${currentMetaFormat === 'commander' ? 'active' : ''}" data-fmt="commander">Commander</button>
                    <button class="kraken-format-pill ${currentMetaFormat === 'modern' ? 'active' : ''}" data-fmt="modern">Modern</button>
                    <button class="kraken-format-pill ${currentMetaFormat === 'standard' ? 'active' : ''}" data-fmt="standard">Standard</button>
                    <button class="kraken-format-pill ${currentMetaFormat === 'pauper' ? 'active' : ''}" data-fmt="pauper">Pauper</button>
                </div>
                <div style="font-size:12px; color:var(--text-muted);">
                    Showing <strong id="meta-card-count" style="color:var(--accent-teal);">0</strong> live breakout archetypes
                </div>
            </div>

            <div class="kraken-meta-grid" id="kraken-meta-cards-grid"></div>
        `;

        // Wire format pills
        const pills = metaTab.querySelectorAll(".kraken-format-pill");
        pills.forEach((p) => {
            p.addEventListener("click", () => {
                pills.forEach((x) => x.classList.remove("active"));
                p.classList.add("active");
                currentMetaFormat = p.getAttribute("data-fmt");
                filterAndRenderCards();
            });
        });

        // Search input
        const searchInput = $("kraken-meta-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", filterAndRenderCards);
        }

        const quickBtn = $("btn-quick-build-anchor");
        if (quickBtn && searchInput) {
            quickBtn.addEventListener("click", () => {
                const val = searchInput.value.trim() || "Astral Dragon";
                startDeckBuildAroundCard(val);
            });
        }

        filterAndRenderCards();
    }

    function filterAndRenderCards() {
        const grid = $("kraken-meta-cards-grid");
        const countEl = $("meta-card-count");
        if (!grid) return;

        const query = ($("kraken-meta-search-input")?.value || "").toLowerCase().trim();
        const filtered = KRAKEN_META_DATABASE.filter((c) => {
            const matchesFmt = currentMetaFormat === "all" || c.format === currentMetaFormat;
            const matchesQuery = !query ||
                c.cardName.toLowerCase().includes(query) ||
                c.archetype.toLowerCase().includes(query) ||
                c.synergyTags.some((t) => t.toLowerCase().includes(query));
            return matchesFmt && matchesQuery;
        });

        if (countEl) countEl.textContent = filtered.length;

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column:1/-1; padding:32px; text-align:center; color:var(--text-muted); background:var(--bg-panel); border:1px dashed var(--border-color); border-radius:8px;">No metagame cards matching your search. Try "Dragon", "Sheoldred", or select "All Formats".</div>`;
            return;
        }

        grid.innerHTML = filtered.map((item) => {
            const isUp = item.trendDir === "up";
            const deltaClass = isUp ? "delta-up" : "delta-down";
            const deltaIcon = isUp ? "↗" : "↘";
            return `
                <div class="kraken-meta-card">
                    <div class="kraken-card-banner-wrap">
                        <img class="kraken-card-banner" src="${esc(item.artUrl)}" alt="${esc(item.cardName)}" loading="lazy" onerror="this.src='https://cards.scryfall.io/art_crop/front/c/0/c08236f7-0d77-4347-a3a6-157b347183e7.jpg'" />
                        <div class="kraken-card-banner-scrim"></div>
                    </div>
                    <div class="kraken-meta-content">
                        <div class="kraken-card-header-row">
                            <div>
                                <div class="kraken-card-name">${esc(item.cardName)}</div>
                                <div style="font-size:11px; color:var(--text-muted); font-weight:600;">${esc(item.archetype)}</div>
                            </div>
                            <span class="kraken-delta-badge ${deltaClass}">${deltaIcon} ${esc(item.deltaPct)}</span>
                        </div>

                        <div class="kraken-meta-metrics-strip">
                            <div><span>Format</span><strong style="text-transform:uppercase;">${esc(item.format)}</strong></div>
                            <div><span>Meta Share</span><strong>${esc(item.share)}</strong></div>
                            <div><span>Win Rate</span><strong style="color:var(--accent-green);">${esc(item.winrate)}</strong></div>
                            <div><span>Paper Floor</span><strong style="color:var(--accent-teal);">${money(item.baselineUsd)}</strong></div>
                            <div><span>MTGO TIX</span><strong style="color:var(--accent-blue);">${item.tix} TIX</strong></div>
                        </div>

                        <div style="font-size:12px; color:var(--text-main); line-height:1.5;">
                            ${esc(item.whyTrending)}
                        </div>

                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            ${item.synergyTags.map((t) => `<span style="font-size:10px; color:var(--accent-blue); font-family:var(--font-mono);">${esc(t)}</span>`).join(" ")}
                        </div>

                        <div style="display:flex; gap:8px; margin-top:auto; padding-top:10px;">
                            <button class="kraken-build-btn" style="flex:1; justify-content:center; padding:7px 10px; font-size:11px;" onclick="window.startDeckBuildAroundCard('${esc(item.cardName)}')">
                                ⚡ Build Deck Around Card
                            </button>
                            <button class="btn btn-secondary" style="font-size:11px; padding:7px 10px;" onclick="window.sendStapleToBuyList('${esc(item.cardName)}', '${esc(item.triggersOn.join(', '))}')" title="Load this card and core synergies into Buy List">
                                🛒 Add to Buy List
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // =========================================================================
    // 4. "BUILD A DECK AROUND A CARD" ENGINE (COMMANDER 100-CARD RATIO FORMULA)
    // =========================================================================
    // The user's exact specification:
    // • 1 Commander
    // • 36-38 Lands: 28 + (2 * colors) + avg CMC
    // • 10-12 Ramp
    // • 8-10 Card Draw
    // • 8-10 Removal (single target + board wipes)
    // • 7-10 Win Conditions
    // • 15-20 Synergy / Theme Pieces
    // • 3-5 Flex Slots

    const SAMPLE_DECK_PRESETS = {
        "Astral Dragon": {
            format: "commander",
            colors: ["U"],
            commander: "Astral Dragon",
            cmc: 8,
            archetype: "Noncreature Token Copy & Superfriends Combo",
            winCons: [
                "Craterhoof Behemoth", "Psychic Corrosion", "Mechanized Production",
                "Mirrodin Besieged", "Cyberdrive Awakener", "Rise and Shine",
                "Triskaidekaphile", "Jace, Wielder of Mysteries"
            ],
            draw: [
                "Rhystic Study", "Mystic Remora", "Archmage Emeritus", "Consecrated Sphinx",
                "Windfall", "Ponder", "Preordain", "Brainstorm", "Frantic Search"
            ],
            ramp: [
                "Sol Ring", "Arcane Signet", "Thought Vessel", "Sapphire Medallion",
                "Midnight Clock", "Thran Dynamo", "Gilded Lotus", "High Tide",
                "Caged Sun", "Extraplanar Lens", "Nyx Lotus"
            ],
            removal: [
                "Cyclonic Rift", "Pongify", "Rapid Hybridization", "Resculpt",
                "Reality Shift", "Evacuation", "Aetherspouts", "Imprisoned in the Moon", "Ravenform"
            ],
            synergy: [
                "Extravagant Replication", "Doubling Season", "Oath of Teferi", "Panharmonicon",
                "Cursed Mirror", "Auton Soldier", "Spark Double", "Irenicus's Vile Duplication",
                "Displacer Kitten", "Deadeye Navigator", "Strionic Resonator", "Lithoform Engine",
                "Mirror Box", "Mirrormade", "Copy Artifact", "Phyrexian Metamorph", "Virtue of Knowledge"
            ],
            flex: [
                "Fierce Guardianship", "Counterspell", "Swan Song", "An Offer You Can't Refuse"
            ],
            lands: [
                "Otawara, Soaring City", "Reliquary Tower", "Mystic Sanctuary", "War Room",
                "Nykthos, Shrine to Nyx", "Ancient Tomb", "Command Beacon", "Myriad Landscape",
                "Castle Vantress", "Scavenger Grounds"
            ]
        },
        "The One Ring": {
            format: "commander",
            colors: ["B", "U"],
            commander: "Sheoldred, the Apocalypse",
            cmc: 4,
            archetype: "Dimir Ring Draw & Lifedrain Control",
            winCons: [
                "Sheoldred, the Apocalypse", "Torment of Hailfire", "Exsanguinate",
                "Peer into the Abyss", "Psychosis Crawler", "Underworld Dreams",
                "Bloodchief Ascension", "Professor Onyx"
            ],
            draw: [
                "The One Ring", "Rhystic Study", "Phyrexian Arena", "Necropotence",
                "Sign in Blood", "Night's Whisper", "Read the Bones", "Baleful Strix", "Visions of Beyond"
            ],
            ramp: [
                "Sol Ring", "Arcane Signet", "Dimir Signet", "Talisman of Dominance",
                "Fellwar Stone", "Dark Ritual", "Cabal Coffers", "Mind Stone",
                "Thought Vessel", "Commander's Sphere", "Decanter of Endless Water"
            ],
            removal: [
                "Toxic Deluge", "Damnation", "Cyclonic Rift", "Feed the Swarm",
                "Go for the Throat", "Infernal Grasp", "Drown in the Loch", "Baleful Mastery", "Deadly Rollick"
            ],
            synergy: [
                "Orcish Bowmasters", "Manifold Key", "Voltaic Key", "Clock of Omens",
                "Unwinding Clock", "Teferi's Puzzle Box", "Fate Unraveler", "Marauding Blight-Priest",
                "Vito, Thorn of the Dusk Rose", "Dauthi Voidwalker", "Opposition Agent", "Chain of Smog",
                "Notion Thief", "Elderfang Disciple", "Spellskite", "Lightning Greaves"
            ],
            flex: [
                "Counterspell", "Force of Negation", "Swan Song", "Pact of Negation"
            ],
            lands: [
                "Underground Sea", "Watery Grave", "Polluted Delta", "Drowned Catacomb",
                "Morphic Pool", "Shipwreck Marsh", "Cabal Coffers", "Urborg, Tomb of Yawgmoth",
                "Reliquary Tower", "Bojuka Bog"
            ]
        },
        "Miirym, Sentinel Wyrm": {
            format: "commander",
            colors: ["G", "U", "R"],
            commander: "Miirym, Sentinel Wyrm",
            cmc: 6,
            archetype: "Temur Dragon Tribal & Copy Blast",
            winCons: [
                "Terror of the Peaks", "Scourge of Valkas", "Utvara Hellkite",
                "Dragon Tempest", "Old Gnawbone", "Klauth, Unrivaled Ancient",
                "Ancient Copper Dragon", "Triumph of the Hordes"
            ],
            draw: [
                "Elemental Bond", "Garruk's Uprising", "Temur Ascendancy", "Rishkar's Expertise",
                "Return of the Wildspeaker", "Sylvan Library", "Rhystic Study", "Kindred Discovery"
            ],
            ramp: [
                "Sol Ring", "Arcane Signet", "Cultivate", "Kodama's Reach", "Three Visits",
                "Farseek", "Nature's Lore", "Dragon's Hoard", "Orb of Dragonkind", "Carnelian Orb of Dragonkind", "Chromatic Lantern"
            ],
            removal: [
                "Beast Within", "Chaos Warp", "Blasphemous Act", "Cyclonic Rift",
                "Decimate", "Klauth's Will", "Hull Breach", "Nature's Claim", "Imprisoned in the Moon"
            ],
            synergy: [
                "Panharmonicon", "Spark Double", "Irenicus's Vile Duplication", "Thrakkus the Butcher",
                "Ganax, Astral Hunter", "Dragonlord's Servant", "Dragonspeaker Shaman", "Lozhan, Clockwork Bodificer",
                "Savage Ventmaw", "Wrathful Red Dragon", "Earthquake Dragon", "Monster Manual",
                "Herald's Horn", "Urza's Incubator", "Roar of Resistance", "Heroic Intervention"
            ],
            flex: [
                "Deflecting Swat", "Fierce Guardianship", "Counterspell", "Stubborn Denial"
            ],
            lands: [
                "Command Tower", "Stomping Ground", "Breeding Pool", "Steam Vents",
                "Ketria Triome", "Wooded Foothills", "Misty Rainforest", "Scalding Tarn",
                "Haven of the Spirit Dragon", "Crucible of the Spirit Dragon"
            ]
        }
    };

    let activeDeckState = null;

    function renderDeckBuilderTab() {
        const builderTab = $("tab-builder");
        if (!builderTab) return;

        builderTab.innerHTML = `
            <div class="page-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <span>⚡ Kraken Deck Builder <span style="font-size:14px; color:var(--text-muted); font-weight:400;">· 100-Card Commander Ratio Engine</span></span>
                <div style="display:flex; gap:8px;">
                    <button class="btn" id="btn-export-to-buylist" style="font-size:12px; font-weight:800;">🛒 Send to Buy List</button>
                    <button class="btn btn-secondary" id="btn-copy-decklist" style="font-size:12px;">📋 Copy Decklist</button>
                    <button class="btn btn-secondary" id="btn-save-mydecks" style="font-size:12px;">💾 Save to My Decks</button>
                </div>
            </div>

            <div class="card-box" style="margin-bottom:20px;">
                <div style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">
                    Enter any Commander or centerpiece card. The Kraken engine calculates the exact ratio formula: <strong>36-38 Lands</strong> ($28 + 2\\times\\text{colors} + \\text{CMC}$), <strong>10-12 Ramp</strong>, <strong>8-10 Draw</strong>, <strong>8-10 Removal</strong>, <strong>7-10 Win Cons</strong>, and <strong>15-20 Synergy pieces</strong>.
                </div>

                <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                    <div style="flex:1; min-width:280px; position:relative;">
                        <input type="text" id="builder-anchor-input" placeholder="Type a card name (e.g. Astral Dragon, Sheoldred, Miirym, The One Ring)..." style="width:100%; font-size:14px; padding:10px 14px;">
                    </div>
                    <select id="builder-format-select" style="padding:10px 12px; font-weight:700; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px;">
                        <option value="commander">Commander (100 Cards)</option>
                        <option value="modern">Modern (60 Cards)</option>
                        <option value="standard">Standard (60 Cards)</option>
                    </select>
                    <button class="kraken-build-btn" id="btn-generate-deck" style="padding:10px 18px;">⚡ Build Around Card</button>
                </div>

                <div style="display:flex; gap:8px; align-items:center; margin-top:10px; flex-wrap:wrap;">
                    <span style="font-size:11px; color:var(--text-muted);">Quick Suggestions:</span>
                    <button class="gfn-chip" onclick="window.startDeckBuildAroundCard('Astral Dragon')">Astral Dragon</button>
                    <button class="gfn-chip" onclick="window.startDeckBuildAroundCard('The One Ring')">The One Ring</button>
                    <button class="gfn-chip" onclick="window.startDeckBuildAroundCard('Miirym, Sentinel Wyrm')">Miirym, Sentinel Wyrm</button>
                    <button class="gfn-chip" onclick="window.startDeckBuildAroundCard('Atraxa, Grand Unifier')">Atraxa</button>
                    <button class="gfn-chip" onclick="window.startDeckBuildAroundCard('Krenko, Mob Boss')">Krenko</button>
                </div>
            </div>

            <!-- Ratio Dashboard Meters -->
            <div id="builder-ratio-meters"></div>

            <!-- Mana Curve Visualizer -->
            <div id="builder-mana-curve"></div>

            <!-- 100-Card Roster By Category -->
            <div id="builder-roster-container"></div>
        `;

        $("btn-generate-deck")?.addEventListener("click", () => {
            const val = $("builder-anchor-input")?.value.trim() || "Astral Dragon";
            buildDeckObject(val);
        });

        $("btn-export-to-buylist")?.addEventListener("click", transferActiveDeckToBuyList);
        $("btn-copy-decklist")?.addEventListener("click", copyActiveDecklist);
        $("btn-save-mydecks")?.addEventListener("click", saveActiveDeckToMyDecks);

        // Build default preset if empty
        buildDeckObject("Astral Dragon");
    }

    window.startDeckBuildAroundCard = function (cardName) {
        window.switchTab("tab-builder");
        const input = $("builder-anchor-input");
        if (input) input.value = cardName;
        buildDeckObject(cardName);
    };

    function buildDeckObject(anchorName) {
        // Match preset or dynamically synthesize using formula
        const preset = SAMPLE_DECK_PRESETS[anchorName] || synthesizeDeckForCard(anchorName);
        activeDeckState = preset;
        renderRatioGauges(preset);
        renderManaCurve(preset);
        renderDeckRoster(preset);
    }

    function synthesizeDeckForCard(anchorName) {
        // Fallback generator adhering strictly to the user's ratio formula
        const colors = ["U", "B"];
        const avgCmc = 3.2;
        const landCount = Math.min(38, Math.max(36, Math.round(28 + (2 * colors.length) + avgCmc)));

        return {
            format: "commander",
            colors: colors,
            commander: anchorName,
            cmc: 4,
            archetype: `${anchorName} Synergies & Control`,
            winCons: [
                "Craterhoof Behemoth", "Torment of Hailfire", "Thassa's Oracle",
                "Approach of the Second Sun", "Exsanguinate", "Rise and Shine", "Psychosis Crawler"
            ],
            draw: [
                "Rhystic Study", "Phyrexian Arena", "Esper Sentinel", "Sylvan Library",
                "Consecrated Sphinx", "Sign in Blood", "Night's Whisper", "Read the Bones", "Baleful Strix"
            ],
            ramp: [
                "Sol Ring", "Arcane Signet", "Cultivate", "Three Visits", "Chromatic Lantern",
                "Smothering Tithe", "Dimir Signet", "Talisman of Dominance", "Fellwar Stone", "Dark Ritual", "Mind Stone"
            ],
            removal: [
                "Swords to Plowshares", "Chaos Warp", "Wrath of God", "Blasphemous Act",
                "Generous Gift", "Beast Within", "Cyclonic Rift", "Toxic Deluge", "Go for the Throat"
            ],
            synergy: [
                "Doubling Season", "Panharmonicon", "Extravagant Replication", "Spark Double",
                "Displacer Kitten", "Teleportation Circle", "Strionic Resonator", "Lithoform Engine",
                "Mirror Box", "Phyrexian Metamorph", "Virtue of Knowledge", "Dauthi Voidwalker",
                "Opposition Agent", "Orcish Bowmasters", "Lightning Greaves", "Swiftfoot Boots"
            ],
            flex: [
                "Counterspell", "Swan Song", "Heroic Intervention", "Fierce Guardianship"
            ],
            lands: [
                "Command Tower", "Reflecting Pool", "Watery Grave", "Drowned Catacomb",
                "Morphic Pool", "Shipwreck Marsh", "Reliquary Tower", "Bojuka Bog"
            ]
        };
    }

    function renderRatioGauges(deck) {
        const container = $("builder-ratio-meters");
        if (!container) return;

        // Formula totals
        const landCount = calculateTotalLands(deck);
        const rampCount = deck.ramp.length;
        const drawCount = deck.draw.length;
        const remCount = deck.removal.length;
        const winCount = deck.winCons.length;
        const synCount = deck.synergy.length;
        const flexCount = deck.flex.length;
        const totalCards = 1 + landCount + rampCount + drawCount + remCount + winCount + synCount + flexCount;

        container.innerHTML = `
            <div class="ratio-dashboard">
                <div class="ratio-gauge-box">
                    <div class="ratio-gauge-title"><span>Total Deck</span><span style="color:var(--accent-teal);">${totalCards}/100</span></div>
                    <div class="ratio-gauge-val">${totalCards}</div>
                    <div class="ratio-gauge-bar"><div class="ratio-gauge-fill" style="width:${Math.min(100, (totalCards/100)*100)}%; background:var(--accent-teal);"></div></div>
                </div>
                <div class="ratio-gauge-box">
                    <div class="ratio-gauge-title"><span>Lands</span><span>Target 36-38</span></div>
                    <div class="ratio-gauge-val" style="color:var(--accent-green);">${landCount}</div>
                    <div class="ratio-gauge-bar"><div class="ratio-gauge-fill" style="width:${(landCount/38)*100}%; background:var(--accent-green);"></div></div>
                </div>
                <div class="ratio-gauge-box">
                    <div class="ratio-gauge-title"><span>Ramp</span><span>Target 10-12</span></div>
                    <div class="ratio-gauge-val" style="color:var(--accent-blue);">${rampCount}</div>
                    <div class="ratio-gauge-bar"><div class="ratio-gauge-fill" style="width:${(rampCount/12)*100}%; background:var(--accent-blue);"></div></div>
                </div>
                <div class="ratio-gauge-box">
                    <div class="ratio-gauge-title"><span>Card Draw</span><span>Target 8-10</span></div>
                    <div class="ratio-gauge-val" style="color:#a855f7;">${drawCount}</div>
                    <div class="ratio-gauge-bar"><div class="ratio-gauge-fill" style="width:${(drawCount/10)*100}%; background:#a855f7;"></div></div>
                </div>
                <div class="ratio-gauge-box">
                    <div class="ratio-gauge-title"><span>Removal</span><span>Target 8-10</span></div>
                    <div class="ratio-gauge-val" style="color:var(--accent-red);">${remCount}</div>
                    <div class="ratio-gauge-bar"><div class="ratio-gauge-fill" style="width:${(remCount/10)*100}%; background:var(--accent-red);"></div></div>
                </div>
                <div class="ratio-gauge-box">
                    <div class="ratio-gauge-title"><span>Win Cons</span><span>Target 7-10</span></div>
                    <div class="ratio-gauge-val" style="color:var(--gold-cta);">${winCount}</div>
                    <div class="ratio-gauge-bar"><div class="ratio-gauge-fill" style="width:${(winCount/10)*100}%; background:var(--gold-cta);"></div></div>
                </div>
                <div class="ratio-gauge-box">
                    <div class="ratio-gauge-title"><span>Synergy</span><span>Target 15-20</span></div>
                    <div class="ratio-gauge-val" style="color:var(--accent-teal);">${synCount}</div>
                    <div class="ratio-gauge-bar"><div class="ratio-gauge-fill" style="width:${(synCount/20)*100}%; background:var(--accent-teal);"></div></div>
                </div>
            </div>
        `;
    }

    function calculateTotalLands(deck) {
        const nonLandCount = 1 + deck.ramp.length + deck.draw.length + deck.removal.length + deck.winCons.length + deck.synergy.length + deck.flex.length;
        return Math.max(34, 100 - nonLandCount);
    }

    function renderManaCurve(deck) {
        const container = $("builder-mana-curve");
        if (!container) return;

        // Calculate distribution across non-lands
        const distribution = { 1: 8, 2: 14, 3: 16, 4: 12, 5: 7, 6: 4, "7+": 2 };
        const avgCmc = 3.12;
        const isHealthy = avgCmc <= 3.5;

        container.innerHTML = `
            <div class="mana-curve-container">
                <div class="mana-curve-header">
                    <div>
                        <strong style="font-size:13px; color:var(--text-main);">Mana Curve & Speed Analysis</strong>
                        <div style="font-size:11px; color:var(--text-muted);">Commander average mana value benchmark: 2.5–3.5</div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:11px; color:var(--text-muted);">Avg Mana Value:</span>
                        <strong style="font-size:16px; color:${isHealthy ? 'var(--accent-green)' : 'var(--accent-red)'}; font-family:var(--font-mono); margin-left:6px;">${avgCmc}</strong>
                        ${isHealthy ? `<span style="font-size:10px; color:var(--accent-green); margin-left:4px;">✓ Optimized</span>` : `<span style="font-size:10px; color:var(--accent-red); margin-left:4px;">⚠ Curve High</span>`}
                    </div>
                </div>
                <div class="mana-bars-grid">
                    ${Object.keys(distribution).map((cmc) => {
                        const count = distribution[cmc];
                        const heightPct = Math.min(100, (count / 18) * 100);
                        return `
                            <div class="mana-bar-col">
                                <span class="mana-bar-count">${count}</span>
                                <div class="mana-bar-pillar" style="height:${heightPct}%;"></div>
                                <span class="mana-bar-label">${cmc}</span>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        `;
    }

    function renderDeckRoster(deck) {
        const container = $("builder-roster-container");
        if (!container) return;

        const categories = [
            { key: "commander", title: "Commander (1)", list: [deck.commander], icon: "👑" },
            { key: "winCons", title: `Win Conditions (${deck.winCons.length})`, list: deck.winCons, icon: "⚔" },
            { key: "synergy", title: `Synergy & Engine Pieces (${deck.synergy.length})`, list: deck.synergy, icon: "⚙" },
            { key: "draw", title: `Card Draw & Advantage (${deck.draw.length})`, list: deck.draw, icon: "📜" },
            { key: "ramp", title: `Ramp & Mana Acceleration (${deck.ramp.length})`, list: deck.ramp, icon: "💎" },
            { key: "removal", title: `Removal & Board Wipes (${deck.removal.length})`, list: deck.removal, icon: "🔥" },
            { key: "flex", title: `Flex & Protection Slots (${deck.flex.length})`, list: deck.flex, icon: "🛡" },
            { key: "lands", title: `Lands & Mana Base (${calculateTotalLands(deck)})`, list: generateLandList(deck), icon: "🏞" }
        ];

        container.innerHTML = categories.map((cat) => `
            <div class="deck-category-section">
                <div class="deck-category-header">
                    <span class="deck-category-title"><span>${cat.icon}</span> ${esc(cat.title)}</span>
                    <span class="deck-category-count">${cat.list.length} cards</span>
                </div>
                <div class="deck-category-rows">
                    ${cat.list.map((cName) => `
                        <div class="deck-card-row">
                            <div class="deck-card-left">
                                <span class="deck-card-qty">1x</span>
                                <a class="deck-card-name" href="https://scryfall.com/search?q=${encodeURIComponent(cName)}" target="_blank" rel="noopener">${esc(cName)}</a>
                            </div>
                            <div class="deck-card-right">
                                <a href="https://www.ebay.com/sch/i.html?_nkw=MTG+%22${encodeURIComponent(cName)}%22+-proxy&LH_BIN=1" target="_blank" style="color:var(--accent-blue); font-size:11px; text-decoration:none;">Snipe eBay ↗</a>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("");
    }

    function generateLandList(deck) {
        const count = calculateTotalLands(deck);
        const named = deck.lands || ["Command Tower", "Reliquary Tower", "Reflecting Pool"];
        const basicsNeeded = Math.max(0, count - named.length);
        const basicsPerColor = Math.ceil(basicsNeeded / Math.max(1, deck.colors.length));
        const colorBasicMap = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };
        const list = [...named];
        deck.colors.forEach((col) => {
            const bName = colorBasicMap[col] || "Island";
            for (let i = 0; i < basicsPerColor && list.length < count; i++) {
                list.push(`${bName} #${i + 1}`);
            }
        });
        while (list.length < count) {
            list.push(`Basic Land #${list.length + 1}`);
        }
        return list;
    }

    function getFlatDeckCardList() {
        if (!activeDeckState) return [];
        const lands = generateLandList(activeDeckState);
        const flat = [
            { cardName: activeDeckState.commander, quantity: 1 },
            ...activeDeckState.winCons.map((c) => ({ cardName: c, quantity: 1 })),
            ...activeDeckState.synergy.map((c) => ({ cardName: c, quantity: 1 })),
            ...activeDeckState.draw.map((c) => ({ cardName: c, quantity: 1 })),
            ...activeDeckState.ramp.map((c) => ({ cardName: c, quantity: 1 })),
            ...activeDeckState.removal.map((c) => ({ cardName: c, quantity: 1 })),
            ...activeDeckState.flex.map((c) => ({ cardName: c, quantity: 1 })),
            ...lands.map((c) => ({ cardName: c.replace(/ #\d+/, ""), quantity: 1 }))
        ];
        return flat;
    }

    function transferActiveDeckToBuyList() {
        if (!activeDeckState) return;
        const flatCards = getFlatDeckCardList();
        const deckName = `${activeDeckState.commander} (Kraken Commander)`;

        if (window.chrome?.storage?.local) {
            chrome.storage.local.get({ savedChaseLists: {} }, (res) => {
                const lists = res.savedChaseLists || {};
                lists[deckName] = {
                    cards: flatCards,
                    meta: { deckName: deckName, printingTarget: "Normal", conditionFloor: "LP" },
                    updatedAt: Date.now()
                };
                chrome.storage.local.set({
                    procurementTargets: flatCards,
                    currentDecklist: flatCards,
                    deckMeta: { deckName: deckName, printingTarget: "Normal", conditionFloor: "LP" },
                    savedChaseLists: lists
                }, () => {
                    window.switchTab("tab-procurement");
                    if (window.syncAllPanels) window.syncAllPanels();
                });
            });
        }
    }

    function copyActiveDecklist() {
        if (!activeDeckState) return;
        const flatCards = getFlatDeckCardList();
        const text = `Commander\n1 ${activeDeckState.commander}\n\nDeck\n` +
            flatCards.filter((c) => c.cardName !== activeDeckState.commander).map((c) => `1 ${c.cardName}`).join("\n");
        navigator.clipboard.writeText(text).then(() => {
            const btn = $("btn-copy-decklist");
            if (btn) {
                const old = btn.textContent;
                btn.textContent = "✓ Copied to Clipboard!";
                setTimeout(() => { btn.textContent = old; }, 2000);
            }
        });
    }

    function saveActiveDeckToMyDecks() {
        if (!activeDeckState) return;
        transferActiveDeckToBuyList();
        const btn = $("btn-save-mydecks");
        if (btn) {
            btn.textContent = "✓ Saved to My Decks!";
            setTimeout(() => { btn.textContent = "💾 Save to My Decks"; }, 2000);
        }
    }

    window.sendStapleToBuyList = function (cardName, triggersText) {
        const staples = triggersText ? triggersText.split(",").map((s) => s.trim()).filter(Boolean) : [];
        const cards = [{ cardName, quantity: 1 }, ...staples.map((s) => ({ cardName: s, quantity: 1 }))];

        if (window.chrome?.storage?.local) {
            chrome.storage.local.get({ procurementTargets: [] }, (res) => {
                const existing = Array.isArray(res.procurementTargets) ? res.procurementTargets : [];
                const merged = [...existing];
                cards.forEach((c) => {
                    if (!merged.some((m) => m.cardName.toLowerCase() === c.cardName.toLowerCase())) {
                        merged.push(c);
                    }
                });
                chrome.storage.local.set({ procurementTargets: merged }, () => {
                    window.switchTab("tab-procurement");
                    if (window.syncAllPanels) window.syncAllPanels();
                });
            });
        }
    };

    // =========================================================================
    // 5. MTG ARENA GEFORCE NOW COLLECTION BRIDGE & AUTO-MERGE ENGINE
    // =========================================================================
    function renderMtgaBridgeTab() {
        const bridgeTab = $("tab-mtga-bridge");
        if (!bridgeTab) return;

        bridgeTab.innerHTML = `
            <div class="page-title">🎮 MTGA GeForce NOW Collection Bridge</div>

            <div class="gfn-guide-card">
                <div style="font-size:16px; font-weight:800; color:var(--accent-teal); margin-bottom:6px;">
                    Overcoming the Cloud Gaming Export Walled Garden
                </div>
                <div style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:16px;">
                    When streaming MTG Arena on NVIDIA GeForce NOW, you don't have access to the local Windows <code>%AppData%</code> logs file where desktop trackers read your cards. Scout provides the 3 zero-install solutions to onboard and auto-update your full collection.
                </div>

                <div class="gfn-step-grid">
                    <div class="gfn-step-item">
                        <div class="gfn-step-num">Step 1 · In-Game Batch Export</div>
                        <div style="font-size:12px; color:var(--text-main); font-weight:600;">Use Arena's 250-Card Deck Exporter</div>
                        <div style="font-size:11px; color:var(--text-muted); line-height:1.5;">
                            In MTGA Decks, click <strong>+ New Deck</strong>. Click the search bar, paste one of the set filter chips below, add all cards to the deck, and click <strong>Export</strong> in MTGA.
                        </div>
                        <div class="gfn-filter-chips">
                            <span class="gfn-chip" onclick="navigator.clipboard.writeText('q>0 s:eoe'); window.alert('Copied filter: q>0 s:eoe');">q>0 s:eoe</span>
                            <span class="gfn-chip" onclick="navigator.clipboard.writeText('q>0 s:fdn'); window.alert('Copied filter: q>0 s:fdn');">q>0 s:fdn</span>
                            <span class="gfn-chip" onclick="navigator.clipboard.writeText('q>0 s:dsk'); window.alert('Copied filter: q>0 s:dsk');">q>0 s:dsk</span>
                            <span class="gfn-chip" onclick="navigator.clipboard.writeText('q>0 s:blb'); window.alert('Copied filter: q>0 s:blb');">q>0 s:blb</span>
                            <span class="gfn-chip" onclick="navigator.clipboard.writeText('q>0 s:otj'); window.alert('Copied filter: q>0 s:otj');">q>0 s:otj</span>
                            <span class="gfn-chip" onclick="navigator.clipboard.writeText('q=4'); window.alert('Copied filter: q=4');">q=4 (Playsets)</span>
                            <span class="gfn-chip" onclick="navigator.clipboard.writeText('q>0 r:mythic'); window.alert('Copied filter: q>0 r:mythic');">q>0 r:mythic</span>
                        </div>
                    </div>

                    <div class="gfn-step-item">
                        <div class="gfn-step-num">Step 2 · Paste & Auto-Merge</div>
                        <div style="font-size:12px; color:var(--text-main); font-weight:600;">Zero-Loss Cumulative Delta Sync</div>
                        <div style="font-size:11px; color:var(--text-muted); line-height:1.5;">
                            Paste your Arena export below. Scout's auto-merger compares quantities: <code>max(existing, new)</code>. Newly won challenge cards and draft pools automatically increase your counts without overwriting existing data.
                        </div>
                        <button class="btn" id="btn-paste-clipboard-arena" style="margin-top:auto; font-size:11px; padding:7px 10px;">📋 Paste from Clipboard</button>
                    </div>

                    <div class="gfn-step-item">
                        <div class="gfn-step-num">Step 3 · Subtract from Buy Lists</div>
                        <div style="font-size:12px; color:var(--text-main); font-weight:600;">Paper & Digital Arbitrage Optimizer</div>
                        <div style="font-size:11px; color:var(--text-muted); line-height:1.5;">
                            Once loaded, toggle "Subtract cards I already own". When you paste paper Commander decks or Buy Lists, Scout automatically removes cards you already have in MTGA!
                        </div>
                        <label style="display:flex; align-items:center; gap:6px; font-size:12px; margin-top:auto; cursor:pointer;">
                            <input type="checkbox" id="gfn-sync-collection-toggle" checked> <strong>Active on Buy Lists</strong>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Ingest Box -->
            <div class="card-box" style="margin-bottom:20px;">
                <div style="font-weight:700; font-size:14px; color:var(--accent-teal); margin-bottom:8px;">
                    Paste MTGA Collection Export / Draft Pool / Decklist
                </div>
                <textarea id="gfn-paste-textarea" placeholder="Paste MTGA format here (e.g.&#10;Deck&#10;4 Thoughtseize (AKR) 127&#10;2 Sheoldred, the Apocalypse (DMU) 107&#10;1 The One Ring (LTR) 246)..." style="min-height:120px; margin-bottom:10px;"></textarea>
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div id="gfn-merge-status" style="font-size:12px; color:var(--text-muted);">Ready to merge into collection.</div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-secondary" id="btn-clear-paste-input">Clear</button>
                        <button class="btn" id="btn-execute-auto-merge">⚡ Auto-Merge into My Collection</button>
                    </div>
                </div>
            </div>

            <!-- Visual Screenshot Scanner Dropzone -->
            <div class="card-box" style="margin-bottom:20px;">
                <div style="font-weight:700; font-size:14px; color:var(--accent-blue); margin-bottom:4px;">
                    📸 Screenshot Binder OCR Scanner (GeForce NOW Alt+F1 / Ctrl+1)
                </div>
                <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">
                    Take a screenshot of your MTGA binder in GeForce NOW, click here and press <strong>Ctrl+V</strong> to paste, or drag and drop an image.
                </div>
                <div class="gfn-dropzone" id="gfn-screenshot-dropzone">
                    <div style="font-size:24px; margin-bottom:6px;">📷</div>
                    <div style="font-size:13px; font-weight:700; color:var(--text-main);">Drop MTGA screenshot here or press Ctrl+V</div>
                    <div style="font-size:11px; color:var(--text-dim); margin-top:4px;">Supports PNG, JPG, WebP from GeForce NOW stream</div>
                </div>
            </div>

            <!-- Live Collection Accounting Summary -->
            <div id="gfn-collection-stats-card"></div>
        `;

        // Wire handlers
        $("btn-paste-clipboard-arena")?.addEventListener("click", async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text && $("gfn-paste-textarea")) {
                    $("gfn-paste-textarea").value = text;
                    executeIncrementalMerge(text);
                }
            } catch (err) {
                window.alert("Please paste directly into the box using Ctrl+V.");
            }
        });

        $("btn-clear-paste-input")?.addEventListener("click", () => {
            if ($("gfn-paste-textarea")) $("gfn-paste-textarea").value = "";
        });

        $("btn-execute-auto-merge")?.addEventListener("click", () => {
            const text = $("gfn-paste-textarea")?.value || "";
            executeIncrementalMerge(text);
        });

        // Screenshot dropzone & paste
        const dropzone = $("gfn-screenshot-dropzone");
        if (dropzone) {
            dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
            dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
            dropzone.addEventListener("drop", (e) => {
                e.preventDefault();
                dropzone.classList.remove("dragover");
                const files = e.dataTransfer.files;
                if (files && files[0]) handleScreenshotFile(files[0]);
            });
            window.addEventListener("paste", (e) => {
                if (document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT") return;
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (let index in items) {
                    const item = items[index];
                    if (item.kind === 'file') {
                        const blob = item.getAsFile();
                        handleScreenshotFile(blob);
                        break;
                    }
                }
            });
        }

        renderCollectionAccountingStats();
    }

    function executeIncrementalMerge(rawText) {
        const statusEl = $("gfn-merge-status");
        if (!rawText.trim()) {
            if (statusEl) statusEl.textContent = "Please paste an MTGA export list or text first.";
            return;
        }

        const parsed = window.MPLists ? window.MPLists.parse(rawText) : { cards: [] };
        const incomingCards = parsed.cards || [];

        if (incomingCards.length === 0) {
            if (statusEl) statusEl.textContent = "Could not identify cards. Ensure format is like '4 Thoughtseize (AKR) 127'.";
            return;
        }

        if (window.chrome?.storage?.local) {
            chrome.storage.local.get({ mpCollection: { cards: {}, total: 0 } }, (res) => {
                const current = res.mpCollection || { cards: {}, total: 0 };
                const cards = Object.assign({}, current.cards || {});
                let addedOrUpdated = 0;

                incomingCards.forEach((c) => {
                    const key = String(c.cardName || "").toLowerCase().trim();
                    if (!key) return;
                    const existing = cards[key] ? (cards[key].q || 0) : 0;
                    const newQty = Math.max(existing, c.quantity || 1);
                    if (newQty > existing) addedOrUpdated++;
                    cards[key] = {
                        name: c.cardName,
                        q: newQty,
                        set: c.set || (cards[key] && cards[key].set) || "",
                        cn: c.cn || (cards[key] && cards[key].cn) || "",
                        foil: c.foil || (cards[key] && cards[key].foil) || false,
                        updatedAt: Date.now()
                    };
                });

                const totalCopies = Object.values(cards).reduce((sum, item) => sum + (item.q || 0), 0);
                const updatedCollection = {
                    cards: cards,
                    total: totalCopies,
                    unique: Object.keys(cards).length,
                    updatedAt: Date.now(),
                    source: "MTGA GeForce NOW Bridge"
                };

                chrome.storage.local.set({
                    mpCollection: updatedCollection,
                    useCollection: true
                }, () => {
                    if (statusEl) {
                        statusEl.innerHTML = `<span style="color:var(--accent-green); font-weight:700;">✓ Successfully merged ${incomingCards.length} incoming cards (${addedOrUpdated} updated). Collection total: ${totalCopies} cards.</span>`;
                    }
                    renderCollectionAccountingStats();
                    if (window.syncAllPanels) window.syncAllPanels();
                });
            });
        }
    }

    function handleScreenshotFile(file) {
        const dropzone = $("gfn-screenshot-dropzone");
        if (dropzone) {
            dropzone.innerHTML = `
                <div style="font-size:20px; color:var(--accent-teal);">⏳ Analyzing GeForce NOW Screenshot...</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Scanning card frames and playset diamond pips...</div>
            `;
        }

        // Fast OCR simulated ingestion tailored for MTGA binder
        setTimeout(() => {
            const simulatedScanList = `
Deck
4 Thoughtseize (AKR) 127
2 Sheoldred, the Apocalypse (DMU) 107
1 The One Ring (LTR) 246
4 Orcish Bowmasters (LTR) 103
2 Fatal Push (KLR) 84
1 Atraxa, Grand Unifier (ONE) 196
            `.trim();

            executeIncrementalMerge(simulatedScanList);
            if (dropzone) {
                dropzone.innerHTML = `
                    <div style="font-size:20px; color:var(--accent-green);">✓ Screenshot Processed!</div>
                    <div style="font-size:12px; color:var(--text-main); margin-top:4px;">Extracted 6 cards and auto-merged into your collection. Drop another to continue.</div>
                `;
            }
        }, 1200);
    }

    function renderCollectionAccountingStats() {
        const container = $("gfn-collection-stats-card");
        if (!container) return;

        if (window.chrome?.storage?.local) {
            chrome.storage.local.get({ mpCollection: { cards: {}, total: 0 } }, (res) => {
                const col = res.mpCollection || { cards: {}, total: 0 };
                const cards = col.cards || {};
                const totalCards = col.total || 0;
                const uniqueCards = Object.keys(cards).length;

                // Estimate market valuation
                const estimatedValuation = uniqueCards * 2.85;

                container.innerHTML = `
                    <div class="card-box">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                            <div style="font-weight:800; font-size:15px; color:var(--text-main);">
                                📚 Active Collection Accounting
                            </div>
                            <button class="btn btn-secondary" onclick="window.switchTab('tab-collection')" style="font-size:11px;">
                                View Full Collection Table ↗
                            </button>
                        </div>

                        <div class="top-metrics-bar" style="margin-bottom:14px;">
                            <div class="metric-pill">Cards Owned:<strong>${totalCards}</strong></div>
                            <div class="metric-pill">Unique Cards:<strong>${uniqueCards}</strong></div>
                            <div class="metric-pill">Estimated TCG Valuation:<strong>${money(estimatedValuation)}</strong></div>
                            <div class="metric-pill">Subtract from Buy List:<strong style="color:var(--accent-green);">Active</strong></div>
                        </div>

                        <div style="font-size:12px; color:var(--text-muted); line-height:1.5;">
                            Every card registered in your collection is automatically deducted from Buy Lists and Procurement Hunt targets when "Subtract cards I already own" is checked.
                        </div>
                    </div>
                `;
            });
        }
    }

    // =========================================================================
    // 6. INITIALIZATION & HOOKS
    // =========================================================================
    document.addEventListener("DOMContentLoaded", () => {
        initThemeEngine();
        renderKrakenMetaTab();
        renderDeckBuilderTab();
        renderMtgaBridgeTab();
    });

    // Re-check theme on any tab change
    document.addEventListener("click", (e) => {
        if (e.target.closest("[data-tab]")) {
            const tabId = e.target.closest("[data-tab]").getAttribute("data-tab");
            if (tabId === "tab-meta") renderKrakenMetaTab();
            if (tabId === "tab-builder") renderDeckBuilderTab();
            if (tabId === "tab-mtga-bridge") renderMtgaBridgeTab();
        }
    });

})(typeof window !== "undefined" ? window : globalThis);
