<div align="center">

# Flick × Channel3

### Your usual groceries, priced at real online stores.

[![API](https://img.shields.io/badge/Channel3-POST%20%2Fv1%2Fsearch-111827?style=flat-square)](../backend/src/scout.ts)
[![Agent](https://img.shields.io/badge/agent-Scout-FB923C?style=flat-square)](../backend/src/scout.ts)
[![Live](https://img.shields.io/badge/live-flickit.site%2Fscout-36D1DC?style=flat-square)](https://www.flickit.site/scout)

**Channel3 is where Scout, Flick's grocery agent, gets real prices from real online stores, so
"cheaper elsewhere" is a fact you can open and buy.**

</div>

> **Track:** Best Use of Channel3. The project must call Channel3's API or MCP server.

Scout learns what you buy again and again ("cornflakes every Sunday"), prices it at every store
each week, sees prices rising before they do, and buys the basket with one PayPal approval. Every
product has a **Real prices at online stores** button. Behind it, Flick's backend calls Channel3's
product search and shows the in-stock offers in US dollars, cheapest first, each with its store,
its price, what it was before, a picture and a buy link.

## Why Flick Wins This Track

| What the track asks | What Flick does |
|---|---|
| **Call Channel3's API** | `POST https://api.trychannel3.com/v1/search` from the deployed backend, with the key in the server's environment only. It runs live on [flickit.site/scout](https://www.flickit.site/scout). |
| **Make it matter** | It's the evidence behind Scout's advice. When Scout says your usual is cheaper elsewhere, Channel3's live offers are what you check it against. |
| **Use the data well** | Products are flattened into one row per offer. Flick keeps only in-stock offers in USD with an `https` link, shows the old price when there's a discount, and sorts cheapest first. |
| **Respect the API** | The same search is reused for six hours, so a busy demo doesn't spend the free tier; a call times out after 20 seconds; a missing key says how to get one. |

## What We Built

```
You open a product in Scout ("Eggs, 12 large")
  → POST /api/scout/online { productId }       (the browser never sees the key)
  → Flick's backend builds the query from Scout's catalog: name and size
  → POST https://api.trychannel3.com/v1/search
      { query, limit: 10, config: { country: "US", currency: "USD" } }
  → each product's offers: in stock, USD, https only
  → { title, store, price, was, url, image }, cheapest first, the best 8
  → cached for 6 hours, shown under the product with buy links
```

Scout also reads a photo of a shelf, a fridge, a cart or a list into products (a vision model), and
the same endpoint prices anything by `query` instead of a product id.

## Deployment Evidence

| Check | Result |
|---|---|
| `GET /api/scout` on the live backend | `config: { ai: true, online: true }`: the Channel3 key is set in production |
| `POST /api/scout/online { productId: "eggs" }` | Live offers from Channel3, with `buy.trychannel3.com` links and `cdn.trychannel3.com` images |
| No key set | A 503 that says to set `CHANNEL3_API_KEY`, and the button explains it in the app |

## Source Code

| File | Purpose |
|---|---|
| [`backend/src/scout.ts`](../backend/src/scout.ts) | `online()`: the Channel3 call, the filtering and the cache |
| [`backend/src/scout-rules.ts`](../backend/src/scout-rules.ts) | Scout's catalog, the weekly prices, trends and forecasts (tested) |
| [`backend/src/server.ts`](../backend/src/server.ts) | The route, `POST /api/scout/online` |
| [`frontend/app/_landing/scout.tsx`](../frontend/app/_landing/scout.tsx) | The button and the list of offers |

## Product Feedback for Channel3

### What worked well

- **One call, clean JSON.** Products with offers, prices, availability and images, and no scraping.
- **Buy links and images in the response**, ready to show.
- **A free tier** that was enough to build and demo on, with a cache in front.

### Where we lost time

- **Grocery queries match non-grocery products.** "Eggs 12 large" returns real eggs, but also an acrylic egg bin and salmon eggs from a fishing store. A shopping agent needs to tell food from things for food.

### Suggestions

- A category filter (grocery, household) on search.
- Unit prices (per ounce, per count), so a shopping agent can compare a 12-pack with an 18-pack.

## Future Plans with Channel3

1. **Category-filtered searches**, so only groceries come back for groceries.
2. **Online offers in Scout's weekly quote**, beside the sandbox stores, so the basket can be split between them.
3. **Channel3's MCP server behind Ask Flick**, so "where's coffee cheapest?" is one question.

## Why Flick and Channel3

An agent that says "buy it elsewhere" has to be right, and a demo's made-up prices can't prove it.
Channel3 gives Scout real offers from real stores in one call, so its advice is something you can
check and act on.

[Back to partner evidence](README.md) · [Main README](../README.md)
