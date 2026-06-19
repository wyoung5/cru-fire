/**
 * J Fire — script.js
 * ─────────────────────────────────────────────────────────────
 * Core Functionality:
 *  1. Authentication System
 *     - Sign-up / sign-in via localStorage user store
 *     - Budget section hidden until authenticated
 *     - Hero & about sections always visible
 *
 *  2. Project Management
 *     - Create and manage projects with localStorage persistence
 *     - Auto-save feature: projects save when title is typed
 *
 *  3. Financial Tracking
 *     - Live validation and summary display
 *     - Fixed cost tracking with running totals (cost | budget | actuals)
 *     - Variable cost tracking with running totals (cost | budget | actuals)
 *     - Budget overview with overhead calculations
 *
 *  4. Data Visualization
 *     - 5-year chart with live updates via Chart.js
 *       (auto-updates on every input change)
 *     - Budget vs Actuals comparison chart
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS & STORAGE KEYS
   ═══════════════════════════════════════════════════════════ */

const STORAGE_KEYS = {
    USERS: 'jfire_users',
    SESSION: 'jfire_session',
    PROJECT: 'jfire_project',
};

/* ═══════════════════════════════════════════════════════════
   UTILITY HELPERS
   ═══════════════════════════════════════════════════════════ */

/** Format a number as a USD string with two decimal places. */
function formatUSD(amount) {
    return '$' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Parse a numeric input value; return 0 if empty or NaN. */
function parseNum(id) {
    const val = parseFloat(document.getElementById(id)?.value ?? '');
    return isNaN(val) ? 0 : val;
}

/** Show a status message inside a .jf-status element. */
function showStatus(el, message, isError = false) {
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
    el.classList.toggle('error', isError);
}

/** Hide a .jf-status element. */
function hideStatus(el) {
    if (!el) return;
    el.classList.remove('visible', 'error');
    el.textContent = '';
}

/** Sum the values of all inputs matching a CSS selector. */
function sumInputs(selector) {
    return Array.from(document.querySelectorAll(selector))
        .reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
}

/**
 * Simple debounce — returns a function that delays invoking fn
 * until after `wait` ms have elapsed since the last invocation.
 */
function debounce(fn, wait) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

/* ═══════════════════════════════════════════════════════════
   USER STORE (localStorage)
   A simple client-side user store for portfolio demonstration.
   In production, replace with a real auth backend.
   ═══════════════════════════════════════════════════════════ */

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) ?? '{}');
    } catch {
        return {};
    }
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function getSession() {
    return localStorage.getItem(STORAGE_KEYS.SESSION);
}

function setSession(username) {
    localStorage.setItem(STORAGE_KEYS.SESSION, username);
}

function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
}

/* ═══════════════════════════════════════════════════════════
   AUTH-GATED UI
   Show hero + about to everyone.
   Reveal #budget-entry and auth-only nav items only when
   a valid session exists.
   ═══════════════════════════════════════════════════════════ */

/**
 * Update the page's auth-gated elements based on current session.
 * Called after every login / logout.
 */
function applyAuthState() {
    const isLoggedIn = Boolean(getSession());

    // Budget entry section
    const budgetSection = document.getElementById('budget-entry');
    budgetSection?.classList.toggle('hidden', !isLoggedIn);

    // Nav items: show/hide auth-only vs guest-only items
    document.querySelectorAll('.nav-auth-only').forEach(el => el.classList.toggle('hidden', !isLoggedIn));
    document.querySelectorAll('.nav-guest-only').forEach(el => el.classList.toggle('hidden', isLoggedIn));

    // Hero CTA anchor text swap is handled by the class toggles above
}

/* ═══════════════════════════════════════════════════════════
   AUTH OVERLAY
   ═══════════════════════════════════════════════════════════ */

