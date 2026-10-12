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
// HYDRATION (3L) & FUEL
// =========================================================
const waterCups = document.querySelectorAll(".cup-item");
const waterAmountText = document.getElementById("waterAmountText");
const waterProgressFill = document.getElementById("waterProgressFill");

function updateWaterUI() {
  waterCups.forEach((cup, idx) => {
    cup.classList.toggle("filled", idx < waterCupsCount);
  });
  const liters = (waterCupsCount * 0.375).toFixed(2);
  if (waterAmountText) waterAmountText.textContent = `${liters} / 3.0 L`;
  const pct = Math.min(100, Math.round((waterCupsCount / 8) * 100));
  if (waterProgressFill) waterProgressFill.style.width = `${pct}%`;

  trackerData.water = waterCupsCount;
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
// STATS & STREAK ANALYTICS
// =========================================================
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

  // Sleep recovery avg
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
// REALTIME 24/7 CLOUD SYNC (Phone <-> Laptop with ZERO Server)
// =========================================================
const SYNC_ID_KEY = "tracker_cloud_sync_id";
let currentSyncId = localStorage.getItem(SYNC_ID_KEY) || "";
let lastCloudHash = "";
let cloudPushTimer = null;

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

  if (currentSyncId) {
    await fetchFromCloud(true);
  } else {
    await createCloudObject();
  }

  updateCloudSyncUI();
  startCloudSyncPoll();
}

async function createCloudObject() {
  try {
    const res = await fetch("https://api.restful-api.dev/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "tracker_sync", data: getCloudBundle() })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.id) {
        currentSyncId = json.id;
        localStorage.setItem(SYNC_ID_KEY, currentSyncId);
        lastCloudHash = JSON.stringify(getCloudBundle());
        updateCloudSyncUI();
      }
    }
  } catch (err) {}
}

async function fetchFromCloud(force = false) {
  if (!currentSyncId) return;
  try {
    const res = await fetch(`https://api.restful-api.dev/objects/${currentSyncId}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        const remoteHash = JSON.stringify(json.data);
        const localHash = JSON.stringify(getCloudBundle());
        if (remoteHash !== lastCloudHash && (remoteHash !== localHash || force)) {
          applyCloudBundle(json.data);
          lastCloudHash = remoteHash;
          updateCloudStatusIndicator(true, "Synced with Cloud");
        }
      }
    }
  } catch (err) {
    updateCloudStatusIndicator(false, "Local Mode (Offline)");
  }
}

function scheduleCloudPush() {
  if (!currentSyncId) {
    createCloudObject();
    return;
  }
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(async () => {
    const bundle = getCloudBundle();
    const currentHash = JSON.stringify(bundle);
    if (currentHash === lastCloudHash) return;

    try {
      const res = await fetch(`https://api.restful-api.dev/objects/${currentSyncId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "tracker_sync", data: bundle })
      });
      if (res.ok) {
        lastCloudHash = currentHash;
        updateCloudStatusIndicator(true, "Saved to Cloud");
      }
    } catch (err) {
      updateCloudStatusIndicator(false, "Local Mode (Offline)");
    }
  }, 300);
}

function updateCloudStatusIndicator(isOnline, text) {
  const syncLabel = document.getElementById("syncStatusLabel");
  const cloudText = document.getElementById("cloudStatusText");
  if (syncLabel) syncLabel.textContent = isOnline ? "Cloud Synced" : "Offline";
  if (cloudText) cloudText.textContent = text;
}

