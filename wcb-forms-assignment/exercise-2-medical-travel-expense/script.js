/* ==========================================================================
   Medical & Travel Expense Request — dynamic renderer
   --------------------------------------------------------------------------
   Six independent, arbitrary-length tables drive the whole document. The
   editor lets you add/remove rows per table; render() rebuilds the document
   from that state every time. Pagination is height-measured (see
   measure* functions): a table that is short enough is placed as one block
   like any other section, but a table whose full row-set is taller than a
   blank page is automatically SPLIT across pages, repeating the column
   header and adding a "(continued)" label — the same way a real report
   generator would handle an unpredictable number of expense rows.
   ========================================================================== */

const $ = (id) => document.getElementById(id);
const stage = document.getElementById("stage");

/* ------------------------------ table schema -------------------------------
   Each definition describes one WCB expense table: its id, title, the
   printed note under the heading (if any), its columns (key/label/type),
   and one empty-row template. type drives both the editor input and the
   document formatting (date -> long date, money -> $x.xx). */
const TABLE_DEFS = [
  {
    id: "prescriptionDrugs",
    title: "Prescription Drugs",
    columns: [
      { key: "drugName", label: "Drug Name", type: "text" },
      { key: "prescriptionDate", label: "Prescription Date", type: "date" },
      { key: "datePurchased", label: "Date Purchased", type: "date" },
      { key: "providerName", label: "Healthcare Provider Name", type: "text" },
      { key: "paidAmount", label: "Paid Amount", type: "money" },
    ],
  },
  {
    id: "otcDrugs",
    title: "Over-the-Counter Drugs",
    columns: [
      { key: "drugName", label: "Drug Name", type: "text" },
      { key: "datePurchased", label: "Date Purchased", type: "date" },
      { key: "paidAmount", label: "Paid Amount", type: "money" },
      { key: "sellerName", label: "Seller's Name", type: "text" },
      { key: "reason", label: "Reason for Purchasing", type: "text" },
    ],
  },
  {
    id: "supplies",
    title: "Bandages, Braces or Other Medical Supplies",
    columns: [
      { key: "itemPurchased", label: "Item Purchased", type: "text" },
      { key: "datePurchased", label: "Date Purchased", type: "date" },
      { key: "wasPrescribed", label: "Was this Prescribed?", type: "select", options: ["Yes", "No"] },
      { key: "providerName", label: "Healthcare Provider Name", type: "text" },
      { key: "paidAmount", label: "Paid Amount", type: "money" },
      { key: "sellerName", label: "Seller's Name", type: "text" },
    ],
  },
  {
    id: "parking",
    title: "Parking for Medical Appointments",
    columns: [
      { key: "address", label: "Address of Healthcare Provider/Medical Facility", type: "text" },
      { key: "date", label: "Date", type: "date" },
      { key: "paidAmount", label: "Paid Amount", type: "money" },
      { key: "meterUsed", label: "Meter Used?", type: "select", options: ["Yes", "No"] },
      { key: "meterNumber", label: "Meter Number", type: "text" },
    ],
  },
  {
    id: "mileage",
    title: "Mileage to Medical Appointments",
    note: "The WCB will generally reimburse only those transportation costs which are in excess of costs that would be incurred by the worker while travelling to and from work.",
    columns: [
      { key: "appointmentDate", label: "Appointment Date", type: "date" },
      { key: "providerAddress", label: "Address of Healthcare Provider/Medical Facility", type: "text" },
      { key: "workplaceAddress", label: "Address of Workplace", type: "text" },
      { key: "km", label: "Number of km (Round Trip)", type: "number" },
    ],
  },
  {
    id: "busTaxi",
    title: "Bus or Taxi Fare for Medical Appointments",
    note: "*Note: Pre-approval is required from your WCB representative to claim taxi fare(s).",
    smallNote: true,
    columns: [
      { key: "appointmentDate", label: "Appointment Date", type: "date" },
      { key: "startingAddress", label: "Address of Starting Point", type: "text" },
      { key: "providerAddress", label: "Address of Healthcare Provider/Medical Facility", type: "text" },
      { key: "mode", label: "Bus or Taxi", type: "select", options: ["Bus", "Taxi"] },
      { key: "fare", label: "Total Fare Paid", type: "money" },
    ],
  },
];

