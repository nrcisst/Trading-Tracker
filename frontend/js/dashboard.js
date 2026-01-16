// ==========================================================================
// DASHBOARD.JS - Dashboard Views, Week View, Analytics Charts, Tag Autocomplete, Markdown
// ==========================================================================

// ---- Week View ----
let currentWeekStart = null;

// Expose currentWeekStart for equity curve
Object.defineProperty(window, 'currentWeekStart', {
    get: () => currentWeekStart
});

// ---- Premium Number Formatting ----
// Format currency values with K/M abbreviations for compact display
function formatCurrencyCompact(value) {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return (value < 0 ? '-' : '') + '$' + (absValue / 1000000).toFixed(1) + 'M';
    }
    if (absValue >= 1000) {
        return (value < 0 ? '-' : '') + '$' + (absValue / 1000).toFixed(1) + 'K';
    }
    return (value < 0 ? '-' : '') + '$' + absValue.toFixed(0);
}

// Premium chart theme configuration
const premiumChartTheme = {
    gridColor: 'rgba(255, 255, 255, 0.04)',
    tickColor: 'rgba(255, 255, 255, 0.5)',
    positiveColor: 'rgba(52, 211, 153, 0.85)',
    positiveGlow: 'rgba(52, 211, 153, 0.3)',
    negativeColor: 'rgba(248, 113, 113, 0.85)',
    negativeGlow: 'rgba(248, 113, 113, 0.3)',
    accentColors: [
        'rgba(99, 102, 241, 0.85)',   // Indigo
        'rgba(139, 92, 246, 0.85)',   // Purple
        'rgba(236, 72, 153, 0.85)',   // Pink
        'rgba(245, 158, 11, 0.85)',   // Amber
        'rgba(6, 182, 212, 0.85)',    // Cyan
        'rgba(34, 197, 94, 0.85)'     // Green
    ],
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
};

// Get data filtered by current calendar mode
function getFilteredTradesData() {
    const mode = window.getCalendarMode?.() || 'month';
    const allTrades = window.getTradesByDate?.() || {};

    if (mode === 'week' && window.currentWeekStart) {
        const weekDays = getWeekDays(window.currentWeekStart);
        const filtered = {};
        weekDays.forEach(day => {
            const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            if (allTrades[dateKey]) {
                filtered[dateKey] = allTrades[dateKey];
            }
        });
        return filtered;
    }

    // For month and year modes, return existing data
    return allTrades;
}

function getFilteredEntriesData() {
    const mode = window.getCalendarMode?.() || 'month';
    const allEntriesData = allEntries || {};

    if (mode === 'week' && window.currentWeekStart) {
        const weekDays = getWeekDays(window.currentWeekStart);
        const filtered = {};
        weekDays.forEach(day => {
            const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            if (allEntriesData[dateKey]) {
                filtered[dateKey] = allEntriesData[dateKey];
            }
        });
        return filtered;
    }

    return allEntriesData;
}

function initWeekView() {
    const today = new Date();
    // Start week on Monday
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentWeekStart = new Date(today.setDate(diff));
    currentWeekStart.setHours(0, 0, 0, 0);
}

// Set week start based on a specific year and month (uses first Monday of that month)
function setWeekFromMonth(year, month) {
    // Start from the 1st of the month
    const firstOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstOfMonth.getDay();
    // Find the Monday of that week (could be in previous month)
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart = new Date(year, month, 1 + diff);
    currentWeekStart.setHours(0, 0, 0, 0);
}

function getWeekDays(startDate) {
    const days = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        days.push(day);
    }
    return days;
}