function initAuth() {
    const overlay = document.getElementById('auth-overlay');
    const signoutBtn = document.getElementById('signout-btn');
    const authMessage = document.getElementById('auth-message');
    const signupForm = document.getElementById('signup-form');
    const signinForm = document.getElementById('signin-form');

    // Tab switching
    const tabSigninBtn = document.getElementById('tab-signin-btn');
    const tabSignupBtn = document.getElementById('tab-signup-btn');
    const tabSignin = document.getElementById('tab-signin');
    const tabSignup = document.getElementById('tab-signup');

    // Nav sign-in CTAs (hero + navbar) that open the overlay
    const navSigninCta = document.getElementById('nav-signin-cta');
    const heroSigninCta = document.getElementById('hero-signin-cta');

    function switchTab(tab) {
        const isSignin = tab === 'signin';
        tabSigninBtn.classList.toggle('active', isSignin);
        tabSignupBtn.classList.toggle('active', !isSignin);
        tabSignin.classList.toggle('active', isSignin);
        tabSignup.classList.toggle('active', !isSignin);
        tabSigninBtn.setAttribute('aria-selected', String(isSignin));
        tabSignupBtn.setAttribute('aria-selected', String(!isSignin));
        authMessage.textContent = '';
    }

    tabSigninBtn.addEventListener('click', () => switchTab('signin'));
    tabSignupBtn.addEventListener('click', () => switchTab('signup'));

    /** Open the auth overlay (e.g. when a guest clicks "Sign in"). */
    function openOverlay() {
        overlay?.classList.remove('hidden');
        setTimeout(() => document.getElementById('signin-username')?.focus(), 50);
    }

    navSigninCta?.addEventListener('click', openOverlay);
    heroSigninCta?.addEventListener('click', openOverlay);

    // Close overlay when clicking the dark backdrop (outside the card itself)
    overlay?.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
    });

    /**
     * Apply session state to the UI.
     * The overlay is NEVER forced open here — guests see the homepage
     * and choose to sign in via a CTA.  The overlay only closes
     * automatically once a valid session is established.
     */
    function checkSession() {
        if (getSession()) {
            overlay.classList.add('hidden');
        }
        // No else — guests land on the hero; overlay stays closed until they click Sign in.
        applyAuthState();
    }

    // Sign-up handler
    signupForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;

        if (!username || !email || !password) {
            authMessage.textContent = 'Please fill in all fields.';
            return;
        }
        if (password.length < 6) {
            authMessage.textContent = 'Password must be at least 6 characters.';
            return;
        }

        const users = getUsers();
        if (users[username]) {
            authMessage.textContent = 'Username already taken. Try signing in.';
            return;
        }

        // Store credentials (plain text — demo only; use hashing in production)
        users[username] = { email, password, createdAt: new Date().toISOString() };
        saveUsers(users);
        setSession(username);
        checkSession();
    });

    // Sign-in handler
    signinForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('signin-username').value.trim();
        const password = document.getElementById('signin-password').value;

        const users = getUsers();
        if (!users[username] || users[username].password !== password) {
            authMessage.textContent = 'Incorrect username or password.';
            return;
        }

        setSession(username);
        checkSession();
    });

    // Sign-out handler
    signoutBtn?.addEventListener('click', () => {
        clearSession();
        // Lock the budget forms again visually
        const wrapper = document.getElementById('budget-forms-wrapper');
        wrapper?.classList.remove('unlocked');
        wrapper?.classList.add('locked');
        document.getElementById('project-badge')?.classList.remove('visible');
        checkSession();
    });

    // Trap focus inside overlay when visible (basic implementation)
    overlay?.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || overlay.classList.contains('hidden')) return;
        const focusable = overlay.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
        }
    });

    checkSession();
}

/* ═══════════════════════════════════════════════════════════
   PROJECT FORM — Save & Load
   + Auto-save on project-name input (debounced)
   ═══════════════════════════════════════════════════════════ */

/** Fields that belong to the project setup form. */
const PROJECT_FIELDS = [
    'budget-name', 'sponsor-name', 'protocol-name',
    'study-name', 'disease-name', 'category-name', 'initial-date',
];

const TRACKED_PROJECT_INPUTS = '#project-form input, #finance-form input, #fixed-cost-form input, #variable-cost-form input';

