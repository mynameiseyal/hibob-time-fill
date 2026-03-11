(function () {
  "use strict";

  const TAG = "[HiBob-Filler]";
  const REQUEST_DELAY_MS = 400;

  const filledDates = new Set();

  function getEmployeeId() {
    const match = location.href.match(/employees\/(\d+)/);
    if (match) return match[1];
    const perfEntries = performance.getEntriesByType("resource");
    for (const entry of perfEntries) {
      const m = entry.name.match(/attendance\/employees\/(\d+)/);
      if (m) return m[1];
    }
    return null;
  }

  function randomDuration() {
    const totalSteps = (10 * 60 - 9 * 60) / 5;
    const stepsPicked = Math.floor(Math.random() * (totalSteps + 1));
    return 9 * 60 + stepsPicked * 5;
  }

  function getUnfilledDays(workdays) {
    const dayNameToNum = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const rows = document.querySelectorAll('[role="row"]');
    const unfilled = [];

    for (const row of rows) {
      const cells = row.querySelectorAll('[role="gridcell"]');
      if (cells.length < 2) continue;

      // cells[0] = indicator column ("1" when attendance is missing)
      // cells[1] = date column ("Wed, 11/03/2026")
      const indicator = (cells[0].getAttribute("aria-label") || cells[0].textContent || "").trim();
      const indicatorNum = parseInt(indicator, 10);
      if (isNaN(indicatorNum) || indicatorNum < 1) continue;

      const dateText = (cells[1].getAttribute("aria-label") || cells[1].textContent || "").trim();
      const match = dateText.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s*(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) continue;

      const [, dayName, dd, mm, yyyy] = match;
      const dayNum = dayNameToNum[dayName];
      if (!workdays.includes(dayNum)) continue;

      const isoDate = `${yyyy}-${mm}-${dd}`;
      if (filledDates.has(isoDate)) continue;

      unfilled.push({ date: isoDate, display: dateText });
    }

    return unfilled;
  }

  async function fillDay(employeeId, date, durationMinutes) {
    const url = `/api/attendance/employees/${employeeId}/attendance/entries?forDate=${date}`;
    // getTimezoneOffset() returns negative for east-of-UTC (e.g. -120 for UTC+2 Israel)
    const tzOffset = new Date().getTimezoneOffset();
    const body = [
      {
        start: `${date}T00:00`,
        end: null,
        reason: null,
        comment: null,
        entryType: "work",
        reportingMethod: "duration",
        durationInMinutes: durationMinutes,
        offset: tzOffset,
      },
    ];

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });

    return { ok: resp.ok, status: resp.status };
  }

  function buildPanel() {
    const panel = document.createElement("div");
    panel.id = "hb-filler-panel";

    const header = document.createElement("div");
    header.className = "hb-filler-header";

    const title = document.createElement("span");
    title.className = "hb-filler-title";
    title.textContent = "Attendance Filler";

    const minBtn = document.createElement("button");
    minBtn.className = "hb-filler-minimize";
    minBtn.title = "Minimize";
    minBtn.textContent = "\u2212";

    header.appendChild(title);
    header.appendChild(minBtn);

    const body = document.createElement("div");
    body.className = "hb-filler-body";

    const status = document.createElement("div");
    status.className = "hb-filler-status hb-ready";
    status.id = "hb-status";

    const statusText = document.createElement("span");
    statusText.textContent = "Ready to fill attendance.";
    const br = document.createElement("br");
    const statusSmall = document.createElement("small");
    statusSmall.textContent = "Random duration 9h00m\u201310h00m per day.";
    status.appendChild(statusText);
    status.appendChild(br);
    status.appendChild(statusSmall);

    const btn = document.createElement("button");
    btn.className = "hb-filler-btn";
    btn.id = "hb-fill-btn";
    btn.textContent = "Fill Missing Days";

    const progress = document.createElement("div");
    progress.className = "hb-filler-progress";
    progress.id = "hb-progress";

    body.appendChild(status);
    body.appendChild(btn);
    body.appendChild(progress);

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);

    minBtn.addEventListener("click", () => {
      body.classList.toggle("hb-hidden");
      minBtn.textContent = body.classList.contains("hb-hidden") ? "+" : "\u2212";
    });

    btn.addEventListener("click", startFilling);
  }

  async function startFilling() {
    const btn = document.getElementById("hb-fill-btn");
    const progress = document.getElementById("hb-progress");
    const status = document.getElementById("hb-status");
    btn.disabled = true;

    const employeeId = getEmployeeId();
    if (!employeeId) {
      progress.textContent = "Could not detect employee ID. Try refreshing.";
      btn.disabled = false;
      return;
    }

    const result = await new Promise((r) =>
      chrome.storage.local.get(STORAGE_KEY_WORKDAYS, r)
    );
    const workdays = result[STORAGE_KEY_WORKDAYS] || DEFAULT_WORKDAYS;

    const days = getUnfilledDays(workdays);
    if (days.length === 0) {
      progress.textContent = "No unfilled working days found.";
      btn.disabled = false;
      return;
    }

    progress.textContent = `Found ${days.length} unfilled day(s). Starting...`;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const durationMinutes = randomDuration();
      const h = Math.floor(durationMinutes / 60);
      const m = durationMinutes % 60;
      const durStr = `${h}h${String(m).padStart(2, "0")}m`;

      progress.textContent = `[${i + 1}/${days.length}] ${day.display} \u2014 ${durStr}...`;

      try {
        const resp = await fillDay(employeeId, day.date, durationMinutes);
        if (resp.ok) {
          succeeded++;
          filledDates.add(day.date);
          progress.textContent = `[${i + 1}/${days.length}] ${day.display} \u2014 ${durStr} \u2713`;
        } else {
          failed++;
          progress.textContent = `[${i + 1}/${days.length}] ${day.display} \u2014 FAILED (${resp.status})`;
          console.warn(TAG, "Failed:", day.date, resp.status);
        }
      } catch (err) {
        failed++;
        progress.textContent = `[${i + 1}/${days.length}] ${day.display} \u2014 ERROR`;
        console.error(TAG, "Error:", day.date, err);
      }

      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    }

    const doneText = `Done! ${succeeded} filled, ${failed} failed.`;
    progress.textContent = doneText;

    status.textContent = "";
    const completedText = document.createTextNode("Completed.");
    const completedBr = document.createElement("br");
    const completedSmall = document.createElement("small");
    completedSmall.textContent = `${succeeded} days filled successfully.`;
    status.appendChild(completedText);
    status.appendChild(completedBr);
    status.appendChild(completedSmall);

    btn.disabled = false;

    if (succeeded > 0) {
      progress.textContent = doneText + " Reloading in 3s...";
      setTimeout(() => location.reload(), 3000);
    }
  }

  buildPanel();
  console.log(TAG, "Content script active");
})();
