const TCG_METRICS_SCHEMA = {
    "mtggoldfish.com": {
        siteName: "MTGGoldfish",
        targetKey: "watchlist_cards",
        extract: () => {
            let cardName = "Unknown Card";
            const h1s = document.querySelectorAll("h1");
            for (let h of h1s) {
                const text = h.innerText.trim();
                if (text && !text.includes("Privacy") && !text.includes("CCPA") && !text.includes("Cookie") && !text.includes("MTGGoldfish")) {
                    cardName = text.split("#")[0].replace("Price", "").trim();
                    break;
                }
            }
            const tabletopEl = document.querySelector(".tweak-price-tabletop, .price-box-price");
            const mtgoEl = document.querySelector(".tweak-price-mtgo");
            return {
                cardName: cardName,
                metricA: "Paper Floor",
                valueA: tabletopEl ? tabletopEl.innerText.trim() : "N/A",
                metricB: "MTGO TIX",
                valueB: mtgoEl ? mtgoEl.innerText.trim() : "N/A",
                actionType: "goldfish_card"
            };
        }
    },
    "ebay.com": {
        siteName: "eBay Auction",
        targetKey: "card_chase",
        extract: () => {
            const titleEl = document.querySelector(".x-item-title__mainTitle span, h1");
            const bidEl = document.querySelector(".x-price-primary span, .main-price span");
            const shipEl = document.querySelector(".ux-shipping-cost span, .shipping-cost");
            return {
                cardName: titleEl ? titleEl.innerText.trim() : "eBay Listing",
                metricA: "Current Bid",
                valueA: bidEl ? bidEl.innerText.trim() : "N/A",
                metricB: "Shipping",
                valueB: shipEl ? shipEl.innerText.trim() : "Calculated",
                actionType: "tcg_product"
            };
        }
    },
    "tcgplayer.com": {
        siteName: "TCGplayer Marketplace",
        targetKey: "card_chase",
        extract: () => {
            const titleEl = document.querySelector(".product-details__name");
            const priceEl = document.querySelector(".product-details__price");
            return {
                cardName: titleEl ? titleEl.innerText.trim() : "TCG Product",
                metricA: "Market Price",
                valueA: priceEl ? priceEl.innerText.trim() : "N/A",
                metricB: "Variant",
                valueB: "Standard/Foil",
                actionType: "tcg_product"
            };
        }
    },
    "mtgdecks.net": {
        siteName: "MTGDecks Analyzer",
        targetKey: "currentDecklist",
        extract: () => {
            return {
                cardName: document.title.split("|")[0].trim() || "Active Decklist",
                metricA: "Detected Format",
                valueA: "Competitive Meta",
                metricB: "Spreads",
                valueB: "Computed",
                actionType: "decklist_scrape"
            };
        }
    }
};