function initProjectForm() {
    const form = document.getElementById('project-form');
    const loadBtn = document.getElementById('load-project-btn');
    const statusEl = document.getElementById('project-status');
    const badge = document.getElementById('project-badge');
    const badgeName = document.getElementById('project-badge-name');
    const formsWrapper = document.getElementById('budget-forms-wrapper');
    const budgetNameEl = document.getElementById('budget-name');
    const autoSaveInd = document.getElementById('autosave-indicator');

    /** Unlock the budget forms section. */
    function unlockForms(projectName) {
        formsWrapper?.classList.remove('locked');
        formsWrapper?.classList.add('unlocked');
        if (badge) badge.classList.add('visible');
        if (badgeName) badgeName.textContent = `Saved: ${projectName}`;
    }

    /** Return an object with all tracked form input values. */
    function collectFormValues() {
        const values = {};
        document.querySelectorAll(TRACKED_PROJECT_INPUTS).forEach(input => {
            if (!input.id) return;
            values[input.id] = input.value;
        });
        return values;
    }

    /** Persist the project object to localStorage. */
    function persistProject(projectName) {
        const project = {};
        PROJECT_FIELDS.forEach(id => {
            const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            project[key] = document.getElementById(id)?.value.trim() ?? '';
        });
        project.savedAt = new Date().toISOString();
        project.formValues = collectFormValues();
        localStorage.setItem(STORAGE_KEYS.PROJECT, JSON.stringify(project));
        return project;
    }

    /** Check on page load whether a project was already saved. */
    function checkExistingProject() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECT) ?? 'null');
            if (saved?.budgetName) unlockForms(saved.budgetName);
        } catch { /* no saved project */ }
    }

    /* ── Auto-save when project name is entered ─── */
    const autoSave = debounce(() => {
        const name = budgetNameEl?.value.trim();
        if (!name) return; // do nothing if field is empty

        if (autoSaveInd) {
            autoSaveInd.textContent = 'Saving…';
            autoSaveInd.className = 'autosave-indicator saving';
        }

        persistProject(name);
        unlockForms(name);
        hideStatus(statusEl);

        if (autoSaveInd) {
            autoSaveInd.textContent = '✓ Project auto-saved';
            autoSaveInd.className = 'autosave-indicator saved';
            // Fade the message out after a moment
            setTimeout(() => {
                if (autoSaveInd.classList.contains('saved')) {
                    autoSaveInd.textContent = '';
                    autoSaveInd.className = 'autosave-indicator';
                }
            }, 3000);
        }
    }, 600);

    document.querySelectorAll(TRACKED_PROJECT_INPUTS).forEach(input => {
        input.addEventListener('input', autoSave);
    });

    // Manual save (full form validation)
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        hideStatus(statusEl);

        const missing = PROJECT_FIELDS.filter(id => !document.getElementById(id)?.value.trim());
        if (missing.length) {
            showStatus(statusEl, 'Please fill in all required fields.', true);
            document.getElementById(missing[0])?.focus();
            return;
        }

        const project = persistProject(document.getElementById('budget-name').value.trim());
        showStatus(statusEl, `Project "${project.budgetName}" saved successfully.`);
        unlockForms(project.budgetName);

        // Clear auto-save indicator since user just manually saved
        if (autoSaveInd) { autoSaveInd.textContent = ''; autoSaveInd.className = 'autosave-indicator'; }
    });

    function restoreSavedProject(saved) {
        if (!saved) return;

        PROJECT_FIELDS.forEach(id => {
            const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            const el = document.getElementById(id);
            if (el && saved[key] !== undefined) el.value = saved[key];
        });

        if (saved.formValues && typeof saved.formValues === 'object') {
            Object.entries(saved.formValues).forEach(([id, value]) => {
                const input = document.getElementById(id);
                if (input) input.value = value;
            });
        }

        unlockForms(saved.budgetName || 'Project');
        document.querySelectorAll('#finance-form input, #fixed-cost-form input, #variable-cost-form input')
            .forEach(input => input.dispatchEvent(new Event('input', { bubbles: true })));
    }

    // Load project
    loadBtn?.addEventListener('click', () => {
        hideStatus(statusEl);
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECT) ?? 'null');
            if (!saved) {
                showStatus(statusEl, 'No saved project found.', true);
                return;
            }

            restoreSavedProject(saved);
            const savedDate = saved.savedAt ? new Date(saved.savedAt).toLocaleString() : '—';
            showStatus(statusEl, `Loaded "${saved.budgetName}" (last saved ${savedDate}).`);
        } catch {
            showStatus(statusEl, 'Could not load project — data may be corrupted.', true);
        }
    });

    function checkExistingProject() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECT) ?? 'null');
            if (saved?.budgetName) {
                restoreSavedProject(saved);
            }
        } catch { /* no saved project */ }
    }

    checkExistingProject();
}

