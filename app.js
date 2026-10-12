/**
 * TRACKER - DAILY DISCIPLINE & HABIT OS
 * 100% Serverless & Standalone (No server or laptop required!)
 * Saves directly to device storage with full offline PWA support.
 */

// Core Default Habits
const DEFAULT_HABITS = [
  "Workout / Exercise",
  "10,000 Steps",
  "Drink 3L Water",
  "No Junk Food",
  "Healthy Meals",
  "Read / Learn",
  "Meditate / Journal",
  "Wake Up Early",
  "Sleep On Time",
  "Be Productive",
  "Deep Work Session",
  "Daily Reflection"
];

// Sleep Tiers
const SLEEP_TIERS = [
  { label: "10 hrs", val: 10 },
  { label: "9 hrs", val: 9 },
  { label: "8 hrs", val: 8 },
  { label: "7 hrs", val: 7 },
  { label: "6 hrs", val: 6 },
  { label: "5 hrs", val: 5 },
  { label: "< 5 hrs", val: 4 }
];

// Month & Day Helpers
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const TOTAL_DAYS = 31;

// Motivational Discipline Quotes
const DISCIPLINE_QUOTES = [
  "\"The pain of discipline is far less than the pain of regret. Lock in.\"",
  "\"Every single day is a vote for the person you wish to become. Win today.\"",
  "\"No one is coming to save you. Put your head down and put in the work.\"",
  "\"You don't need motivation. You need a standard you refuse to drop below.\"",
  "\"Consistency is the only superpower that matters. Master the routine.\"",
  "\"Suffering in discipline is the catalyst of growth. Stay relentless.\"",
  "\"Don't negotiate with yourself. If it's on the schedule, it gets done.\"",
  "\"Small daily improvements over time lead to stunning results.\""
];

// App Global State
let currentMonth = "October";
let currentYear = 2026;
let isBlankMode = false;
let currentThemeIdx = 0;
const THEMES = ["wallpaper-theme", "minimal-dark", "classic-white"];

// Timer State
let timerSeconds = 90;
let timerInitial = 90;
let timerInterval = null;
let isTimerRunning = false;

// Hydration State
let waterCupsCount = 0;

// Zoom State
let currentZoom = 1.0;
let currentZoomMode = "fit-page";

// Main Tracker Persistence Data
let trackerData = {
  name: "",
  month: "October",
  year: 2026,
  day: "",
  goal: "",
  habits: [...DEFAULT_HABITS],
  habitGrid: {},
  sleepGrid: {},
  weekly: {},
  reflection: {},
  water: 0,
  split: "Push (Chest, Shoulders, Triceps)",
  splitNotes: "",
  exercises: [
    { name: "Incline DB Bench Press", weight: "32 kg", reps: "10", done: true },
    { name: "Weighted Chest Dips", weight: "+15 kg", reps: "12", done: true },
    { name: "Cable Lateral Raises", weight: "12 kg", reps: "15", done: false },
    { name: "Overhead Tricep Extension", weight: "28 kg", reps: "12", done: false }
  ],
  prs: { bench: "", squat: "", deadlift: "", ohp: "", pullups: "", bodyfat: "" },
  macros: { calories: "", protein: "", carbs: "", fats: "", dietNotes: "" }
};

// Debounce utility to prevent excessive calls
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Debounced version of saveData (300ms) — use for input events
const debouncedSaveData = debounce(() => saveData(), 300);

// Athlete Profile Persistence Data
const PROFILE_KEY = "tracker_athlete_profile";
let athleteProfile = {
  name: "",
  age: "",
  height: "",
  startWeight: "",
  goalWeight: "",
  goalBodyFat: "",
  nonNegotiables: ""
};

function getStorageKey() {
  return `tracker_${currentYear}_${currentMonth}`;
}

// =========================================================
// AUDIO SYNTHESIZER (Web Audio API)
// =========================================================
function playAudioBeep(frequency = 880, duration = 0.15, type = "sine") {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

// =========================================================
// TAB NAVIGATION SYSTEM
// =========================================================
function setupTabNavigation() {
  const tabs = document.querySelectorAll(".nav-tab");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const targetPanelId = tab.dataset.tab;
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }

      // If switching to sheet tab, re-fit sheet
      if (targetPanelId === "sheetTab") {
        setTimeout(triggerFitPage, 100);
      }
      // If switching to analytics, refresh stats
      if (targetPanelId === "analyticsTab") {
        updateStats();
      }
    });
  });
}

// =========================================================
// TABLE GENERATION (Habits & Sleep Grids)
// =========================================================
function getWeekdayForDay(day) {
  const monthIdx = MONTH_NAMES.indexOf(currentMonth);
  if (monthIdx === -1) return "";
  const date = new Date(currentYear, monthIdx, day);
  return WEEKDAYS_SHORT[date.getDay()];
}

function isToday(day) {
  const today = new Date();
  const monthIdx = MONTH_NAMES.indexOf(currentMonth);
  return today.getDate() === day &&
         today.getMonth() === monthIdx &&
         today.getFullYear() === currentYear;
}

function initializeTables() {
  const habitsHeaderRow = document.getElementById("habitsHeaderRow");
  const sleepHeaderRow = document.getElementById("sleepHeaderRow");

  if (!habitsHeaderRow || !sleepHeaderRow) return;

  habitsHeaderRow.innerHTML = '<th class="habit-col-header">Habit / Day</th>';
  sleepHeaderRow.innerHTML = '<th class="sleep-col-header">Hours Slept / Day</th>';

  for (let d = 1; d <= TOTAL_DAYS; d++) {
    const weekday = getWeekdayForDay(d);
    const todayMatch = isToday(d);
    const todayClass = todayMatch ? "today-col" : "";

    const thHabit = document.createElement("th");
    thHabit.className = `day-col ${todayClass}`;
    thHabit.title = `Day ${d} (${weekday})`;
    thHabit.innerHTML = `
      <div class="day-col-content">
        <span class="day-weekday">${weekday}</span>
        <span class="day-num">${d}</span>
      </div>
    `;
    habitsHeaderRow.appendChild(thHabit);

    const thSleep = document.createElement("th");
    thSleep.className = `day-col ${todayClass}`;
    thSleep.title = `Day ${d} (${weekday})`;
    thSleep.innerHTML = `
      <div class="day-col-content">
        <span class="day-weekday">${weekday}</span>
        <span class="day-num">${d}</span>
      </div>
    `;
    sleepHeaderRow.appendChild(thSleep);
  }

  renderHabitsBody();
  renderSleepBody();
  renderMobileChecklist();
}

// =========================================================
// HABIT MANAGEMENT: ADD, MODIFY, DELETE
// =========================================================
function addHabit(initialName = "") {
  let name = initialName;
  if (!name) {
    const inputPrompt = prompt("Enter new habit name:", `Habit ${trackerData.habits.length + 1}`);
    if (inputPrompt === null) return;
    name = inputPrompt.trim() || `Habit ${trackerData.habits.length + 1}`;
  }

  trackerData.habits.push(name);
  renderHabitsBody();
  renderMobileChecklist();
  saveData();
  updateStats();
  playAudioBeep(700, 0.1, "sine");
}

function deleteHabit(habitIdx) {
  const habitName = trackerData.habits[habitIdx] || `Habit ${habitIdx + 1}`;
  if (!confirm(`Are you sure you want to delete "${habitName}"?`)) {
    return;
  }

  // Remove habit from list
  trackerData.habits.splice(habitIdx, 1);

  // Remap habitGrid keys cleanly
  const newGrid = {};
  Object.keys(trackerData.habitGrid).forEach(key => {
    const parts = key.split("_");
    const idx = parseInt(parts[0], 10);
    const day = parts[1];

    if (idx < habitIdx) {
      newGrid[key] = trackerData.habitGrid[key];
    } else if (idx > habitIdx) {
      newGrid[`${idx - 1}_${day}`] = trackerData.habitGrid[key];
    }
  });
  trackerData.habitGrid = newGrid;

  renderHabitsBody();
  renderMobileChecklist();
  saveData();
  updateStats();
  playAudioBeep(350, 0.15, "sawtooth");
}

function renderHabitsBody() {
  const habitsBody = document.getElementById("habitsBody");
  if (!habitsBody) return;
  habitsBody.innerHTML = "";

  trackerData.habits.forEach((habitName, habitIdx) => {
    const tr = document.createElement("tr");

    // Editable habit name with inline Delete button
    const tdLabel = document.createElement("td");
    tdLabel.className = "habit-name-cell";

    const labelWrap = document.createElement("div");
    labelWrap.className = "habit-label-wrap";

    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.value = habitName;
    inputName.title = "Click/tap to rename habit";
    inputName.className = "habit-name-input";
    inputName.addEventListener("change", (e) => {
      trackerData.habits[habitIdx] = e.target.value.trim() || `Habit ${habitIdx + 1}`;
      renderMobileChecklist();
      saveData();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "habit-delete-btn no-print";
    deleteBtn.title = "Delete this habit";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteHabit(habitIdx);
    });

    labelWrap.appendChild(inputName);
    labelWrap.appendChild(deleteBtn);
    tdLabel.appendChild(labelWrap);
    tr.appendChild(tdLabel);

    // Days 1-31
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const td = document.createElement("td");
      td.className = "grid-cell";
      if (isToday(day)) td.classList.add("today-cell");
      td.dataset.habit = habitIdx;
      td.dataset.day = day;

      const cellKey = `${habitIdx}_${day}`;
      if (trackerData.habitGrid[cellKey]) {
        td.classList.add("checked");
      }

      td.addEventListener("click", () => {
        const willCheck = !td.classList.contains("checked");
        setHabitCell(habitIdx, day, willCheck);
        if (willCheck) playAudioBeep(640, 0.08, "triangle");
      });

      tr.appendChild(td);
    }

    habitsBody.appendChild(tr);
  });
}

