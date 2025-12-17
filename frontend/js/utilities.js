// ---- Animated Counter ----
function animateCounter(element, targetValue, duration = 800, prefix = '', suffix = '') {
    const isNegative = targetValue < 0;
    const absTarget = Math.abs(targetValue);
    const startValue = 0;
    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic for smooth deceleration
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (absTarget - startValue) * easeOut;

        const displayValue = isNegative ? -currentValue : currentValue;

        if (prefix === '$' || suffix === '%') {
            element.textContent = prefix + (isNegative ? '-' : '') + Math.abs(displayValue).toFixed(2) + suffix;
        } else {
            element.textContent = prefix + Math.round(displayValue) + suffix;
        }

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }

    requestAnimationFrame(updateCounter);
}

// Animate all stat values with counting effect
function animateAllStats() {
    const statElements = document.querySelectorAll('.stat-value');
    statElements.forEach(el => {
        const text = el.textContent;
        const isPercent = text.includes('%');
        const isDollar = text.includes('$');
        const isNegative = text.includes('-');

        // Extract numeric value
        let value = parseFloat(text.replace(/[$%,]/g, ''));
        if (isNaN(value)) return;

        if (isDollar) {
            animateCounter(el, value, 800, '$', '');
        } else if (isPercent) {
            animateCounter(el, value, 800, '', '%');
        } else {
            animateCounter(el, value, 800, '', '');
        }
    });
}

