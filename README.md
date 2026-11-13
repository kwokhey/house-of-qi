# House of Qi · online shop

Crystal jewellery shop for **House of Qi** (Soleil Trinity Infinite Resources Sdn. Bhd., 202201006345 (1452042-H)).

- Hosting: **Cloudflare Pages** (free), one link for phone and desktop
- Payments: **Stripe Checkout** (cards, FPX and any other methods switched on in Stripe)
- No build step. Products and stock live in a Cloudflare D1 database, managed from the order page (`/admin` → Stock). Shop settings (shipping, homepage sections) live in `data/catalog.json`

```
index.html               the shop (one page)
policies.html            shipping, returns, care, privacy
404.html                 page-not-found
assets/css/shop.css      shop design (colours and fonts at the top)
assets/css/page.css      design for policies / 404
assets/js/shop.js        shop behaviour: bag, product sheet, checkout, thank-you screen
assets/js/art.js         drawn product pictures, used until real photos are added
assets/img/              logo, icons, product photos
data/catalog.json        products, prices, shipping, homepage settings
functions/api/checkout.js  creates the Stripe payment page (prices checked on the server)
functions/api/order.js     reads the paid order for the thank-you screen
functions/_lib/pricing.js  shared price rules
_headers                 security and caching headers
```

---

## 1. Deploy on Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → choose this repository.
2. Project name: `house-of-qi` (this gives `house-of-qi.pages.dev`).
3. Build settings: **Framework preset: None**, **Build command:** leave empty, **Build output directory:** `/`
4. **Save and Deploy.**

Every push to GitHub redeploys the site automatically.

> Use **Connect to Git**, not drag-and-drop upload. Drag-and-drop does not include the `functions` folder, so checkout would not work.

## 2. Connect the client's Stripe account

The secret key should be added by the client (or with them), so it never travels by chat or email.

1. Stripe Dashboard → **Developers → API keys**. Start with **Test mode** and copy the **Secret key** (`sk_test_…`).
   - Tidier option: **Create restricted key** with only **Checkout Sessions: Write** (and Read). Use that instead of the full secret key.
2. Cloudflare → the Pages project → **Settings → Variables and Secrets** → **Add**
   Name `STRIPE_SECRET_KEY`, type **Secret**, value = the key, environment **Production**.
3. **Deployments** → latest → **Retry deployment** so the key takes effect.
4. Stripe → **Settings → Payment methods**: switch on **Cards** and **FPX** (and GrabPay, Apple Pay / Google Pay if wanted).
5. Stripe → **Settings → Customer emails**: turn on **Successful payments** (customers get a receipt).
   Stripe → **Settings → Team and security → Notifications**: turn on email for **Successful payments** (the client is told about every order).
6. Stripe → **Settings → Business → Public details**: set the website to the shop link.

**Test:** add items → Checkout → Continue to payment → card `4242 4242 4242 4242`, any future date, any CVC.
You should land on the "Thank you for your order" screen, and the payment appears in Stripe → **Payments**.

**Go live:** in Stripe switch off Test mode, copy the live key (`sk_live_…` or a live restricted key), replace the value in Cloudflare, retry the deployment, and place one real small order to confirm.

### Where orders appear

Stripe → **Payments** → click a payment. You'll see:
- the items with their options (bead size, wrist size, add-ons) and any gift message
- the delivery choice, customer name, email, phone and shipping address
- the order number (e.g. `HQ-261112-K7PQ`) under **Metadata**, also shown to the customer

## 3. Custom domain (later)

Buy the domain in Cloudflare (**Domain Registration → Register Domains**), then Pages project → **Custom domains** → **Set up a custom domain** → add `yourdomain.com` and `www.yourdomain.com`. No code change is needed. Update the website address in Stripe's public details afterwards.

---

---

## Orders and stock (house-of-qi.pages.dev/admin)

Log in with the `ADMIN_PASSWORD` secret.

**Orders tab:** paid orders from Stripe. Mark as packed → choose courier, add tracking number → mark as shipped. Customers follow progress at `/track`.

**Stock tab:** the inventory.
- **Import** your Excel/CSV file or a Google Sheets link. Rows are matched by Item ID, so re-importing updates instead of duplicating. Rows without an ID get one in the `STONE-1-SIZE` format.
- Tap an item to: add/change its **photo** (straight from the phone camera), **Sold offline** (Instagram, WhatsApp, bazaar…), **Add stock**, **Adjust count**, edit price/description/meaning, hide it from the website, or feature it on the home page. Every change is in its History with Undo.
- **Website orders deduct stock automatically** once paid. Sold-out pieces disappear from the shop and can't be bought.
- **Export Excel** downloads the full list with photos, stock in/sold/left, cost, price and profit.