// =========================================================
// MOBILE "TODAY'S CHECKLIST" (Thumb-Optimized for iPhone)
// =========================================================
function renderMobileChecklist() {
  const container = document.getElementById("mobileChecklist");
  if (!container) return;

  const today = new Date();
  const todayDay = today.getDate();
  const todayLabel = document.getElementById("todayDateLabel");
  if (todayLabel) {
    todayLabel.textContent = `Today: ${MONTH_NAMES[today.getMonth()]} ${todayDay}`;
  }

  container.innerHTML = "";

  if (trackerData.habits.length === 0) {
    container.innerHTML = `
      <div class="empty-habits-notice">
        <p>No habits added yet.</p>
        <button class="btn btn-glow btn-sm" onclick="addHabit()">➕ Add Your First Habit</button>
      </div>
    `;
    return;
  }

  let completedTodayCount = 0;

  trackerData.habits.forEach((habitName, habitIdx) => {
    const isCompleted = !!trackerData.habitGrid[`${habitIdx}_${todayDay}`];
    if (isCompleted) completedTodayCount++;

    const item = document.createElement("div");
    item.className = `mobile-habit-item ${isCompleted ? "completed" : ""}`;

    // Big Toggle Checkbox
    const checkBtn = document.createElement("button");
    checkBtn.className = `mobile-check-box ${isCompleted ? "checked" : ""}`;
    checkBtn.innerHTML = isCompleted ? "✓" : "";
    checkBtn.title = "Tap to toggle today's completion";
    checkBtn.addEventListener("click", () => {
      const newState = !isCompleted;
      setHabitCell(habitIdx, todayDay, newState);
      if (newState) playAudioBeep(740, 0.1, "triangle");
    });

    // Editable name input
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "mobile-habit-input";
    nameInput.value = habitName;
    nameInput.placeholder = "Habit name";
    nameInput.addEventListener("change", (e) => {
      trackerData.habits[habitIdx] = e.target.value.trim() || `Habit ${habitIdx + 1}`;
      renderHabitsBody();
      saveData();
    });

    // Delete Button
    const delBtn = document.createElement("button");
    delBtn.className = "mobile-del-btn";
    delBtn.title = "Delete habit";
    delBtn.innerHTML = "🗑️";
    delBtn.addEventListener("click", () => {
      deleteHabit(habitIdx);
    });

    item.appendChild(checkBtn);
    item.appendChild(nameInput);
    item.appendChild(delBtn);
    container.appendChild(item);
  });

  // Update mobile progress bar
  const pct = Math.round((completedTodayCount / trackerData.habits.length) * 100);
  const fill = document.getElementById("todayProgressFill");
  const text = document.getElementById("todayProgressText");
  if (fill) fill.style.width = `${pct}%`;
  if (text) text.textContent = `${completedTodayCount} of ${trackerData.habits.length} habits completed today (${pct}%)`;
}

function setHabitCell(habitIdx, day, state) {
  const key = `${habitIdx}_${day}`;
  const cell = document.querySelector(`.grid-cell[data-habit="${habitIdx}"][data-day="${day}"]`);
  
  if (state) {
    trackerData.habitGrid[key] = true;
    cell?.classList.add("checked");
  } else {
    delete trackerData.habitGrid[key];
    cell?.classList.remove("checked");
  }

  renderMobileChecklist();
  saveData();
  updateStats();
}

function renderSleepBody() {
  renderSleepMatrixTable();
  renderSleepGraph();
}

function renderSleepMatrixTable() {
  const sleepBody = document.getElementById("sleepBody");
  if (!sleepBody) return;
  sleepBody.innerHTML = "";

  SLEEP_TIERS.forEach((tier, tierIdx) => {
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.className = "sleep-label-cell";
    tdLabel.textContent = tier.label;
    tr.appendChild(tdLabel);

    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const td = document.createElement("td");
      td.className = "sleep-cell";
      if (isToday(day)) td.classList.add("today-cell");
      td.dataset.tier = tierIdx;
      td.dataset.day = day;

      if (trackerData.sleepGrid[day] === tierIdx) {
        td.classList.add("active-sleep");
      }

      td.addEventListener("click", () => {
        if (trackerData.sleepGrid[day] === tierIdx) {
          delete trackerData.sleepGrid[day];
        } else {
          trackerData.sleepGrid[day] = tierIdx;
          playAudioBeep(520, 0.08, "sine");
        }
        updateSleepDayCells(day);
        renderSleepGraph();
        saveData();
        updateStats();
      });

      tr.appendChild(td);
    }

    sleepBody.appendChild(tr);
  });
}

function updateSleepDayCells(day) {
  const selectedTier = trackerData.sleepGrid[day];
  const dayCells = document.querySelectorAll(`.sleep-cell[data-day="${day}"]`);
  
  dayCells.forEach(cell => {
    const cellTier = parseInt(cell.dataset.tier, 10);
    if (selectedTier !== undefined && cellTier === selectedTier) {
      cell.classList.add("active-sleep");
    } else {
      cell.classList.remove("active-sleep");
    }
  });
}

