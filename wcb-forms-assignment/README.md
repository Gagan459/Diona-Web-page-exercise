# WCB Manitoba Forms — Dynamic HTML/CSS/JS Recreation

Two data-driven web pages that recreate the two supplied WCB Manitoba PDFs:

| Exercise | Recreates | Folder |
|---|---|---|
| 1 | `Worker_Progress_Report.pdf` | [`exercise-1-worker-progress-report/`](./exercise-1-worker-progress-report) |
| 2 | `Medical_and_Travel_Expense_Request.pdf` | [`exercise-2-medical-travel-expense/`](./exercise-2-medical-travel-expense) |

Stack: plain HTML/CSS/JS, no build step, no dependencies. Open either `index.html` directly in a browser, or serve the folder with any static server (`python3 -m http.server`, VS Code Live Server, GitHub Pages, etc.).

Each page is split into two halves:
- **Left — Data Editor**: every field/table on the form, fully editable, plus "Load sample" buttons for quick demos and a "Print / Save as PDF" button.
- **Right — Document Preview**: the WCB-styled report itself, re-rendered from scratch on every keystroke.

## How the "dynamic" requirement is implemented

Nothing about the layout is hardcoded — specifically:

1. **Every field is data-driven.** Checkboxes, dates, free-text boxes, and the pain scale are all rendered from a single JS data object read from the form.
2. **Tables (exercise 2) are arbitrary length.** Each of the six tables (Prescription Drugs, OTC Drugs, Supplies, Parking, Mileage, Bus/Taxi Fare) is backed by an array. Rows can be added/removed one at a time in the editor, or swapped wholesale via the sample-data buttons.
3. **Page count is *computed*, not hardcoded.** Both pages implement a small measurement-based pagination engine (see "Pagination engine" below): the real WCB PDFs are 3 and 2 pages respectively only because of how much text/rows happened to be in *that* submission — our version will show 1 page for a short submission and however many pages are needed for a long one, headers/footers/"Page X of Y" included.
4. **Long tables split themselves across pages.** In exercise 2, if a single table (e.g. Bus/Taxi Fare with 45 rows) is too tall to fit on one blank page, the engine automatically breaks it into chunks, repeating the column header and adding "(continued)" to the section title on the following page(s) — the same way a real report generator has to handle an unpredictable number of expense rows.

### Pagination engine (both exercises)

Browsers have no built-in "how many printed pages will this content take" API, so:

- A hidden "stage" area off-screen renders one empty page (header + blank body + footer) to measure the real available content height for that page size (A4 at 96dpi, ~794×1123px).
- Each content block (a form section, or — in exercise 2 — a whole table or a chunk of one) is rendered into that same hidden stage at the real content width, and its rendered height is measured.
- A greedy packer places blocks onto the current page until the next block would overflow, then starts a new page. Footers are filled in afterward with the final page count.

This is intentionally block-level (a whole section moves together) rather than splitting mid-paragraph, matching how the source PDFs actually paginate. Exercise 2 adds one more level: a single **table** can be split row-by-row if it's long enough to overflow a full blank page on its own (see the shipped "large sample" — the 45-row Bus/Taxi table splits across 3 pages).

## Assumptions & things I want to flag

- **Logo**: I don't have the real WCB Manitoba logo asset, so the header uses a simplified original SVG mark inspired by the two-figure motif in the source PDFs, not the literal trademarked logo.
- **"Submitted" timestamp**: shown as the live current date/time at render time (per instruction), rather than a frozen value — reflects what a "submit this report right now" flow would show.
- **Field types inferred from the PDFs' printed answers**: e.g. "Meter Used?" and "Was this Prescribed?" are modelled as Yes/No selects, "Bus or Taxi" as a select, all dates as native date inputs, all currency fields formatted as `$x.xx` on render.
- **Section-to-page mapping**: rather than hardcoding which field lands on which of the original PDF's 3 (or 2) pages, the layout is fully reflowed by the measurement engine described above — this is a deliberate choice to make the "different data → different number of pages" requirement demonstrable, at the cost of not matching the *exact* original page breaks for the exact original sample data.
- Client-side validation (required fields, malformed dates, etc.) was left out of scope since the brief is about layout/pagination fidelity, not a submission workflow.

## AI assistance

This was built with AI (Claude) assistance. See [`PROMPT_HISTORY.md`](./PROMPT_HISTORY.md) for the prompt history, called out per the assignment instructions.

## Video

- Exercise 1 walkthrough: `<add link or repo path here>`
- Exercise 2 walkthrough: `<add link or repo path here>`
