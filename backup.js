// Mirror Pool Scout: backup / restore format (pure functions, no DOM).
// One plain JSON file holds everything a user would hate to lose: decks, bookmarks, collection, alerts and settings.
// The same file is meant to be readable by a future web/phone version (PWA), so the shape is versioned and documented.
//   { app: "mirrorpool-scout", schema: 1, appVersion, exportedAt, data: { <storage key>: <value>, ... } }
// Licence keys are never included.
(function (root) {
    "use strict";

    const SCHEMA = 1;
    const KEYS = ["savedChaseLists", "mpBookmarks", "mpCollection", "useCollection", "hideOwned", "mpAlerts", "mpAlertSettings",
        "mpShipSettings", "mpFlipSettings", "mpLanded", "watchlist", "procurementTargets", "deckMeta", "affiliateEnabled"];

    function build(storage, appVersion) {
        const data = {};
        KEYS.forEach((k) => { if (storage[k] !== undefined && storage[k] !== null) data[k] = storage[k]; });
        return { app: "mirrorpool-scout", schema: SCHEMA, appVersion: appVersion || "", exportedAt: new Date().toISOString(), data };
    }

    function validate(obj) {
        if (!obj || typeof obj !== "object") return { ok: false, reason: "That file isn't a Mirror Pool Scout backup." };
        if (obj.app !== "mirrorpool-scout" || !obj.data || typeof obj.data !== "object") return { ok: false, reason: "That file isn't a Mirror Pool Scout backup." };
        if (!(obj.schema >= 1) || obj.schema > SCHEMA) return { ok: false, reason: "This backup is from a newer version of Scout. Update the extension and try again." };
        return { ok: true };
    }

    function summary(data) {
        const d = data || {};
        return {
            decks: Object.keys(d.savedChaseLists || {}).length,
            bookmarks: (d.mpBookmarks || []).length,
            collection: d.mpCollection && d.mpCollection.total ? d.mpCollection.total : 0,
            alerts: Object.keys(d.mpAlerts || {}).length
        };
    }

    // Combine a backup into what is already stored. Nothing the user has now is thrown away.
    function merge(existing, incoming) {
        const out = {};
        const ex = existing || {}, inc = incoming || {};
        // decks: by name, newest wins
        const decks = Object.assign({}, ex.savedChaseLists || {});
        Object.keys(inc.savedChaseLists || {}).forEach((n) => {
            const a = decks[n], b = inc.savedChaseLists[n];
            if (!a || (b.updatedAt || 0) > (a.updatedAt || 0)) decks[n] = b;
        });
        if (Object.keys(decks).length) out.savedChaseLists = decks;
        // bookmarks / watchlist: union by url
        const union = (a, b) => {
            const seen = new Set(), res = [];
            (a || []).concat(b || []).forEach((x) => { const u = x && x.url; if (!u || seen.has(u)) return; seen.add(u); res.push(x); });
            return res;
        };
        const bm = union(ex.mpBookmarks, inc.mpBookmarks); if (bm.length) out.mpBookmarks = bm;
        const wl = union(ex.watchlist, inc.watchlist); if (wl.length) out.watchlist = wl;
        // collection: larger quantity per card wins (a backup should never lower what you own)
        if (ex.mpCollection || inc.mpCollection) {
            const cards = Object.assign({}, (ex.mpCollection || {}).cards || {});
            Object.keys((inc.mpCollection || {}).cards || {}).forEach((k) => {
                const b = inc.mpCollection.cards[k];
                if (!cards[k] || b.q > cards[k].q) cards[k] = b;
            });
            const total = Object.values(cards).reduce((n, c) => n + c.q, 0);
            out.mpCollection = { cards, total, unique: Object.keys(cards).length, updatedAt: Date.now(), source: "merged backup" };
        }
        // alert targets: existing wins
        const al = Object.assign({}, inc.mpAlerts || {}, ex.mpAlerts || {}); if (Object.keys(al).length) out.mpAlerts = al;
        // settings and the active list: keep what is there, fill gaps from the backup
        ["mpAlertSettings", "mpShipSettings", "mpFlipSettings", "deckMeta", "useCollection", "hideOwned", "affiliateEnabled", "procurementTargets"].forEach((k) => {
            const v = ex[k] !== undefined && ex[k] !== null && !(Array.isArray(ex[k]) && !ex[k].length) ? ex[k] : inc[k];
            if (v !== undefined) out[k] = v;
        });
        return out;
    }

    const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    // Netscape bookmark file: Chrome, Firefox, Safari and Edge can all import this.
    function bookmarksHtml(list) {
        const rows = (list || []).map((b) => `        <DT><A HREF="${escHtml(b.url)}" ADD_DATE="${Math.floor((b.savedAt || Date.now()) / 1000)}">${escHtml(b.title || b.url)}</A>`).join("\n");
        return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n    <DT><H3>Mirror Pool Scout</H3>\n    <DL><p>\n${rows}\n    </DL><p>\n</DL><p>\n`;
    }

    const csvq = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    function bookmarksCsv(list) {
        return ["Title,URL,Source,Note,Saved"].concat((list || []).map((b) => [csvq(b.title), csvq(b.url), csvq(b.source), csvq(b.note), csvq(b.savedAt ? new Date(b.savedAt).toISOString() : "")].join(","))).join("\n");
    }

    const api = { SCHEMA, KEYS, build, validate, summary, merge, bookmarksHtml, bookmarksCsv };
    root.MPBackup = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