function formatWeekLabel(start) {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const options = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`;
}

function renderWeekView() {
    const container = document.getElementById('week-grid');
    const weekDays = getWeekDays(currentWeekStart);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Update week label in controls
    const weekLabel = document.getElementById('week-label');
    if (weekLabel) {
        weekLabel.textContent = formatWeekLabel(currentWeekStart);
    }

    container.innerHTML = weekDays.map((day, index) => {
        const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        const data = (window.getTradesByDate?.() || {})[dateKey] || { pl: 0 };
        const pl = data.pl || 0;
        // Get trade count from entriesByDate (not tradesByDate which doesn't have this field)
        const entries = (window.entriesByDate || {})[dateKey] || [];
        const tradeCount = entries.length;

        const isToday = day.getTime() === today.getTime();
        const plClass = pl > 0 ? 'positive' : pl < 0 ? 'negative' : '';
        const dayClass = isToday ? 'today' : '';

        return `
      <div class="week-day ${plClass} ${dayClass}" onclick="openDayModal('${dateKey}')">
        <div class="week-day-header">
          <span class="week-day-dow">${dayNames[index]}</span>
          <span class="week-day-date">${day.getDate()}</span>
        </div>
        <div class="week-day-pl ${plClass}">${pl !== 0 ? formatPL(pl) : '-'}</div>
        <div class="week-day-trades">${tradeCount > 0 ? `${tradeCount} trade${tradeCount > 1 ? 's' : ''}` : 'No trades'}</div>
      </div>
    `;
    }).join('');
}

function prevWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    loadWeekData();
}

function nextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    loadWeekData();
}

// Load data for the current week (handles cross-month weeks)
async function loadWeekData() {
    const weekDays = getWeekDays(currentWeekStart);
    const monthsToLoad = new Set();

    // Identify all months we need data for
    weekDays.forEach(day => {
        const key = `${day.getFullYear()}-${day.getMonth()}`;
        monthsToLoad.add(key);
    });

    // Load each needed month's data
    for (const key of monthsToLoad) {
        const [year, month] = key.split('-').map(Number);
        // Fetch without clearing existing data
        if (typeof window.fetchMonthDataMerge === 'function') {
            await window.fetchMonthDataMerge(year, month);
        } else if (typeof window.fetchMonthData === 'function') {
            // Fallback - this will clear data but at least load something
            await window.fetchMonthData(year, month);
        }
    }

    renderWeekView();
    updateWeekStats();

    // Update period label and equity curve
    if (typeof window.updateStatsPeriodLabel === 'function') {
        window.updateStatsPeriodLabel();
    }
    if (typeof window.renderEquityCurve === 'function') {
        window.renderEquityCurve();
    }
}

// Calculate stats for the current week
function updateWeekStats() {
    const weekDays = getWeekDays(currentWeekStart);
    const tradesByDate = window.getTradesByDate?.() || {};

    let weekPl = 0;
    let tradingDays = 0;
    let maxWin = 0;
    let maxLoss = 0;
    let winCount = 0;
    let lossCount = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let greenDayTotal = 0;
    let redDayTotal = 0;

    weekDays.forEach(day => {
        const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        const data = tradesByDate[dateKey];

        if (data && typeof data.pl === 'number' && data.pl !== 0) {
            tradingDays++;
            weekPl += data.pl;

            if (data.pl > 0) {
                if (data.pl > maxWin) maxWin = data.pl;
                winCount++;
                grossProfit += data.pl;
                greenDayTotal += data.pl;
            } else {
                if (data.pl < maxLoss) maxLoss = data.pl;
                lossCount++;
                grossLoss += Math.abs(data.pl);
                redDayTotal += data.pl;
            }
        }
    });

    const totalTrades = winCount + lossCount;
    const winRate = totalTrades > 0 ? Math.round((winCount / totalTrades) * 100) : 0;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '∞' : '0.00';
    const avgGreenDay = winCount > 0 ? greenDayTotal / winCount : 0;
    const avgRedDay = lossCount > 0 ? redDayTotal / lossCount : 0;

    // Update the unified stats UI
    const netPlEl = document.getElementById('stat-net-pl');
    if (netPlEl) {
        netPlEl.textContent = formatPL(weekPl);
        netPlEl.className = `stat-value ${weekPl > 0 ? 'positive' : weekPl < 0 ? 'negative' : ''}`;
    }

    const winRateEl = document.getElementById('stat-win-rate');
    if (winRateEl) winRateEl.textContent = `${winRate}%`;

    const profitFactorEl = document.getElementById('stat-profit-factor');
    if (profitFactorEl) profitFactorEl.textContent = profitFactor;

    const tradingDaysEl = document.getElementById('stat-trading-days');
    if (tradingDaysEl) tradingDaysEl.textContent = tradingDays;

    const maxWinEl = document.getElementById('stat-max-win');
    if (maxWinEl) maxWinEl.textContent = formatPL(maxWin);

    const maxLossEl = document.getElementById('stat-max-loss');
    if (maxLossEl) maxLossEl.textContent = formatPL(maxLoss);

    // Update avg green/red day stats
    const avgGreenEl = document.getElementById('stat-avg-green');
    if (avgGreenEl) avgGreenEl.textContent = formatPL(avgGreenDay);

    const avgRedEl = document.getElementById('stat-avg-red');
    if (avgRedEl) avgRedEl.textContent = formatPL(avgRedDay);
}

// ---- Dashboard Analytics Charts ----
let dayOfWeekChart = null;
let setupChart = null;
let plDistributionChart = null;

function renderDashboardCharts() {
    renderDayOfWeekChart();
    renderSetupChart();
    renderPlDistributionChart();
    renderStreakStats();
}

function renderDayOfWeekChart() {
    const ctx = document.getElementById('day-of-week-chart');
    if (!ctx) return;

    // Use filtered data based on calendar mode
    const filteredTrades = getFilteredTradesData();

    // Calculate P/L by day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const plByDay = [0, 0, 0, 0, 0, 0, 0];
    const countByDay = [0, 0, 0, 0, 0, 0, 0];

    Object.entries(filteredTrades).forEach(([dateKey, data]) => {
        const date = new Date(dateKey + 'T12:00:00');
        const dayIndex = date.getDay();
        if (data.pl) {
            plByDay[dayIndex] += data.pl;
            countByDay[dayIndex]++;
        }
    });

    // Calculate averages
    const avgByDay = plByDay.map((total, i) => countByDay[i] > 0 ? total / countByDay[i] : 0);

    if (dayOfWeekChart) {
        dayOfWeekChart.destroy();
    }

    dayOfWeekChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dayNames,
            datasets: [{
                label: 'Avg P/L',
                data: avgByDay,
                backgroundColor: avgByDay.map(v => v >= 0 ? premiumChartTheme.positiveColor : premiumChartTheme.negativeColor),
                hoverBackgroundColor: avgByDay.map(v => v >= 0 ? 'rgba(52, 211, 153, 1)' : 'rgba(248, 113, 113, 1)'),
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 600,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255, 255, 255, 0.8)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: ctx => formatCurrencyCompact(ctx.raw)
                    }
                }
            },
            scales: {
                y: {
                    grid: {
                        color: premiumChartTheme.gridColor,
                        drawBorder: false
                    },
                    border: { display: false },
                    ticks: {
                        color: premiumChartTheme.tickColor,
                        font: { size: 11 },
                        padding: 8,
                        callback: v => formatCurrencyCompact(v)
                    }
                },
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: premiumChartTheme.tickColor,
                        font: { size: 11, weight: '500' }
                    }
                }
            }
        }
    });
}

function renderSetupChart() {
    const ctx = document.getElementById('setup-chart');
    if (!ctx) return;

    // Use filtered entries based on calendar mode
    const filteredEntries = getFilteredEntriesData();

    // Gather setup/tag statistics
    const setupStats = {};

    Object.values(filteredEntries).forEach(dayEntries => {
        (Array.isArray(dayEntries) ? dayEntries : []).forEach(entry => {
            const tag = entry.tag || 'Untagged';
            if (!setupStats[tag]) {
                setupStats[tag] = { total: 0, wins: 0, pl: 0 };
            }
            setupStats[tag].total++;
            setupStats[tag].pl += entry.pnl || 0;
            if ((entry.pnl || 0) > 0) setupStats[tag].wins++;
        });
    });

    const labels = Object.keys(setupStats);
    if (labels.length === 0) {
        if (setupChart) setupChart.destroy();
        return;
    }

    if (setupChart) {
        setupChart.destroy();
    }

    setupChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: labels.map(tag => setupStats[tag].total),
                backgroundColor: premiumChartTheme.accentColors.slice(0, labels.length),
                hoverBackgroundColor: premiumChartTheme.accentColors.map(c => c.replace('0.85', '1')),
                borderWidth: 0,
                spacing: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            animation: {
                animateRotate: true,
                duration: 800,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: premiumChartTheme.tickColor,
                        boxWidth: 12,
                        padding: 10,
                        font: { size: 11 },
                        generateLabels: chart => {
                            const data = chart.data;
                            return data.labels.map((label, i) => ({
                                text: `${label} (${data.datasets[0].data[i]})`,
                                fillStyle: data.datasets[0].backgroundColor[i],
                                hidden: false,
                                index: i
                            }));
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255, 255, 255, 0.8)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: ctx => {
                            const tag = labels[ctx.dataIndex];
                            const winRate = setupStats[tag].total > 0
                                ? ((setupStats[tag].wins / setupStats[tag].total) * 100).toFixed(0)
                                : 0;
                            return [
                                `Trades: ${setupStats[tag].total}`,
                                `Win Rate: ${winRate}%`,
                                `P/L: ${formatCurrencyCompact(setupStats[tag].pl)}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

function renderPlDistributionChart() {
    const ctx = document.getElementById('pl-distribution-chart');
    if (!ctx) return;

    // Use filtered entries based on calendar mode
    const filteredEntries = getFilteredEntriesData();

    // Create histogram of P/L values
    const plValues = [];
    Object.values(filteredEntries).forEach(dayEntries => {
        (Array.isArray(dayEntries) ? dayEntries : []).forEach(entry => {
            if (entry.pnl !== undefined) plValues.push(entry.pnl);
        });
    });

    if (plValues.length === 0) {
        if (plDistributionChart) plDistributionChart.destroy();
        return;
    }

    // Create bins
    const min = Math.min(...plValues);
    const max = Math.max(...plValues);
    const binCount = 10;
    const binSize = (max - min) / binCount || 1;

    const bins = Array(binCount).fill(0);
    const binLabels = [];
    const binColors = [];

    for (let i = 0; i < binCount; i++) {
        const binStart = min + i * binSize;
        const binEnd = binStart + binSize;
        const binMid = (binStart + binEnd) / 2;
        binLabels.push(formatCurrencyCompact(binStart));
        binColors.push(binMid >= 0 ? premiumChartTheme.positiveColor : premiumChartTheme.negativeColor);

        plValues.forEach(v => {
            if (v >= binStart && v < binEnd) bins[i]++;
        });
    }

    if (plDistributionChart) {
        plDistributionChart.destroy();
    }

    plDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: 'Trades',
                data: bins,
                backgroundColor: binColors,
                hoverBackgroundColor: binColors.map(c => c.replace('0.85', '1')),
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 600,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255, 255, 255, 0.8)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: ctx => `P/L Range: ${ctx[0].label}`,
                        label: ctx => `${ctx.raw} trades`
                    }
                }
            },
            scales: {
                y: {
                    grid: {
                        color: premiumChartTheme.gridColor,
                        drawBorder: false
                    },
                    border: { display: false },
                    ticks: {
                        color: premiumChartTheme.tickColor,
                        font: { size: 11 },
                        padding: 8,
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: 'Trades',
                        color: 'rgba(255, 255, 255, 0.4)',
                        font: { size: 10 }
                    }
                },
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: premiumChartTheme.tickColor,
                        font: { size: 10 },
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function renderStreakStats() {
    // Calculate streaks
    const dates = Object.keys(window.getTradesByDate?.() || {}).sort();

    let currentStreak = 0;
    let currentStreakType = null;
    let bestWinStreak = 0;
    let worstLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;

    dates.forEach(dateKey => {
        const data = (window.getTradesByDate?.() || {})[dateKey];
        const pl = data?.pl || 0;

        if (pl > 0) {
            tempWinStreak++;
            tempLossStreak = 0;
            if (tempWinStreak > bestWinStreak) bestWinStreak = tempWinStreak;
        } else if (pl < 0) {
            tempLossStreak++;
            tempWinStreak = 0;
            if (tempLossStreak > worstLossStreak) worstLossStreak = tempLossStreak;
        }
    });

    // Calculate current streak (from most recent day)
    for (let i = dates.length - 1; i >= 0; i--) {
        const pl = (window.getTradesByDate?.() || {})[dates[i]]?.pl || 0;
        if (pl === 0) continue;

        if (currentStreakType === null) {
            currentStreakType = pl > 0 ? 'win' : 'loss';
            currentStreak = 1;
        } else if ((currentStreakType === 'win' && pl > 0) || (currentStreakType === 'loss' && pl < 0)) {
            currentStreak++;
        } else {
            break;
        }
    }

    // Update DOM (no emojis)
    const currentEl = document.getElementById('current-streak');
    const bestWinEl = document.getElementById('best-win-streak');
    const worstLossEl = document.getElementById('worst-loss-streak');

    if (currentEl) {
        const streakLabel = currentStreakType === 'win' ? 'W' : currentStreakType === 'loss' ? 'L' : '';
        currentEl.textContent = `${currentStreak} day${currentStreak !== 1 ? 's' : ''} ${streakLabel}`;
        currentEl.className = `streak-value ${currentStreakType === 'win' ? 'positive' : currentStreakType === 'loss' ? 'negative' : ''}`;
    }
    if (bestWinEl) bestWinEl.textContent = `${bestWinStreak} days`;
    if (worstLossEl) worstLossEl.textContent = `${worstLossStreak} days`;
}

// ---- Simple Markdown Support ----
function renderMarkdown(text) {
    if (!text) return '';

    // Escape HTML
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Code: `code`
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Links: [text](url)
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Bullet lists: - item
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    // Wrap consecutive list items in ul tags
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
}

// ---- Unified View System ----
// This replaces the scattered view logic. Call this from app.js.
function showDashboardView() {
    // Hide calendar containers
    const calendarContainer = document.getElementById('calendar-container');
    const yearContainer = document.getElementById('year-container');
    const weekContainer = document.getElementById('week-container');
    const journalContainer = document.getElementById('journal-container');
    const dashboardSection = document.getElementById('dashboard-section');
    const filterControls = document.querySelector('.filter-controls');

    if (calendarContainer) calendarContainer.classList.add('hidden');
    if (yearContainer) yearContainer.classList.add('hidden');
    if (weekContainer) weekContainer.classList.add('hidden');
    if (journalContainer) journalContainer.classList.add('hidden');
    if (dashboardSection) dashboardSection.classList.remove('hidden');
    if (filterControls) filterControls.classList.add('hidden');

    // Update button states
    updateViewButtons('dashboard');

    // Render charts
    renderDashboardCharts();
}

function showJournalView() {
    const calendarContainer = document.getElementById('calendar-container');
    const yearContainer = document.getElementById('year-container');
    const weekContainer = document.getElementById('week-container');
    const journalContainer = document.getElementById('journal-container');
    const dashboardSection = document.getElementById('dashboard-section');
    const filterControls = document.querySelector('.filter-controls');

    if (calendarContainer) calendarContainer.classList.add('hidden');
    if (yearContainer) yearContainer.classList.add('hidden');
    if (weekContainer) weekContainer.classList.add('hidden');
    if (journalContainer) journalContainer.classList.remove('hidden');
    if (dashboardSection) dashboardSection.classList.add('hidden');
    if (filterControls) filterControls.classList.remove('hidden');

    updateViewButtons('journal');

    if (typeof renderJournalView === 'function') renderJournalView();
}

function showCalendarView() {
    const calendarContainer = document.getElementById('calendar-container');
    const yearContainer = document.getElementById('year-container');
    const weekContainer = document.getElementById('week-container');
    const journalContainer = document.getElementById('journal-container');
    const dashboardSection = document.getElementById('dashboard-section');
    const filterControls = document.querySelector('.filter-controls');

    // Show based on mode (month/year/week)
    if (window.getCalendarMode?.() === 'year') {
        if (calendarContainer) calendarContainer.classList.add('hidden');
        if (yearContainer) yearContainer.classList.remove('hidden');
        if (weekContainer) weekContainer.classList.add('hidden');
    } else if (window.getCalendarMode?.() === 'week') {
        if (calendarContainer) calendarContainer.classList.add('hidden');
        if (yearContainer) yearContainer.classList.add('hidden');
        if (weekContainer) weekContainer.classList.remove('hidden');
        if (!currentWeekStart) initWeekView();
        renderWeekView();
    } else {
        if (calendarContainer) calendarContainer.classList.remove('hidden');
        if (yearContainer) yearContainer.classList.add('hidden');
        if (weekContainer) weekContainer.classList.add('hidden');
    }

    if (journalContainer) journalContainer.classList.add('hidden');
    if (dashboardSection) dashboardSection.classList.add('hidden');
    if (filterControls) filterControls.classList.add('hidden');

    updateViewButtons('calendar');
}

function updateViewButtons(activeView) {
    const calendarBtn = document.getElementById('calendar-view-btn');
    const journalBtn = document.getElementById('journal-view-btn');
    const dashboardBtn = document.getElementById('dashboard-view-btn');

    if (calendarBtn) calendarBtn.classList.toggle('active', activeView === 'calendar');
    if (journalBtn) journalBtn.classList.toggle('active', activeView === 'journal');
    if (dashboardBtn) dashboardBtn.classList.toggle('active', activeView === 'dashboard');
}

function setupDashboardViewToggle() {
    const dashboardBtn = document.getElementById('dashboard-view-btn');
    const journalBtn = document.getElementById('journal-view-btn');
    const calendarBtn = document.getElementById('calendar-view-btn');

    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', showDashboardView);
    }

    if (journalBtn) {
        journalBtn.addEventListener('click', showJournalView);
    }

    if (calendarBtn) {
        calendarBtn.addEventListener('click', showCalendarView);
    }
}

// ---- Integration with app.js ----
// Store all entries for analytics
let allEntries = {};

function setAllEntries(entries) {
    allEntries = entries;
}

// Initialize dashboard features
document.addEventListener('DOMContentLoaded', () => {
    setupDashboardViewToggle();
});

// Export for app.js and onclick handlers
window.renderWeekView = renderWeekView;
window.renderDashboardCharts = renderDashboardCharts;
window.showDashboardView = showDashboardView;
window.showJournalView = showJournalView;
window.showCalendarView = showCalendarView;
window.setAllEntries = setAllEntries;
window.renderMarkdown = renderMarkdown;
window.prevWeek = prevWeek;
window.nextWeek = nextWeek;
window.loadWeekData = loadWeekData;
window.updateWeekStats = updateWeekStats;
window.getWeekDays = getWeekDays;
window.setWeekFromMonth = setWeekFromMonth;