/* ------------------------------ state --------------------------------------*/
const state = { tables: {} };
TABLE_DEFS.forEach((t) => (state.tables[t.id] = []));

function emptyRow(tableDef) {
  const row = {};
  tableDef.columns.forEach((c) => (row[c.key] = ""));
  return row;
}

/* ------------------------------ logo (approximation) ------------------------*/
function logoSVG() {
  return `
  <svg viewBox="0 0 60 50" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="14" r="8" fill="#1b3a63"/>
    <circle cx="40" cy="14" r="8" fill="#5b8bc0"/>
    <path d="M6 46 C6 30 16 24 20 24 C24 24 34 30 34 46 Z" fill="#1b3a63"/>
    <path d="M26 46 C26 30 36 24 40 24 C44 24 54 30 54 46 Z" fill="#5b8bc0"/>
  </svg>`;
}

/* ------------------------------ formatting helpers ---------------------------*/
const esc = (s) => (s ?? "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function fmtCell(col, value) {
  if (col.type === "date") return esc(fmtDate(value));
  if (col.type === "money") {
    const n = parseFloat(value);
    return isNaN(n) ? "" : `$${n.toFixed(2)}`;
  }
  if (col.type === "number") return value === "" ? "" : esc(value);
  return esc(value);
}

/* ------------------------------ header / footer -------------------------------*/
function headerHTML() {
  return `
  <div class="doc-header">
    <div class="brand">
      ${logoSVG()}
      <div class="brand-text">
        <div class="brand-name"><em>Workers</em> Compensation<br><em>Board of</em> Manitoba</div>
        <div class="brand-addr">333 Broadway, Winnipeg, MB R3C 4W3<br>Phone: (204) 954-4321 · Toll Free: 1-855-954-4321 · wcb.mb.ca</div>
      </div>
    </div>
    <div class="doc-title-block">
      <div class="doc-title">Medical &amp; Travel<br>Expense Request</div>
      <div class="doc-badges"><div class="badge">Claim No. <b class="claimNoOut"></b></div></div>
    </div>
  </div>`;
}

function footerHTML() {
  return `
  <div class="doc-footer">
    <div>Worker App ID: <span class="appIdOut"></span></div>
    <div class="right">Submitted: <span class="submittedOut"></span><br>Page <span class="pageNumOut"></span> of <span class="pageCountOut"></span></div>
  </div>`;
}