Stock lives in a Cloudflare **D1** database (free tier). Setup, once:
1. Cloudflare → **Storage & databases → D1 SQL database → Create** → name `house-of-qi`.
2. Pages project **house-of-qi → Settings → Bindings → Add → D1 database** → variable name `DB` → database `house-of-qi` → Save.
3. Redeploy. Tables are created automatically on first use.

Until the database is connected, the shop shows the sample products from `data/catalog.json`. Cost prices and suppliers are only visible on the order page, never in the shop.

**Marketing tab:**
- **Coupon codes**: % off or RM off. Optional minimum spend, start/end dates, a limit on how many orders can use it, and "don't discount pieces already on sale". Customers type the code at checkout (the box only appears while a code is live). Each code shows how many paid orders used it and the discount given. A code that has been used can be switched off but not deleted.
- **Sales**: automatic % off for the whole shop, a shop section, chosen stones or chosen pieces, between two dates. The shop shows the old price crossed out, the % off and the sale name. If two sales cover a piece, the bigger one wins. Prices round to the nearest ringgit.
- **Announcement bar**: one line across the top of the shop, with optional dates.
- Everything is checked again on the server at payment, and Stripe shows the discount on its payment page and receipt. Profit on the Stock page uses what the customer actually paid.

---

## Everyday edits (`data/catalog.json`)

**Product**

```json
{
  "id": "star-rose-bracelet",          // unique, lowercase, no spaces (never change once orders exist)
  "name": "Star Rose Quartz Bracelet",
  "short": "Star Rose Quartz",          // optional shorter name for small cards
  "zh": "星光粉晶手链",
  "collection": "bracelets",            // must match an id in "collections"
  "price": 480,                         // base price in RM
  "image": "assets/img/products/star-rose.jpg",   // leave "" to use the drawn picture
  "soldOut": false,
  "bestseller": 1,                      // optional rank in Bestsellers
  "signature": true,                    // optional "Signature" label
  "spotlight": true,                    // optional: shows in the monthly spotlight section
  "stone": "Star rose quartz",
  "quality": "Clear, 6-ray star",
  "intentions": ["love"],               // keys from "intentions"
  "description": "Short description shown on the card and product page.",
  "meaning": "Text for the Meaning box on the product page.",
  "groups": [ ...options, see below... ]
}
```

**Options** (`groups`): each group is either `"type": "one"` (pick one, e.g. bead size) or `"type": "many"` (tick boxes, e.g. gift box). Each option's `price` is **added** to the base price.

```json
{ "id": "bead", "label": "Bead size", "type": "one",
  "opts": [ { "id": "10", "label": "10 mm", "price": 0 },
            { "id": "12", "label": "12 mm", "price": 100 } ] }
```

**Photos:** square or 4:5 JPG/WebP, about 1200 px and under 300 KB, in `assets/img/products/`. Set the product's `"image"`. Real photos also appear on the Stripe payment page.

**Delivery:** `"shipping"` in `data/catalog.json`: West Malaysia (RM10), East Malaysia (RM20), self pick-up, and Outside Malaysia (`"contact": true`, which can't be paid online: the checkout button opens WhatsApp with the bag contents instead). There is no free delivery. Keep `policies.html` (Delivery and International customers) in step with any change. The order page warns when the address doesn't match the West/East region the customer picked.

**Homepage:** `"hero"` (featured product and text; `|` splits the title onto two lines), `"spotlight"` (monthly stones title and note), `"collections"` (order of sections; `layout` is `bestsellers`, `feature`, `grid` or `list`).

**WhatsApp:** put the number in `"whatsapp"`, country code first, digits only (e.g. `"60123456789"`). A WhatsApp link then appears on each product and in the footer.

**Sold out:** `"soldOut": true`. It can't be added to the bag or paid for.

After editing, bump `?v=1` to `?v=2` in `index.html` if you changed CSS or JS (so browsers fetch the new file). Catalog changes appear within a minute.

## Before launch checklist

- [ ] Real products, prices, photos and meanings in `data/catalog.json`
- [ ] Shipping fees and the returns policy in `policies.html` confirmed by the client
- [ ] Business address and a contact (WhatsApp / email) added to the site (expected for Malaysian online sellers and by Stripe)
- [ ] Test-mode order works end to end, then live key added
