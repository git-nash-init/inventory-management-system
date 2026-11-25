# Shop Manager

A very simple stock and billing app for a small shop. There is **no login**: opening the site shows the data straight away.

- **Home**: sold, bought and profit for the dates you pick, what was sold, stock left, low stock, latest bills. Buttons next to the title choose the dates: Today, Yesterday, This week (Monday to Sunday), This month (the default), This year, or Custom dates. The exact dates being shown, for example `1 – 30 Nov 2026`, are written on the right. Stock left is always what is in the shop right now.
- **Stock**: add products, add stock when new goods come in, fix a quantity. Products have a group (Pipe, Water tank ...); search and the group list narrow a long list.
- **Make bill**: customer name and mobile, items, optional GST % for the whole bill. Selling more than is in stock is refused.
- **All bills / one bill**: print the bill (shop name, address, phone on top, bank details at the bottom). A bill can be cancelled, which puts the stock back.
- **Shop details**: the name, address, phone and bank details printed on every bill.
- **Language button** (next to the dark/light button): switches every word between simple Hinglish (the default) and English. The choice is remembered on that device.

## How the numbers work

- Quantity left = all stock added, minus everything sold on bills that are not cancelled.
- Profit = amount sold minus what those goods cost. Each bill line keeps the buying price from the time of sale, so changing a buying price later does not change old profit. GST is not counted as sold amount or profit.
- Stock left (worth) = quantity left x buying price.

## Setup

1. Create a Supabase project and run the files in `supabase/migrations` in order in its SQL editor (5 tables, a stock view and the functions the app calls).
2. Copy `.env.example` to `.env.local` and fill in the project URL and the publishable (anon) key.
3. Optional: run `supabase/seed/catalogue.sql` to load the shop's 147 products (prices and quantities start at 0).
4. `npm install`, then `npm run dev`.

```
npm run typecheck   # TypeScript
npm run lint
npm test            # unit tests
npm run build
npm run test:e2e                      # browser tests (needs the dev server running; read-only)
E2E_ALLOW_WRITES=1 npm run test:e2e   # also runs the add product / bill flow. It WRITES to the database, so use a test project, not real shop data
```

## Security: please read

There is no sign-in, so the database allows the public key to read and write the five shop tables (row level security is on, with open policies). **Anyone who has the website address can see and change all the data**, and so can anyone who takes the public key from the site's code. This was chosen on purpose for a single shop. If the address is shared widely or the data becomes sensitive, add a sign-in or put the site behind a password at the host (for example HTTP basic auth or Cloudflare Access).

The app sends a per-request Content Security Policy and standard security headers (`src/proxy.ts`, `next.config.ts`).

## Where things are

| Path | What |
|---|---|
| `src/app` | Pages: `/dashboard`, `/stock`, `/bills`, `/bills/new`, `/bills/[id]`, `/settings` |
| `src/features` | The screens (dashboard, stock, bills, settings) |
| `src/data` | `queries.ts` (reads), `actions.ts` (writes through the database functions) |
| `src/lib/i18n` | English and Hinglish words, `useI18n()` |
| `supabase/migrations` | The database |
