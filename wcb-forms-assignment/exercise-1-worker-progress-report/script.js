/* ==========================================================================
   Worker Progress Report — dynamic renderer
   --------------------------------------------------------------------------
   Design: the form fields on the left are the single source of truth.
   render() reads them into a plain "data" object, turns that data object
   into an array of independent content "blocks" (Return to Work, Recovery,
   Pain scale, ...), then hands those blocks to paginate(), which MEASURES
   each block's real rendered height and packs blocks onto pages up to the
   available content height of one printed page. Nothing about the page
   count is hardcoded — add a long comment or extra data and a page 4 will
   appear on its own.
   ========================================================================== */

const $ = (id) => document.getElementById(id);
const stage = document.getElementById("stage");

/* ---------------------------- logo (approximation) --------------------- */
function logoSVG() {
  return `
  <svg viewBox="0 0 60 50" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="14" r="8" fill="#1b3a63"/>
    <circle cx="40" cy="14" r="8" fill="#5b8bc0"/>
    <path d="M6 46 C6 30 16 24 20 24 C24 24 34 30 34 46 Z" fill="#1b3a63"/>
    <path d="M26 46 C26 30 36 24 40 24 C44 24 54 30 54 46 Z" fill="#5b8bc0"/>
  </svg>`;
}

/* ------------------------------ read form data --------------------------*/
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function readData() {
  return {
    workerName: $("workerName").value.trim() || "—",
    claimNo: $("claimNo").value.trim() || "—",
    workerAppId: $("workerAppId").value.trim() || "—",

    rtwStatus: $("rtwStatus").value,
    rtwDate: $("rtwDate").value,
    dutyType: $("dutyType").value,
    dutyOther: $("dutyOther").value.trim(),
    rtwGoing: $("rtwGoing").value.trim(),
    expectedReturn: $("expectedReturn").value,
    concerns: $("concerns").value.trim(),
    contactName: $("contactName").value.trim(),
    contactDate: $("contactDate").value,

    recoveryStatus: $("recoveryStatus").value,
    recoveryComments: $("recoveryComments").value.trim(),

    painScale: Number($("painScale").value),

    treatmentStatus: $("treatmentStatus").value,
    providerType: $("providerType").value.trim(),
    lastTreatmentDate: $("lastTreatmentDate").value,
    lastTreatmentName: $("lastTreatmentName").value.trim(),
    nextTreatmentDate: $("nextTreatmentDate").value,
    chiroFrequency: $("chiroFrequency").value.trim(),

    medicationStatus: $("medicationStatus").value,
    medicationName: $("medicationName").value.trim(),

    exerciseStatus: $("exerciseStatus").value,
    exerciseList: $("exerciseList").value.trim(),

    otherInfo: $("otherInfo").value.trim(),
  };
}