// =========================================================
// INTERACTIVE VISUAL SLEEP RECOVERY GRAPH
// =========================================================
function renderSleepGraph() {
  const svg = document.getElementById("sleepTrendSvg");
  const timeline = document.getElementById("sleepDaysTimeline");
  if (!svg) return;

  const width = 860;
  const height = 170;
  const padLeft = 32;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 24;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const minHours = 0;
  const maxHours = 12;
  const targetHours = getTargetSleepHours();

  // Helper to map (day 1..31, hours 0..12) to (x, y)
  const getX = (day) => padLeft + ((day - 1) / (TOTAL_DAYS - 1)) * chartWidth;
  const getY = (hrs) => padTop + chartHeight - (Math.min(Math.max(hrs, 0), maxHours) / maxHours) * chartHeight;

  // Compute metrics
  const sleepEntries = Object.entries(trackerData.sleepGrid);
  let totalHours = 0;
  sleepEntries.forEach(([_, tierIdx]) => {
    totalHours += SLEEP_TIERS[tierIdx].val;
  });
  const avgHours = sleepEntries.length > 0 ? (totalHours / sleepEntries.length).toFixed(1) : "--";

  const avgEl = document.getElementById("sleepGraphAvgVal");
  if (avgEl) avgEl.textContent = avgHours !== "--" ? `${avgHours} hrs` : "-- hrs";

  const targetEl = document.getElementById("sleepGraphTargetVal");
  if (targetEl) targetEl.textContent = `${targetHours.toFixed(1)} hrs`;

  const qualityEl = document.getElementById("sleepGraphQualityVal");
  if (qualityEl) {
    if (avgHours === "--") {
      qualityEl.textContent = "No Data";
      qualityEl.style.color = "#94a3b8";
    } else {
      const avgNum = parseFloat(avgHours);
      if (avgNum >= targetHours) {
        qualityEl.textContent = "Optimal ⚡";
        qualityEl.style.color = "#10b981";
      } else if (avgNum >= targetHours - 1.0) {
        qualityEl.textContent = "Good 👍";
        qualityEl.style.color = "#38bdf8";
      } else {
        qualityEl.textContent = "Deficit ⚠️";
        qualityEl.style.color = "#f43f5e";
      }
    }
  }

  // Build SVG Content
  let svgHtml = `
    <defs>
      <linearGradient id="sleepAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0284c7" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="#0284c7" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
  `;

  // Horizontal Grid Lines for 4, 6, 8, 10 hrs
  [4, 6, 8, 10].forEach(h => {
    const y = getY(h);
    svgHtml += `
      <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="sleep-grid-line"/>
      <text x="${padLeft - 6}" y="${y + 3}" font-size="9" fill="#94a3b8" text-anchor="end" font-family="monospace">${h}h</text>
    `;
  });

  // Target Guideline
  const targetY = getY(targetHours);
  svgHtml += `
    <line x1="${padLeft}" y1="${targetY}" x2="${width - padRight}" y2="${targetY}" class="sleep-target-line"/>
    <text x="${width - padRight - 4}" y="${targetY - 4}" font-size="9" fill="#d97706" font-weight="bold" text-anchor="end">Target: ${targetHours}h</text>
  `;

  // Bars & Points calculation
  const points = [];
  const barWidth = Math.max(8, (chartWidth / TOTAL_DAYS) * 0.65);

  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const x = getX(day);
    const tierIdx = trackerData.sleepGrid[day];
    const isDayToday = isToday(day);

    if (tierIdx !== undefined) {
      const hours = SLEEP_TIERS[tierIdx].val;
      const y = getY(hours);
      const barH = (padTop + chartHeight) - y;
      points.push({ day, x, y, hours });

      let barClass = "sleep-bar";
      if (hours >= targetHours) barClass += " optimal";
      else if (hours < 6) barClass += " deficit";

      svgHtml += `
        <rect x="${x - barWidth / 2}" y="${y}" width="${barWidth}" height="${barH}" rx="3" class="${barClass}" onclick="promptDaySleep(${day})">
          <title>Day ${day}: ${hours} Hours Slept</title>
        </rect>
        <text x="${x}" y="${y - 4}" font-size="8.5" fill="#0284c7" font-weight="bold" text-anchor="middle">${hours}</text>
      `;
    } else {
      // Empty column placeholder for click-to-log
      svgHtml += `
        <rect x="${x - barWidth / 2}" y="${padTop}" width="${barWidth}" height="${chartHeight}" fill="transparent" class="sleep-col-tap" style="cursor: pointer;" onclick="promptDaySleep(${day})">
          <title>Click to log sleep for Day ${day}</title>
        </rect>
      `;
    }

    // Today indicator marker on baseline
    if (isDayToday) {
      svgHtml += `
        <circle cx="${x}" cy="${padTop + chartHeight + 12}" r="3.5" fill="#f59e0b"/>
      `;
    }
  }

  // Smooth Area & Trend Line over logged points
  if (points.length >= 2) {
    let dPath = `M ${points[0].x} ${points[0].y}`;
    let dArea = `M ${points[0].x} ${padTop + chartHeight} L ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const cpX = (prev.x + cur.x) / 2;
      dPath += ` C ${cpX} ${prev.y}, ${cpX} ${cur.y}, ${cur.x} ${cur.y}`;
      dArea += ` C ${cpX} ${prev.y}, ${cpX} ${cur.y}, ${cur.x} ${cur.y}`;
    }

    const last = points[points.length - 1];
    dArea += ` L ${last.x} ${padTop + chartHeight} Z`;

    svgHtml += `
      <path d="${dArea}" fill="url(#sleepAreaGrad)"/>
      <path d="${dPath}" class="sleep-trend-path"/>
    `;
  }

  // Dots over logged days
  points.forEach(p => {
    svgHtml += `
      <circle cx="${p.x}" cy="${p.y}" r="4" class="sleep-graph-dot" onclick="promptDaySleep(${p.day})">
        <title>Day ${p.day}: ${p.hours} hrs</title>
      </circle>
    `;
  });

  svg.innerHTML = svgHtml;

  // Timeline Day Buttons below chart
  if (timeline) {
    timeline.innerHTML = "";
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sleep-day-btn";
      if (trackerData.sleepGrid[day] !== undefined) btn.classList.add("has-sleep");
      if (isToday(day)) btn.classList.add("today-day");
      btn.textContent = day;
      btn.title = `Day ${day}: ${trackerData.sleepGrid[day] !== undefined ? SLEEP_TIERS[trackerData.sleepGrid[day]].label : "Tap to set sleep"}`;
      btn.addEventListener("click", () => promptDaySleep(day));
      timeline.appendChild(btn);
    }
  }
}

// 1-Click Interactive Sleep Picker for any day
function promptDaySleep(day) {
  const currentTier = trackerData.sleepGrid[day];
  const currentLabel = currentTier !== undefined ? SLEEP_TIERS[currentTier].label : "Not set";
  
  // Quick cycle or prompt
  const options = SLEEP_TIERS.map((t, idx) => `${idx + 1}: ${t.label}`).join("\n");
  const input = prompt(`Enter sleep for Day ${day} (Currently: ${currentLabel}):\n\n${options}\n0: Clear sleep`, currentTier !== undefined ? currentTier + 1 : "3");
  
  if (input === null) return;
  const choice = parseInt(input.trim(), 10);
  if (choice === 0) {
    delete trackerData.sleepGrid[day];
  } else if (choice >= 1 && choice <= SLEEP_TIERS.length) {
    trackerData.sleepGrid[day] = choice - 1;
    playAudioBeep(640, 0.1, "sine");
  } else {
    return;
  }

  updateSleepDayCells(day);
  renderSleepGraph();
  saveData();
  updateStats();
}

// 1-Click: Mark Today's Habits Complete
function completeTodayHabits() {
  const today = new Date();
  const day = today.getDate();
  trackerData.habits.forEach((_, habitIdx) => {
    trackerData.habitGrid[`${habitIdx}_${day}`] = true;
  });
  renderHabitsBody();
  renderMobileChecklist();
  saveData();
  updateStats();
  playAudioBeep(880, 0.2, "triangle");
}

// =========================================================
// ACCURATE ZOOM & RESPONSIVE FIT
// =========================================================
const sheetScaleWrapper = document.getElementById("sheetScaleWrapper");
const sheetScrollContainer = document.getElementById("sheetScrollContainer");
const trackerSheet = document.getElementById("trackerSheet");
const zoomLevelText = document.getElementById("zoomLevelText");

function applyZoom(scale, mode = "custom") {
  const clampedScale = Math.min(Math.max(scale, 0.35), 2.0);
  currentZoom = clampedScale;
  currentZoomMode = mode;

  if (sheetScaleWrapper) {
    sheetScaleWrapper.style.transform = `scale(${currentZoom})`;
  }

  if (zoomLevelText) {
    zoomLevelText.textContent = `${Math.round(currentZoom * 100)}%`;
  }

  document.querySelectorAll(".zoom-pill").forEach(p => p.classList.remove("active"));
  if (mode === "fit-page") document.getElementById("zoomFitPageBtn")?.classList.add("active");
  if (mode === "fit-width") document.getElementById("zoomFitWidthBtn")?.classList.add("active");
  if (mode === "reset") document.getElementById("zoomResetBtn")?.classList.add("active");
}

function calculateFitPageScale() {
  if (!sheetScrollContainer || !trackerSheet) return 1.0;
  const availWidth = sheetScrollContainer.clientWidth - 24;
  const availHeight = sheetScrollContainer.clientHeight - 24;

  const sheetWidth = trackerSheet.offsetWidth || 860;
  const sheetHeight = trackerSheet.offsetHeight || 1220;

  const scaleX = availWidth / sheetWidth;
  const scaleY = availHeight / sheetHeight;

  return Math.min(scaleX, scaleY, 1.2);
}

function calculateFitWidthScale() {
  if (!sheetScrollContainer || !trackerSheet) return 1.0;
  const availWidth = sheetScrollContainer.clientWidth - 24;
  const sheetWidth = trackerSheet.offsetWidth || 860;
  return Math.min(availWidth / sheetWidth, 1.4);
}

function triggerFitPage() {
  if (window.innerWidth <= 768) {
    applyZoom(1.0, "normal");
    return;
  }
  const scale = calculateFitPageScale();
  applyZoom(scale, "fit-page");
}

function triggerFitWidth() {
  if (window.innerWidth <= 768) {
    applyZoom(1.0, "normal");
    return;
  }
  const scale = calculateFitWidthScale();
  applyZoom(scale, "fit-width");
}

window.addEventListener("resize", () => {
  if (document.getElementById("sheetTab")?.classList.contains("active")) {
    if (window.innerWidth <= 768) {
      applyZoom(1.0, "normal");
    } else {
      if (currentZoomMode === "fit-page") triggerFitPage();
      else if (currentZoomMode === "fit-width") triggerFitWidth();
    }
  }
});

// =========================================================
// GYM REST TIMER
// =========================================================
const timerDisplay = document.getElementById("timerDisplay");
const startTimerBtn = document.getElementById("startTimerBtn");
const resetTimerBtn = document.getElementById("resetTimerBtn");
const timerPills = document.querySelectorAll(".t-pill");

function formatTimer(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  if (timerDisplay) timerDisplay.textContent = formatTimer(timerSeconds);
}

function startTimer() {
  if (isTimerRunning) {
    clearInterval(timerInterval);
    isTimerRunning = false;
    startTimerBtn.textContent = "Resume";
    return;
  }

  isTimerRunning = true;
  startTimerBtn.textContent = "Pause";

  timerInterval = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimerDisplay();
    } else {
      clearInterval(timerInterval);
      isTimerRunning = false;
      startTimerBtn.textContent = "Start Rest";
      timerSeconds = timerInitial;
      updateTimerDisplay();

      // Rest finished chime!
      playAudioBeep(987, 0.25, "triangle");
      setTimeout(() => playAudioBeep(1318, 0.4, "triangle"), 200);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval);
  isTimerRunning = false;
  timerSeconds = timerInitial;
  startTimerBtn.textContent = "Start Rest";
  updateTimerDisplay();
}

// =========================================================
// EXERCISE SET LOGGER TABLE
// =========================================================
function renderExerciseList() {
  const tbody = document.getElementById("exerciseListBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  trackerData.exercises.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" value="${item.name}" data-idx="${idx}" class="ex-name-input"></td>
      <td><input type="text" value="${item.weight}" data-idx="${idx}" class="ex-weight-input" style="width: 90px;"></td>
      <td><input type="text" value="${item.reps}" data-idx="${idx}" class="ex-reps-input" style="width: 70px;"></td>
      <td><input type="checkbox" ${item.done ? "checked" : ""} data-idx="${idx}" class="ex-check" style="width: 22px; height: 22px; cursor: pointer;"></td>
      <td><button class="btn-sm btn-delete-ex" data-idx="${idx}" title="Delete exercise">✕</button></td>
    `;

    // Listeners
    tr.querySelector(".ex-name-input").addEventListener("change", (e) => {
      trackerData.exercises[idx].name = e.target.value;
      saveData();
    });
    tr.querySelector(".ex-weight-input").addEventListener("change", (e) => {
      trackerData.exercises[idx].weight = e.target.value;
      saveData();
    });
    tr.querySelector(".ex-reps-input").addEventListener("change", (e) => {
      trackerData.exercises[idx].reps = e.target.value;
      saveData();
    });
    tr.querySelector(".ex-check").addEventListener("change", (e) => {
      trackerData.exercises[idx].done = e.target.checked;
      saveData();
      if (e.target.checked) playAudioBeep(780, 0.1, "sine");
    });
    tr.querySelector(".btn-delete-ex").addEventListener("click", () => {
      trackerData.exercises.splice(idx, 1);
      renderExerciseList();
      saveData();
    });

    tbody.appendChild(tr);
  });
}

