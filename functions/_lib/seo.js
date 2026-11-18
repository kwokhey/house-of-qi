/**
 * Search (SEO) and AI-answer (AEO) helpers.
 * The shop is drawn by JavaScript, so pages also get a plain-HTML copy of their content
 * (#ssr) plus structured data (JSON-LD) that search engines and AI assistants can read
 * without running scripts. The shop script removes #ssr when it starts.
 */
export const SITE = "https://houseofqi.shop";
export const BRAND = "House of Qi";
export const COMPANY = "Soleil Trinity Infinite Resources Sdn. Bhd.";
export const SOCIAL = ["https://www.instagram.com/house_of_qi/", "https://www.facebook.com/profile.php?id=61589016106066"];

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const RM = (n) => "RM" + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const abs = (path) => (/^https?:/.test(path) ? path : SITE + "/" + String(path || "").replace(/^\//, ""));
export const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

/** Questions customers (and AI assistants) ask; answers match policies.html */
export function faqs(cfg) {
  const s = (cfg && cfg.shipping) || {};
  const w = s.west || { fee: 10, note: "3–5 working days" }, e = s.east || { fee: 20, note: "5–7 working days" };
  const days = (o) => (String(o.note || "").match(/\d+–\d+ working days/) || [""])[0];
  return [
    ["Are House of Qi crystals natural?", "Yes. Every House of Qi piece is made with natural gemstones. Because they are natural, colour, clarity and patterns vary slightly from piece to piece and from the photos, which makes each piece unique."],
    ["How do I choose a bracelet bead size?", "Bead size is the width of each bead in millimetres. 4–6 mm beads are delicate and easy to stack, 8 mm is the classic everyday size, and 10–14 mm beads make a bolder statement. Use “Bracelets by bead size” in the shop menu to see only the sizes you want."],
    ["Do you deliver across Malaysia, and how much is delivery?", `Yes. Orders are cleansed, packed by hand and dispatched within 1–2 working days. Delivery to West Malaysia (Peninsular) is ${RM(w.fee)} and takes ${days(w) || "3–5 working days"}; East Malaysia (Sabah, Sarawak & Labuan) is ${RM(e.fee)} and takes ${days(e) || "5–7 working days"}. Parcels go by DHL. These rates cover 1–3 pieces (up to 500 g); every further 3 pieces add RM2 in Peninsular Malaysia or RM5 in East Malaysia. Self pick-up by appointment is free.`],
    ["Do you ship outside Malaysia?", `Yes. Delivery to Singapore is by DHL, ${RM((s.sg && s.sg.fee) || 88)} for 1–3 pieces (up to 500 g) plus RM15 for every further 3 pieces, paid online. Singapore customers can sometimes self-collect when House of Qi is in Singapore. For other countries, message House of Qi on WhatsApp before ordering to confirm availability, the delivery cost and payment. Import duties and taxes are paid by the customer.`],
    ["How do I pay?", "Pay securely online at checkout. Payments are processed by Stripe, and House of Qi never sees or stores your card details."],
    ["Can I return or exchange a piece?", "Unworn pieces in their original packaging can be returned or exchanged within 14 days of delivery. Contact House of Qi to start a return. Custom-sized or engraved pieces can only be returned if they arrive damaged."],
    ["How do I care for and cleanse my crystal bracelet?", "Take it off before showering, swimming or exercise, and keep it away from perfume and chemicals. Coloured stones such as rose quartz and amethyst can fade in strong sunlight, so cleanse them under moonlight, with sound, or on a selenite plate instead. Roll elastic bracelets on and off rather than stretching them."],
    ["What is Cleanse & Recharge?", "Cleanse & Recharge is a complimentary option you can tick before adding a piece to your bag. House of Qi cleanses and recharges the crystal before it is sent to you."],
    ["Which crystal should I choose?", "Browse by intention, birthstone, chakra, colour or bead size in the shop menu. The meanings shared describe traditional and spiritual beliefs about each stone; they are not medical advice."],
    ["Who runs House of Qi?", `House of Qi is a Malaysian crystal jewellery shop run by ${COMPANY} You can reach customer service on WhatsApp${cfg && cfg.whatsapp ? ` at +${cfg.whatsapp}` : ""}.`],
  ];
}

export function orgLd(cfg) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["OnlineStore", "Organization"], "@id": SITE + "/#store", name: BRAND, alternateName: "House of Qi Crystals",
        legalName: COMPANY, url: SITE + "/", logo: abs("/assets/img/logo.png"), image: abs("/assets/img/logo.png"),
        description: "Malaysian online shop for natural crystal bracelets, pendants and rings.",
        sameAs: SOCIAL, areaServed: "MY", currenciesAccepted: "MYR",
        address: { "@type": "PostalAddress", addressCountry: "MY" },
        ...(cfg && cfg.whatsapp ? { contactPoint: { "@type": "ContactPoint", telephone: "+" + cfg.whatsapp, contactType: "customer service", availableLanguage: ["English", "Malay", "Chinese"] } } : {}),
        hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "MY", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: 14, returnMethod: "https://schema.org/ReturnByMail" },
      },
      { "@type": "WebSite", "@id": SITE + "/#website", url: SITE + "/", name: BRAND, publisher: { "@id": SITE + "/#store" }, inLanguage: "en-MY" },
    ],
  };
}

