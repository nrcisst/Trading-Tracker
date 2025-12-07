// ---- Auth Management ----

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function clearToken() {
  localStorage.removeItem('token');
}

async function authedFetch(url, options = {}) {
  const token = getToken();
  if (!token) {
    showAuth();
    throw new Error('No token');
  }

  const isFormData = options.body instanceof FormData;
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    showAuth();
    showError('Session expired. Please log in again.');
    throw new Error('Unauthorized');
  }

  return response;
}

window.handleLogin = async function () {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const loginBtn = document.querySelector('#loginForm button');

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  if (!email.includes('@')) {
    showError('Enter a valid email');
    return;
  }

  try {
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = 'Logging in...';
    }

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      setToken(data.token);
      showSuccess('Logged in');
      showApp();
      init();
    } else {
      showError(data.error || 'Login failed');
    }
  } catch (err) {
    showError('Login error: ' + err.message);
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  }
}

window.handleRegister = async function () {
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value.trim();

  const registerBtn = document.querySelector('#registerForm button');

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  if (!email.includes('@')) {
    showError('Enter a valid email');
    return;
  }

  if (password.length < 8) {
    showError('Password must be at least 8 characters');
    return;
  }

  try {
    if (registerBtn) {
      registerBtn.disabled = true;
      registerBtn.textContent = 'Creating account...';
    }

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      setToken(data.token);
      showSuccess('Account created');
      showApp();
      init();
    } else {
      showError(data.error || 'Registration failed');
    }
  } catch (err) {
    showError('Registration error: ' + err.message);
  } finally {
    if (registerBtn) {
      registerBtn.disabled = false;
      registerBtn.textContent = 'Register';
    }
  }
}

window.handleLogout = function () {


  clearToken();
  showAuth();
  // Reset state
  tradesByDate = {};
  currentView = 'calendar';
}

function showAuth() {
  document.getElementById('authContainer').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'none';
}

function showApp() {
  document.getElementById('authContainer').style.display = 'none';
  document.getElementById('appContainer').style.display = 'block';
}

window.showLogin = function () {


  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
}

window.showRegister = function () {


  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
}

// ---- User Profile Functions ----

async function loadUserInfo() {
  try {
    const res = await authedFetch(`${apiBase}/user/me`);
    if (!res.ok) throw new Error('Failed to load user');

    currentUser = await res.json();
    renderUserHeader();
  } catch (err) {
    console.error('Error loading user:', err);
  }
}

function renderUserHeader() {
  if (!currentUser) return;

  const displayName = currentUser.username || currentUser.email;
  const email = currentUser.email;
  const initials = getInitials(displayName);
  const profileImage = currentUser.profileImage;

  // Header avatar
  document.getElementById('headerEmail').textContent = displayName;
  if (profileImage) {
    document.getElementById('headerAvatarImg').src = profileImage;
    document.getElementById('headerAvatarImg').style.display = 'block';
    document.getElementById('headerAvatarInitials').style.display = 'none';
  } else {
    document.getElementById('headerAvatarInitials').textContent = initials;
    document.getElementById('headerAvatarInitials').style.display = 'block';
    document.getElementById('headerAvatarImg').style.display = 'none';
  }

  // Dropdown
  document.getElementById('dropdownUsername').textContent = currentUser.username || 'Set username';
  document.getElementById('dropdownEmail').textContent = email;
  document.getElementById('dropdownMemberSince').textContent =
    `Member since ${formatDate(currentUser.memberSince)}`;

  if (profileImage) {
    document.getElementById('dropdownAvatarImg').src = profileImage;
    document.getElementById('dropdownAvatarImg').style.display = 'block';
    document.getElementById('dropdownAvatarInitials').style.display = 'none';
  } else {
    document.getElementById('dropdownAvatarInitials').textContent = initials;
    document.getElementById('dropdownAvatarInitials').style.display = 'block';
    document.getElementById('dropdownAvatarImg').style.display = 'none';
  }

  document.getElementById('userHeader').style.display = 'flex';
}