function addExerciseRow() {
  trackerData.exercises.push({ name: "New Exercise", weight: "20 kg", reps: "10", done: false });
  renderExerciseList();
  saveData();
}

// =========================================================
// =========================================================
// HYDRATION & FUEL (Custom Water Goal Support)
// =========================================================
const waterAmountText = document.getElementById("waterAmountText");
const waterProgressFill = document.getElementById("waterProgressFill");
const waterGoalInput = document.getElementById("waterGoalInput");

function getTargetWaterLiters() {
  const customVal = parseFloat(waterGoalInput?.value || trackerData.waterGoal || 3.0);
  return isNaN(customVal) || customVal <= 0 ? 3.0 : customVal;
}

function updateWaterUI() {
  const targetLiters = getTargetWaterLiters();
  const perGlassLiters = targetLiters / 8;

  const waterCups = document.querySelectorAll(".cup-item");
  waterCups.forEach((cup, idx) => {
    cup.classList.toggle("filled", idx < waterCupsCount);
    const glassAmount = ((idx + 1) * perGlassLiters).toFixed(1);
    cup.title = `Glass ${idx + 1} (${glassAmount} L)`;
  });

  const currentLiters = (waterCupsCount * perGlassLiters).toFixed(2);
  if (waterAmountText) {
    waterAmountText.textContent = `${currentLiters} / ${targetLiters.toFixed(1)} L`;
  }

  const pct = Math.min(100, Math.round((waterCupsCount / 8) * 100));
  if (waterProgressFill) waterProgressFill.style.width = `${pct}%`;

  trackerData.water = waterCupsCount;
  trackerData.waterGoal = targetLiters;
  saveData();
}

function handleWaterClick(cupIdx) {
  waterCupsCount = (waterCupsCount === cupIdx) ? cupIdx - 1 : cupIdx;
  playAudioBeep(440, 0.1, "sine");
  updateWaterUI();
}

// =========================================================
// MOTIVATIONAL QUOTE ENGINE
// =========================================================
function setRandomQuote() {
  const quoteText = document.getElementById("quoteText");
  if (quoteText) {
    const randomIdx = Math.floor(Math.random() * DISCIPLINE_QUOTES.length);
    quoteText.textContent = DISCIPLINE_QUOTES[randomIdx];
  }
}

// =========================================================
// STATS & STREAK ANALYTICS (Custom Sleep Goal Support)
// =========================================================
const sleepGoalInput = document.getElementById("sleepGoalInput");

function getTargetSleepHours() {
  const customVal = parseFloat(sleepGoalInput?.value || trackerData.sleepGoal || 8.0);
  return isNaN(customVal) || customVal <= 0 ? 8.0 : customVal;
}

function updateStats() {
  const today = new Date();
  const currentDayNum = Math.min(Math.max(today.getDate(), 1), 31);
  const totalHabits = trackerData.habits.length || 1;

  // Today's habits
  let todayCount = 0;
  trackerData.habits.forEach((_, idx) => {
    if (trackerData.habitGrid[`${idx}_${currentDayNum}`]) todayCount++;
  });
  const todayPct = Math.round((todayCount / totalHabits) * 100);

  const statTodayBig = document.getElementById("statTodayBig");
  const statTodayPct = document.getElementById("statTodayPct");
  if (statTodayBig) statTodayBig.textContent = `${todayCount} / ${trackerData.habits.length}`;
  if (statTodayPct) statTodayPct.textContent = `${todayPct}% Routine Completed`;

  // Month checks
  const totalChecks = Object.keys(trackerData.habitGrid).length;
  const possibleMonthChecks = totalHabits * 31;
  const monthPct = Math.round((totalChecks / possibleMonthChecks) * 100);

  const statMonthBig = document.getElementById("statMonthBig");
  const statTotalChecks = document.getElementById("statTotalChecks");
  if (statMonthBig) statMonthBig.textContent = `${monthPct}%`;
  if (statTotalChecks) statTotalChecks.textContent = `${totalChecks} Total Checks Logged`;

  // Sleep recovery avg with custom target comparison
  const targetSleep = getTargetSleepHours();
  trackerData.sleepGoal = targetSleep;
  const sleepEntries = Object.values(trackerData.sleepGrid);
  const statSleepBig = document.getElementById("statSleepBig");
  if (sleepEntries.length > 0) {
    const totalHours = sleepEntries.reduce((sum, tierIdx) => sum + SLEEP_TIERS[tierIdx].val, 0);
    const avg = (totalHours / sleepEntries.length).toFixed(1);
    if (statSleepBig) statSleepBig.textContent = `${avg} hrs`;
  } else {
    if (statSleepBig) statSleepBig.textContent = "- hrs";
  }

  // Streak Calculation
  let streak = 0;
  for (let d = currentDayNum; d >= 1; d--) {
    let dayCount = 0;
    trackerData.habits.forEach((_, idx) => {
      if (trackerData.habitGrid[`${idx}_${d}`]) dayCount++;
    });
    if (dayCount > 0) streak++;
    else break;
  }
  const statStreakBig = document.getElementById("statStreakBig");
  if (statStreakBig) statStreakBig.textContent = `${streak} Days 🔥`;

  // Header active streak badge
  const countdownText = document.getElementById("countdownText");
  if (countdownText) {
    countdownText.textContent = `Tracker Active: Day ${currentDayNum} • ${streak} Day Streak`;
  }
}

// =========================================================
// ATHLETE PROFILE & "CLEAR PROFILE" SYSTEM
// =========================================================
const profNameInput = document.getElementById("profNameInput");
const profAgeInput = document.getElementById("profAgeInput");
const profHeightInput = document.getElementById("profHeightInput");
const profStartWeightInput = document.getElementById("profStartWeightInput");
const profGoalWeightInput = document.getElementById("profGoalWeightInput");
const profBodyFatGoalInput = document.getElementById("profBodyFatGoalInput");
const profNonNegotiablesInput = document.getElementById("profNonNegotiablesInput");
const navProfileName = document.getElementById("navProfileName");
const profDisplayTitle = document.getElementById("profDisplayTitle");

function loadProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw) {
    try {
      athleteProfile = JSON.parse(raw);
      applyProfileToUI();
    } catch (e) {}
  }
}

function applyProfileToUI() {
  if (profNameInput) profNameInput.value = athleteProfile.name || "";
  if (profAgeInput) profAgeInput.value = athleteProfile.age || "";
  if (profHeightInput) profHeightInput.value = athleteProfile.height || "";
  if (profStartWeightInput) profStartWeightInput.value = athleteProfile.startWeight || "";
  if (profGoalWeightInput) profGoalWeightInput.value = athleteProfile.goalWeight || "";
  if (profBodyFatGoalInput) profBodyFatGoalInput.value = athleteProfile.goalBodyFat || "";
  if (profNonNegotiablesInput) profNonNegotiablesInput.value = athleteProfile.nonNegotiables || "";

  if (athleteProfile.name) {
    if (navProfileName) navProfileName.textContent = athleteProfile.name.split(" ")[0];
    if (profDisplayTitle) profDisplayTitle.textContent = athleteProfile.name.toUpperCase();
    const userNameInput = document.getElementById("userNameInput");
    if (userNameInput && !userNameInput.value) userNameInput.value = athleteProfile.name;
  }
}

function saveProfile() {
  athleteProfile = {
    name: profNameInput ? profNameInput.value.trim() : "",
    age: profAgeInput ? profAgeInput.value.trim() : "",
    height: profHeightInput ? profHeightInput.value.trim() : "",
    startWeight: profStartWeightInput ? profStartWeightInput.value.trim() : "",
    goalWeight: profGoalWeightInput ? profGoalWeightInput.value.trim() : "",
    goalBodyFat: profBodyFatGoalInput ? profBodyFatGoalInput.value.trim() : "",
    nonNegotiables: profNonNegotiablesInput ? profNonNegotiablesInput.value.trim() : ""
  };

  localStorage.setItem(PROFILE_KEY, JSON.stringify(athleteProfile));

  if (athleteProfile.name) {
    if (navProfileName) navProfileName.textContent = athleteProfile.name.split(" ")[0];
    if (profDisplayTitle) profDisplayTitle.textContent = athleteProfile.name.toUpperCase();
    const userNameInput = document.getElementById("userNameInput");
    if (userNameInput) {
      userNameInput.value = athleteProfile.name;
      trackerData.name = athleteProfile.name;
      saveData();
    }
  }

  scheduleCloudPush();
  playAudioBeep(880, 0.15, "triangle");
  alert("Profile Saved Successfully!");
}