function updateCloudSyncUI() {
  const syncIdInput = document.getElementById("syncIdInput");
  const syncUrlInput = document.getElementById("syncUrlInput");
  const qrCodeImg = document.getElementById("qrCodeImg");

  if (!currentSyncId) return;

  if (syncIdInput) syncIdInput.value = currentSyncId;

  // Build clean link with #sync=ID
  const baseUrl = window.location.origin + window.location.pathname;
  const syncUrl = `${baseUrl}#sync=${currentSyncId}`;
  if (syncUrlInput) syncUrlInput.value = syncUrl;

  if (qrCodeImg) {
    qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(syncUrl)}`;
  }
}

function startCloudSyncPoll() {
  // Poll cloud quietly every 5 seconds so laptop and phone stay in sync
  setInterval(() => {
    if (!document.hidden && currentSyncId) {
      const isTyping = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA");
      if (!isTyping) {
        fetchFromCloud();
      }
    }
  }, 5000);

  // Instant refresh when user switches tab or unlocks phone
  window.addEventListener("focus", () => {
    if (currentSyncId) fetchFromCloud();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && currentSyncId) fetchFromCloud();
  });
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
    await fetchFromCloud(true);
    updateCloudSyncUI();
    alert("✓ Connected to Sync ID! Data has been synced.");
  });

  syncNowBtn?.addEventListener("click", async () => {
    syncNowBtn.textContent = "⏳ Syncing...";
    await fetchFromCloud(true);
    await scheduleCloudPush();
    syncNowBtn.textContent = "✓ Synced!";
    setTimeout(() => syncNowBtn.textContent = "🔄 Sync Now", 2000);
  });
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
    document.getElementById(id)?.addEventListener("input", saveData);
  });

  document.querySelectorAll(".week-card input, .reflection-box input").forEach(inp => {
    inp.addEventListener("input", saveData);
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

  // Water buttons
  waterCups.forEach(cup => {
    cup.addEventListener("click", () => {
      const cupIdx = parseInt(cup.dataset.cup, 10);
      handleWaterClick(cupIdx);
    });
  });

  // Quote Refresh
  document.getElementById("refreshQuoteBtn")?.addEventListener("click", setRandomQuote);

  // Athlete Profile Buttons
  document.getElementById("saveProfileBtn")?.addEventListener("click", saveProfile);
  document.getElementById("clearProfileBtn")?.addEventListener("click", clearProfile);
}

// =========================================================
// MOBILE MODE SWITCHER (Today's Checklist vs Full Month Table)
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

  // Set default view: mobile starts in 'today' mode; desktop starts in 'sheet' mode
  if (window.innerWidth <= 768) {
    setMode("today");
  } else {
    setMode("sheet");
  }
}

// =========================================================
// INTRO ANIMATION GATEWAY (Suitable for Phone & Laptop)
// =========================================================
let introAutoTimer = null;
let introElapsed = 0;
const INTRO_DURATION_MS = 4000;

function setupIntroGateway() {
  const gateway = document.getElementById("introGateway");
  const enterBtn = document.getElementById("enterTrackerBtn");
  const timerFill = document.getElementById("introTimerFill");
  const timerText = document.getElementById("introTimerText");
  const showIntroCheck = document.getElementById("showIntroEveryTimeCheck");
  const brandBadgeBtn = document.getElementById("brandBadgeBtn");

  if (!gateway) return;

  const isSkipIntro = localStorage.getItem("tracker_skip_intro") === "true";
  if (showIntroCheck) {
    showIntroCheck.checked = !isSkipIntro;
    showIntroCheck.addEventListener("change", (e) => {
      localStorage.setItem("tracker_skip_intro", e.target.checked ? "false" : "true");
    });
  }

  function updateGatewayData() {
    const greeting = document.getElementById("introGreeting");
    const dateVal = document.getElementById("introDateVal");
    const streakVal = document.getElementById("introStreakVal");
    const habitsCount = document.getElementById("introHabitsCount");
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

    // Completed today
    let doneToday = 0;
    trackerData.habits.forEach((_, idx) => {
      if (trackerData.habitGrid[`${idx}_${todayNum}`]) doneToday++;
    });
    if (habitsCount) {
      habitsCount.textContent = `${doneToday}/${trackerData.habits.length} Done`;
    }

    // Random quote
    if (quoteText) {
      const q = DISCIPLINE_QUOTES[Math.floor(Math.random() * DISCIPLINE_QUOTES.length)];
      quoteText.textContent = q.replace(/^"|"$/g, "");
    }
  }

  function dismissGateway(immediate = false) {
    if (introAutoTimer) {
      clearInterval(introAutoTimer);
      introAutoTimer = null;
    }

    if (immediate) {
      gateway.style.display = "none";
      gateway.classList.add("dismissed");
      return;
    }

    // Tactile launch sound chime
    playAudioBeep(587, 0.1, "triangle");
    setTimeout(() => playAudioBeep(880, 0.2, "triangle"), 90);

    gateway.classList.add("dismissed");
    setTimeout(() => {
      gateway.style.display = "none";
      if (window.innerWidth > 768) {
        triggerFitPage();
      }
    }, 450);
  }

  function openGateway() {
    if (introAutoTimer) clearInterval(introAutoTimer);
    updateGatewayData();
    gateway.classList.remove("dismissed");
    gateway.style.display = "flex";
    startCountdown();
  }

  function startCountdown() {
    introElapsed = 0;
    if (timerFill) timerFill.style.width = "0%";
    const intervalMs = 50;

    introAutoTimer = setInterval(() => {
      introElapsed += intervalMs;
      const pct = Math.min(100, (introElapsed / INTRO_DURATION_MS) * 100);
      if (timerFill) timerFill.style.width = `${pct}%`;

      const remainingSec = Math.max(1, Math.ceil((INTRO_DURATION_MS - introElapsed) / 1000));
      if (timerText) timerText.textContent = `Launching in ${remainingSec}s...`;

      if (introElapsed >= INTRO_DURATION_MS) {
        dismissGateway(false);
      }
    }, intervalMs);
  }

  // Event Listeners
  enterBtn?.addEventListener("click", () => dismissGateway(false));

  // Pressing Enter or Space to launch when gateway is visible
  window.addEventListener("keydown", (e) => {
    if (gateway.style.display !== "none" && !gateway.classList.contains("dismissed")) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        dismissGateway(false);
      }
    }
  });

  // Clicking brand badge in header re-opens the gateway
  brandBadgeBtn?.addEventListener("click", openGateway);

  // Initial populate and trigger
  updateGatewayData();

  if (isSkipIntro) {
    dismissGateway(true);
  } else {
    startCountdown();
  }
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
  initCloudSync();
  setupIntroGateway();

  if (window.innerWidth > 768) {
    setTimeout(triggerFitPage, 150);
  } else {
    applyZoom(1.0, "normal");
  }
});