function getInitials(email) {
  if (!email) return '?';
  const parts = email.split('@')[0].split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

window.toggleProfileDropdown = function () {


  const dropdown = document.getElementById('profileDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

window.handleProfileImageUpload = async function (event) {


  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showError('File too large. Maximum size is 5MB.');
    return;
  }

  if (!file.type.startsWith('image/')) {
    showError('Please select an image file.');
    return;
  }

  const formData = new FormData();
  formData.append('profileImage', file);

  try {
    const token = getToken();
    const res = await fetch(`${apiBase}/user/profile-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Upload failed');
    }

    const data = await res.json();
    currentUser.profileImage = data.profileImage;
    renderUserHeader();

    showSuccess('Profile picture updated!');
  } catch (err) {
    showError(err.message);
  }

  event.target.value = '';
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('profileDropdown');
  const userInfo = document.querySelector('.user-info');
  if (dropdown && userInfo && !dropdown.contains(e.target) && !userInfo.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

// Remove tooltips on scroll
window.addEventListener('scroll', removeAllTooltips, true);

// ---- App Code ----

const apiBase = "/api";

let currentUser = null;
let currentYear;
let currentMonth;

let tradesByDate = {};
let currentView = 'calendar'; // 'calendar' or 'journal'
let calendarMode = 'month'; // 'month' or 'year'
let filterDayType = 'all'; // 'all', 'green', 'red'
let sortBy = 'date'; // 'date', 'pl-high', 'pl-low', 'trades'
let filterTicker = ''; // ticker filter
let reviewMode = false;
let reviewDays = []; // filtered days for review
let currentReviewIndex = 0;
let yearMonthPl = {}; // month -> pl for current year
let ytdPl = 0;
let mtdPl = 0;

// ---- Toast Notifications ----

function showSuccess(message) {
  showToast(message, 'success');
}

function showError(message) {
  showToast(message, 'error');
}

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    });
  }, 3000);
}

// ---- Confirmation Modal ----

function confirm(message, title = 'Confirm Action') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('confirm-cancel');
    const okBtn = document.getElementById('confirm-ok');

    titleEl.textContent = title;
    messageEl.textContent = message;

    modal.classList.remove('hidden');

    const cleanup = () => {
      modal.classList.add('hidden');
      cancelBtn.removeEventListener('click', handleCancel);
      okBtn.removeEventListener('click', handleOk);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleOk = () => {
      cleanup();
      resolve(true);
    };

    cancelBtn.addEventListener('click', handleCancel);
    okBtn.addEventListener('click', handleOk);
  });
}

// ---- Helpers -------------------

function removeAllTooltips() {
  document.querySelectorAll('.calendar-tooltip').forEach(t => t.remove());
}

function formatPL(value) {
  if (typeof value !== 'number' || isNaN(value)) return '$0.00';

  const absValue = Math.abs(value).toFixed(2);
  const formatted = Number(absValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (value === 0) return '$0.00';
  if (value > 0) return `+$${formatted}`;
  return `-$${formatted}`;
}

function formatDateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

async function fetchDay(dateKey) {
  try {
    const res = await authedFetch(`${apiBase}/trades/${dateKey}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch day");
    }
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.error("fetchDay error:", err);
    showError(err.message || "Failed to load day data");
    return null;
  }
}

async function saveDay(dateKey, payload) {
  try {
    const res = await authedFetch(`${apiBase}/trades/${dateKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to save day");
    }
  } catch (err) {
    console.error("saveDay error:", err);
    throw err;
  }
}

async function fetchMonthData(year, month) {
  const m = month + 1;
  try {
    // Fetch trades
    const tradesRes = await authedFetch(`${apiBase}/trades?year=${year}&month=${m}`);
    if (!tradesRes.ok) {
      const errorData = await tradesRes.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch month data");
    }
    const tradesJson = await tradesRes.json();

    // Fetch all entries for the month in one call
    const entriesRes = await authedFetch(`${apiBase}/entries/month?year=${year}&month=${m}`);
    if (!entriesRes.ok) {
      const errorData = await entriesRes.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch entries");
    }
    const entriesJson = await entriesRes.json();

    // Store entries grouped by date
    window.entriesByDate = entriesJson.data || {};

    // Clear current trades and repopulate
    tradesByDate = {};
    tradesJson.data.forEach(trade => {
      tradesByDate[trade.trade_date] = trade;
    });

    tradesJson.data.forEach(trade => {
      tradesByDate[trade.trade_date] = trade;
    });

    calculateAndRenderMonthlyStats();

  } catch (err) {
    console.error("fetchMonthData error:", err);
    showError(err.message || "Failed to load month data");
  }
}

async function fetchYearData(year) {
  try {
    const res = await authedFetch(`${apiBase}/trades/year?year=${year}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch year data");
    }
    const json = await res.json();

    // Initialize all months to 0
    const months = {};
    for (let i = 1; i <= 12; i++) {
      months[i] = 0;
    }

    (json.data || []).forEach(row => {
      if (row.month) {
        const parts = row.month.split('-');
        const monthNum = parseInt(parts[1], 10);
        months[monthNum] = row.pl || 0;
      }
    });

    yearMonthPl = months;
    updateYearStats();
    renderYearGrid();
    if (calendarMode === 'year') {
      renderEquityCurve();
    }
  } catch (err) {
    console.error("fetchYearData error:", err);
    showError(err.message || "Failed to load year data");
  }
}


function calculateAndRenderMonthlyStats() {
  const trades = Object.values(tradesByDate);
  let netPl = 0;
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let maxWin = 0;
  let maxLoss = 0;

  trades.forEach(t => {
    if (typeof t.pl === 'number') {
      netPl += t.pl;
      if (t.pl > 0) {
        wins++;
        grossProfit += t.pl;
        if (t.pl > maxWin) maxWin = t.pl;
      } else if (t.pl < 0) {
        losses++;
        grossLoss += Math.abs(t.pl);
        if (t.pl < maxLoss) maxLoss = t.pl;
      }
    }
  });

  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";

  renderStatsUI({
    netPl,
    winRate,
    profitFactor,
    maxWin,
    maxLoss
  });

  // Also update header MTD
  mtdPl = monthlyPlForHeader(tradesByDate);
  renderHeaderStatus();
  updateMonthlyStats();
  renderEquityCurve();
}

async function fetchAndRenderYearStats(year) {
  try {
    const res = await authedFetch(`${apiBase}/trades/year/stats?year=${year}`);
    if (!res.ok) throw new Error("Failed to fetch year stats");
    const json = await res.json();
    const stats = json.data;

    const winRate = stats.total_trades > 0 ? Math.round((stats.wins / stats.total_trades) * 100) : 0;
    const profitFactor = stats.gross_loss > 0
      ? (stats.gross_profit / stats.gross_loss).toFixed(2)
      : stats.gross_profit > 0 ? "∞" : "0.00";

    renderStatsUI({
      netPl: stats.net_pl,
      winRate: winRate,
      profitFactor: profitFactor,
      maxWin: stats.max_win,
      maxLoss: stats.max_loss
    });

  } catch (err) {
    console.error("fetchAndRenderYearStats error:", err);
    // Fallback to zero
    renderStatsUI({
      netPl: 0,
      winRate: 0,
      profitFactor: "0.00",
      maxWin: 0,
      maxLoss: 0
    });
  }
}

function renderStatsUI({ netPl, winRate, profitFactor, maxWin, maxLoss }) {
  const netPlEl = document.getElementById("stat-net-pl");
  netPlEl.textContent = formatPL(netPl);
  netPlEl.className = `stat-value ${netPl > 0 ? 'positive' : netPl < 0 ? 'negative' : ''}`;

  document.getElementById("stat-win-rate").textContent = `${winRate}%`;
  document.getElementById("stat-profit-factor").textContent = profitFactor;

  document.getElementById("stat-max-win").textContent = formatPL(maxWin);
  document.getElementById("stat-max-loss").textContent = formatPL(maxLoss);
}


function monthlyPlForHeader(tradesMap) {
  return Object.values(tradesMap).reduce((sum, t) => sum + (t.pl || 0), 0);
}

// ---- Year Grid ----

function renderYearGrid() {
  const grid = document.getElementById('year-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const entries = [];

  let maxAbs = 0;
  for (let m = 1; m <= 12; m++) {
    const pl = yearMonthPl[m] || 0;
    entries.push({ month: m, pl });
    if (Math.abs(pl) > maxAbs) maxAbs = Math.abs(pl);
  }

  entries.forEach(({ month, pl }, idx) => {
    const cell = document.createElement('div');
    cell.className = 'year-cell';

    if (pl > 0) cell.classList.add('positive');
    else if (pl < 0) cell.classList.add('negative');
    else cell.classList.add('neutral');

    const label = document.createElement('div');
    label.className = 'month-label';
    const date = new Date(currentYear, month - 1, 1);
    label.textContent = date.toLocaleString('default', { month: 'short' });

    const plEl = document.createElement('div');
    plEl.className = 'month-pl';
    plEl.textContent = formatPL(pl);

    cell.appendChild(label);
    cell.appendChild(plEl);

    // Staggered reveal
    cell.style.animation = `fadeUp 0.35s ease ${idx * 0.03}s forwards`;

    // Click to jump into that month
    cell.addEventListener('click', async () => {
      calendarMode = 'month';
      document.getElementById('mode-month').classList.add('active');
      document.getElementById('mode-year').classList.remove('active');
      document.getElementById('yearly-stats').classList.add('hidden');
      document.getElementById('monthly-stats').classList.remove('hidden');
      document.getElementById('year-container').classList.add('hidden');
      document.getElementById('calendar-container').classList.remove('hidden');
      currentMonth = month - 1;
      await fetchMonthData(currentYear, currentMonth);
      renderCalendar();
    });

    grid.appendChild(cell);
  });
}

// ---- Monthly Stats ----

function updateMonthlyStats() {
  const trades = Object.values(tradesByDate);

  let monthlyPl = 0;
  let tradingDays = 0;
  let greenDays = 0;
  let redDays = 0;
  let greenDayTotal = 0;
  let redDayTotal = 0;

  trades.forEach(t => {
    if (typeof t.pl === 'number' && t.pl !== 0) {
      tradingDays++;
      monthlyPl += t.pl;

      if (t.pl > 0) {
        greenDays++;
        greenDayTotal += t.pl;
      } else if (t.pl < 0) {
        redDays++;
        redDayTotal += t.pl;
      }
    }
  });

  const avgGreenDay = greenDays > 0 ? greenDayTotal / greenDays : 0;
  const avgRedDay = redDays > 0 ? redDayTotal / redDays : 0;

  // Update DOM
  const monthlyPlEl = document.getElementById("monthly-pl");
  monthlyPlEl.textContent = formatPL(monthlyPl);
  monthlyPlEl.className = `stat-value ${monthlyPl > 0 ? 'positive' : monthlyPl < 0 ? 'negative' : ''}`;

  document.getElementById("monthly-trading-days").textContent = tradingDays;
  document.getElementById("monthly-avg-green").textContent = formatPL(avgGreenDay);
  document.getElementById("monthly-avg-red").textContent = formatPL(avgRedDay);
}

// ---- Yearly Stats ----

function updateYearStats() {
  const values = Object.values(yearMonthPl || {});
  let ytdPlCalc = 0;
  let greenMonths = 0;
  let redMonths = 0;
  let best = 0;
  let worst = 0;

  values.forEach(v => {
    ytdPlCalc += v;
    if (v > 0) greenMonths++;
    if (v < 0) redMonths++;
    if (v > best) best = v;
    if (v < worst) worst = v;
  });

  ytdPl = ytdPlCalc;
  const ytdPlEl = document.getElementById('ytd-pl');
  ytdPlEl.textContent = formatPL(ytdPl);
  ytdPlEl.className = `stat-value ${ytdPl > 0 ? 'positive' : ytdPl < 0 ? 'negative' : ''}`;

  document.getElementById('ytd-green-months').textContent = greenMonths;
  document.getElementById('ytd-red-months').textContent = redMonths;

  const bestEl = document.getElementById('ytd-best-month');
  bestEl.textContent = formatPL(best);
  bestEl.className = `stat-value ${best > 0 ? 'positive' : best < 0 ? 'negative' : ''}`;

  const worstEl = document.getElementById('ytd-worst-month');
  worstEl.textContent = formatPL(worst);
  worstEl.className = `stat-value ${worst > 0 ? 'positive' : worst < 0 ? 'negative' : ''}`;

  renderHeaderStatus();
}

// ---- Equity Curve ----

let equityCurveChart = null;

function renderEquityCurve() {
  let labels = [];
  let data = [];

  if (calendarMode === 'year') {
    // Use monthly aggregates for current year
    let cumulative = 0;
    for (let m = 1; m <= 12; m++) {
      const pl = yearMonthPl[m] || 0;
      cumulative += pl;
      data.push(cumulative);
      const date = new Date(currentYear, m - 1, 1);
      labels.push(date.toLocaleString('default', { month: 'short' }));
    }

    if (data.length === 0) {
      data.push(0);
      labels.push('Jan');
    }
  } else {
    const trades = Object.entries(tradesByDate)
      .map(([date, data]) => ({ date, pl: data.pl || 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate cumulative P/L
    let cumulative = 0;
    const equityData = trades.map(t => {
      cumulative += t.pl;
      return {
        date: t.date,
        equity: cumulative
      };
    });

    if (equityData.length === 0) {
      equityData.push({ date: formatDateKey(currentYear, currentMonth, 1), equity: 0 });
    }

    labels = equityData.map(d => {
      const [, month, day] = d.date.split('-');
      return `${month}/${day}`;
    });

    data = equityData.map(d => d.equity);
  }

  const ctx = document.getElementById('equity-curve').getContext('2d');

  // Destroy existing chart if it exists
  if (equityCurveChart) {
    equityCurveChart.destroy();
  }

  // Determine line color based on final equity
  const finalEquity = data[data.length - 1] || 0;
  const lineColor = finalEquity >= 0 ? 'rgba(28, 183, 85, 1)' : 'rgba(200, 34, 34, 1)';
  const gradientColor = finalEquity >= 0 ? 'rgba(28, 183, 85, 0.2)' : 'rgba(200, 34, 34, 0.2)';

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, gradientColor);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  equityCurveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cumulative P/L',
        data: data,
        borderColor: lineColor,
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 7,
        pointBackgroundColor: lineColor,
        pointBorderColor: '#111',
        pointBorderWidth: 2,
        animation: {
          duration: 700,
          easing: 'easeOutQuart',
          from: Number.isFinite(data[0]) ? data[0] : 0,
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.5,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(17, 17, 17, 0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          animation: {
            duration: 150,
            easing: 'easeOutQuart'
          },
          callbacks: {
            label: function (context) {
              return `P/L: $${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)',
            maxRotation: 45,
            minRotation: 45
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)',
            callback: function (value) {
              return '$' + value.toFixed(0);
            }
          }
        }
      }
    }
  });
}


// ---- Journal View --------

async function renderJournalView() {
  const journalList = document.getElementById("journal-list");
  journalList.innerHTML = "";

  // Get all trades and convert to array
  let trades = Object.entries(tradesByDate).map(([date, data]) => ({
    date,
    pl: data.pl || 0,
    notes: data.notes || "",
    tradeCount: 0,
    tickers: []
  }));

  // Filter out days with no P/L AND no notes
  trades = trades.filter(t => t.pl !== 0 || t.notes.trim().length > 0);

  // Use cached entries data
  const entriesData = window.entriesByDate || {};
  trades.forEach(trade => {
    const entries = entriesData[trade.date] || [];
    trade.tradeCount = entries.length;
    trade.tickers = [...new Set(entries.map(e => e.ticker))];
  });

  // Apply filters
  trades = applyFilters(trades);

  // Apply sorting
  trades = applySorting(trades);

  // Store for review mode
  reviewDays = trades.map(t => t.date);

  // Render entries or empty state
  if (trades.length === 0) {
    const emptyMsg = filterTicker || filterDayType !== 'all'
      ? 'No trading days match your filters'
      : 'No trading days found for this month';
    journalList.innerHTML = `<div class="journal-empty">${emptyMsg}</div>`;
    return;
  }

  trades.forEach(trade => {
    const entry = document.createElement("div");
    entry.className = `journal-entry ${trade.pl > 0 ? 'positive' : trade.pl < 0 ? 'negative' : ''}`;

    const [year, month, day] = trade.date.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const plFormatted = formatPL(trade.pl);
    const plClass = trade.pl > 0 ? 'positive' : trade.pl < 0 ? 'negative' : '';

    // Get notes preview (first 40 chars)
    const notesPreview = trade.notes ? (trade.notes.length > 40 ? trade.notes.substring(0, 40) + '...' : trade.notes) : 'No notes';

    // Format trade count
    const tradeCountText = trade.tradeCount === 0 ? '0' : `${trade.tradeCount}`;

    // Get top ticker or first 2 tickers
    const tickerTag = trade.tickers.length > 0 ? trade.tickers.slice(0, 2).join(', ') : '-';

    entry.innerHTML = `
      <div class="journal-date">${dateStr}</div>
      <div class="journal-pl ${plClass}">${plFormatted} </div>
      <div class="journal-trades"> ${tradeCountText} trades</div>
      <div class="journal-tag">${tickerTag}</div>
      <div class="journal-notes">${notesPreview}</div>
    `;

    entry.addEventListener('click', () => {
      currentReviewIndex = reviewDays.indexOf(trade.date);
      openDayModal(trade.date);
    });
    journalList.appendChild(entry);
  });
}

function applyFilters(trades) {
  let filtered = [...trades];

  // Filter by day type
  if (filterDayType === 'green') {
    filtered = filtered.filter(t => t.pl > 0);
  } else if (filterDayType === 'red') {
    filtered = filtered.filter(t => t.pl < 0);
  }

  // Filter by ticker
  if (filterTicker) {
    const tickerUpper = filterTicker.toUpperCase();
    filtered = filtered.filter(t =>
      t.tickers && t.tickers.some(ticker => ticker.includes(tickerUpper))
    );
  }

  return filtered;
}

function applySorting(trades) {
  let sorted = [...trades];

  switch (sortBy) {
    case 'date':
      sorted.sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
      break;
    case 'pl-high':
      sorted.sort((a, b) => b.pl - a.pl);
      break;
    case 'pl-low':
      sorted.sort((a, b) => a.pl - b.pl);
      break;
    case 'trades':
      sorted.sort((a, b) => (b.tradeCount || 0) - (a.tradeCount || 0));
      break;
  }

  return sorted;
}

function toggleView(view) {
  currentView = view;

  const calendarContainer = document.getElementById('calendar-container');
  const yearContainer = document.getElementById('year-container');
  const journalContainer = document.getElementById('journal-container');
  const calendarBtn = document.getElementById('calendar-view-btn');
  const journalBtn = document.getElementById('journal-view-btn');
  const filterControls = document.querySelector('.filter-controls');

  if (view === 'calendar') {
    if (calendarMode === 'year') {
      calendarContainer.classList.add('hidden');
      yearContainer.classList.remove('hidden');
      document.getElementById('yearly-stats').classList.remove('hidden');
      document.getElementById('monthly-stats').classList.add('hidden');
    } else {
      calendarContainer.classList.remove('hidden');
      yearContainer.classList.add('hidden');
      document.getElementById('yearly-stats').classList.add('hidden');
      document.getElementById('monthly-stats').classList.remove('hidden');
    }
    journalContainer.classList.add('hidden');
    calendarBtn.classList.add('active');
    journalBtn.classList.remove('active');
    filterControls.classList.add('hidden');
  } else {
    calendarContainer.classList.add('hidden');
    yearContainer.classList.add('hidden');
    journalContainer.classList.remove('hidden');
    calendarBtn.classList.remove('active');
    journalBtn.classList.add('active');
    filterControls.classList.remove('hidden');
    renderJournalView();
  }
}

function setupViewControls() {
  document.getElementById('calendar-view-btn').addEventListener('click', () => toggleView('calendar'));
  document.getElementById('journal-view-btn').addEventListener('click', () => toggleView('journal'));

  document.getElementById('filter-day-type').addEventListener('change', (e) => {
    filterDayType = e.target.value;
    if (currentView === 'journal') {
      renderJournalView();
    }
  });

  document.getElementById('sort-by').addEventListener('change', (e) => {
    sortBy = e.target.value;
    if (currentView === 'journal') {
      renderJournalView();
    }
  });

  document.getElementById('filter-ticker').addEventListener('input', (e) => {
    filterTicker = e.target.value.trim();
    if (currentView === 'journal') {
      renderJournalView();
    }
  });

  document.getElementById('review-mode-btn').addEventListener('click', () => {
    reviewMode = !reviewMode;
    const btn = document.getElementById('review-mode-btn');
    if (reviewMode) {
      btn.classList.add('active');
      showToast('Review mode enabled', 'success');
    } else {
      btn.classList.remove('active');
      document.getElementById('review-nav').classList.add('hidden');
    }
  });

  // Review navigation
  document.getElementById('prev-day-btn').addEventListener('click', () => {
    if (currentReviewIndex > 0) {
      currentReviewIndex--;
      openDayModal(reviewDays[currentReviewIndex]);
    }
  });

  document.getElementById('next-day-btn').addEventListener('click', () => {
    if (currentReviewIndex < reviewDays.length - 1) {
      currentReviewIndex++;
      openDayModal(reviewDays[currentReviewIndex]);
    }
  });
}

function setCalendarMode(mode) {
  if (mode === calendarMode) return;
  calendarMode = mode;

  const monthBtn = document.getElementById('mode-month');
  const yearBtn = document.getElementById('mode-year');
  monthBtn.classList.toggle('active', mode === 'month');
  yearBtn.classList.toggle('active', mode === 'year');

  if (mode === 'year') {
    document.getElementById('calendar-container').classList.add('hidden');
    document.getElementById('year-container').classList.remove('hidden');
    document.getElementById('yearly-stats').classList.remove('hidden');
    document.getElementById('monthly-stats').classList.add('hidden');
    document.getElementById('current-month-label').textContent = `${currentYear}`;
    fetchYearData(currentYear);
    fetchAndRenderYearStats(currentYear);

    renderEquityCurve();
    renderHeaderStatus();
  } else {
    document.getElementById('calendar-container').classList.remove('hidden');
    document.getElementById('year-container').classList.add('hidden');
    document.getElementById('yearly-stats').classList.add('hidden');
    document.getElementById('monthly-stats').classList.remove('hidden');
    calculateAndRenderMonthlyStats();
    renderCalendar();

    renderEquityCurve();
    renderHeaderStatus();
  }
}

function renderHeaderStatus() {
  const bar = document.getElementById('header-status');
  if (!bar) return;
  bar.classList.remove('hidden');

  const ytdEl = document.getElementById('status-ytd');
  const mtdEl = document.getElementById('status-mtd');

  ytdEl.textContent = formatPL(ytdPl || 0);
  ytdEl.className = `status-value ${ytdPl > 0 ? 'positive' : ytdPl < 0 ? 'negative' : ''}`;

  mtdEl.textContent = formatPL(mtdPl || 0);
  mtdEl.className = `status-value ${mtdPl > 0 ? 'positive' : mtdPl < 0 ? 'negative' : ''}`;
}

function setupHeaderActions() {
  const quickAddBtn = document.getElementById('quick-add');
  if (!quickAddBtn) return;

  quickAddBtn.addEventListener('click', async () => {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();

    // Ensure we’re in month mode and showing the calendar
    setCalendarMode('month');

    // Refresh data for the current month
    await fetchMonthData(currentYear, currentMonth);
    renderCalendar();

    // Open today’s modal
    const dateKey = formatDateKey(currentYear, currentMonth, today.getDate());
    openDayModal(dateKey);
  });
}


// ---- Calendar Rendering --------

function renderCalendar() {
  removeAllTooltips();
  const calendarEl = document.getElementById("calendar");
  const labelEl = document.getElementById("current-month-label");

  calendarEl.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  // Calculate max P/L for color intensity
  const allPLs = Object.values(tradesByDate).map(d => Math.abs(d.pl || 0));
  const maxPL = Math.max(...allPLs, 100); // Min 100 for scaling

  for (let i = 0; i < startWeekday; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "day-cell empty";
    calendarEl.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";

    const contentContainer = document.createElement("div");
    contentContainer.className = "cell-content";

    const dateNumber = document.createElement("div");
    dateNumber.className = "date-number";
    dateNumber.textContent = day;
    contentContainer.appendChild(dateNumber);

    const key = formatDateKey(currentYear, currentMonth, day);
    const data = tradesByDate[key];

    if (data && typeof data.pl === "number") {
      const plEl = document.createElement("div");
      plEl.className = "pl-summary";
      contentContainer.appendChild(plEl);

      // Calculate color intensity (0-1)
      const intensity = Math.min(Math.abs(data.pl) / maxPL, 1);

      if (data.pl > 0) {
        cell.classList.add("positive");
        const alpha = 0.65 + (intensity * 0.35); // 65% to 100%
        cell.style.background = `rgba(28, 183, 85, ${alpha})`;
        plEl.textContent = formatPL(data.pl);
      }
      else if (data.pl < 0) {
        cell.classList.add("negative");
        const alpha = 0.65 + (intensity * 0.35); // 65% to 100%
        cell.style.background = `rgba(200, 34, 34, ${alpha})`;
        plEl.textContent = formatPL(data.pl);
      }

      // Add hover tooltip
      cell.addEventListener('mouseenter', () => {
        // Remove any existing tooltips first
        document.querySelectorAll('.calendar-tooltip').forEach(t => t.remove());

        const tooltip = document.createElement('div');
        tooltip.className = 'calendar-tooltip';

        const date = new Date(currentYear, currentMonth, day);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        // Get trade count from cached data
        const tradeCount = (window.entriesByDate && window.entriesByDate[key]) ? window.entriesByDate[key].length : 0;

        const plClass = data.pl > 0 ? 'positive' : data.pl < 0 ? 'negative' : '';
        const plSign = data.pl >= 0 ? '+' : '-';
        const notesPreview = data.notes ? (data.notes.length > 60 ? data.notes.substring(0, 60) + '...' : data.notes) : '';

        tooltip.innerHTML = `
          <div class="tooltip-date">${dateStr}</div>
          <div class="tooltip-pl ${plClass}">${plSign}$${Math.abs(data.pl).toFixed(2)}</div>
          <div class="tooltip-trades">${tradeCount} trade${tradeCount !== 1 ? 's' : ''}</div>
          ${notesPreview ? `<div class="tooltip-notes">${notesPreview}</div>` : ''}
        `;

        document.body.appendChild(tooltip);

        // Position tooltip
        const rect = cell.getBoundingClientRect();
        tooltip.style.position = 'fixed';
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 10}px`;
        tooltip.style.transform = 'translate(-50%, -100%)';

        cell._tooltip = tooltip;
      });

      cell.addEventListener('mouseleave', () => {
        if (cell._tooltip) {
          cell._tooltip.remove();
          cell._tooltip = null;
        }
      });
    } else {
      cell.classList.add("neutral");
    }

    cell.appendChild(contentContainer);
    cell.addEventListener("click", () => openDayModal(key));
    calendarEl.appendChild(cell);
  }

  // Fill the rest of the last row with empty cells
  const totalCells = startWeekday + daysInMonth;
  const remainingCells = 7 - (totalCells % 7);
  if (remainingCells < 7) {
    for (let i = 0; i < remainingCells; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "day-cell empty";
      calendarEl.appendChild(emptyCell);
    }
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
  removeAllTooltips();
  const modal = document.getElementById("day-modal");
  const label = document.getElementById("modal-date-label");
  const notesInput = document.getElementById("notes-input");

  modal.dataset.dateKey = dateKey;

  const [year, month, day] = dateKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  label.textContent = date.toDateString();

  notesInput.value = "";

  try {
    const existing = await fetchDay(dateKey);
    if (existing) {
      notesInput.value = existing.notes ?? "";
    }

    // Fetch and render entries
    await fetchAndRenderEntries(dateKey);

    // Focus ticker input
    setTimeout(() => {
      document.getElementById("entry-ticker").focus();
    }, 100);

  } catch (error) {
    console.error(error);
  }

  // Show review navigation if in review mode
  const reviewNav = document.getElementById('review-nav');
  if (reviewMode && reviewDays.length > 0) {
    reviewNav.classList.remove('hidden');
    document.getElementById('review-position').textContent =
      `Day ${currentReviewIndex + 1} of ${reviewDays.length}`;

    // Disable buttons at boundaries
    document.getElementById('prev-day-btn').disabled = currentReviewIndex === 0;
    document.getElementById('next-day-btn').disabled = currentReviewIndex === reviewDays.length - 1;
  } else {
    reviewNav.classList.add('hidden');
  }

  document.body.style.overflow = 'hidden';
  modal.classList.remove("hidden");

  // Click outside to close
  const handleOutsideClick = (e) => {
    if (e.target === modal) {
      closeDayModal();
      modal.removeEventListener('click', handleOutsideClick);
    }
  };
  modal.addEventListener('click', handleOutsideClick);

  // Add Esc key listener
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeDayModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

async function fetchAndRenderEntries(dateKey) {
  try {
    const res = await authedFetch(`${apiBase}/entries/${dateKey}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch entries");
    }
    const json = await res.json();
    renderEntries(json.data);
    updateDailySummary(json.data);
  } catch (err) {
    console.error("fetchAndRenderEntries error:", err);
    showError(err.message || "Failed to load entries");
  }
}

function updateDailySummary(entries) {
  if (!entries) entries = [];

  const netPl = entries.reduce((sum, e) => sum + e.pnl, 0);
  const tradeCount = entries.length;

  let biggestTrade = { pnl: 0 };
  let worstTrade = { pnl: 0 };

  if (entries.length > 0) {
    biggestTrade = entries.reduce((max, e) => Math.abs(e.pnl) > Math.abs(max.pnl) ? e : max, entries[0]);
    worstTrade = entries.reduce((min, e) => e.pnl < min.pnl ? e : min, entries[0]);
  }

  const winners = entries.filter(e => e.pnl > 0);
  const losers = entries.filter(e => e.pnl < 0);
  const grossProfit = winners.reduce((sum, e) => sum + e.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((sum, e) => sum + e.pnl, 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";

  // Update DOM
  const netPlEl = document.getElementById("summary-net-pl");
  netPlEl.textContent = formatPL(netPl);
  netPlEl.className = `summary-value ${netPl > 0 ? 'positive' : netPl < 0 ? 'negative' : ''}`;

  document.getElementById("summary-trades").textContent = tradeCount;

  const bestEl = document.getElementById("summary-best");
  bestEl.textContent = formatPL(biggestTrade.pnl);
  bestEl.className = `summary-value ${biggestTrade.pnl > 0 ? 'positive' : biggestTrade.pnl < 0 ? 'negative' : ''}`;

  const worstEl = document.getElementById("summary-worst");
  worstEl.textContent = formatPL(worstTrade.pnl);
  worstEl.className = `summary-value ${worstTrade.pnl > 0 ? 'positive' : worstTrade.pnl < 0 ? 'negative' : ''}`;

  document.getElementById("summary-pf").textContent = profitFactor;
}

function renderEntries(entries) {
  const listEl = document.getElementById("trade-entries-list");
  listEl.innerHTML = "";

  if (!entries || entries.length === 0) {
    listEl.innerHTML = "<div style='color: var(--text-secondary); font-size: 0.8rem; text-align: center; padding: 1rem;'>No trades recorded</div>";
    return;
  }

  entries.forEach(entry => {
    const item = document.createElement("div");
    item.className = "trade-entry-item";

    const plClass = entry.pnl > 0 ? "positive" : entry.pnl < 0 ? "negative" : "";
    const plText = formatPL(entry.pnl);

    // Optional fields badges
    let badges = '';
    if (entry.tag) badges += `<span class="trade-badge tag">${entry.tag}</span>`;
    if (entry.setup_quality) badges += `<span class="trade-badge quality-${entry.setup_quality.toLowerCase()}">Grade ${entry.setup_quality}</span>`;
    if (entry.confidence) badges += `<span class="trade-badge confidence">Conf: ${entry.confidence}/5</span>`;

    item.innerHTML = `
      <div class="trade-entry-info">
        <div class="trade-main-row">
          <span class="trade-ticker">${entry.ticker}</span>
          <span style="color: var(--text-secondary); font-size: 0.8em;">${entry.direction}</span>
          <span class="trade-pl ${plClass}">${plText}</span>
        </div>
        ${badges ? `<div class="trade-badges-row">${badges}</div>` : ''}
      </div>
      <button class="delete-trade-btn" data-id="${entry.id}">&times;</button>
    `;

    // Click to edit
    item.querySelector('.trade-entry-info').addEventListener('click', () => {
      editTradeEntry(entry);
    });

    // Delete handler
    item.querySelector(".delete-trade-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      const confirmed = await confirm("Delete this trade?", "Delete Trade");
      if (confirmed) {
        await deleteTradeEntry(entry.id);
        // Refresh list and calendar
        const modal = document.getElementById("day-modal");
        const dateKey = modal.dataset.dateKey;
        await fetchAndRenderEntries(dateKey);

        // Refresh the P/L display
        // Handled by fetchAndRenderEntries -> updateDailySummary

        // Refresh calendar and stats
        await refreshAppData();

      }
    });

    listEl.appendChild(item);
  });
}

async function deleteTradeEntry(id) {
  try {
    const res = await authedFetch(`${apiBase}/entries/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to delete");
    }
    showSuccess("Trade deleted");
  } catch (err) {
    console.error("deleteTradeEntry error:", err);
    showError(err.message || "Failed to delete trade");
    throw err;
  }
}

function editTradeEntry(entry) {
  // Populate form with existing values
  document.getElementById("entry-ticker").value = entry.ticker;
  document.getElementById("entry-direction").value = entry.direction;
  document.getElementById("entry-pl").value = entry.pnl;
  document.getElementById("entry-tag").value = entry.tag || "";
  document.getElementById("entry-confidence").value = entry.confidence || "";
  document.getElementById("entry-quality").value = entry.setup_quality || "";

  // Change button to "Update"
  const addBtn = document.getElementById("add-trade-btn");
  addBtn.textContent = "Update";
  addBtn.dataset.editId = entry.id;

  // Focus ticker
  document.getElementById("entry-ticker").focus();
  document.getElementById("entry-ticker").select();
}

async function updateTradeEntry(id, payload) {
  try {
    const res = await authedFetch(`${apiBase}/entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to update");
    }
    showSuccess("Trade updated");
  } catch (err) {
    console.error("updateTradeEntry error:", err);
    showError(err.message || "Failed to update trade");
    throw err;
  }
}

function closeDayModal() {
  const modal = document.getElementById("day-modal");
  document.body.style.overflow = '';
  modal.classList.add("hidden");
}

function setupModalButtons() {
  // Close buttons
  document.getElementById("close-modal").addEventListener("click", closeDayModal);

  // Save Day (Notes)
  document.getElementById("save-day").addEventListener("click", async () => {
    const modal = document.getElementById("day-modal");
    const dateKey = modal.dataset.dateKey;
    const notes = document.getElementById("notes-input").value;
    const saveBtn = document.getElementById("save-day");

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      await saveDay(dateKey, { notes });
      await refreshAppData();
      closeDayModal();

      showSuccess("Notes saved");
    } catch (err) {
      console.error(err);
      showError("Error saving notes");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Summary";
    }
  });

  // Centralized refresh function
  async function refreshAppData() {
    // Always fetch year data to update YTD and Grid
    await fetchYearData(currentYear);

    // If in month view, refetch month data
    if (calendarMode === 'month') {
      await fetchMonthData(currentYear, currentMonth); // This calls calculateAndRenderMonthlyStats
      renderCalendar();
    } else {
      // In year mode, refresh year stats
      await fetchAndRenderYearStats(currentYear);
      renderYearGrid();
    }

    // Update Header Status (YTD/MTD)
    renderHeaderStatus();

    // If journal view is active, it needs to re-render potentially
    if (currentView === 'journal') {
      renderJournalView();
    }
  }

  // Add Trade Entry
  const addBtn = document.getElementById("add-trade-btn");

  const handleAddTrade = async () => {
    const modal = document.getElementById("day-modal");
    const dateKey = modal.dataset.dateKey;

    const tickerInput = document.getElementById("entry-ticker");
    const directionInput = document.getElementById("entry-direction");
    const plInput = document.getElementById("entry-pl");

    // Optional fields
    const tagInput = document.getElementById("entry-tag");
    const confidenceInput = document.getElementById("entry-confidence");
    const qualityInput = document.getElementById("entry-quality");

    const ticker = tickerInput.value.trim().toUpperCase();
    const direction = directionInput.value;
    const plVal = plInput.value;

    // Clear previous errors
    tickerInput.style.borderColor = '';
    plInput.style.borderColor = '';

    if (!ticker) {
      tickerInput.style.borderColor = '#f87171';
      tickerInput.focus();
      showError("Ticker is required");
      return;
    }

    if (plVal === "" || isNaN(parseFloat(plVal))) {
      plInput.style.borderColor = '#f87171';
      plInput.focus();
      showError("Valid P/L is required");
      return;
    }

    const addBtn = document.getElementById("add-trade-btn");
    const isEditMode = addBtn.dataset.editId;

    const payload = {
      trade_date: dateKey,
      ticker,
      direction,
      entry_price: 0,
      exit_price: 0,
      size: 0,
      pnl: parseFloat(plVal),
      notes: "",
      tag: tagInput.value || null,
      confidence: confidenceInput.value ? parseInt(confidenceInput.value) : null,
      setup_quality: qualityInput.value || null
    };

    try {
      if (isEditMode) {
        // Update existing trade
        await updateTradeEntry(addBtn.dataset.editId, payload);
        delete addBtn.dataset.editId;
        addBtn.textContent = "Add";
      } else {
        // Add new trade
        const res = await authedFetch(`${apiBase}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to add entry");

        showSuccess("Trade added");
      }

      // Clear inputs
      tickerInput.value = "";
      plInput.value = "";
      tagInput.value = "";
      confidenceInput.value = "";
      qualityInput.value = "";
      directionInput.value = "LONG";

      // Focus ticker for next entry
      tickerInput.focus();

      // Refresh list and calendar
      // Refresh list and calendar
      await fetchAndRenderEntries(dateKey);

      // Refresh calendar and stats logic
      await refreshAppData();


    } catch (err) {
      console.error(err);
      showError("Error saving trade");
    }
  };

  addBtn.addEventListener("click", handleAddTrade);

  // Enter key support
  const inputs = ["entry-ticker", "entry-pl", "entry-tag", "entry-confidence", "entry-quality"];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddTrade();
        }
      });
    }
  });

  // Also add Enter support for direction select
  document.getElementById("entry-direction").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTrade();
    }
  });
}