function clearProfile() {
  if (confirm("Are you sure you want to clear your Athlete Profile? This will reset all biometric targets and your profile name.")) {
    localStorage.removeItem(PROFILE_KEY);
    athleteProfile = { name: "", age: "", height: "", startWeight: "", goalWeight: "", goalBodyFat: "", nonNegotiables: "" };

    applyProfileToUI();
    if (navProfileName) navProfileName.textContent = "Profile";
    if (profDisplayTitle) profDisplayTitle.textContent = "ATHLETE PROFILE";
    const userNameInput = document.getElementById("userNameInput");
    if (userNameInput) userNameInput.value = "";
    trackerData.name = "";
    saveData();
    scheduleCloudPush();

    playAudioBeep(330, 0.2, "sawtooth");
  }
}

// =========================================================
// 100% LOCAL & REALTIME CLOUD DATA PERSISTENCE
// =========================================================
function saveData() {
  const userNameInput = document.getElementById("userNameInput");
  const userMonthInput = document.getElementById("userMonthInput");
  const userDayInput = document.getElementById("userDayInput");
  const mainGoalInput = document.getElementById("mainGoalInput");

  if (userNameInput) trackerData.name = userNameInput.value;
  if (userMonthInput) trackerData.month = userMonthInput.value;
  if (userDayInput) trackerData.day = userDayInput.value;
  if (mainGoalInput) trackerData.goal = mainGoalInput.value;

  // PRs
  const prBench = document.getElementById("prBench");
  const prSquat = document.getElementById("prSquat");
  const prDeadlift = document.getElementById("prDeadlift");
  const prOhp = document.getElementById("prOhp");
  const prPullups = document.getElementById("prPullups");
  const prBodyFat = document.getElementById("prBodyFat");

  trackerData.prs = {
    bench: prBench ? prBench.value : "",
    squat: prSquat ? prSquat.value : "",
    deadlift: prDeadlift ? prDeadlift.value : "",
    ohp: prOhp ? prOhp.value : "",
    pullups: prPullups ? prPullups.value : "",
    bodyfat: prBodyFat ? prBodyFat.value : ""
  };

  // Macros
  const macroCalories = document.getElementById("macroCalories");
  const macroProtein = document.getElementById("macroProtein");
  const macroCarbs = document.getElementById("macroCarbs");
  const macroFats = document.getElementById("macroFats");
  const dietNotes = document.getElementById("dietNotes");
  const splitDetailInput = document.getElementById("splitDetailInput");

  trackerData.macros = {
    calories: macroCalories ? macroCalories.value : "",
    protein: macroProtein ? macroProtein.value : "",
    carbs: macroCarbs ? macroCarbs.value : "",
    fats: macroFats ? macroFats.value : "",
    dietNotes: dietNotes ? dietNotes.value : ""
  };
  trackerData.splitNotes = splitDetailInput ? splitDetailInput.value : "";

  // Weekly & Reflection inputs
  document.querySelectorAll(".week-card input").forEach(inp => {
    if (inp.id) trackerData.weekly[inp.id] = inp.value;
  });
  document.querySelectorAll(".reflection-box input").forEach(inp => {
    if (inp.id) trackerData.reflection[inp.id] = inp.value;
  });

  // Save directly to device storage
  localStorage.setItem(getStorageKey(), JSON.stringify(trackerData));

  // Auto-sync to cloud in background
  scheduleCloudPush();
}

function loadData() {
  const raw = localStorage.getItem(getStorageKey());
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      applyDataToState(parsed);
    } catch (e) {}
  } else {
    resetToDefaultState();
  }

  populateUIWithData();
}

function applyDataToState(parsed) {
  trackerData = {
    name: parsed.name || "",
    month: parsed.month || currentMonth,
    year: parsed.year || currentYear,
    day: parsed.day || "",
    goal: parsed.goal || "",
    habits: Array.isArray(parsed.habits) && parsed.habits.length > 0 ? parsed.habits : [...DEFAULT_HABITS],
    habitGrid: parsed.habitGrid || {},
    sleepGrid: parsed.sleepGrid || {},
    weekly: parsed.weekly || {},
    reflection: parsed.reflection || {},
    water: parsed.water || 0,
    waterGoal: parsed.waterGoal || 3.0,
    sleepGoal: parsed.sleepGoal || 8.0,
    split: parsed.split || "Push (Chest, Shoulders, Triceps)",
    splitNotes: parsed.splitNotes || "",
    exercises: Array.isArray(parsed.exercises) ? parsed.exercises : trackerData.exercises,
    prs: parsed.prs || trackerData.prs,
    macros: parsed.macros || trackerData.macros
  };
}

function resetToDefaultState() {
  trackerData = {
    name: "",
    month: currentMonth,
    year: currentYear,
    day: "",
    goal: "",
    habits: [...DEFAULT_HABITS],
    habitGrid: {},
    sleepGrid: {},
    weekly: {},
    reflection: {},
    water: 0,
    waterGoal: 3.0,
    sleepGoal: 8.0,
    split: "Push (Chest, Shoulders, Triceps)",
    splitNotes: "",
    exercises: [
      { name: "Incline DB Bench Press", weight: "32 kg", reps: "10", done: true },
      { name: "Weighted Chest Dips", weight: "+15 kg", reps: "12", done: true },
      { name: "Cable Lateral Raises", weight: "12 kg", reps: "15", done: false },
      { name: "Overhead Tricep Extension", weight: "28 kg", reps: "12", done: false }
    ],
    prs: { bench: "", squat: "", deadlift: "", ohp: "", pullups: "", bodyfat: "" },
    macros: { calories: "", protein: "", carbs: "", fats: "", dietNotes: "" }
  };
}

function populateUIWithData() {
  const userNameInput = document.getElementById("userNameInput");
  const userMonthInput = document.getElementById("userMonthInput");
  const userDayInput = document.getElementById("userDayInput");
  const mainGoalInput = document.getElementById("mainGoalInput");

  if (userNameInput) userNameInput.value = trackerData.name || athleteProfile.name || "";
  if (userMonthInput) userMonthInput.value = trackerData.month;
  if (userDayInput) userDayInput.value = trackerData.day || `Day ${new Date().getDate()}`;
  if (mainGoalInput) mainGoalInput.value = trackerData.goal;

  // PRs
  if (document.getElementById("prBench")) document.getElementById("prBench").value = trackerData.prs.bench || "";
  if (document.getElementById("prSquat")) document.getElementById("prSquat").value = trackerData.prs.squat || "";
  if (document.getElementById("prDeadlift")) document.getElementById("prDeadlift").value = trackerData.prs.deadlift || "";
  if (document.getElementById("prOhp")) document.getElementById("prOhp").value = trackerData.prs.ohp || "";
  if (document.getElementById("prPullups")) document.getElementById("prPullups").value = trackerData.prs.pullups || "";
  if (document.getElementById("prBodyFat")) document.getElementById("prBodyFat").value = trackerData.prs.bodyfat || "";

  // Macros
  if (document.getElementById("macroCalories")) document.getElementById("macroCalories").value = trackerData.macros.calories || "";
  if (document.getElementById("macroProtein")) document.getElementById("macroProtein").value = trackerData.macros.protein || "";
  if (document.getElementById("macroCarbs")) document.getElementById("macroCarbs").value = trackerData.macros.carbs || "";
  if (document.getElementById("macroFats")) document.getElementById("macroFats").value = trackerData.macros.fats || "";
  if (document.getElementById("dietNotes")) document.getElementById("dietNotes").value = trackerData.macros.dietNotes || "";
  if (document.getElementById("splitDetailInput")) document.getElementById("splitDetailInput").value = trackerData.splitNotes || "";

  // Splits
  document.querySelectorAll(".split-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.split === trackerData.split);
  });
  const currentSplitLabel = document.getElementById("currentSplitLabel");
  if (currentSplitLabel) currentSplitLabel.textContent = trackerData.split.split(" ")[0] + " Day";

  // Custom Goals: Water & Sleep
  if (waterGoalInput) waterGoalInput.value = trackerData.waterGoal || 3.0;
  if (sleepGoalInput) sleepGoalInput.value = trackerData.sleepGoal || 8.0;

  // Water
  waterCupsCount = trackerData.water || 0;
  updateWaterUI();

  // Weekly & Reflection
  document.querySelectorAll(".week-card input").forEach(inp => {
    if (inp.id) inp.value = trackerData.weekly[inp.id] || "";
  });
  document.querySelectorAll(".reflection-box input").forEach(inp => {
    if (inp.id) inp.value = trackerData.reflection[inp.id] || "";
  });

  renderHabitsBody();
  renderSleepBody();
  renderMobileChecklist();
  renderExerciseList();
  updateStats();
}

// =========================================================
// REALTIME LIVE SYNC (Phone <-> Laptop Dual-Channel Sync)
// =========================================================
const SYNC_ID_KEY = "tracker_cloud_sync_id";
let currentSyncId = localStorage.getItem(SYNC_ID_KEY) || "";
let lastCloudHash = "";
let cloudPushTimer = null;
let detectedLanUrl = "";
let peer = null;
let activePeerConns = [];

function getCloudBundle() {
  return {
    profile: athleteProfile,
    trackerData: trackerData,
    month: currentMonth,
    year: currentYear,
    updatedAt: Date.now()
  };
}