/* ═══════════════════════════════════════════════════════════
   FINANCE OVERVIEW FORM — live summary
   ═══════════════════════════════════════════════════════════ */

function initFinanceForm() {
    const form = document.getElementById('finance-form');
    const summary = document.getElementById('finance-summary');
    const inputs = form?.querySelectorAll('input') ?? [];

    function renderSummary() {
        const start = document.getElementById('enrollment-start')?.value;
        const end = document.getElementById('close-out-date')?.value;
        const low = parseInt(document.getElementById('patients-low')?.value) || 0;
        const high = parseInt(document.getElementById('patients-high')?.value) || 0;
        const sfRate = parseFloat(document.getElementById('screen-fail-rate')?.value) || 0;
        const overhead = parseFloat(document.getElementById('overhead-rate')?.value) || 0;
        const inflation = parseFloat(document.getElementById('inflation-rate')?.value) || 0;

        if (!start && !end && !low && !high) { summary.innerHTML = ''; return; }

        const expectedLow = Math.round(low * (1 - sfRate / 100));
        const expectedHigh = Math.round(high * (1 - sfRate / 100));
        const midPatients = Math.round((expectedLow + expectedHigh) / 2);

        summary.innerHTML = `
      <dl>
        <dt>Enrollment window</dt>
        <dd>${start || '—'} → ${end || '—'}</dd>
        <dt>Patient range (enrolled)</dt>
        <dd>${low} – ${high}</dd>
        <dt>After screen failure (${sfRate}%)</dt>
        <dd>${expectedLow} – ${expectedHigh}</dd>
        <dt>Mid-range patients (used for estimates)</dt>
        <dd>${midPatients}</dd>
        <dt>Overhead rate</dt>
        <dd>${overhead.toFixed(2)}%</dd>
        <dt>Annual inflation</dt>
        <dd>${inflation.toFixed(2)}%</dd>
      </dl>
    `;

        updateBudgetOverview();
    }

    inputs.forEach(input => input.addEventListener('input', renderSummary));

    // Prevent native submit — form is 100% live/reactive
    form?.addEventListener('submit', (e) => e.preventDefault());
}

/* ═══════════════════════════════════════════════════════════
FIXED COST FORM — live totals for projected-cost | projected-budget | actual-cost | actual-budget
═══════════════════════════════════════════════════════════ */
function initFixedCostForm() {
    const form = document.getElementById('fixed-cost-form');
    function update() {
        // Sum all four columns
        const projectedCostTotal = sumInputs('.fixed-projected-cost-input');
        const projectedBudgetTotal = sumInputs('.fixed-projected-budget-input');
        const actualCostTotal = sumInputs('.fixed-cost-input');
        const actualBudgetTotal = sumInputs('.fixed-budget-input');

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatUSD(val); };
        set('fixed-projected-cost-total', projectedCostTotal);
        set('fixed-projected-budget-total', projectedBudgetTotal);
        set('fixed-cost-total', actualCostTotal);
        set('fixed-budget-total', actualBudgetTotal);

        updateBudgetOverview();
    }

    // Listen on all four column-types
    form?.querySelectorAll('.fixed-projected-cost-input, .fixed-projected-budget-input, .fixed-cost-input, .fixed-budget-input')
        .forEach(el => el.addEventListener('input', update));
    form?.addEventListener('submit', (e) => e.preventDefault());
}

