// Mirror Pool Scout - affiliate link decorator (single source of truth for the developer's IDs).
//
// Loaded by dashboard.html and by the auto-detector content script.
// Links are decorated ONLY at the moment the user clicks them (never on page load, never in the
// background), which is what the eBay Partner Network, Impact and Chrome Web Store rules expect.
// A visible disclosure + opt-out lives in Settings (storage key: affiliateEnabled, default on).
(function (root) {
    "use strict";

    const AFFILIATE = {
        // eBay Partner Network (US). Standard rover-style parameters for deep links to ebay.com.
        epnCampId: "5339224696",
        epnCustomId: "mpscout",
        // Impact (TCGplayer program). Account id = "Mirror Pool Scout" media partner id.
        impactAccountId: "9019865",
        impactProgramId: "21018",
        // Paste the tracking-link base from Impact > Create Tracking Link > TCGplayer, WITHOUT the ?u= part, e.g.
        //   https://tcgplayer.pxf.io/c/9019865/<AD_ID>/21018
        // Left empty on purpose: until it is set, TCGplayer links are left untouched rather than risking dead links.
        impactTrackingBase: "",
        impactSubId: "mpscout"
    };

    let enabled = true;
    try {
        chrome.storage.local.get({ affiliateEnabled: true }, (r) => { enabled = r.affiliateEnabled !== false; });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && changes.affiliateEnabled) enabled = changes.affiliateEnabled.newValue !== false;
        });
    } catch (e) { /* not in an extension context (tests): stay enabled */ }

    function hostIs(host, domain) { return host === domain || host.endsWith("." + domain); }

    function decorate(href) {
        if (!enabled || !href) return href;
        let u;
        try { u = new URL(href); } catch (e) { return href; }
        if (u.protocol !== "https:" && u.protocol !== "http:") return href;
        const host = u.hostname.toLowerCase();

        // eBay: search and item pages only.
        if (hostIs(host, "ebay.com") && /^\/(sch|itm)\//.test(u.pathname)) {
            if (u.searchParams.has("campid")) return href;
            u.searchParams.set("mkcid", "1");
            u.searchParams.set("mkrid", "711-53200-19255-0");
            u.searchParams.set("siteid", "0");
            u.searchParams.set("campid", AFFILIATE.epnCampId);
            u.searchParams.set("customid", AFFILIATE.epnCustomId);
            u.searchParams.set("toolid", "10001");
            u.searchParams.set("mkevt", "1");
            return u.toString();
        }

        // TCGplayer via Impact: only when a tracking base has been configured.
        if (AFFILIATE.impactTrackingBase && hostIs(host, "tcgplayer.com") && !hostIs(host, "partner.tcgplayer.com")) {
            return AFFILIATE.impactTrackingBase + "?subId1=" + encodeURIComponent(AFFILIATE.impactSubId) + "&u=" + encodeURIComponent(href);
        }
        return href;
    }

    // On the dashboard every link is ours. Inside a content script (someone else's page) ONLY links that
    // Scout itself rendered are touched; the site's own links are never rewritten.
    const SCOUT_UI = "#mirrorpool-site-adapter, #mirrorpool-scavenger-bar, #mirrorpool-badge-root";
    function isScoutLink(a) {
        try { if (location.protocol === "chrome-extension:") return true; } catch (e) { return false; }
        return !!a.closest(SCOUT_UI);
    }

    // Decorate an <a> just before the browser follows it (left click, middle click, Enter).
    function onActivate(e) {
        const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
        if (!a || !isScoutLink(a)) return;
        const next = decorate(a.href);
        if (next !== a.href) a.href = next;
    }
    try {
        document.addEventListener("click", onActivate, true);
        document.addEventListener("auxclick", onActivate, true);
    } catch (e) { /* no document (service worker / tests) */ }

    function open(href, target) { return window.open(decorate(href), target || "_blank", "noopener"); }

    const api = { AFFILIATE: AFFILIATE, decorate: decorate, open: open, setEnabled: (v) => { enabled = !!v; } };
    root.MPAffiliate = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