function applyCloudBundle(bundle) {
  if (!bundle) return;
  if (bundle.profile) {
    athleteProfile = bundle.profile;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(athleteProfile));
    applyProfileToUI();
  }
  if (bundle.trackerData) {
    applyDataToState(bundle.trackerData);
    localStorage.setItem(getStorageKey(), JSON.stringify(trackerData));
    populateUIWithData();
  }
}

async function getBestServerBase() {
  if (window.location.protocol.startsWith("http")) {
    return window.location.origin;
  }
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 600);
    const r = await fetch("http://localhost:3000/api/ip", { signal: ctrl.signal });
    clearTimeout(tid);
    if (r.ok) return "http://localhost:3000";
  } catch (e) {}
  return "http://localhost:3000";
}

async function resolveLanUrl() {
  if (detectedLanUrl) return detectedLanUrl;
  const base = await getBestServerBase();
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 800);
    const res = await fetch(`${base}/api/ip`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (res.ok) {
      const json = await res.json();
      if (json && json.url) {
        detectedLanUrl = json.url;
        return detectedLanUrl;
      }
    }
  } catch (e) {}

  if (window.location.protocol.startsWith("http") && !window.location.hostname.includes("localhost") && window.location.hostname !== "127.0.0.1") {
    detectedLanUrl = `${window.location.protocol}//${window.location.host}`;
    return detectedLanUrl;
  }

  detectedLanUrl = "http://10.100.123.198:3000";
  return detectedLanUrl;
}

async function getSyncShareUrl() {
  const lanBase = await resolveLanUrl();
  return `${lanBase}/#sync=${encodeURIComponent(currentSyncId)}`;
}

async function initCloudSync() {
  // Check if sync ID is in URL hash or query (e.g. from scanning QR code)
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  let paramId = "";
  if (hash.includes("sync=")) {
    paramId = hash.split("sync=")[1].split("&")[0];
  } else if (search.includes("sync=")) {
    paramId = search.split("sync=")[1].split("&")[0];
  }

  if (paramId) {
    paramId = decodeURIComponent(paramId).trim();
    if (paramId) {
      currentSyncId = paramId;
      localStorage.setItem(SYNC_ID_KEY, currentSyncId);
      try {
        history.replaceState(null, null, window.location.pathname);
      } catch (e) {}
    }
  }

  // If no sync ID yet, create a default 4-digit code (e.g. 1234 or random 4-digit)
  if (!currentSyncId) {
    currentSyncId = Math.floor(1000 + Math.random() * 9000).toString();
    localStorage.setItem(SYNC_ID_KEY, currentSyncId);
  }

  fetchFromCloud(true);
  updateCloudSyncUI();
  initPeerSync();
  startCloudSyncPoll();
}

async function fetchFromCloud(force = false) {
  if (!currentSyncId) return;
  const base = await getBestServerBase();
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 800);
    const res = await fetch(`${base}/api/sync?code=${encodeURIComponent(currentSyncId)}`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        const remoteHash = JSON.stringify(json.data);
        const localHash = JSON.stringify(getCloudBundle());
        if (remoteHash !== lastCloudHash && (remoteHash !== localHash || force)) {
          applyCloudBundle(json.data);
          lastCloudHash = remoteHash;
          updateCloudStatusIndicator(true, "Live Synced");
          return;
        }
      }
      updateCloudStatusIndicator(true, "Live Synced");
    }
  } catch (err) {
    if (activePeerConns.length > 0) {
      updateCloudStatusIndicator(true, "P2P Synced");
    } else {
      updateCloudStatusIndicator(false, "Offline / Local");
    }
  }
}

function broadcastPeerBundle(bundle) {
  if (!activePeerConns || activePeerConns.length === 0) return;
  const msg = JSON.stringify({ type: "SYNC_BUNDLE", bundle: bundle, time: Date.now() });
  activePeerConns.forEach(conn => {
    try {
      if (conn && conn.open) conn.send(msg);
    } catch (e) {}
  });
}

function handlePeerData(rawData) {
  try {
    const parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
    if (parsed && parsed.bundle) {
      const remoteHash = JSON.stringify(parsed.bundle);
      const localHash = JSON.stringify(getCloudBundle());
      if (remoteHash !== localHash) {
        applyCloudBundle(parsed.bundle);
        lastCloudHash = remoteHash;
        updateCloudStatusIndicator(true, "Live Synced (P2P)");
      }
    }
  } catch (e) {}
}

function initPeerSync() {
  if (typeof Peer === "undefined" || !currentSyncId) return;
  try {
    if (peer && !peer.destroyed) peer.destroy();
  } catch (e) {}
  activePeerConns = [];

  const cleanCode = currentSyncId.toString().replace(/[^a-zA-Z0-9]/g, "");
  const hostRoomId = `tracker_room_${cleanCode}`;

  try {
    peer = new Peer(hostRoomId, { debug: 0 });
    peer.on("open", () => {
      updateCloudStatusIndicator(true, "Live Sync Ready");
    });
    peer.on("connection", (conn) => {
      activePeerConns.push(conn);
      conn.on("open", () => {
        conn.send(JSON.stringify({ type: "SYNC_BUNDLE", bundle: getCloudBundle() }));
        updateCloudStatusIndicator(true, "Device Connected");
      });
      conn.on("data", handlePeerData);
      conn.on("close", () => {
        activePeerConns = activePeerConns.filter(c => c !== conn);
      });
    });
    peer.on("error", (err) => {
      if (err.type === "unavailable-id") {
        try { peer.destroy(); } catch (e) {}
        const clientPeer = new Peer(undefined, { debug: 0 });
        clientPeer.on("open", () => {
          const conn = clientPeer.connect(hostRoomId, { reliable: true });
          conn.on("open", () => {
            activePeerConns = [conn];
            conn.send(JSON.stringify({ type: "SYNC_BUNDLE", bundle: getCloudBundle() }));
            updateCloudStatusIndicator(true, "Device Connected");
          });
          conn.on("data", handlePeerData);
          conn.on("close", () => {
            activePeerConns = [];
          });
        });
        peer = clientPeer;
      }
    });
  } catch (e) {}
}

