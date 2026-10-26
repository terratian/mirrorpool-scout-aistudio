// Mirror Pool Scout - Web Extension API Shim
// Enables full standalone browser and web runtime execution of the extension terminal.
(function () {
    "use strict";

    if (typeof window === "undefined") return;

    // In-app non-blocking notification toast (replaces blocking window.alert inside iframe)
    function showAppToast(msg, type = "info") {
        let container = document.getElementById("mp-global-toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "mp-global-toast-container";
            container.style.cssText = "position:fixed; bottom:24px; right:24px; z-index:999999; display:flex; flex-direction:column; gap:8px; pointer-events:none; max-width:380px;";
            document.body ? document.body.appendChild(container) : document.addEventListener("DOMContentLoaded", () => document.body.appendChild(container));
        }
        const toast = document.createElement("div");
        toast.style.cssText = "background:#0f172a; color:#f8fafc; border:1px solid #10b981; border-radius:8px; padding:10px 14px; font-size:12px; font-weight:600; box-shadow:0 10px 25px rgba(0,0,0,0.6); pointer-events:auto; display:flex; align-items:center; gap:8px; opacity:0; transform:translateY(10px); transition:all 0.25s ease;";
        const icon = type === "warning" ? "⚠️" : (type === "success" ? "✓" : "◈");
        toast.innerHTML = `<span style="color:#00ffcc; font-size:14px;">${icon}</span><span style="flex:1;">${String(msg)}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateY(0)";
        });
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Safely wrap window.alert to prevent iframe permission blocks
    const originalAlert = window.alert;
    window.alert = function (msg) {
        showAppToast(msg, "warning");
    };

    const STORAGE_KEY = "mp_scout_extension_storage_v1";

    // Seed realistic starting data so terminal opens fully populated with live MTG comp tracking
    const DEFAULT_DATA = {
        scoutArmed: true,
        affiliateEnabled: true,
        licenseValid: true,
        deckMeta: {
            deckName: "Modern & Commander Staples",
            printingTarget: "Normal",
            conditionFloor: "LP"
        },
        currentDecklist: [
            { cardName: "The One Ring", quantity: 1, acquired: 0, basis: 0 },
            { cardName: "Orcish Bowmasters", quantity: 2, acquired: 0, basis: 0 },
            { cardName: "Thoughtseize", quantity: 4, acquired: 2, basis: 34.00 },
            { cardName: "Astral Dragon", quantity: 1, acquired: 0, basis: 0 },
            { cardName: "Teferi's Protection", quantity: 1, acquired: 0, basis: 0 },
            { cardName: "Roaming Throne", quantity: 1, acquired: 0, basis: 0 },
            { cardName: "Professor Onyx", quantity: 1, acquired: 1, basis: 4.50 }
        ],
        procurementTargets: [
            { cardName: "The One Ring", quantity: 1, acquired: 0, basis: 0 },
            { cardName: "Orcish Bowmasters", quantity: 2, acquired: 0, basis: 0 },
            { cardName: "Thoughtseize", quantity: 4, acquired: 2, basis: 34.00 },
            { cardName: "Astral Dragon", quantity: 1, acquired: 0, basis: 0 },
            { cardName: "Teferi's Protection", quantity: 1, acquired: 0, basis: 0 },
            { cardName: "Roaming Throne", quantity: 1, acquired: 0, basis: 0 },
            { cardName: "Professor Onyx", quantity: 1, acquired: 1, basis: 4.50 }
        ],
        savedChaseLists: {
            "Modern & Commander Staples": {
                cards: [
                    { cardName: "The One Ring", quantity: 1, acquired: 0, basis: 0 },
                    { cardName: "Orcish Bowmasters", quantity: 2, acquired: 0, basis: 0 },
                    { cardName: "Thoughtseize", quantity: 4, acquired: 2, basis: 34.00 },
                    { cardName: "Astral Dragon", quantity: 1, acquired: 0, basis: 0 },
                    { cardName: "Teferi's Protection", quantity: 1, acquired: 0, basis: 0 },
                    { cardName: "Roaming Throne", quantity: 1, acquired: 0, basis: 0 },
                    { cardName: "Professor Onyx", quantity: 1, acquired: 1, basis: 4.50 }
                ],
                meta: { deckName: "Modern & Commander Staples", printingTarget: "Normal", conditionFloor: "LP" },
                updatedAt: Date.now()
            }
        },
        watchlist: [
            {
                cardName: "The One Ring",
                title: "The One Ring - Borderless Scene Card Near Mint MTG",
                marketFloor: 58.00,
                totalCost: 46.50,
                timeLeft: "3h 12m",
                activity: "14 Bidders / 38 Watchers",
                url: "https://www.ebay.com/sch/i.html?_nkw=MTG+%22The+One+Ring%22+-proxy"
            },
            {
                cardName: "Orcish Bowmasters",
                title: "Orcish Bowmasters - The Lord of the Rings: Tales of Middle-earth NM",
                marketFloor: 48.00,
                totalCost: 39.99,
                timeLeft: "1d 4h",
                activity: "Buy It Now (<85%)",
                url: "https://www.ebay.com/sch/i.html?_nkw=MTG+%22Orcish+Bowmasters%22+-proxy"
            },
            {
                cardName: "Astral Dragon",
                title: "Astral Dragon - Commander Legends: Battle for Baldur's Gate Foil",
                marketFloor: 18.58,
                totalCost: 14.80,
                timeLeft: "5h 45m",
                activity: "8 Bidders",
                url: "https://www.ebay.com/sch/i.html?_nkw=MTG+%22Astral+Dragon%22+-proxy"
            }
        ],
        mpBookmarks: [
            {
                title: "The One Ring (MTG LOTR)",
                marketFloor: 58.00,
                totalCost: 46.50,
                url: "https://www.ebay.com/sch/i.html?_nkw=MTG+%22The+One+Ring%22+-proxy"
            }
        ]
    };

    let localStore = {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            localStore = JSON.parse(raw);
        } else {
            localStore = Object.assign({}, DEFAULT_DATA);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(localStore));
        }
    } catch (e) {
        localStore = Object.assign({}, DEFAULT_DATA);
    }

    const listeners = [];

    function saveStore() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(localStore));
        } catch (e) {
            console.warn("localStorage quota or error", e);
        }
    }

    function dispatchStorageChange(changes) {
        listeners.forEach(fn => {
            try { fn(changes, "local"); } catch (err) { console.error("storage listener error", err); }
        });
    }

    // Build chrome namespace
    window.chrome = window.chrome || {};
    window.chrome.runtime = window.chrome.runtime || {};
    window.chrome.storage = window.chrome.storage || {};

    window.chrome.storage.local = {
        get: function (keys, callback) {
            let res = {};
            if (typeof keys === "string") {
                res[keys] = localStore[keys];
            } else if (Array.isArray(keys)) {
                keys.forEach(k => { res[k] = localStore[k]; });
            } else if (typeof keys === "object" && keys !== null) {
                Object.keys(keys).forEach(k => {
                    res[k] = localStore[k] !== undefined ? localStore[k] : keys[k];
                });
            } else if (!keys) {
                res = Object.assign({}, localStore);
            }
            if (typeof callback === "function") {
                setTimeout(() => callback(res), 0);
            }
            return Promise.resolve(res);
        },
        set: function (items, callback) {
            const changes = {};
            Object.keys(items || {}).forEach(k => {
                changes[k] = { oldValue: localStore[k], newValue: items[k] };
                localStore[k] = items[k];
            });
            saveStore();
            dispatchStorageChange(changes);
            if (typeof callback === "function") {
                setTimeout(callback, 0);
            }
            return Promise.resolve();
        },
        remove: function (keys, callback) {
            const list = Array.isArray(keys) ? keys : [keys];
            const changes = {};
            list.forEach(k => {
                changes[k] = { oldValue: localStore[k], newValue: undefined };
                delete localStore[k];
            });
            saveStore();
            dispatchStorageChange(changes);
            if (typeof callback === "function") setTimeout(callback, 0);
            return Promise.resolve();
        },
        clear: function (callback) {
            localStore = {};
            saveStore();
            if (typeof callback === "function") setTimeout(callback, 0);
            return Promise.resolve();
        }
    };

    window.chrome.storage.onChanged = {
        addListener: function (fn) {
            if (typeof fn === "function" && !listeners.includes(fn)) {
                listeners.push(fn);
            }
        },
        removeListener: function (fn) {
            const idx = listeners.indexOf(fn);
            if (idx !== -1) listeners.splice(idx, 1);
        }
    };

    window.chrome.runtime.lastError = null;
    window.chrome.runtime.getURL = function (path) {
        return path;
    };

    const messageListeners = [];
    window.chrome.runtime.onMessage = {
        addListener: function (fn) {
            messageListeners.push(fn);
        }
    };

    window.chrome.runtime.sendMessage = function (message, callback) {
        if (typeof message === "object" && message !== null) {
            if (message.action === "fetchCollectionPrices" && message.cardNames) {
                if (window.MPScry && typeof window.MPScry.fetchPrices === "function") {
                    window.MPScry.fetchPrices(message.cardNames).then(res => {
                        if (typeof callback === "function") callback(res);
                    }).catch(err => {
                        if (typeof callback === "function") callback({ prices: {}, error: String(err) });
                    });
                    return true;
                }
            }
        }
        if (typeof callback === "function") {
            setTimeout(() => callback(null), 0);
        }
        return false;
    };

    window.chrome.runtime.onInstalled = { addListener: function () {} };
    window.chrome.runtime.onStartup = { addListener: function () {} };

    window.chrome.tabs = window.chrome.tabs || {
        create: function (opts) {
            if (opts && opts.url) {
                window.open(opts.url, "_blank");
            }
        },
        query: function (queryInfo, callback) {
            if (typeof callback === "function") {
                setTimeout(() => callback([]), 0);
            }
        }
    };

    window.chrome.alarms = window.chrome.alarms || {
        create: function () {},
        clear: function (name, cb) { if (cb) cb(); },
        onAlarm: { addListener: function () {} }
    };

    window.chrome.notifications = window.chrome.notifications || {
        create: function (id, opts, cb) {
            showAppToast(`${opts?.title || "Alert"}: ${opts?.message || ""}`, "info");
            if (cb) cb(id);
        },
        clear: function (id, cb) { if (cb) cb(); },
        onClicked: { addListener: function () {} }
    };

    window.chrome.action = window.chrome.action || {
        setBadgeText: function () {},
        setBadgeBackgroundColor: function () {},
        onClicked: { addListener: function () {} }
    };

    window.chrome.scripting = window.chrome.scripting || {
        executeScript: function () {
            return Promise.resolve([]);
        }
    };
})();
