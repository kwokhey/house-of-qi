/* House of Qi · reads an inventory sheet (Excel or Google Sheets) into stock items.
   Understands the "US Crystals Inventory" layout: supplier rows (e.g. "Igor"),
   merged Product Name / Details cells, and rows without an Item ID. */
(function (root) {
  const SPELLING = { LARIMA: "Larimar", CELENITE: "Selenite", ADVENTURINE: "Aventurine", ONIX: "Onyx", YELOW: "Yellow" };
  const SMALL = new Set(["of", "on", "and", "the"]);

  function titleCase(s) {
    return s.toLowerCase().replace(/[a-z]+/g, (w, i) => {
      const fix = SPELLING[w.toUpperCase()];
      if (fix) return fix;
      if (i > 0 && SMALL.has(w)) return w;
      return w[0].toUpperCase() + w.slice(1);
    });
  }

  function cleanStone(raw) {
    let s = String(raw || "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    s = s.replace(/\s*-\s*/g, "-");                       // MULTI - COLOUR → MULTI-COLOUR
    s = s.replace(/^(.+?),\s*(.+)$/, "$1 ($2)");           // HESSONITE, ORANGE GARNET → HESSONITE (ORANGE GARNET)
    s = s.replace(/\bTOURMALINATED ON QUARTZ\b/i, "TOURMALINATED QUARTZ");
    s = titleCase(s).replace(/Multi-Colour/g, "Multi-colour");
    // close a bracket left open in the sheet: "Rose Quartz (Pendant" → "Rose Quartz (Pendant)"
    const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
    if (open > 0) s += ")".repeat(open);
    return s;
  }

  // "Rose Quartz (Rings)", "Boulder Opal (Pendants)", "Topaz Ring" → the kind of piece is in the name (same rule as functions/_lib/db.js)
  function splitType(stone) {
    const KIND = (w) => (/^ring/i.test(w) ? "Ring" : "Pendant");
    let s = String(stone || "").trim(), m;
    if ((m = s.match(/^(.*?)\s*\(\s*(rings?|pendants?|necklaces?)\b\s*(.*)\)$/i))) {
      const extra = m[3].replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
      return { stone: m[1].trim(), type: KIND(m[2]), extra: extra ? extra[0].toUpperCase() + extra.slice(1) : "" };
    }
    if ((m = s.match(/^(.*?)\s*\b(rings?|pendants?|necklaces?)$/i))) return { stone: m[1].trim(), type: KIND(m[2]), extra: "" };
    return null;
  }

  function parseDetails(raw, stone) {
    let d = String(raw || "").replace(/\s+/g, " ").trim();
    const size = (d.match(/\[(\d+(?:\.\d+)?)\s*mm\]/i) || [])[1];
    const type = /pendant|necklace/i.test(d) ? "Pendant" : /\brings?\b/i.test(d) ? "Ring" : "Bracelet";
    let v = d.replace(/\[[^\]]*\]/g, "").replace(/\b(bracelets?|pendants?|necklaces?|rings?)\b/gi, "");
    const premium = /\*?\s*premium/i.test(v);
    v = v.replace(/\(?\*?\s*premium\)?/gi, "").replace(/[()]/g, " ").replace(/\s*,\s*/g, ", ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").replace(/\s+/g, " ");
    v = v.split(/\s*,\s*/).filter((part) => part && part.toLowerCase() !== stone.toLowerCase()).join(", ");
    v = v.replace(/\b[A-Za-z]+\b/g, (w) => SPELLING[w.toUpperCase()] || w);
    if (v) v = v[0].toUpperCase() + v.slice(1).toLowerCase().replace(/\bbaltic\b/g, "Baltic");
    if (premium) v = v ? `${v}, premium` : "Premium";
    return { type, size: size ? Number(size) : null, variant: v };
  }

  const num = (x) => {
    const n = Number(String(x ?? "").replace(/[^0-9.\-]/g, ""));
    return String(x ?? "").trim() === "" || !Number.isFinite(n) ? null : n;
  };

  function findCols(header) {
    const c = {};
    header.forEach((h, i) => {
      const t = String(h || "").toLowerCase();
      if (c.id == null && /item\s*id|^id$|code/.test(t)) c.id = i;
      else if (c.product == null && /product|stone|name/.test(t)) c.product = i;
      else if (c.details == null && /detail|description/.test(t)) c.details = i;
      else if (c.stockIn == null && /stock\s*in|qty|quantity/.test(t)) c.stockIn = i;
      else if (c.cost == null && /purchase|cost/.test(t)) c.cost = i;
      else if (c.price == null && /selling|price/.test(t)) c.price = i;
      else if (c.stockOut == null && /stock\s*out|sold/.test(t)) c.stockOut = i;
    });
    return c;
  }

  function abbrFor(stone, used) {
    const base = stone.replace(/\([^)]*\)/g, "").replace(/-/g, " ").trim().toUpperCase();
    const words = base.split(/\s+/).filter(Boolean);
    const tries = words.length > 1
      ? [words.map((w) => w[0]).join("").slice(0, 4), words[0].slice(0, 3) + words.slice(1).map((w) => w[0]).join("")]
      : [base.slice(0, 4), base.slice(0, 5), base.slice(0, 6)];
    for (const t of tries) if (!used.has(t) || used.get(t) === stone) { used.set(t, stone); return t; }
    let k = 2; while (used.has(tries[0] + k)) k++;
    used.set(tries[0] + k, stone); return tries[0] + k;
  }

  /** rows: array of arrays of cell values (first sheet). Returns { items, notes } */
  function parse(rows) {
    const notes = [];
    const hi = rows.findIndex((r) => r.some((x) => /item\s*id/i.test(String(x || ""))) && r.some((x) => /product|stone/i.test(String(x || ""))));
    if (hi < 0) throw new Error("Couldn't find the header row. The sheet needs columns like Item ID, Product Name, Details, Stock In, Purchase Price, Selling Price.");
    const c = findCols(rows[hi]);
    if (c.product == null || c.price == null) throw new Error("Couldn't find the Product Name and Selling Price columns.");
    const items = [], ids = new Set(), used = new Map();
    let supplier = "", stone = "", stoneRaw = "", details = "", generated = 0, fixed = new Set();
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r].map((x) => (x == null ? "" : String(x).trim()));
      const get = (k) => (c[k] == null ? "" : row[c[k]] || "");
      const qtyIn = num(get("stockIn")), price = num(get("price"));
      if (qtyIn == null && price == null) {
        const text = row.filter(Boolean);
        if (text.length === 1 && text[0].length < 60) {
          // a lone word like "Igor" starts a supplier section; a note like "(type of stone - …)" starts a new, unnamed one
          supplier = /^\(/.test(text[0]) ? "" : titleCase(text[0]); stone = ""; details = "";
        }
        continue;
      }
      if (get("product")) { stoneRaw = get("product"); stone = cleanStone(stoneRaw); details = get("details"); }
      else if (get("details")) details = get("details");
      if (!stone) { notes.push(`Row ${r + 1} skipped: no product name.`); continue; }
      if (stoneRaw && cleanStone(stoneRaw).toUpperCase() !== stoneRaw.toUpperCase().replace(/\s*-\s*/g, "-")) fixed.add(`${stoneRaw.trim()} → ${stone}`);
      const d = parseDetails(details, stone);
      // "Opal" + "Blue opal, premium" → stone "Blue Opal", variant "Premium"
      let shown = stone;
      const parts = d.variant ? d.variant.split(/\s*,\s*/) : [];
      const hit = parts.findIndex((x) => new RegExp(`\\b${stone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(x) && x.toLowerCase() !== stone.toLowerCase());
      if (hit >= 0) {
        shown = titleCase(parts[hit]);
        parts.splice(hit, 1);
        d.variant = parts.join(", ");
        if (d.variant) d.variant = d.variant[0].toUpperCase() + d.variant.slice(1);
      }
      let id = get("id").toUpperCase().replace(/\s+/g, "");
      if (!id || ids.has(id)) {
        const base = `${abbrFor(stone, used)}-1-${d.size != null ? String(d.size).replace(".", "") : "X"}`;
        id = base; let k = 0;
        while (ids.has(id)) id = `${base}-${String.fromCharCode(66 + k++)}`;
        generated++;
      } else used.set(id.split("-")[0], stone);
      ids.add(id);
      const out = num(get("stockOut")) || 0;
      // the ID above is made from the full name, so it stays the same as in earlier imports
      const k = splitType(shown);
      if (k) { shown = k.stone; d.type = k.type; d.variant = [k.extra, d.variant].filter(Boolean).join(", "); }
      items.push({
        id, stone: shown, type: d.type, variant: d.variant, size_mm: d.size, supplier,
        collection: { Pendant: "pendants", Ring: "rings" }[d.type] || "bracelets",
        cost: num(get("cost")) || 0, price: price || 0,
        stock_in: qtyIn || 0, stock: Math.max(0, (qtyIn || 0) - out),
      });
    }
    if (generated) notes.push(`${generated} rows had no Item ID, so IDs were made in your format (stone-sheet-size), e.g. ${items.find((i) => /-1-/.test(i.id))?.id || ""}.`);
    if (fixed.size) notes.push(`Names tidied: ${[...fixed].filter((f) => !/^[A-Z ]+ → /.test(f) || /Larimar|Selenite|Aventurine|Onyx|\(|Tourmalinated|Multi/.test(f)).slice(0, 12).join("; ")}.`);
    return { items, notes };
  }

  /** Minimal CSV reader (quoted fields, commas, new lines) */
  function csv(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  const api = { parse, csv, cleanStone, parseDetails };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.StockImport = api;
})(typeof window !== "undefined" ? window : globalThis);
