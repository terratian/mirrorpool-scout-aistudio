// Mirror Pool Scout: deck-page recognizer. Injected on demand (dashboard button) or by deckpill.js (floating button).
// Needs listformats.js loaded first (MPLists). Returns { ok, title, text, count, source } and never throws.
// Strategy per site: use the site's own plain-text export when it has one (most reliable), else read the page.
(function (root) {
    "use strict";

    const host = () => location.hostname.replace(/^www\./, "");
    const SITES = [
        { id: "MTGGoldfish", test: (h, p) => /mtggoldfish\.com$/.test(h) && /^\/(deck|archetype)\//.test(p) },
        { id: "Archidekt",   test: (h, p) => /archidekt\.com$/.test(h) && /^\/decks\/\d+/.test(p) },
        { id: "Moxfield",    test: (h, p) => /moxfield\.com$/.test(h) && /^\/decks\//.test(p) },
        { id: "Scryfall",    test: (h, p) => /scryfall\.com$/.test(h) && /\/decks\//.test(p) },
        { id: "TappedOut",   test: (h, p) => /tappedout\.net$/.test(h) && /^\/mtg-decks\//.test(p) },
        { id: "Deckstats",   test: (h, p) => /deckstats\.net$/.test(h) && /^\/decks\//.test(p) },
        { id: "MTGTop8",     test: (h, p) => /mtgtop8\.com$/.test(h) && /[?&]d=\d+/.test(location.search) },
        { id: "MTGDecks",    test: (h, p) => /mtgdecks\.net$/.test(h) },
        { id: "EDHREC",      test: (h, p) => /edhrec\.com$/.test(h) && /^\/(deckpreview|decks)\//.test(p) },
        { id: "AetherHub",   test: (h, p) => /aetherhub\.com$/.test(h) && /\/Deck\//i.test(p) },
        { id: "Magic.gg / Wizards", test: (h) => /(magic\.gg|wizards\.com)$/.test(h) }
    ];

    function siteFor() {
        const h = host(), p = location.pathname;
        return SITES.find((s) => s.test(h, p)) || null;
    }

    const pageTitle = () => {
        const h1 = document.querySelector("h1");
        const t = (h1 && (h1.childNodes[0] && h1.childNodes[0].textContent || h1.innerText) || document.title || "").trim();
        return t.split("\n")[0].replace(/\s*[\|–\-]\s*(MTGGoldfish|Archidekt|Moxfield|Scryfall|TappedOut|Deckstats|MTG Decks|EDHREC|AetherHub).*$/i, "").trim().slice(0, 80);
    };

    async function getText(url, asJson) {
        const r = await fetch(url, { credentials: "include" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return asJson ? r.json() : r.text();
    }

    const ADAPTERS = {
        MTGGoldfish: async () => {
            const m = /\/deck\/(?:download\/|arena_download\/|visual\/)?(\d+)/.exec(location.pathname) || /\/deck\/(\d+)/.exec(location.pathname);
            if (!m) return "";
            return getText(`/deck/download/${m[1]}`);
        },
        Archidekt: async () => {
            const m = /\/decks\/(\d+)/.exec(location.pathname);
            if (!m) return "";
            const j = await getText(`https://archidekt.com/api/decks/${m[1]}/`, true);
            const skip = /maybeboard|considering/i;
            return (j.cards || []).filter((c) => !(c.categories || []).some((x) => skip.test(x)))
                .map((c) => `${c.quantity} ${c.card && c.card.oracleCard ? c.card.oracleCard.name : (c.card && c.card.name) || ""}`).filter((l) => /\d+ \S/.test(l)).join("\n");
        },
        Moxfield: async () => {
            const m = /\/decks\/([A-Za-z0-9_-]+)/.exec(location.pathname);
            if (!m) return "";
            const j = await getText(`https://api2.moxfield.com/v2/decks/all/${m[1]}`, true);
            const out = [];
            ["mainboard", "sideboard", "commanders", "companions"].forEach((b) => {
                Object.values(j[b] || {}).forEach((e) => out.push(`${e.quantity} ${e.card && e.card.name}`));
            });
            return out.join("\n");
        },
        Scryfall: async () => {
            const m = /\/decks\/([0-9a-f-]{36})/i.exec(location.pathname);
            if (!m) return "";
            return getText(`https://api.scryfall.com/decks/${m[1]}/export/text`);
        },
        TappedOut: async () => getText(location.pathname + "?fmt=txt"),
        Deckstats: async () => getText(location.pathname + "?export_txt=1")
    };

    // Reads a decklist straight off the page when the site has no usable export.
    function readDom() {
        // 1) a textarea / pre that already holds the list
        const blocks = Array.from(document.querySelectorAll("textarea, pre, code"));
        for (const b of blocks) {
            const t = (b.value || b.innerText || "").trim();
            if (t.split("\n").length >= 5 && MPLists.parse(t).cards.length >= 5) return t;
        }
        // 2) rows with a quantity and a card link
        const lines = [];
        const seen = new Set();
        document.querySelectorAll("tr, li, div.deck-col-card, div[class*='card-row'], div[class*='cardrow'], div[class*='deck-row']").forEach((row) => {
            const txt = (row.innerText || "").replace(/\s+/g, " ").trim();
            if (!txt || txt.length > 120) return;
            const qm = /^(\d{1,3})\s*x?\s+/i.exec(txt);
            const a = row.querySelector("a");
            if (!qm || !a) return;
            const name = (a.innerText || "").trim();
            if (!name || name.length < 2 || name.length > 60 || /^\d+$/.test(name)) return;
            const line = `${qm[1]} ${name}`;
            if (seen.has(row)) return;
            seen.add(row);
            lines.push(line);
        });
        return lines.length >= 5 ? lines.join("\n") : "";
    }

    async function extract() {
        try {
            const site = siteFor();
            let text = "";
            const tried = [];
            if (site && ADAPTERS[site.id]) {
                try { text = await ADAPTERS[site.id](); tried.push("export"); } catch (e) { text = ""; }
            }
            if (!text || MPLists.parse(text).cards.length < 1) { text = readDom(); tried.push("page"); }
            const parsed = MPLists.parse(text || "");
            if (!parsed.cards.length) return { ok: false, source: site ? site.id : host(), reason: "No decklist found on this page." };
            return { ok: true, source: site ? site.id : host(), title: parsed.deckName || pageTitle(), text, count: parsed.total, unique: parsed.cards.length, format: parsed.format, via: tried[tried.length - 1] };
        } catch (e) {
            return { ok: false, reason: String(e && e.message || e) };
        }
    }

    root.MPDeck = { siteFor, extract, detect: () => !!siteFor() };
})(typeof self !== "undefined" ? self : globalThis);