/* ------------------------------ table HTML builder -----------------------------*/
function buildTableHTML(tableDef, rows, continued) {
  const headCells = tableDef.columns.map((c) => `<th>${esc(c.label)}</th>`).join("");
  let bodyRows;
  if (rows.length === 0) {
    bodyRows = `<tr><td colspan="${tableDef.columns.length}" style="color:#999; font-style:italic;">No items submitted</td></tr>`;
  } else {
    bodyRows = rows
      .map((row) => `<tr>${tableDef.columns.map((c) => `<td>${fmtCell(c, row[c.key])}</td>`).join("")}</tr>`)
      .join("");
  }
  return `
    <div class="section-title">${esc(tableDef.title)}${continued ? " (continued)" : ""}</div>
    ${!continued && tableDef.note ? `<p class="note-text${tableDef.smallNote ? " small" : ""}">${esc(tableDef.note)}</p>` : ""}
    <table class="doc-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

/* ------------------------------ pagination engine (measurement-based) ---------*/
function measureMaxContentHeight() {
  const probe = document.createElement("div");
  probe.className = "page";
  probe.style.width = "var(--page-w)";
  probe.innerHTML = headerHTML() + `<div class="page-body"></div>` + footerHTML();
  stage.appendChild(probe);
  const h = probe.querySelector(".page-body").clientHeight;
  stage.removeChild(probe);
  return h;
}

function measureHTMLHeight(html, widthPx) {
  const wrap = document.createElement("div");
  wrap.className = "page-body";
  wrap.style.width = widthPx + "px";
  wrap.style.position = "static";
  wrap.innerHTML = html;
  stage.appendChild(wrap);
  const h = wrap.scrollHeight;
  stage.removeChild(wrap);
  return h;
}

/* Turns one table definition + its rows into one or more "blocks" (HTML
   strings). If the whole table fits comfortably it's a single block. If it
   is taller than one blank page, it is split row-by-row: as many rows as
   fit go in the first chunk, the rest continue on a following page under a
   repeated header labelled "(continued)". Split chunks are flagged so the
   packer always starts a fresh page right after them. */
function tableToBlocks(tableDef, rows, contentWidth, maxHeight) {
  const wholeHTML = buildTableHTML(tableDef, rows, false);
  const wholeHeight = measureHTMLHeight(wholeHTML, contentWidth);

  if (wholeHeight <= maxHeight || rows.length === 0) {
    return [{ html: wholeHTML, forceBreakAfter: false }];
  }

  // Determine how many rows fit on a fresh, empty page.
  let rowsPerPage = 0;
  for (let n = 1; n <= rows.length; n++) {
    const h = measureHTMLHeight(buildTableHTML(tableDef, rows.slice(0, n), false), contentWidth);
    if (h > maxHeight) break;
    rowsPerPage = n;
  }
  rowsPerPage = Math.max(rowsPerPage, 1); // always make progress even on tiny pages

  const chunks = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) {
    const slice = rows.slice(i, i + rowsPerPage);
    const isFirst = i === 0;
    chunks.push({
      html: buildTableHTML(tableDef, slice, !isFirst),
      forceBreakAfter: true, // split tables always end their own page cleanly
    });
  }
  return chunks;
}

/* ------------------------------ full document build -----------------------------*/
function nowStamp() {
  const d = new Date();
  const date = d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

function buildAllBlocks(contentWidth, maxHeight) {
  const blocks = [];

  const workerName = $("workerName").value.trim() || "—";
  blocks.push({
    html: `<p class="intro-line"><span class="name answer">${esc(workerName)}</span> requested reimbursement for the following medical and/or travel expenses:</p>`,
    forceBreakAfter: false,
  });

  TABLE_DEFS.forEach((tableDef) => {
    const rows = state.tables[tableDef.id];
    const chunks = tableToBlocks(tableDef, rows, contentWidth, maxHeight);
    chunks.forEach((c) => blocks.push(c));
  });

  blocks.push({
    html: `<div class="privacy-row"><span class="chk checked"></span> I understand that the <a href="#">Privacy Notice</a> applies to the personal information collected in this document.</div>`,
    forceBreakAfter: false,
  });

  return blocks;
}

function paginate(blocks, maxHeight, contentWidth) {
  const pages = [[]];
  let runningHeight = 0;

  blocks.forEach((block) => {
    const h = measureHTMLHeight(block.html, contentWidth);
    const current = pages[pages.length - 1];
    if (current.length > 0 && runningHeight + h > maxHeight) {
      pages.push([]);
      runningHeight = 0;
    }
    pages[pages.length - 1].push(block.html);
    runningHeight += h;

    if (block.forceBreakAfter) {
      pages.push([]);
      runningHeight = 0;
    }
  });

  // drop a trailing empty page if the last forceBreakAfter created one
  if (pages.length > 1 && pages[pages.length - 1].length === 0) pages.pop();

  return pages;
}

function render() {
  const maxHeight = measureMaxContentHeight();
  const contentWidth = 794 - 46 * 2;

  const blocks = buildAllBlocks(contentWidth, maxHeight);
  const pages = paginate(blocks, maxHeight, contentWidth);

  const claimNo = $("claimNo").value.trim() || "—";
  const appId = $("workerAppId").value.trim() || "—";
  const submitted = nowStamp();

  const pagesEl = $("pages");
  pagesEl.innerHTML = "";

  pages.forEach((pageBlocks, i) => {
    const pageEl = document.createElement("div");
    pageEl.className = "page";
    pageEl.innerHTML = headerHTML() + `<div class="page-body">${pageBlocks.join("")}</div>` + footerHTML();
    pagesEl.appendChild(pageEl);

    pageEl.querySelectorAll(".claimNoOut").forEach((el) => (el.textContent = claimNo));
    pageEl.querySelectorAll(".appIdOut").forEach((el) => (el.textContent = appId));
    pageEl.querySelectorAll(".submittedOut").forEach((el) => (el.textContent = submitted));
    pageEl.querySelectorAll(".pageNumOut").forEach((el) => (el.textContent = i + 1));
    pageEl.querySelectorAll(".pageCountOut").forEach((el) => (el.textContent = pages.length));
  });
}

/* ------------------------------ editor rendering ---------------------------------*/
function fieldInput(tableId, rowIndex, col, value) {
  const id = `f_${tableId}_${rowIndex}_${col.key}`;
  if (col.type === "select") {
    const opts = col.options
      .map((o) => `<option value="${esc(o)}" ${value === o ? "selected" : ""}>${esc(o)}</option>`)
      .join("");
    return `<label>${esc(col.label)}
      <select id="${id}" data-table="${tableId}" data-row="${rowIndex}" data-col="${col.key}">
        <option value="">--</option>
        ${opts}
      </select></label>`;
  }
  const inputType = col.type === "date" ? "date" : col.type === "number" ? "number" : "text";
  return `<label>${esc(col.label)}
    <input type="${inputType}" id="${id}" data-table="${tableId}" data-row="${rowIndex}" data-col="${col.key}" value="${esc(value)}">
    </label>`;
}

function renderEditors() {
  const container = $("tableEditors");
  container.innerHTML = TABLE_DEFS.map((tableDef) => {
    const rows = state.tables[tableDef.id];
    const rowCards = rows
      .map(
        (row, idx) => `
      <div class="row-card">
        <button type="button" class="row-remove" data-remove-table="${tableDef.id}" data-remove-row="${idx}" title="Remove row">✕</button>
        <div class="row-num">Row ${idx + 1}</div>
        <div class="row-grid">
          ${tableDef.columns.map((c) => fieldInput(tableDef.id, idx, c, row[c.key])).join("")}
        </div>
      </div>`
      )
      .join("");

    return `
      <div class="table-editor">
        <h2>${esc(tableDef.title)} <span style="color:#999; font-weight:normal;">(${rows.length} row${rows.length === 1 ? "" : "s"})</span></h2>
        ${rows.length === 0 ? `<div class="empty-note">No rows yet — this table will print as empty.</div>` : rowCards}
        <button type="button" class="row-add" data-add-table="${tableDef.id}">+ Add row</button>
      </div>`;
  }).join("");

  // wire inputs
  container.querySelectorAll("input,select").forEach((el) => {
    el.addEventListener("input", () => {
      const { table, row, col } = el.dataset;
      state.tables[table][row][col] = el.value;
      render();
    });
  });
  container.querySelectorAll("[data-remove-table]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.removeTable;
      const r = Number(btn.dataset.removeRow);
      state.tables[t].splice(r, 1);
      renderEditors();
      render();
    });
  });
  container.querySelectorAll("[data-add-table]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.addTable;
      const def = TABLE_DEFS.find((d) => d.id === t);
      state.tables[t].push(emptyRow(def));
      renderEditors();
      render();
    });
  });
}

/* ------------------------------ sample datasets -------------------------------*/
const SAMPLES = {
  small: {
    prescriptionDrugs: [{ drugName: "Naproxen", prescriptionDate: "2024-02-28", datePurchased: "2024-02-29", providerName: "Dr. Best", paidAmount: "20.00" }],
    otcDrugs: [{ drugName: "Advil", datePurchased: "2024-03-28", paidAmount: "8.00", sellerName: "Shoppers Drug Mart", reason: "Pain" }],
    supplies: [{ itemPurchased: "Tensor", datePurchased: "2024-02-28", wasPrescribed: "Yes", providerName: "Dr. Best", paidAmount: "10.00", sellerName: "Shoppers Drug Mart" }],
    parking: [{ address: "333 St Mary Ave, Winnipeg MB R3C 4A5, Canada", date: "2024-03-28", paidAmount: "10.00", meterUsed: "Yes", meterNumber: "12245" }],
    mileage: [{ appointmentDate: "2024-03-28", providerAddress: "HSC, 820 Sherbrook St, Winnipeg MB R3A 1R9, Canada", workplaceAddress: "WCB, 333 Broadway, Winnipeg MB R3C 4W3, Canada", km: "20" }],
    busTaxi: [
      { appointmentDate: "2024-03-28", startingAddress: "", providerAddress: "HSC Winnipeg Women's Hospital, 665 William Ave, Winnipeg MB R3E 0Z2, Canada", mode: "Bus", fare: "3.00" },
      { appointmentDate: "2024-03-27", startingAddress: "25 Furby St, Winnipeg MB R3C 2A2, Canada", providerAddress: "440 Edmonton St, Winnipeg MB R3B 2M4, Canada", mode: "Taxi", fare: "15.00" },
    ],
  },
  large: {
    prescriptionDrugs: [
      { drugName: "Naproxen", prescriptionDate: "2024-02-28", datePurchased: "2024-02-29", providerName: "Dr. Best", paidAmount: "20.00" },
      { drugName: "Gabapentin", prescriptionDate: "2024-03-05", datePurchased: "2024-03-06", providerName: "Dr. Best", paidAmount: "34.50" },
      { drugName: "Cyclobenzaprine", prescriptionDate: "2024-03-12", datePurchased: "2024-03-13", providerName: "Dr. Chen", paidAmount: "18.75" },
    ],
    otcDrugs: [
      { drugName: "Advil", datePurchased: "2024-03-28", paidAmount: "8.00", sellerName: "Shoppers Drug Mart", reason: "Pain" },
      { drugName: "Tylenol", datePurchased: "2024-04-02", paidAmount: "9.50", sellerName: "Shoppers Drug Mart", reason: "Headache" },
    ],
    supplies: [
      { itemPurchased: "Tensor", datePurchased: "2024-02-28", wasPrescribed: "Yes", providerName: "Dr. Best", paidAmount: "10.00", sellerName: "Shoppers Drug Mart" },
      { itemPurchased: "Lumbar brace", datePurchased: "2024-03-15", wasPrescribed: "Yes", providerName: "Dr. Best", paidAmount: "45.00", sellerName: "Wellwise" },
    ],
    parking: [
      { address: "333 St Mary Ave, Winnipeg MB R3C 4A5, Canada", date: "2024-03-28", paidAmount: "10.00", meterUsed: "Yes", meterNumber: "12245" },
      { address: "820 Sherbrook St, Winnipeg MB R3A 1R9, Canada", date: "2024-04-04", paidAmount: "12.00", meterUsed: "No", meterNumber: "" },
    ],
    mileage: [
      { appointmentDate: "2024-03-28", providerAddress: "HSC, 820 Sherbrook St, Winnipeg MB R3A 1R9, Canada", workplaceAddress: "WCB, 333 Broadway, Winnipeg MB R3C 4W3, Canada", km: "20" },
      { appointmentDate: "2024-04-04", providerAddress: "St. Boniface Hospital, 409 Tache Ave, Winnipeg MB R2H 2A6, Canada", workplaceAddress: "WCB, 333 Broadway, Winnipeg MB R3C 4W3, Canada", km: "14" },
    ],
    // Deliberately long — big enough that this single table cannot fit on
    // one blank page, so tableToBlocks() must split it (repeated header +
    // "(continued)") across pages. This is the clearest way to demo the
    // pagination engine handling an unpredictable number of rows.
    busTaxi: Array.from({ length: 45 }, (_, i) => ({
      appointmentDate: `2024-04-${String((i % 28) + 1).padStart(2, "0")}`,
      startingAddress: `${100 + i} Furby St, Winnipeg MB, Canada`,
      providerAddress: `${400 + i} Edmonton St, Winnipeg MB, Canada`,
      mode: i % 3 === 0 ? "Taxi" : "Bus",
      fare: (3 + i * 1.25).toFixed(2),
    })),
  },
};

function applySample(name) {
  const sample = SAMPLES[name];
  TABLE_DEFS.forEach((t) => {
    state.tables[t.id] = (sample[t.id] || []).map((r) => ({ ...emptyRow(t), ...r }));
  });
  renderEditors();
  render();
}

/* ------------------------------ wire up global events --------------------------*/
document.querySelectorAll("[data-sample]").forEach((btn) => {
  btn.addEventListener("click", () => applySample(btn.dataset.sample));
});
["workerName", "claimNo", "workerAppId"].forEach((id) => $(id).addEventListener("input", render));

applySample("small");