function scheduleCloudPush() {
  if (!currentSyncId) return;
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(async () => {
    const bundle = getCloudBundle();
    const currentHash = JSON.stringify(bundle);
    if (currentHash === lastCloudHash) return;

    // Push via PeerJS P2P
    broadcastPeerBundle(bundle);

    // Push to server /api/sync
    const base = await getBestServerBase();
    try {
      const res = await fetch(`${base}/api/sync?code=${encodeURIComponent(currentSyncId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: bundle })
      });
      if (res.ok) {
        lastCloudHash = currentHash;
        updateCloudStatusIndicator(true, "Live Synced");
      }
    } catch (err) {
      if (activePeerConns.length > 0) {
        lastCloudHash = currentHash;
        updateCloudStatusIndicator(true, "P2P Synced");
      } else {
        updateCloudStatusIndicator(false, "Offline / Local");
      }
    }
  }, 1000);
}

function updateCloudStatusIndicator(isOnline, text) {
  const syncLabel = document.getElementById("syncStatusLabel");
  const cloudText = document.getElementById("cloudStatusText");
  if (syncLabel) syncLabel.textContent = isOnline ? "Live Synced" : "Offline";
  if (cloudText) cloudText.textContent = text || (isOnline ? "Live Sync Active" : "Offline / Local");
}

async function updateCloudSyncUI() {
  const syncIdInput = document.getElementById("syncIdInput");
  const syncUrlInput = document.getElementById("syncUrlInput");
  const qrCodeImg = document.getElementById("qrCodeImg");

  if (!currentSyncId) return;
  if (syncIdInput) syncIdInput.value = currentSyncId;

  const shareUrl = await getSyncShareUrl();
  if (syncUrlInput) syncUrlInput.value = shareUrl;

  if (qrCodeImg) {
    qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;
  }
}

function startCloudSyncPoll() {
  // Poll /api/sync every 15 seconds (was 1.5s which caused page freeze on laptops)
  setInterval(() => {
    if (!document.hidden && currentSyncId) {
      const isTyping = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA");
      if (!isTyping) {
        fetchFromCloud();
      }
    }
  }, 15000);

  window.addEventListener("focus", () => {
    if (currentSyncId) fetchFromCloud();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && currentSyncId) fetchFromCloud();
  });
}

function copyDataCode() {
  try {
    const bundle = getCloudBundle();
    const codeStr = btoa(unescape(encodeURIComponent(JSON.stringify(bundle))));
    navigator.clipboard.writeText(codeStr).then(() => {
      alert("✓ Data Code copied! You can paste this on your other device.");
    }).catch(() => {
      prompt("Copy your Data Code below:", codeStr);
    });
  } catch (e) {
    alert("Could not copy data code.");
  }
}

function pasteDataCode() {
  const input = prompt("Paste your Data Code here:");
  if (!input) return;
  try {
    const jsonStr = decodeURIComponent(escape(atob(input.trim())));
    const bundle = JSON.parse(jsonStr);
    applyCloudBundle(bundle);
    saveData();
    scheduleCloudPush();
    alert("✓ Data code applied and synced successfully!");
  } catch (e) {
    alert("Invalid data code! Please check and try again.");
  }
}

// Data Export & Import
function setupBackupHandlers() {
  const exportBtn = document.getElementById("exportDataBtn");
  const importInput = document.getElementById("importFileInput");

  exportBtn?.addEventListener("click", () => {
    const backup = {
      profile: athleteProfile,
      currentMonthData: trackerData,
      exportDate: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `tracker_backup_${currentMonth}_${currentYear}.json`);
    dlAnchor.click();
  });

  importInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.profile) {
          athleteProfile = parsed.profile;
          saveProfile();
        }
        if (parsed.currentMonthData) {
          applyDataToState(parsed.currentMonthData);
          saveData();
          populateUIWithData();
        }
        alert("Backup imported successfully!");
      } catch (err) {
        alert("Invalid backup file!");
      }
    };
    reader.readAsText(file);
  });
}

// =========================================================
// CLOUD SYNC & PAIRING MODAL
// =========================================================
function setupPhoneConnectModal() {
  const phoneBtn = document.getElementById("phoneConnectBtn");
  const modal = document.getElementById("phoneModal");
  const closeBtn = document.getElementById("closePhoneModalBtn");
  const dismissBtn = document.getElementById("dismissModalBtn");
  const copySyncUrlBtn = document.getElementById("copySyncUrlBtn");
  const syncUrlInput = document.getElementById("syncUrlInput");
  const syncIdInput = document.getElementById("syncIdInput");
  const setSyncIdBtn = document.getElementById("setSyncIdBtn");
  const syncNowBtn = document.getElementById("syncNowBtn");

  phoneBtn?.addEventListener("click", () => {
    updateCloudSyncUI();
    modal.style.display = "flex";
  });

  const closeModal = () => { modal.style.display = "none"; };
  closeBtn?.addEventListener("click", closeModal);
  dismissBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  copySyncUrlBtn?.addEventListener("click", () => {
    if (syncUrlInput) {
      syncUrlInput.select();
      navigator.clipboard.writeText(syncUrlInput.value).then(() => {
        copySyncUrlBtn.textContent = "✓ Copied!";
        setTimeout(() => copySyncUrlBtn.textContent = "📋 Copy Link", 2000);
      });
    }
  });

  setSyncIdBtn?.addEventListener("click", async () => {
    const inputVal = syncIdInput?.value.trim();
    if (!inputVal) return;
    currentSyncId = inputVal;
    localStorage.setItem(SYNC_ID_KEY, currentSyncId);
    await updateCloudSyncUI();
    initPeerSync();
    await fetchFromCloud(true);
    await scheduleCloudPush();
    alert(`✓ Connected to pairing code: ${currentSyncId}! Data is synced.`);
  });

  syncNowBtn?.addEventListener("click", async () => {
    syncNowBtn.textContent = "⏳ Syncing...";
    await fetchFromCloud(true);
    await scheduleCloudPush();
    syncNowBtn.textContent = "✓ Synced!";
    setTimeout(() => syncNowBtn.textContent = "🔄 Sync Now", 2000);
  });

  document.getElementById("modalCopyCodeBtn")?.addEventListener("click", copyDataCode);
  document.getElementById("modalPasteCodeBtn")?.addEventListener("click", pasteDataCode);
  document.getElementById("cardCopyCodeBtn")?.addEventListener("click", copyDataCode);
  document.getElementById("cardPasteCodeBtn")?.addEventListener("click", pasteDataCode);
}

// =========================================================
// EVENT LISTENERS & BOOTSTRAP
// =========================================================
function setupEventListeners() {
  setupTabNavigation();
  setupBackupHandlers();
  setupPhoneConnectModal();

  // Add Habit buttons
  document.getElementById("addNewHabitBtn")?.addEventListener("click", () => addHabit());
  document.getElementById("sheetAddHabitBtn")?.addEventListener("click", () => addHabit());
  document.getElementById("mobileAddHabitBtn")?.addEventListener("click", () => addHabit());

  // Setup Mobile Mode Switcher (Today's Checklist vs Full Month Table)
  setupMobileModeSwitcher();

  // Auto-save on inputs
  const autoSaveIds = [
    "userNameInput", "userMonthInput", "userDayInput", "mainGoalInput",
    "splitDetailInput", "prBench", "prSquat", "prDeadlift", "prOhp", "prPullups", "prBodyFat",
    "macroCalories", "macroProtein", "macroCarbs", "macroFats", "dietNotes"
  ];
  autoSaveIds.forEach(id => {
    document.getElementById(id)?.addEventListener("input", debouncedSaveData);
  });

  document.querySelectorAll(".week-card input, .reflection-box input").forEach(inp => {
    inp.addEventListener("input", debouncedSaveData);
  });

  // Month & Year Selector
  const monthSelect = document.getElementById("monthSelect");
  const yearInput = document.getElementById("yearInput");

  monthSelect?.addEventListener("change", (e) => {
    currentMonth = e.target.value;
    const userMonthInput = document.getElementById("userMonthInput");
    if (userMonthInput) userMonthInput.value = currentMonth;
    initializeTables();
    loadData();
  });

  yearInput?.addEventListener("change", (e) => {
    currentYear = parseInt(e.target.value, 10) || 2026;
    initializeTables();
    loadData();
  });

  // Complete Today Button
  document.getElementById("checkTodayBtn")?.addEventListener("click", completeTodayHabits);

  // Zoom Buttons
  document.getElementById("zoomOutBtn")?.addEventListener("click", () => applyZoom(currentZoom - 0.1, "custom"));
  document.getElementById("zoomInBtn")?.addEventListener("click", () => applyZoom(currentZoom + 0.1, "custom"));
  document.getElementById("zoomResetBtn")?.addEventListener("click", () => applyZoom(1.0, "reset"));
  document.getElementById("zoomFitPageBtn")?.addEventListener("click", triggerFitPage);
  document.getElementById("zoomFitWidthBtn")?.addEventListener("click", triggerFitWidth);

  // Blank Sheet Mode
  document.getElementById("blankModeBtn")?.addEventListener("click", () => {
    isBlankMode = !isBlankMode;
    document.body.classList.toggle("blank-mode", isBlankMode);
    document.getElementById("blankModeBtn").textContent = isBlankMode ? "Interactive View" : "📄 Blank Sheet";
  });

  // Print Button
  document.getElementById("printBtn")?.addEventListener("click", () => window.print());

  // Reset Month
  document.getElementById("clearDataBtn")?.addEventListener("click", () => {
    if (confirm(`Reset all tracked data for ${currentMonth} ${currentYear}?`)) {
      localStorage.removeItem(getStorageKey());
      loadData();
    }
  });

  // Theme Cycling
  document.getElementById("toggleThemeBtn")?.addEventListener("click", () => {
    document.body.classList.remove(...THEMES);
    currentThemeIdx = (currentThemeIdx + 1) % THEMES.length;
    document.body.classList.add(THEMES[currentThemeIdx]);
  });

  // Timer Controls
  startTimerBtn?.addEventListener("click", startTimer);
  resetTimerBtn?.addEventListener("click", resetTimer);

  timerPills.forEach(pill => {
    pill.addEventListener("click", () => {
      timerPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const seconds = parseInt(pill.dataset.time, 10);
      timerInitial = seconds;
      timerSeconds = seconds;
      resetTimer();
    });
  });

  // Split Selector
  document.querySelectorAll(".split-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".split-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      trackerData.split = btn.dataset.split;
      const currentSplitLabel = document.getElementById("currentSplitLabel");
      if (currentSplitLabel) currentSplitLabel.textContent = btn.dataset.split.split(" ")[0] + " Day";
      saveData();
    });
  });

  // Exercise table add row
  document.getElementById("addExerciseRowBtn")?.addEventListener("click", addExerciseRow);

  // Water buttons & Custom Water Goal
  const waterCups = document.querySelectorAll(".cup-item");
  waterCups.forEach(cup => {
    cup.addEventListener("click", () => {
      const cupIdx = parseInt(cup.dataset.cup, 10);
      handleWaterClick(cupIdx);
    });
  });

  waterGoalInput?.addEventListener("change", () => {
    updateWaterUI();
  });
  waterGoalInput?.addEventListener("input", debounce(() => {
    updateWaterUI();
  }, 300));

  // Custom Sleep Goal & Graph View Toggles
  sleepGoalInput?.addEventListener("change", () => {
    updateStats();
    renderSleepGraph();
    saveData();
  });
  sleepGoalInput?.addEventListener("input", debounce(() => {
    updateStats();
    renderSleepGraph();
    saveData();
  }, 300));

  const sleepGraphBtn = document.getElementById("sleepViewGraphBtn");
  const sleepGridBtn = document.getElementById("sleepViewGridBtn");
  const sleepGraphWrap = document.getElementById("sleepGraphContainer");
  const sleepTableWrap = document.getElementById("sleepTableWrap");

  sleepGraphBtn?.addEventListener("click", () => {
    sleepGraphBtn.classList.add("active");
    sleepGridBtn?.classList.remove("active");
    if (sleepGraphWrap) sleepGraphWrap.style.display = "flex";
    if (sleepTableWrap) sleepTableWrap.style.display = "none";
    renderSleepGraph();
  });

  sleepGridBtn?.addEventListener("click", () => {
    sleepGridBtn.classList.add("active");
    sleepGraphBtn?.classList.remove("active");
    if (sleepGraphWrap) sleepGraphWrap.style.display = "none";
    if (sleepTableWrap) sleepTableWrap.style.display = "block";
    renderSleepMatrixTable();
  });

  // Quote Refresh
  document.getElementById("refreshQuoteBtn")?.addEventListener("click", setRandomQuote);

  // Athlete Profile Buttons
  document.getElementById("saveProfileBtn")?.addEventListener("click", saveProfile);
  document.getElementById("clearProfileBtn")?.addEventListener("click", clearProfile);
}

// =========================================================
// VIEW MODE SWITCHER (Daily Habits vs Monthly)
// =========================================================
function setupMobileModeSwitcher() {
  const modeTodayBtn = document.getElementById("modeTodayBtn");
  const modeSheetBtn = document.getElementById("modeSheetBtn");
  const todayCard = document.getElementById("mobileTodayCard");
  const sheetContainer = document.getElementById("sheetScrollContainer");

  function setMode(mode) {
    if (mode === "today") {
      modeTodayBtn?.classList.add("active");
      modeSheetBtn?.classList.remove("active");
      if (todayCard) todayCard.style.display = "block";
      if (sheetContainer) sheetContainer.style.display = "none";
    } else {
      modeSheetBtn?.classList.add("active");
      modeTodayBtn?.classList.remove("active");
      if (todayCard) todayCard.style.display = "none";
      if (sheetContainer) {
        sheetContainer.style.display = "block";
        if (window.innerWidth <= 768) {
          applyZoom(1.0, "normal");
        } else {
          triggerFitPage();
        }
      }
    }
  }

  modeTodayBtn?.addEventListener("click", () => setMode("today"));
  modeSheetBtn?.addEventListener("click", () => setMode("sheet"));
  document.getElementById("mobileCheckAllBtn")?.addEventListener("click", completeTodayHabits);

  // Default view is 'today' (Daily Habits) across all devices (laptop & mobile)
  setMode("today");
}

// =========================================================
// CINEMATIC BALANCED 1.1S SOUND SYNTHESIZER (120HZ COMPATIBLE)
// =========================================================
function playCinematicVideoSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // 1. Sub-bass cinematic riser sweep (75Hz -> 280Hz over 1.1s)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(75, now);
    subOsc.frequency.exponentialRampToValueAtTime(300, now + 0.95);
    subGain.gain.setValueAtTime(0.01, now);
    subGain.gain.linearRampToValueAtTime(0.25, now + 0.65);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 1.1);

    // 2. Harmonic crystalline energy shimmer
    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmerOsc.type = "triangle";
    shimmerOsc.frequency.setValueAtTime(440, now);
    shimmerOsc.frequency.exponentialRampToValueAtTime(900, now + 0.9);
    shimmerGain.gain.setValueAtTime(0.01, now);
    shimmerGain.gain.linearRampToValueAtTime(0.12, now + 0.7);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmerOsc.start(now);
    shimmerOsc.stop(now + 1.1);

    // 3. Crisp resolution impact chime at 0.95s
    setTimeout(() => {
      try {
        const impactCtx = new AudioCtx();
        const t = impactCtx.currentTime;
        const impactOsc = impactCtx.createOscillator();
        const impactGain = impactCtx.createGain();
        impactOsc.type = "sine";
        impactOsc.frequency.setValueAtTime(1046.5, t); // C6 crystal chime
        impactGain.gain.setValueAtTime(0.18, t);
        impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        impactOsc.connect(impactGain);
        impactGain.connect(impactCtx.destination);
        impactOsc.start(t);
        impactOsc.stop(t + 0.35);
      } catch (err) {}
    }, 950);
  } catch (e) {}
}

// =========================================================
// CINEMATIC VIDEO INTRO GATEWAY (Phone & Laptop Ready, 120Hz Fast)
// =========================================================
function setupIntroGateway() {
  const gateway = document.getElementById("introGateway");
  const imageTarget = document.getElementById("introImageTarget");
  const heroImg = document.getElementById("introHeroImg");
  const timelineFill = document.getElementById("introTimelineFill");
  const cinemaFlash = document.getElementById("introCinemaFlash");
  const skipBtn = document.getElementById("skipIntroBtn");
  const brandBadgeBtn = document.getElementById("brandBadgeBtn");
  const wallpaperBg = document.getElementById("wallpaperBg");

  if (!gateway || !imageTarget) return;

  let isLaunching = false;
  // Always clear skip intro so intro page always appears on refresh
  localStorage.removeItem("tracker_skip_intro");

  function updateGatewayData() {
    const greeting = document.getElementById("introGreeting");
    const dateVal = document.getElementById("introDateVal");
    const streakVal = document.getElementById("introStreakVal");
    const quoteText = document.getElementById("introQuoteText");

    const todayDate = new Date();
    const todayNum = todayDate.getDate();

    if (greeting) {
      if (athleteProfile && athleteProfile.name) {
        greeting.textContent = `⚡ WELCOME, ${athleteProfile.name.split(" ")[0].toUpperCase()}`;
      } else {
        greeting.textContent = "⚡ DAILY DISCIPLINE OS";
      }
    }

    if (dateVal) {
      dateVal.textContent = `Day ${todayNum} • ${MONTH_NAMES[todayDate.getMonth()].slice(0, 3)}`;
    }

    // Calculate streak
    let streak = 0;
    for (let d = todayNum; d >= 1; d--) {
      let dayCount = 0;
      trackerData.habits.forEach((_, idx) => {
        if (trackerData.habitGrid[`${idx}_${d}`]) dayCount++;
      });
      if (dayCount > 0) streak++;
      else break;
    }
    if (streakVal) {
      streakVal.textContent = streak > 0 ? `${streak} Days 🔥` : "Day 1 🚀";
    }

    // Random quote
    if (quoteText) {
      const q = DISCIPLINE_QUOTES[Math.floor(Math.random() * DISCIPLINE_QUOTES.length)];
      quoteText.textContent = q.replace(/^"|"$/g, "");
    }
  }

  function resetGatewayAnimation() {
    isLaunching = false;
    imageTarget.classList.remove("is-zooming-big");
    gateway.classList.remove("is-playing-video", "dismissed");
    if (cinemaFlash) cinemaFlash.classList.remove("active");
    if (timelineFill) {
      timelineFill.style.transition = "none";
      timelineFill.style.width = "0%";
      void timelineFill.offsetWidth; // force reflow
      timelineFill.style.transition = "";
    }
  }

  // Balanced 1.1-Second Cinematic Launch sequence (smooth natural pace)
  function launchCinematicVideo() {
    if (isLaunching) return;
    isLaunching = true;

    // Start sound effect
    playCinematicVideoSound();

    // 1. Image pushes forward smoothly into viewport
    gateway.classList.add("is-playing-video");
    imageTarget.classList.add("is-zooming-big");

    // 2. Timeline scrubber fills smoothly over 1.1s (if present)
    if (timelineFill) {
      timelineFill.style.transition = "width 1.1s cubic-bezier(0.18, 0.88, 0.25, 1)";
      timelineFill.style.width = "100%";
    }

    // 3. Cinematic white shutter flash at 0.95s
    setTimeout(() => {
      if (cinemaFlash) cinemaFlash.classList.add("active");
    }, 950);

    // 4. Open Main Page smoothly at 1.1s
    setTimeout(() => {
      gateway.classList.add("dismissed");
      if (cinemaFlash) cinemaFlash.classList.remove("active");

      setTimeout(() => {
        gateway.style.display = "none";
        resetGatewayAnimation();

        // Responsive fit check for desktop / mobile
        if (window.innerWidth > 768) {
          triggerFitPage();
        }
      }, 300);
    }, 1100);
  }

  function dismissImmediately() {
    isLaunching = false;
    gateway.style.display = "none";
    gateway.classList.add("dismissed");
    resetGatewayAnimation();
    if (window.innerWidth > 768) {
      triggerFitPage();
    }
  }

  function openGateway() {
    resetGatewayAnimation();
    updateGatewayData();
    gateway.style.display = "flex";
    gateway.classList.remove("dismissed");
  }

  // Action: Clicking the Image expands it big and launches the 2s video animation!
  imageTarget.addEventListener("click", launchCinematicVideo);

  // Keyboard support: Pressing Enter or Space clicks image and launches
  window.addEventListener("keydown", (e) => {
    if (gateway.style.display !== "none" && !gateway.classList.contains("dismissed")) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        launchCinematicVideo();
      }
    }
  });

  // Skip link directly opens main page
  skipBtn?.addEventListener("click", dismissImmediately);

  // Clicking brand badge in header re-opens the gateway
  brandBadgeBtn?.addEventListener("click", openGateway);

  // Initial populate
  updateGatewayData();

  // Always show intro gateway on launch and page refresh
  openGateway();
}

// Initial Boot
document.addEventListener("DOMContentLoaded", () => {
  // Register Service Worker for offline PWA on iPhone & PC
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.protocol === 'http:')) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  initializeTables();
  setupEventListeners();
  loadProfile();
  loadData();
  setRandomQuote();
  updateTimerDisplay();
  setupIntroGateway();

  // Run cloud sync asynchronously in background without delaying screen opening
  setTimeout(() => {
    initCloudSync();
  }, 50);

  if (window.innerWidth > 768) {
    setTimeout(triggerFitPage, 100);
  } else {
    applyZoom(1.0, "normal");
  }
});
