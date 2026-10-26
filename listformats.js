// Mirror Pool Scout: universal card-list reader/writer.
// Reads what MTGGoldfish, MTGDecks, MTGO (.dek), Arena, Moxfield, Archidekt, TCGplayer, ManaBox,
// Deckbox and generic spreadsheets hand you, and writes the same formats back out.
(function (root) {
    "use strict";

    function parseCsvRows(text) {
        const rows = [];
        let row = [], cell = "", q = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (q) {
                if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
                else cell += ch;
            } else if (ch === '"') q = true;
            else if (ch === ",") { row.push(cell); cell = ""; }
            else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
            else if (ch !== "\r") cell += ch;
        }
        if (cell.length || row.length) { row.push(cell); rows.push(row); }
        return rows.filter((r) => r.some((c) => c.trim() !== ""));
    }

    const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
    const isFoilWord = (v) => /^(foil|etched|true|yes|y|1|f)$/i.test(String(v || "").trim()) || /foil|etched/i.test(String(v || ""));

    function parseCsv(text) {
        const rows = parseCsvRows(text);
        if (rows.length < 2) return null;
        const head = rows[0].map(norm);
        const find = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
        const iName = find("name", "card name", "card", "simple name");
        const iQty = find("quantity", "qty", "count", "amount", "owned", "have", "total quantity");
        if (iName < 0 || iQty < 0) return null;
        let iSet = find("set code", "set", "edition code");
        if (iSet < 0) iSet = find("edition");
        const iCn = find("collector number", "card number", "number");
        const iFoil = find("foil", "printing", "finish");
        let format = "CSV spreadsheet";
        if (head.includes("manabox id")) format = "ManaBox CSV";
        else if (head.includes("product id") || head.includes("simple name")) format = "TCGplayer CSV";
        else if (head.includes("tradelist count")) format = "Moxfield CSV";
        else if (head.includes("edition") && head.includes("card number")) format = "Deckbox CSV";
        const cards = [], skipped = [];
        rows.slice(1).forEach((r, k) => {
            const name = (r[iName] || "").trim();
            const qty = parseInt(String(r[iQty] || "").replace(/[^\d]/g, ""), 10);
            if (!name || !(qty > 0)) { skipped.push("row " + (k + 2)); return; }
            let set = iSet >= 0 ? (r[iSet] || "").trim() : "";
            if (set.length > 6) set = ""; // a full set name, not a code
            cards.push({ cardName: name, quantity: qty, set: set.toUpperCase(), cn: iCn >= 0 ? (r[iCn] || "").trim() : "", foil: iFoil >= 0 ? isFoilWord(r[iFoil]) : false });
        });
        return { format, cards, skipped };
    }

    function parseDek(text) {
        if (!/<Deck[\s>]/i.test(text) || !/<Cards\b/i.test(text)) return null;
        const cards = [];
        const re = /<Cards\b([^>]*)\/?>/gi;
        let m;
        while ((m = re.exec(text))) {
            const a = m[1];
            const q = /Quantity="(\d+)"/i.exec(a), n = /Name="([^"]+)"/i.exec(a);
            if (q && n) cards.push({ cardName: n[1].replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"'), quantity: parseInt(q[1], 10), set: "", cn: "", foil: false });
        }
        return { format: "MTGO .dek file", cards, skipped: [] };
    }

    const HEADER = /^(deck|main\s?deck|mainboard|main|sideboard|side\s?board|side|commander|companion|maybeboard|considering|about|lands?|creatures?|instants?|sorceries|sorcery|artifacts?|enchantments?|planeswalkers?|battles?|other)\b[\s:]*(\(\d+\))?\s*$/i;

    function cleanName(raw) {
        let s = raw, set = "", cn = "", foil = false;
        if (/\*[FE]\*|\((foil|etched)\)|\[(foil|etched)\]|\s-\s*foil\b|\bfoil$/i.test(s)) foil = true;
        s = s.replace(/\*[FE]\*/gi, " ").replace(/[\(\[](foil|etched)[\)\]]/gi, " ").replace(/\s-\s*foil\b/i, " ");
        s = s.replace(/\s+\$\s?\d+(\.\d+)?\s*$/, ""); // trailing price
        let m = /\s*\(([A-Za-z0-9]{2,6})\)\s*([A-Za-z0-9★\-]+)?\s*$/.exec(s);        // Arena / Moxfield: Name (SET) 123
        if (m) { set = m[1]; cn = m[2] || ""; s = s.slice(0, m.index); }
        else if ((m = /\s*\[([A-Za-z0-9]{2,6})(?::\s*([A-Za-z0-9★\-]+))?\]\s*$/.exec(s))) { set = m[1]; cn = m[2] || ""; s = s.slice(0, m.index); } // TCGplayer: Name [SET]
        else if ((m = /\s+#(\d+)\s*$/.exec(s))) { cn = m[1]; s = s.slice(0, m.index); }
        s = s.replace(/\s+/g, " ").replace(/[,;]+$/, "").trim();
        return { name: s, set: set.toUpperCase(), cn, foil };
    }

    function parseText(text) {
        const cards = [], skipped = [];
        let deckName = "", board = "main";
        let sawSet = false, sawBracket = false, sawSB = false, sawX = false;
        text.split("\n").forEach((line0) => {
            let line = line0.replace(/\r/g, "").trim();
            if (!line) return;
            let m;
            if ((m = /^(?:name|deck)\s*:\s*(.+)$/i.exec(line))) { if (!deckName) deckName = m[1].trim(); return; }
            if (/^(\/\/|#)/.test(line)) { if (!deckName && /^(\/\/|#)\s*(?:name|deck)\s*:?\s*(.+)/i.test(line)) deckName = RegExp.$2.trim(); return; }
            if (HEADER.test(line)) { board = /^(side)/i.test(line) ? "side" : /^(maybe|consider)/i.test(line) ? "maybe" : "main"; return; }
            if (/^[A-Za-z][A-Za-z ]*\s*\(\d+\)\s*$/.test(line)) return; // Moxfield/Archidekt group headings: "Creatures (12)"
            let b = board;
            if (/^SB:\s*/i.test(line)) { line = line.replace(/^SB:\s*/i, ""); b = "side"; sawSB = true; }
            if (b === "maybe") return;
            let qty = 0, rest = "";
            if ((m = /^(\d{1,4})\s*[xX]?\s+(.+)$/.exec(line))) { qty = parseInt(m[1], 10); rest = m[2]; if (/^\d+\s*[xX]\s/.test(line)) sawX = true; }
            else if ((m = /^(.+?)\s+[xX]\s*(\d{1,4})$/.exec(line))) { qty = parseInt(m[2], 10); rest = m[1]; sawX = true; }
            else if (/^[A-Za-z][^\d]{2,78}$/.test(line) && !/:$/.test(line)) { qty = 1; rest = line; } // a bare card name
            else { skipped.push(line0.trim()); return; }
            const c = cleanName(rest);
            if (!c.name || !/[A-Za-z]/.test(c.name) || c.name.length > 90 || !(qty > 0)) { skipped.push(line0.trim()); return; }
            if (c.set) { if (/\[/.test(rest)) sawBracket = true; else sawSet = true; }
            cards.push({ cardName: c.name, quantity: qty, set: c.set, cn: c.cn, foil: c.foil, board: b });
        });
        let format = "Plain list (MTGGoldfish, MTGDecks, MTGO)";
        if (sawBracket) format = "TCGplayer list";
        else if (sawSet) format = "Arena / Moxfield list";
        else if (sawSB) format = "MTGO list";
        else if (sawX) format = "Quantity-x list";
        return { format, cards, skipped, deckName };
    }

    function merge(cards) {
        const map = new Map();
        cards.forEach((c) => {
            const key = c.cardName.toLowerCase();
            const hit = map.get(key);
            if (hit) { hit.quantity += c.quantity; hit.foil = hit.foil || c.foil; if (!hit.set && c.set) { hit.set = c.set; hit.cn = c.cn; } }
            else map.set(key, { cardName: c.cardName, quantity: c.quantity, acquired: 0, basis: 0, set: c.set || "", cn: c.cn || "", foil: !!c.foil });
        });
        return Array.from(map.values());
    }

    function parse(input) {
        const text = String(input || "").replace(/^﻿/, "");
        const res = parseDek(text) || (/,/.test(text.split("\n")[0] || "") ? parseCsv(text) : null) || parseText(text);
        const cards = merge(res.cards);
        const total = cards.reduce((n, c) => n + c.quantity, 0);
        return { format: res.format, cards, total, skipped: res.skipped || [], deckName: res.deckName || "" };
    }

    const csvq = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';

    // kind: plain | mtgo | arena | tcgplayer | manabox | csv
    function format(cards, kind) {
        const rows = (cards || []).filter((c) => c.qty > 0 || c.quantity > 0).map((c) => ({ n: c.cardName, q: c.qty || c.quantity, set: c.set || "", cn: c.cn || "", foil: !!c.foil }));
        switch (kind) {
            case "arena": return rows.map((r) => `${r.q} ${r.n}${r.set ? ` (${r.set}) ${r.cn}`.trimEnd() : ""}`).join("\n");
            case "manabox": return ["Name,Set code,Collector number,Foil,Quantity"].concat(rows.map((r) => [csvq(r.n), csvq(r.set), csvq(r.cn), r.foil ? "foil" : "normal", r.q].join(","))).join("\n");
            case "csv": return ["Quantity,Name,Set,Collector Number,Foil"].concat(rows.map((r) => [r.q, csvq(r.n), csvq(r.set), csvq(r.cn), r.foil ? "Foil" : ""].join(","))).join("\n");
            default: return rows.map((r) => `${r.q} ${r.n}`).join("\n"); // plain / mtgo / tcgplayer mass entry
        }
    }

    const api = { parse, format };
    root.MPLists = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