/* ═══════════════════════════════════════════════════════════
VARIABLE COST FORM — live totals for projected-cost | projected-budget | actual-cost | actual-budget
═══════════════════════════════════════════════════════════ */
function initVariableCostForm() {
    const form = document.getElementById('variable-cost-form');
    function update() {
        // Sum all four columns
        const projectedCostTotal = sumInputs('.variable-projected-cost-input');
        const projectedBudgetTotal = sumInputs('.variable-projected-budget-input');
        const actualCostTotal = sumInputs('.variable-cost-input');
        const actualBudgetTotal = sumInputs('.variable-budget-input');

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatUSD(val); };
        set('variable-projected-cost-total', projectedCostTotal);
        set('variable-projected-budget-total', projectedBudgetTotal);
        set('variable-cost-total', actualCostTotal);
        set('variable-budget-total', actualBudgetTotal);

        updateBudgetOverview();
    }

    // Listen on all four column-types
    form?.querySelectorAll('.variable-projected-cost-input, .variable-projected-budget-input, .variable-cost-input, .variable-budget-input')
        .forEach(el => el.addEventListener('input', update));
    form?.addEventListener('submit', (e) => e.preventDefault());
}

/* ═══════════════════════════════════════════════════════════
BUDGET OVERVIEW — combined totals
Called by every form that can change the bottom-line numbers.
═══════════════════════════════════════════════════════════ */
function updateBudgetOverview() {
    // ── Projected Cost column ──
    const fixedProjectedCost = sumInputs('.fixed-projected-cost-input');
    const variableProjectedCost = sumInputs('.variable-projected-cost-input');

    // ── Projected Budget column ──
    const fixedProjectedBudget = sumInputs('.fixed-projected-budget-input');
    const variableProjectedBudget = sumInputs('.variable-projected-budget-input');

    // ── Actual Cost column ──
    const fixedActualCost = sumInputs('.fixed-cost-input');
    const variableActualCost = sumInputs('.variable-cost-input');

    // ── Actual Budget column ──
    const fixedActualBudget = sumInputs('.fixed-budget-input');
    const variableActualBudget = sumInputs('.variable-budget-input');

    const overhead = parseFloat(document.getElementById('overhead-rate')?.value) || 0;
    const patientsLow = parseInt(document.getElementById('patients-low')?.value) || 0;
    const patientsHigh = parseInt(document.getElementById('patients-high')?.value) || 0;
    const sfRate = parseFloat(document.getElementById('screen-fail-rate')?.value) || 0;
    const midPatients = Math.round(((patientsLow + patientsHigh) / 2) * (1 - sfRate / 100));

    // Totals using the Projected Budget column for the overview and projection
    const variableProjectedTotal = variableProjectedBudget * midPatients;
    const fixedForOverview = fixedProjectedBudget || fixedProjectedCost;   // fall back to cost if budget not entered
    const varForOverview = variableProjectedTotal || (variableProjectedCost * midPatients);
    const subtotal = fixedForOverview + varForOverview;
    const overheadAmt = subtotal * (overhead / 100);
    const grandTotal = subtotal + overheadAmt;

    // Actuals grand total (no overhead applied — actuals are real spend)
    const variableActualTotal = variableActualBudget * midPatients;
    const actualsGrand = fixedActualBudget + variableActualTotal;

    // ── Update text elements ──
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatUSD(val); };
    set('ov-fixed', fixedForOverview);
    set('ov-variable', varForOverview);
    set('ov-overhead', overheadAmt);
    set('ov-total', grandTotal);
    set('ov-actuals-total', actualsGrand);

    // ── Update charts ──
    const inflation = parseFloat(document.getElementById('inflation-rate')?.value) || 0;
    updateProjectionChart(grandTotal, inflation);
    updateActualsChart(grandTotal, actualsGrand);
}

