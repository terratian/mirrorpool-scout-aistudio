// Mirror Pool Scout: small floating "Send deck to Scout" button on deck pages of supported sites.
// No copy and paste: it reads the deck with deckextract.js and saves it to My Decks and the Buy List.
(function () {
    "use strict";
    if (!window.MPDeck || !window.MPDeck.detect()) return;
    if (document.getElementById("mirrorpool-deck-pill") || document.getElementById("mirrorpool-site-adapter")) return;

    const root = document.createElement("div");
    root.id = "mirrorpool-deck-pill";
    root.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483000;font:700 12px/1.3 system-ui,sans-serif;";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.cssText = "background:#0b1120;color:#00ffcc;border:1px solid #00ffcc;border-radius:999px;padding:9px 14px;font:800 12px system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.45)";
    btn.textContent = "◈ Send this deck to Scout";
    const msg = document.createElement("div");
    msg.style.cssText = "margin-top:6px;background:#0b1120;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:6px 10px;display:none;max-width:280px";
    root.append(btn, msg);
    document.body.appendChild(root);

    const say = (t, ok) => { msg.style.display = "block"; msg.style.borderColor = ok ? "#10b981" : "#f59e0b"; msg.textContent = t; };

    btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "Reading deck…";
        const r = await window.MPDeck.extract();
        if (!r.ok) { btn.disabled = false; btn.textContent = "◈ Send this deck to Scout"; say(r.reason || "Couldn't read a decklist here.", false); return; }
        const parsed = MPLists.parse(r.text);
        chrome.runtime.sendMessage({ action: "importDetectedToScout", mode: "deck", decklist: parsed.cards, deckName: r.title || "Imported deck", url: location.href }, (resp) => {
            btn.disabled = false;
            if (chrome.runtime.lastError || !resp || resp.status !== "success") { btn.textContent = "◈ Send this deck to Scout"; say("Couldn't reach Scout. Try again.", false); return; }
            btn.textContent = `✓ Sent ${r.count} cards`;
            say(`${r.title || "Deck"} saved to My Decks and your Buy List (${r.unique} unique, from ${r.source}). Open the Scout dashboard to see prices.`, true);
        });
    });
})();