/* ------------------------------ small helpers ----------------------------*/
const chk = (isOn) => `<span class="chk${isOn ? " checked" : ""}"></span>`;
const esc = (s) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ------------------------------ header / footer --------------------------*/
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
      <div class="doc-title">Worker Progress Report</div>
      <div class="doc-badges">
        <div class="badge">Claim No. <b class="claimNoOut"></b></div>
        <div class="badge"><b>WP</b></div>
      </div>
    </div>
  </div>`;
}

function footerHTML(pageNum, pageCount, data, submittedStr) {
  return `
  <div class="doc-footer">
    <div>Worker App ID: <span class="appIdOut"></span></div>
    <div class="right">Submitted: <span class="submittedOut"></span><br>Page <span class="pageNumOut"></span> of <span class="pageCountOut"></span></div>
  </div>`;
}

/* ------------------------------ content blocks ----------------------------*/
function buildBlocks(data) {
  const blocks = [];

  // Block 1: intro + Return to Work status box
  blocks.push(`
    <p class="intro-line"><span class="name answer">${esc(data.workerName)}</span> provided the following updates in relation to their claim:</p>
    <div class="section-title">Return to Work</div>
    <div class="box">
      <div class="box-caption">Select one:</div>
      <div class="opt-row">
        <span class="opt">${chk(data.rtwStatus === "notMissed")} I have not missed time from work</span>
        <span class="opt">${chk(data.rtwStatus === "notReturned")} I have not returned to work</span>
        <span class="opt">${chk(data.rtwStatus === "returnedOn")} I returned to work on: <span class="answer">${data.rtwStatus === "returnedOn" ? esc(fmtDate(data.rtwDate)) : "____________"}</span></span>
      </div>
    </div>`);

  // Block 2: work duty + how it's going + expected return + concerns + contact
  const dutyLabels = {
    fullRegular: "Full duties, regular hours",
    fullReduced: "Full duties, reduced hours",
    modRegular: "Modified duties, regular hours",
    modReduced: "Modified duties, reduced hours",
  };
  blocks.push(`
    <div class="box">
      <div class="box-caption">I am working:</div>
      <div class="opt-row">
        ${Object.entries(dutyLabels)
          .map(([k, label]) => `<span class="opt">${chk(data.dutyType === k)} ${label}</span>`)
          .join("")}
      </div>
      <div class="opt" style="margin-top:6px;">${chk(data.dutyType === "other")} Other: <span class="answer">${data.dutyType === "other" ? esc(data.dutyOther) : ""}</span></div>
    </div>
    <div class="box">
      <div class="box-caption">My return to work is going:</div>
      <div class="freeform">${esc(data.rtwGoing) || "&nbsp;"}</div>
    </div>
    <div class="field-line"><span class="cap">I expect to return to work on:</span> <span class="answer">${esc(fmtDate(data.expectedReturn)) || "____________"}</span></div>
    <div class="box" style="margin-top:8px;">
      <div class="box-caption">I have the following concerns about returning to work:</div>
      <div class="freeform">${esc(data.concerns) || "&nbsp;"}</div>
    </div>
    <div class="contact-row">
      <div>I was most recently in contact with: <span class="answer">${esc(data.contactName) || "____________"}</span></div>
      <div>on <span class="answer">${esc(fmtDate(data.contactDate)) || "____________"}</span></div>
    </div>`);

  // Block 3: Recovery
  blocks.push(`
    <div class="section-title">Recovery</div>
    <div class="box">
      <div class="box-caption">Select one:</div>
      <div class="opt-row">
        <span class="opt">${chk(data.recoveryStatus === "notFull")} I have not fully recovered from my workplace injury.</span>
        <span class="opt">${chk(data.recoveryStatus === "full")} I have fully recovered from my workplace injury.</span>
      </div>
    </div>
    <div class="box">
      <div class="box-caption">I have provided the following comments about my recovery:</div>
      <div class="freeform">${esc(data.recoveryComments) || "&nbsp;"}</div>
    </div>`);

  // Block 4: Pain scale
  let painCells = "";
  for (let i = 1; i <= 10; i++) {
    painCells += `<div class="pain-cell${i === data.painScale ? " selected" : ""}">${i}</div>`;
  }
  blocks.push(`
    <div class="section-title">Pain Level</div>
    <p style="font-size:11.5px; margin:4px 0 6px;">I rate my current pain/discomfort on a scale of 1&ndash;10, where 1 is no pain and 10 is severe pain.</p>
    <div class="pain-scale">${painCells}</div>`);

  // Block 5: Medical treatment
  blocks.push(`
    <div class="section-title">Medical Treatment</div>
    <div class="box">
      <div class="box-caption">Select one:</div>
      <div class="opt-row" style="flex-direction:column; gap:6px;">
        <span class="opt">${chk(data.treatmentStatus === "notContinuing")} I am not continuing to receive medical treatment for my workplace injury.</span>
        <span class="opt">${chk(data.treatmentStatus === "continuing")} I am continuing to receive medical treatment for my workplace injury from: <span class="answer">${data.treatmentStatus === "continuing" ? esc(data.providerType) : "____________"}</span> <span class="mini-label">(Medical Provider Type)</span></span>
      </div>
      ${
        data.treatmentStatus === "continuing"
          ? `<div class="field-line">My last medical treatment was from <span class="answer">${esc(fmtDate(data.lastTreatmentDate))}</span> <span class="mini-label">(Date)</span> — <span class="answer">${esc(data.lastTreatmentName)}</span> <span class="mini-label">(Medical Provider Name)</span></div>
             <div class="field-line">I am attending a Chiropractor or Physiotherapist <span class="answer">${esc(data.chiroFrequency) || "____________"}</span> <span class="mini-label">(Frequency)</span></div>`
          : ""
      }
    </div>`);

  // Block 6: Medication + next treatment date
  blocks.push(`
    <div class="section-title">Medication</div>
    <div class="box">
      <div class="box-caption">Select one:</div>
      <div class="opt-row" style="flex-direction:column; gap:6px;">
        <span class="opt">${chk(data.medicationStatus === "notTaking")} I am not taking medication for my workplace injury.</span>
        <span class="opt">${chk(data.medicationStatus === "taking")} I am taking medication for my workplace injury: <span class="answer">${data.medicationStatus === "taking" ? esc(data.medicationName) : "____________"}</span> <span class="mini-label">(Name of prescribed medication)</span></span>
      </div>
    </div>
    <div class="field-line">My next medical treatment is <span class="answer">${esc(fmtDate(data.nextTreatmentDate)) || "____________"}</span></div>`);

  // Block 7: Home exercises
  blocks.push(`
    <div class="section-title">Home Exercises</div>
    <div class="box">
      <div class="box-caption">Select one:</div>
      <div class="opt-row">
        <span class="opt">${chk(data.exerciseStatus === "notDoing")} I am not doing home exercises for my workplace injury.</span>
        <span class="opt">${chk(data.exerciseStatus === "doing")} I am doing home exercises for my workplace injury.</span>
      </div>
      ${
        data.exerciseStatus === "doing"
          ? `<div class="field-line" style="margin-top:6px;"><span class="cap">List the exercises you are doing:</span><div class="freeform">${esc(data.exerciseList)}</div></div>`
          : ""
      }
    </div>`);

  // Block 8: Other info
  blocks.push(`
    <div class="section-title">Other Information</div>
    <div class="box">
      <div class="box-caption">I would like to provide the following additional information about my claim/injury:</div>
      <div class="freeform">${esc(data.otherInfo) || "&nbsp;"}</div>
    </div>`);

  // Block 9: certification
  blocks.push(`
    <div class="section-title">Certification</div>
    <p class="cert-text">I certify that the information given on this form is true, correct and complete to the best of my knowledge.
    I agree to notify the Workers Compensation Board of Manitoba (WCB) immediately once I return to any form of work and/or employment.
    I understand that it is an offence to knowingly make a false statement to the WCB. I also understand that it is an offence to
    withhold information from WCB which affects my entitlement to compensation (e.g., full or partial recovery from injury,
    ability to return to work, sources of additional income, etc.). I understand that refusing to co-operate with, or follow my
    treatment, may result in the WCB reducing or suspending my benefits.</p>
    <div class="privacy-row">${chk(true)} I understand that the <a href="#">Privacy Notice</a> applies to the personal information collected in this document.</div>`);

  return blocks;
}

/* ------------------------------ pagination engine -------------------------*/
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

function measureBlockHeight(html, maxWidthPx) {
  const wrap = document.createElement("div");
  wrap.className = "page-body";
  wrap.style.width = maxWidthPx + "px";
  wrap.style.position = "static";
  wrap.innerHTML = html;
  stage.appendChild(wrap);
  const h = wrap.scrollHeight;
  stage.removeChild(wrap);
  return h;
}

function paginateBlocks(blocks) {
  const maxHeight = measureMaxContentHeight();
  // content width = page width minus left/right padding (46px each side)
  const contentWidth = 794 - 46 * 2;

  const pages = [[]];
  let runningHeight = 0;

  blocks.forEach((blockHtml) => {
    const h = measureBlockHeight(blockHtml, contentWidth);
    const current = pages[pages.length - 1];
    if (current.length > 0 && runningHeight + h > maxHeight) {
      pages.push([]);
      runningHeight = 0;
    }
    pages[pages.length - 1].push(blockHtml);
    runningHeight += h;
  });

  return pages;
}

/* ------------------------------ full render --------------------------------*/
function nowStamp() {
  const d = new Date();
  const date = d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

function render() {
  updateConditionals();
  const data = readData();
  $("painScaleOut").textContent = data.painScale;

  const blocks = buildBlocks(data);
  const pages = paginateBlocks(blocks);
  const submitted = nowStamp();

  const pagesEl = $("pages");
  pagesEl.innerHTML = "";

  pages.forEach((pageBlocks, i) => {
    const pageEl = document.createElement("div");
    pageEl.className = "page";
    pageEl.innerHTML =
      headerHTML() +
      `<div class="page-body">${pageBlocks.join("")}</div>` +
      footerHTML();
    pagesEl.appendChild(pageEl);

    pageEl.querySelectorAll(".claimNoOut").forEach((el) => (el.textContent = data.claimNo));
    pageEl.querySelectorAll(".appIdOut").forEach((el) => (el.textContent = data.workerAppId));
    pageEl.querySelectorAll(".submittedOut").forEach((el) => (el.textContent = submitted));
    pageEl.querySelectorAll(".pageNumOut").forEach((el) => (el.textContent = i + 1));
    pageEl.querySelectorAll(".pageCountOut").forEach((el) => (el.textContent = pages.length));
  });
}

/* ------------------------------ conditional field show/hide ---------------*/
function updateConditionals() {
  document.querySelectorAll(".conditional").forEach((el) => {
    const [fieldId, val] = el.dataset.showFor.split(":");
    const field = $(fieldId);
    el.classList.toggle("active", field && field.value === val);
  });
}

/* ------------------------------ sample datasets ----------------------------*/
const SAMPLES = {
  short: {
    workerName: "Madeleine Willson",
    claimNo: "20042047",
    workerAppId: "712041",
    rtwStatus: "notMissed",
    dutyType: "fullRegular",
    rtwGoing: "",
    concerns: "",
    recoveryStatus: "full",
    recoveryComments: "",
    painScale: 1,
    treatmentStatus: "notContinuing",
    medicationStatus: "notTaking",
    exerciseStatus: "notDoing",
    otherInfo: "",
  },
  long: {
    workerName: "Jordan A. Fontaine-Beaulieu",
    claimNo: "20099183",
    workerAppId: "884213",
    rtwStatus: "returnedOn",
    rtwDate: "2024-04-02",
    dutyType: "modReduced",
    rtwGoing:
      "It has been a slow and difficult adjustment. I am finding that even reduced hours leave me fatigued by early afternoon, and I've had to ask my supervisor for extra breaks. Some days are better than others, and I worry about a relapse if my hours increase too quickly. I have flagged this to my case manager and we are reviewing the ramp-up schedule weekly.",
    expectedReturn: "2024-06-01",
    concerns:
      "My main concern is that the modified duties still involve some light lifting that aggravates my lower back. I've discussed alternatives with my supervisor, including a sit-stand desk and rotating tasks every 90 minutes, but we have not finalized anything yet. I would appreciate WCB following up with my employer about accommodations.",
    contactName: "Priya Chandrasekaran",
    contactDate: "2024-04-18",
    recoveryStatus: "notFull",
    recoveryComments:
      "I still experience stiffness in the morning and intermittent sharp pain when bending or twisting. My physiotherapist has noted steady but slow improvement in range of motion over the last six weeks. I am hopeful but not yet at full function.",
    painScale: 6,
    treatmentStatus: "continuing",
    providerType: "Physiotherapist",
    lastTreatmentDate: "2024-04-20",
    lastTreatmentName: "Dr. Aisha Bello",
    nextTreatmentDate: "2024-04-27",
    chiroFrequency: "Twice weekly, reviewed monthly",
    medicationStatus: "taking",
    medicationName: "Naproxen 250mg, as needed",
    exerciseStatus: "doing",
    exerciseList:
      "Daily: pelvic tilts (3x10), bird-dog holds (3x8 each side), hamstring stretches (hold 30s x3), and a 20-minute walk. Twice weekly: resistance band rows and glute bridges as prescribed by my physiotherapist. My physiotherapist also asked me to keep a short pain-and-activity log after each session, noting what aggravated symptoms and what helped, and to bring that log to every appointment so we can adjust the plan together as needed.",
    otherInfo:
      "I want to note that my employer has been supportive so far, but I am concerned about how the accommodation will work once our team moves to a new floor next month, since I understand the new workstation configuration hasn't been finalized. I would like WCB to keep this on file in case I need to raise it again. Separately, I also wanted to flag that I have an upcoming independent medical exam scheduled and would appreciate a copy of the referral letter in advance so I can prepare any questions I have about the assessment process and what it means for my claim going forward.",
  },
};

function applySample(name) {
  const s = SAMPLES[name];
  Object.entries(s).forEach(([key, val]) => {
    const el = $(key);
    if (el) el.value = val;
  });
  render();
}

/* ------------------------------ wire up events -----------------------------*/
document.getElementById("reportForm").addEventListener("input", render);
document.getElementById("reportForm").addEventListener("change", render);
document.querySelectorAll("[data-sample]").forEach((btn) => {
  btn.addEventListener("click", () => applySample(btn.dataset.sample));
});

render();