/* ═══════════════════════════════════════════════════════════
DYNAMIC BUDGET PROJECTION CHART (Chart.js)
Auto-updates on every input change via updateBudgetOverview.
═══════════════════════════════════════════════════════════ */
let budgetChartInstance = null;
/** Build year-by-year totals with compound inflation. */
function buildProjectionData(baseTotal, inflation) {
    const years = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
    const rate = 1 + (parseFloat(inflation) || 0) / 100;
    const totals = years.map((_, i) => +(baseTotal * Math.pow(rate, i)).toFixed(2));
    return { years, totals };
}
function initProjectionChart() {
    const canvas = document.getElementById('budgetChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    budgetChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
            datasets: [
                {
                    label: 'Projected budget ($)',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(54, 176, 235, 0.18)',
                    borderColor: '#36B0EB',
                    borderWidth: 2,
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ' ' + formatUSD(ctx.raw),
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (val) => formatUSD(val),
                        font: { family: "'DM Mono', monospace", size: 11 },
                        color: '#666',
                    },
                    grid: { color: '#e8e8e8' },
                },
                x: {
                    ticks: { font: { size: 12 }, color: '#444' },
                    grid: { display: false },
                },
            },
        },
    });
}
/** Update projection chart whenever inputs change. */
function updateProjectionChart(baseTotal, inflation) {
    if (!budgetChartInstance) return;
    const { totals } = buildProjectionData(baseTotal, inflation);
    budgetChartInstance.data.datasets[0].data = totals;
    budgetChartInstance.update();
}

/* ═══════════════════════════════════════════════════════════
BUDGET VS ACTUALS CHART (Chart.js)
Compares the current-year budget total with actuals.
═══════════════════════════════════════════════════════════ */
let actualsChartInstance = null;
function initActualsChart() {
    const canvas = document.getElementById('actualsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    actualsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Fixed Costs', 'Variable Costs', 'Grand Total'],
            datasets: [
                {
                    label: 'Projected',
                    data: [0, 0, 0],
                    backgroundColor: 'rgba(54, 176, 235, 0.22)',
                    borderColor: '#36B0EB',
                    borderWidth: 2,
                    borderRadius: 4,
                },
                {
                    label: 'Actuals',
                    data: [0, 0, 0],
                    backgroundColor: 'rgba(240, 125, 74, 0.22)',
                    borderColor: '#F07D4A',
                    borderWidth: 2,
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            animation: { duration: 300 },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        font: { family: "'DM Sans', sans-serif", size: 12 },
                        color: '#444',
                        boxWidth: 14,
                    },
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${formatUSD(ctx.raw)}`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (val) => formatUSD(val),
                        font: { family: "'DM Mono', monospace", size: 11 },
                        color: '#666',
                    },
                    grid: { color: '#e8e8e8' },
                },
                x: {
                    ticks: { font: { size: 12 }, color: '#444' },
                    grid: { display: false },
                },
            },
        },
    });
}
/** Update actuals chart whenever inputs change. */
function updateActualsChart(budgetGrand, actualsGrand) {
    if (!actualsChartInstance) return;

    const overhead = parseFloat(document.getElementById('overhead-rate')?.value) || 0;
    const patientsLow = parseInt(document.getElementById('patients-low')?.value) || 0;
    const patientsHigh = parseInt(document.getElementById('patients-high')?.value) || 0;
    const sfRate = parseFloat(document.getElementById('screen-fail-rate')?.value) || 0;
    const midPatients = Math.round(((patientsLow + patientsHigh) / 2) * (1 - sfRate / 100));

    // Get values from all four columns
    const fixedProjectedBudget = sumInputs('.fixed-projected-budget-input');
    const variableProjectedBudget = sumInputs('.variable-projected-budget-input') * midPatients;
    const fixedActualBudget = sumInputs('.fixed-budget-input');
    const variableActualBudget = sumInputs('.variable-budget-input') * midPatients;

    actualsChartInstance.data.datasets[0].data = [fixedProjectedBudget, variableProjectedBudget, budgetGrand];
    actualsChartInstance.data.datasets[1].data = [fixedActualBudget, variableActualBudget, actualsGrand];
    actualsChartInstance.update();
}

/* ═══════════════════════════════════════════════════════════
ENROLLMENT DATE — set minimum to today
═══════════════════════════════════════════════════════════ */
function setDateMin() {
    const today = new Date().toISOString().split('T')[0];
    const el = document.getElementById('enrollment-start');
    if (el) el.min = today;
}

/* ═══════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initProjectForm();
    initFinanceForm();
    initFixedCostForm();
    initVariableCostForm();
    initProjectionChart();
    initActualsChart();
    setDateMin();
});
