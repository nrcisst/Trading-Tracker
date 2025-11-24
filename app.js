const apiBase = "http://localhost:4000/api";

let currentYear;
let currentMonth; 

let tradesByDate = {};

// ---- Helpers -------------------

function formatDateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

async function fetchDay(dateKey){
  const res = await fetch(`${apiBase}/trades/${dateKey}`);
    if (!res.ok) throw new Error("Failed to fetch day");
    const json = await res.json();
    return json.data;
}

async function saveDay(dateKey, payload){
  const res = await fetch(`${apiBase}/trades/${dateKey}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save day");
}


// ---- Calendar Rendering --------

function renderCalendar() {
  const calendarEl = document.getElementById("calendar");
  const labelEl = document.getElementById("current-month-label");

  calendarEl.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay(); 

  // TODO: Render weekday headers (Sun, Mon, etc.)


  for (let i = 0; i < startWeekday; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day-cell empty";
    calendarEl.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";

    const dateNumber = document.createElement("div");
    dateNumber.className = "date-number";
    dateNumber.textContent = day;
    cell.appendChild(dateNumber);

    const key = formatDateKey(currentYear, currentMonth, day);
    const data = tradesByDate[key];

    if (data && typeof data.pl === "number") {
      const plEl = document.createElement("div");
      plEl.className = "pl-summary";
      plEl.textContent = `P/L: ${data.pl}`;
      cell.appendChild(plEl);
    }

    cell.addEventListener("click", () => openDayModal(key));
    calendarEl.appendChild(cell);
  }

  // Month label
  const monthName = firstDay.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  labelEl.textContent = monthName;
}

// ---- Modal Logic ----

async function openDayModal(dateKey) {
  const modal = document.getElementById("day-modal");
  const label = document.getElementById("modal-date-label");
  const plInput = document.getElementById("pl-input");
  const notesInput = document.getElementById("notes-input");

  modal.dataset.dateKey = dateKey;

  const [year, month, day] = dateKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  label.textContent = date.toDateString();

  plInput.value = "";
  notesInput.value = "";

  try {
    const existing = await fetchDay(dateKey);
    if(existing){
      plInput.value = existing.pl ?? "";
      notesInput.value = existing.notes ?? "";
    }
  } catch(error){
    console.error(error);
  }

  modal.classList.remove("hidden");
}

function closeDayModal() {
  const modal = document.getElementById("day-modal");
  modal.classList.add("hidden");
}

function setupModalButtons() {
  const saveBtn = document.getElementById("save-day");
  const closeBtn = document.getElementById("close-modal");
  const modal = document.getElementById("day-modal");

  saveBtn.addEventListener("click", async () => {
    const dateKey = modal.dataset.dateKey;
    const plVal = parseFloat(document.getElementById("pl-input").value);
    const notesVal = document.getElementById("notes-input").value;

    const payload = {
      pl: isNaN(plVal) ? null : plVal,
      notes: notesVal,
    };

    try {
      await saveDay(dateKey, payload);
      // Optional local cache:
      tradesByDate[dateKey] = payload;
      closeDayModal();
      renderCalendar();
    } catch (err) {
      console.error(err);
      // optional: show error to user
    }
  });

  closeBtn.addEventListener("click", closeDayModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeDayModal();
  });
}

// ---- Month navigation ----

function setupMonthControls() {
  document.getElementById("prev-month").addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });
}


// ---- Mouse tracking for flashlight effect ----

function setupMouseTracking() {
  document.addEventListener("mousemove", (e) => {
    document.documentElement.style.setProperty("--x", e.clientX);
    document.documentElement.style.setProperty("--y", e.clientY);
  });
}

function init() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  setupModalButtons();
  setupMonthControls();
  setupMouseTracking();
  renderCalendar();
}

document.addEventListener("DOMContentLoaded", init);