// ---- Month navigation ----

function setupMonthControls() {
  document.getElementById("prev-month").addEventListener("click", async () => {
    if (calendarMode === 'year') {
      currentYear--;
      document.getElementById('current-month-label').textContent = `${currentYear}`;
      await fetchYearData(currentYear);
      renderYearGrid();
    } else {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      await fetchMonthData(currentYear, currentMonth);
      renderCalendar();
    }
  });

  document.getElementById("next-month").addEventListener("click", async () => {
    if (calendarMode === 'year') {
      currentYear++;
      document.getElementById('current-month-label').textContent = `${currentYear}`;
      await fetchYearData(currentYear);
      renderYearGrid();
    } else {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      await fetchMonthData(currentYear, currentMonth);
      renderCalendar();
    }
  });

  document.getElementById('mode-month').addEventListener('click', () => setCalendarMode('month'));
  document.getElementById('mode-year').addEventListener('click', () => setCalendarMode('year'));
}




async function init() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  setupModalButtons();
  setupMonthControls();
  setupViewControls();
  setupHeaderActions();

  // Load user profile info
  await loadUserInfo();

  try {
    await fetchMonthData(currentYear, currentMonth);
    await fetchYearData(currentYear);
  } catch (err) {
    console.error("Error fetching initial data:", err);
  }

  renderCalendar();
  renderHeaderStatus();
}

function bootstrapFromUrlToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  const errorFromUrl = urlParams.get('error');

  if (tokenFromUrl) {
    setToken(tokenFromUrl);
    window.history.replaceState({}, document.title, '/');
    showApp();
    init();
    return true;
  }

  if (errorFromUrl) {
    alert('OAuth login failed. Please try again.');
    window.history.replaceState({}, document.title, '/');
  }

  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  // Check for OAuth token in URL first
  if (bootstrapFromUrlToken()) {
    return;
  }

  // Normal flow
  if (getToken()) {
    showApp();
    init();
  } else {
    showAuth();
  }
});

// ---- Username Management ----

window.showUsernameEdit = function () {
  const popup = document.getElementById('usernamePopup');
  const input = document.getElementById('usernameInput');
  input.value = currentUser?.username || '';
  popup.style.display = 'block';
  input.focus();
};

window.closeUsernamePopup = function () {
  document.getElementById('usernamePopup').style.display = 'none';
};

function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';

  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

window.saveUsername = async function () {
  const username = document.getElementById('usernameInput').value.trim();

  if (!username) {
    showNotification('Username cannot be empty', 'error');
    return;
  }

  if (username.length < 3) {
    showNotification('Username must be at least 3 characters', 'error');
    return;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    showNotification('Username can only contain letters, numbers, - and _', 'error');
    return;
  }

  try {
    const res = await authedFetch(`${apiBase}/user/username`, {
      method: 'PUT',
      body: JSON.stringify({ username })
    });

    const data = await res.json();

    if (res.ok) {
      currentUser.username = data.username;
      renderUserHeader();
      closeUsernamePopup();
      showNotification('Username updated successfully!', 'success');
    } else {
      showNotification(data.error || 'Failed to update username', 'error');
    }
  } catch (err) {
    showNotification('Error updating username', 'error');
  }
};