export function faqLd(list) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: list.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
}

const ship = (fee, min, max) => ({ "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: fee, currency: "MYR" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "MY" },
  deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: min, maxValue: max, unitCode: "DAY" } } });

/** Search-friendly product name: "Natural Amethyst Crystal Bracelet 10 mm" */
export function seoName(p) {
  let n = String(p.name || "");
  if (/bracelet|pendant|necklace|\bring\b/i.test(n) && !/crystal|quartz|opal|jade|glass|amber|emerald|garnet|topaz|peridot/i.test(n)) n = n.replace(/\s+(Bracelet|Pendant|Necklace|Ring)\b/i, " Crystal $1");
  if (!/^natural\b/i.test(n)) n = "Natural " + n;
  return n + (p.size ? ` ${p.size} mm` : "");
}

export function productLd(p, image, extra = {}) {
  const url = `${SITE}/p/${encodeURIComponent(p.id)}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product", "@id": url + "#product", name: seoName(p), sku: p.id, mpn: p.id, url,
        image: [image, ...(p.gallery || []).map(abs)], description: extra.description || productDesc(p),
        additionalProperty: [
          ...(p.stone ? [{ "@type": "PropertyValue", name: "Gemstone", value: p.stone }] : []),
          ...(p.size ? [{ "@type": "PropertyValue", name: "Bead size", value: p.size, unitText: "mm" }] : []),
          ...(p.details ? [{ "@type": "PropertyValue", name: "Details", value: p.details }] : []),
        ], brand: { "@type": "Brand", name: BRAND },
        ...(p.stone ? { material: p.stone } : {}), category: p.collectionName || "Crystal jewellery",
        offers: {
          "@type": "Offer", url, priceCurrency: "MYR", price: Number(p.price).toFixed(2), itemCondition: "https://schema.org/NewCondition",
          availability: p.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", seller: { "@id": SITE + "/#store" },
          shippingDetails: [ship(10, 3, 5), ship(20, 5, 7), { ...ship(88, 3, 7), shippingDestination: { "@type": "DefinedRegion", addressCountry: "SG" } }],
          hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "MY", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: 14, returnMethod: "https://schema.org/ReturnByMail" },
        },
      },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: BRAND, item: SITE + "/" },
        extra.crumb ? { "@type": "ListItem", position: 2, name: extra.crumb[0], item: SITE + extra.crumb[1] } : { "@type": "ListItem", position: 2, name: p.collectionName || "Shop", item: SITE + "/" },
        { "@type": "ListItem", position: 3, name: p.name, item: url },
      ] },
    ],
  };
}

export function productDesc(p) {
  const bits = [p.details, p.soldOut ? "Sold out" : p.stock === 1 ? "One of a kind" : ""].filter(Boolean).join(" · ");
  const base = p.description || `Natural ${String(p.stone || "crystal").toLowerCase()} ${String(p.type || "jewellery").toLowerCase()} from House of Qi, Malaysia.`;
  return `${base}${bits ? " " + bits + "." : ""} ${RM(p.price)}.`.replace(/\.\./g, ".").slice(0, 300);
}

/** Group products by shop section for plain-HTML lists */
export function grouped(cat) {
  const names = Object.fromEntries((cat.collections || []).map((c) => [c.id, c.name]));
  const out = new Map();
  for (const p of cat.products || []) {
    const k = names[p.collection] || "More crystals";
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(p);
  }
  return out;
}

/** Swap the page's default head tags for page-specific ones */
export function setHead(html, { title, description, canonical, image, type = "website", extra = "" }) {
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}">`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(description)}">`)
    .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}">`)
    .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${type}">`)
    .replace(/<link rel="canonical"[^>]*>/, "")
    .replace(/<meta property="og:url"[^>]*>/, "");
  return html.replace("</head>", `<link rel="canonical" href="${esc(canonical)}"><meta property="og:url" content="${esc(canonical)}"><meta name="twitter:card" content="summary_large_image">${extra}</head>`);
}

/** Plain-HTML copy of the page content, placed first in <body>; the shop script removes it */
export const ssr = (inner) => `<div id="ssr" class="ssr">${inner}</div>`;
export const putSsr = (html, block) => html.replace(/<body([^>]*)>/, `<body$1>${block}`);
