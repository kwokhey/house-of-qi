# House of Qi — Online Boutique

An elegant crystal-jewellery storefront that runs on **Cloudflare Pages (free)** or **Vercel (Pro plan for commercial sites)**, with secure payments through **Stripe Checkout** (cards, FPX, GrabPay and other methods you enable in Stripe).

```
house-of-qi/
├── index.html, shop.html, product.html, about.html, policies.html, success.html, 404.html
├── assets/css/style.css     ← brand colours & fonts (top of file)
├── assets/js/app.js         ← cart, product pages, checkout button
├── assets/img/              ← product images (replace the placeholders)
├── data/products.json       ← THE product catalogue: names, prices, sizes, images
├── lib/stripe-checkout.mjs  ← Stripe payment logic (shared by both hosts)
├── functions/api/checkout.js← checkout endpoint for Cloudflare Pages
├── api/checkout.mjs         ← checkout endpoint for Vercel
├── vercel.json              ← Vercel security & caching headers
└── _headers                 ← security & caching headers
```

No build step, no database, no monthly fees.

---

## 1. Put the code on GitHub

1. In GitHub click **New repository** → name it `house-of-qi` → **Private** → Create.
2. On the empty repo page click **uploading an existing file**, drag in **everything inside** the `house-of-qi` folder (not the folder itself), then **Commit changes**.
   *(Or with Git: `git init && git add . && git commit -m "Initial store" && git branch -M main && git remote add origin https://github.com/YOU/house-of-qi.git && git push -u origin main`)*

## 2. Deploy on Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick `house-of-qi`.
2. Build settings: **Framework preset: None**, **Build command: (leave empty)**, **Build output directory: `/`**.
3. Click **Save and Deploy**. You get a link like `house-of-qi.pages.dev`.

Every time you push to GitHub, Cloudflare redeploys automatically.

## 3. Connect Stripe (the client's account)

1. Ask the client to invite you to their Stripe account (Settings → Team) or to send you the **secret key**.
2. Stripe Dashboard → **Developers → API keys** → copy the **Secret key** (`sk_test_…` for testing).
3. Cloudflare → your Pages project → **Settings → Variables and Secrets** → **Add** →
   Name `STRIPE_SECRET_KEY`, type **Secret**, value = the key. Add it for **Production** (and Preview if you like).
4. **Deployments → Retry deployment** so the key takes effect.
5. Stripe → **Settings → Payment methods**: switch on Cards, **FPX**, **GrabPay**, Apple Pay / Google Pay — they appear on checkout automatically.
6. Stripe → **Settings → Customer emails**: turn on **Successful payments** so buyers get a receipt, and **Settings → Notifications** so the client is emailed for every order.

**Test:** add items to the bag → Secure Checkout → pay with card `4242 4242 4242 4242`, any future date, any CVC.
**Go live:** replace the key with the `sk_live_…` key and redeploy.

Orders (with shipping address and phone) appear in Stripe → **Payments**.

## 4. Custom domain (optional, free on Cloudflare)

Pages project → **Custom domains** → **Set up a custom domain** → e.g. `houseofqi.com`.

## Alternative: deploy on Vercel instead of Cloudflare

> Vercel's free **Hobby** plan is for non-commercial use only. A store that takes payments needs **Vercel Pro**. Cloudflare Pages allows commercial sites on its free plan.

1. Push the code to GitHub (step 1 above).
2. vercel.com → **Add New… → Project** → **Import** the `house-of-qi` repo.
3. **Framework Preset: Other**. Leave Build Command and Output Directory empty / default. Root Directory: `./`.
4. Open **Environment Variables** on the same screen → add `STRIPE_SECRET_KEY` = the client's `sk_test_…` key → **Deploy**.
5. You get `house-of-qi.vercel.app`. Test checkout with card `4242 4242 4242 4242`.
6. Custom domain: Project → **Settings → Domains** → add `houseofqi.com` and follow the DNS instructions.
7. If you change the key later: **Settings → Environment Variables**, edit, then **Deployments → ⋯ → Redeploy**.

Every push to GitHub redeploys automatically, the same as Cloudflare.

---

## Everyday edits

**Add / change a product** — edit `data/products.json`:

```json
{
  "id": "unique-url-name",
  "name": "Product Name",
  "collection": "Bracelets",          // Bracelets, Pendants, Crystal Spheres (or a new one)
  "intention": "Love",                 // Love, Abundance, Protection, Clarity, Growth, Courage
  "price": 480,                        // in RM (the starting price)
  "image": "assets/img/my-photo.jpg",
  "material": "Natural rose quartz",
  "description": "One or two lines about the piece.",
  "options": [                         // [] if there are no sizes
    { "label": "10mm", "price": 480 }, // each size can have its own price
    { "label": "12mm", "price": 580 }
  ],
  "featured": true                     // shows on the home page
}
```

Each product also has `"stone": "rose-quartz"`, which links it to the **About the stone** explanation on its product page. The explanations live in the `"stones"` section of the same file (name, Chinese name, meaning, keywords, facts, how to wear, how to know it's real). Several products can share one stone, so write each explanation once. Remove the `"stone"` line and that product simply shows no stone section.

Prices are checked on the server, so customers can't change them in the browser.

**WhatsApp button** — put the client's number in `"whatsapp"` at the top of `data/products.json`, country code first with no "+" or spaces (e.g. `"60123456789"`). A floating WhatsApp button and an "Ask us on WhatsApp" link on each product page then appear automatically, with a pre-filled message naming the piece and size. Leave it empty to hide them.

**Sold out** — set `"soldOut": true` on a product. It shows a "Sold out" badge, can't be added to the bag or bought, and the product page offers a WhatsApp enquiry instead. Set it back to `false` when restocked.

**Announcement bar** — edit the `"announcements"` list; the messages rotate every few seconds.

**Crystal Guide page** (`guide.html`) — built automatically from the `"stones"` section, and the "Shop by Chakra" filters read each stone's `"Chakra"` fact. Add a stone once and it appears everywhere.

**Product photos** — upload square or 4:5 JPG/PNG/WebP images (≈1200px, under 300 KB) to `assets/img/` and point `"image"` at them. Real photos also appear on the Stripe payment page. Photos on a white/cream background look best with this design.

**Brand colours & fonts** — top of `assets/css/style.css` (`--gold`, `--ink`, `--ivory` …). Fonts load from Google Fonts in each page's `<head>`.

**Logo** — the "Qi" mark and wordmark are drawn in `assets/js/app.js` (`renderLayout`). To use the real logo file, replace the `<span class="logo-mark">…</span><span class="logo-word">…</span>` with `<img src="assets/img/logo.svg" alt="House of Qi" style="height:44px">`.

**Shipping** — `freeShippingThreshold`, `shippingFlat`, `shipToCountries` in `data/products.json`.

**Text** — announcement bar, footer, email address: `assets/js/app.js`. Home page copy: `index.html`. Policies: `policies.html` (review with the client before launch).

## Test locally (optional)

```bash
npm i -g wrangler
cp .dev.vars.example .dev.vars   # put your sk_test_ key inside
wrangler pages dev .
```