// ---- Confetti Celebration ----
function createConfetti() {
    const colors = ['#10B981', '#34D399', '#6EE7B7', '#FFD700', '#FFA500'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  `;
    document.body.appendChild(container);

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.cssText = `
      position: absolute;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}%;
      top: -20px;
      opacity: ${Math.random() * 0.5 + 0.5};
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      animation: confettiFall ${Math.random() * 2 + 2}s linear forwards;
      animation-delay: ${Math.random() * 0.5}s;
    `;
        container.appendChild(confetti);
    }

    // Remove container after animation
    setTimeout(() => container.remove(), 4000);
}

// Check for milestones and celebrate
function checkMilestones(netPl, previousPl) {
    // Celebrate first green day of the month
    if (netPl > 0 && (previousPl === undefined || previousPl <= 0)) {
        // First green recorded
    }

    // Celebrate hitting round numbers
    const milestones = [100, 500, 1000, 2500, 5000, 10000];
    for (const milestone of milestones) {
        if (previousPl < milestone && netPl >= milestone) {
            createConfetti();
            showSuccess(`Milestone: $${milestone.toLocaleString()} reached!`);
            break;
        }
    }
}

// Celebrate a green day when saving
function celebrateGreenDay(pl) {
    if (pl > 0) {
        createConfetti();
    }
}

// ---- Keyboard Shortcuts ----
const keyboardShortcuts = {
    isModalOpen: () => !document.getElementById('day-modal').classList.contains('hidden'),

    init() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in an input
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                // But allow Escape
                if (e.key !== 'Escape') return;
            }

            // Ignore if auth screen is showing
            if (document.getElementById('authContainer').style.display !== 'none') return;

            this.handleKeyPress(e);
        });
    },

    handleKeyPress(e) {
        const key = e.key.toLowerCase();

        // Global shortcuts
        switch (key) {
            case 'escape':
                this.closeAnyModal();
                break;
            case '?':
                if (!e.shiftKey) return;
                this.showHelp();
                break;
            case 'n':
                if (!this.isModalOpen()) {
                    e.preventDefault();
                    this.openTodayModal();
                }
                break;
            case 't':
                if (!this.isModalOpen()) {
                    e.preventDefault();
                    this.goToToday();
                }
                break;
        }

        // Navigation shortcuts (when modal is closed)
        if (!this.isModalOpen()) {
            switch (key) {
                case 'j':
                case 'arrowleft':
                    e.preventDefault();
                    document.getElementById('prev-month')?.click();
                    break;
                case 'k':
                case 'arrowright':
                    e.preventDefault();
                    document.getElementById('next-month')?.click();
                    break;
                case '1':
                    document.getElementById('calendar-view-btn')?.click();
                    break;
                case '2':
                    document.getElementById('journal-view-btn')?.click();
                    break;
                case 'm':
                    document.getElementById('mode-month')?.click();
                    break;
                case 'y':
                    document.getElementById('mode-year')?.click();
                    break;
            }
        }
    },

    closeAnyModal() {
        const dayModal = document.getElementById('day-modal');
        const confirmModal = document.getElementById('confirm-modal');
        const profileDropdown = document.getElementById('profileDropdown');

        if (confirmModal && !confirmModal.classList.contains('hidden')) {
            document.getElementById('confirm-cancel')?.click();
        } else if (dayModal && !dayModal.classList.contains('hidden')) {
            document.getElementById('close-modal')?.click();
        }
        if (profileDropdown) {
            profileDropdown.style.display = 'none';
        }
    },

    openTodayModal() {
        const today = new Date();
        const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (typeof openDayModal === 'function') {
            openDayModal(dateKey);
        }
    },

    goToToday() {
        const today = new Date();
        if (typeof currentYear !== 'undefined' && typeof currentMonth !== 'undefined') {
            // Update to current month/year then render
            currentYear = today.getFullYear();
            currentMonth = today.getMonth() + 1;
            if (typeof fetchMonthData === 'function') {
                fetchMonthData(currentYear, currentMonth).then(() => {
                    if (typeof renderCalendar === 'function') renderCalendar();
                    if (typeof calculateAndRenderMonthlyStats === 'function') calculateAndRenderMonthlyStats();
                });
            }
        }
    },

    showHelp() {
        const helpHtml = `
      <div class="keyboard-help-overlay" onclick="this.remove()">
        <div class="keyboard-help" onclick="event.stopPropagation()">
          <h3>Keyboard Shortcuts</h3>
          <div class="shortcut-grid">
            <div class="shortcut-section">
              <h4>Navigation</h4>
              <div class="shortcut"><kbd>J</kbd> / <kbd>←</kbd> Previous month</div>
              <div class="shortcut"><kbd>K</kbd> / <kbd>→</kbd> Next month</div>
              <div class="shortcut"><kbd>T</kbd> Go to today</div>
            </div>
            <div class="shortcut-section">
              <h4>Views</h4>
              <div class="shortcut"><kbd>1</kbd> Calendar view</div>
              <div class="shortcut"><kbd>2</kbd> Journal view</div>
              <div class="shortcut"><kbd>M</kbd> Monthly mode</div>
              <div class="shortcut"><kbd>Y</kbd> Yearly mode</div>
            </div>
            <div class="shortcut-section">
              <h4>Actions</h4>
              <div class="shortcut"><kbd>N</kbd> New trade (today)</div>
              <div class="shortcut"><kbd>Esc</kbd> Close modal</div>
              <div class="shortcut"><kbd>?</kbd> This help</div>
            </div>
          </div>
          <button onclick="this.parentElement.parentElement.remove()" class="btn-secondary" style="margin-top: 1rem;">Close</button>
        </div>
      </div>
    `;
        document.body.insertAdjacentHTML('beforeend', helpHtml);
    }
};

// ---- CSS for confetti animation (inject once) ----
(function injectConfettiCSS() {
    if (document.getElementById('confetti-styles')) return;

    const style = document.createElement('style');
    style.id = 'confetti-styles';
    style.textContent = `
    @keyframes confettiFall {
      0% {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translateY(100vh) rotate(720deg);
        opacity: 0;
      }
    }
    
    .keyboard-help-overlay {
      position: fixed;
      inset: 0;
      background: hsl(0 0% 0% / 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    }
    
    .keyboard-help {
      background: hsl(220 14% 8%);
      border: 1px solid hsl(0 0% 100% / 0.12);
      border-radius: 16px;
      padding: 2rem;
      max-width: 600px;
      box-shadow: 0 20px 60px hsl(0 0% 0% / 0.5);
    }
    
    .keyboard-help h3 {
      margin: 0 0 1.5rem;
      font-size: 1.5rem;
      color: var(--text-primary);
    }
    
    .shortcut-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1.5rem;
    }
    
    .shortcut-section h4 {
      margin: 0 0 0.75rem;
      font-size: 0.85rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .shortcut {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
    
    kbd {
      background: hsl(0 0% 100% / 0.1);
      border: 1px solid hsl(0 0% 100% / 0.2);
      border-radius: 4px;
      padding: 0.2rem 0.5rem;
      font-family: var(--font-mono, monospace);
      font-size: 0.8rem;
      color: var(--text-primary, white);
    }
    
    .onboarding-content h4 {
      margin: 0 0 0.5rem;
      font-size: 1.1rem;
      color: var(--text-primary, white);
    }
    
    .onboarding-content p {
      margin: 0 0 1rem;
      color: var(--text-secondary, #999);
      line-height: 1.5;
    }
    
    .onboarding-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .onboarding-progress {
      font-size: 0.8rem;
      color: var(--text-tertiary, #666);
      margin-right: auto;
    }
    
    .onboarding-skip {
      background: transparent;
      border: none;
      color: var(--text-secondary, #999);
      cursor: pointer;
      font-size: 0.9rem;
    }
    
    .onboarding-next {
      background: var(--text-primary, white);
      color: var(--bg-color, black);
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
  `;
    document.head.appendChild(style);
})();

// Initialize keyboard shortcuts when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    keyboardShortcuts.init();
});

// Export for use in app.js
window.animateCounter = animateCounter;
window.animateAllStats = animateAllStats;
window.createConfetti = createConfetti;
window.celebrateGreenDay = celebrateGreenDay;
window.checkMilestones = checkMilestones;
window.keyboardShortcuts = keyboardShortcuts;

// ---- P/L Calculator ----
function calculatePL() {
    const entryPrice = parseFloat(document.getElementById('entry-entry-price')?.value);
    const exitPrice = parseFloat(document.getElementById('entry-exit-price')?.value);
    const size = parseFloat(document.getElementById('entry-size')?.value);
    const direction = document.getElementById('entry-direction')?.value || 'LONG';

    if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(size)) {
        if (typeof showError === 'function') {
            showError('Enter Entry, Exit, and Size to calculate');
        }
        return;
    }

    let pl;
    if (direction === 'LONG') {
        pl = (exitPrice - entryPrice) * size;
    } else {
        pl = (entryPrice - exitPrice) * size;
    }

    const plInput = document.getElementById('entry-pl');
    if (plInput) {
        plInput.value = pl.toFixed(2);
        // Animate the input to show it was updated
        plInput.style.transition = 'all 0.2s';
        plInput.style.background = 'hsl(45 100% 50% / 0.2)';
        setTimeout(() => {
            plInput.style.background = '';
        }, 500);
    }
}

// Initialize P/L calculator button
document.addEventListener('DOMContentLoaded', () => {
    const calcBtn = document.getElementById('calc-pl-btn');
    if (calcBtn) {
        calcBtn.addEventListener('click', calculatePL);
    }
});

window.calculatePL = calculatePL;
