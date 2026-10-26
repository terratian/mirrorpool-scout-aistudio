console.log("🔮 Mirror Pool Scout: Universal Scraper Initialized");

function scrapeDecklist() {
    const decklist = [];
    const hostname = window.location.hostname;
    
    // Domain routing
    if (hostname.includes("mtgdecks.net")) {
        document.querySelectorAll("table tr").forEach(row => {
            const qty = row.querySelector(".td-qty, td:first-child");
            const name = row.querySelector(".td-card a, .card-name");
            if (qty && name && !isNaN(parseInt(qty.innerText))) {
                decklist.push({ quantity: parseInt(qty.innerText), cardName: name.innerText.trim() });
            }
        });
    } else if (hostname.includes("magic.gg") || hostname.includes("wizards.com")) {
        // Wizards often uses decklist containers with specific row classes
        document.querySelectorAll(".deck-list-row, .decklist-card").forEach(row => {
            const qty = row.querySelector(".deck-list-row-count, .card-count");
            const name = row.querySelector(".deck-list-row-name, .card-name");
            if (qty && name && !isNaN(parseInt(qty.innerText))) {
                decklist.push({ quantity: parseInt(qty.innerText), cardName: name.innerText.trim() });
            }
        });
    }
    
    console.log(`🔮 Scraped ${decklist.length} cards from ${hostname}`);
    return decklist;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extract_deck") {
        const list = scrapeDecklist();
        chrome.storage.local.set({ currentDecklist: list }, () => {
            sendResponse({ status: "success", count: list.length, data: list });
        });
        return true;
    }
});
