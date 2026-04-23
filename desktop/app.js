import { DoFormyEngine } from '../shared/engine.js';

let currentData = null;

async function bootstrapDesktopData() {
    DoFormyEngine.initSync();

    const localRaw = localStorage.getItem('doformy_data');
    let localData = null;
    if (localRaw) {
        try {
            localData = JSON.parse(localRaw);
        } catch (e) {
            localData = null;
        }
    }

    try {
        const serverData = await DoFormyEngine.getData({ fallbackToLocal: false });
        const normalizedServer = DoFormyEngine.normalizeData(serverData);
        const normalizedLocal = DoFormyEngine.normalizeData(localData || DoFormyEngine.getInitialData());

        const serverReset = Number(normalizedServer.user.resetVersion) || 0;
        const localReset = Number(normalizedLocal.user.resetVersion) || 0;

        if (serverReset > localReset) {
            // Server DB was reset; prevent desktop from re-uploading old local test data.
            localStorage.removeItem('doformy_data');
            localStorage.setItem('doformy_data', JSON.stringify(normalizedServer));
            return normalizedServer;
        }

        const merged = DoFormyEngine.mergeData(normalizedLocal, normalizedServer);
        localStorage.setItem('doformy_data', JSON.stringify(merged));
        return merged;
    } catch (e) {
        // Offline: keep local (or initial) data.
        return localData ? DoFormyEngine.normalizeData(localData) : DoFormyEngine.getInitialData();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DoFormy: Desktop inicializácia...');
    initDesktop();
});

async function initDesktop() {
    try {
        currentData = await bootstrapDesktopData();

        refreshUI();

        console.log('DoFormy: Synchronizujem so serverom...');
        currentData = await DoFormyEngine.syncNow(currentData);
        refreshUI();

        renderFullPlan(currentData.user.levelName);
        initSyncButton();
        setupQR();
        setupQuit();
        setupNavigation();
        setupHardReset();

        setInterval(async () => {
            if (!navigator.onLine || DoFormyEngine.isSyncing) return;
            try {
                // Desktop v pollingu iba sťahuje dáta (Vizualizácia)
                const serverData = await DoFormyEngine.getData({ fallbackToLocal: false });
                if (serverData && serverData.user) {
                    const serverReset = Number(serverData.user.resetVersion) || 0;
                    const localReset = Number(currentData.user.resetVersion) || 0;

                    if (serverReset > localReset) {
                        console.log('DoFormy: Detegovaný reset dát na serveri (polling).');
                        currentData = serverData;
                    } else {
                        currentData = DoFormyEngine.mergeData(currentData, serverData);
                    }
                    
                    localStorage.setItem('doformy_data', JSON.stringify(currentData));
                    refreshUI();
                }
            } catch (e) {
                // polling má byť tichý
            }
        }, 2000);
    } catch (e) {
        console.error('DoFormy: Chyba pri inicializácii', e);
    }
}

let lastRenderedHash = '';

function refreshUI() {
    if (!currentData) return;
    updateSidebar(currentData);
    renderKPIBar(currentData);
    renderSidebarWorkout(currentData);
    
    // Výpočet hashu dát pre kontrolu zmien (zohľadňuje používateľa, počet dní aj časy aktualizácií)
    const historyEntries = Object.values(currentData.history);
    const currentHash = JSON.stringify(currentData.user) + 
                       historyEntries.length + 
                       historyEntries.reduce((acc, r) => acc + (r.last_updated || 0), 0);
    
    if (currentHash !== lastRenderedHash) {
        renderCharts(currentData);
        renderConsistencyGrid(currentData);
        lastRenderedHash = currentHash;
    }
    
    renderMilestone(currentData);
}

async function syncDesktopChange(applyChange) {
    applyChange();
    currentData = await DoFormyEngine.saveData(currentData, false);
    refreshUI();
    // Desktop synch je pasívny v pollingu, ale pri manuálnej zmene urobíme aj POST
    currentData = await DoFormyEngine.syncNow(currentData);
    refreshUI();
}

function initSyncButton() {
    const btnSync = document.getElementById('btn-sync');
    if (!btnSync) return;

    window.addEventListener('syncStart', () => {
        btnSync.textContent = '⏳';
    });

    window.addEventListener('syncSuccess', (e) => {
        btnSync.textContent = 'OK';
        setTimeout(() => {
            btnSync.textContent = '🔄';
        }, 1500);
    });

    window.addEventListener('syncError', (e) => {
        btnSync.textContent = 'ERR';
        setTimeout(() => {
            btnSync.textContent = '🔄';
        }, 2000);
    });

    btnSync.onclick = async () => {
        try {
            currentData = await DoFormyEngine.syncNow(currentData);
            refreshUI();
        } catch (e) {
            console.error('Sync failed', e);
        }
    };
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    navItems.forEach(item => {
        item.onclick = () => {
            const view = item.dataset.view;

            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.view-section').forEach(section => {
                section.style.display = 'none';
            });

            const targetView = document.getElementById(`view-${view}`);
            if (targetView) targetView.style.display = 'block';

            document.getElementById('main-title').textContent = item.textContent;
        };
    });
}

function renderFullPlan(currentLevelName) {
    const container = document.getElementById('full-plan-container');
    if (!container) return;

    container.innerHTML = '';

    DoFormyEngine.LEVELS.forEach(level => {
        const config = DoFormyEngine.WORKOUT_DATABASE[level.name];
        const isActive = level.name === currentLevelName;
        const phaseDiv = document.createElement('div');
        phaseDiv.className = `phase-card ${isActive ? 'active-phase' : ''}`;

        let html = `
            <h4>${level.name} ${isActive ? '<span class="badge">Aktuálna</span>' : ''}</h4>
            <p style="color:var(--muted); margin-bottom: 1rem;">${level.desc}</p>
            <p><strong>Tempo:</strong> ${config.tempo} | <strong>Série:</strong> ${config.sets}</p>
            <table class="plan-table">
                <thead>
                    <tr><th>Cvik</th><th>Opakovania</th></tr>
                </thead>
                <tbody>
        `;

        config.exercises.forEach(ex => {
            html += `<tr><td>${ex.name}</td><td>${ex.reps}</td></tr>`;
        });

        html += '</tbody></table>';
        phaseDiv.innerHTML = html;
        container.appendChild(phaseDiv);
    });
}

function setupQuit() {
    const btnQuit = document.getElementById('btn-quit');
    if (!btnQuit) return;

    btnQuit.onclick = async () => {
        if (confirm('Naozaj chcete ukončiť DoFormy a vypnúť server?')) {
            try {
                await fetch('/api/quit', { method: 'POST' });
                window.close();
                document.body.innerHTML = "<div style='display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:sans-serif;background:#F0F4F2;'><h1>DoFormy bol ukončený.</h1><p>Server a CMD okno by mali byť teraz zatvorené.</p></div>";
            } catch (e) {
                console.error('Chyba pri ukončovaní', e);
            }
        }
    };
}

function setupQR() {
    const modal = document.getElementById('qr-modal');
    const btn = document.getElementById('btn-show-qr');
    const span = document.getElementsByClassName('close-modal')[0];
    const qrContainer = document.getElementById('qrcode');

    if (!btn || !modal) return;

    const githubPagesUrl = 'https://neophite2023.github.io/DoFormy/mobile/index.html';
    const isLoopbackHost = host => host === 'localhost' || host === '127.0.0.1' || host === '::1';
    let syncBaseUrl = null;

    try {
        const current = new URL(window.location.href);
        if (!isLoopbackHost((current.hostname || '').toLowerCase())) {
            syncBaseUrl = current.origin;
        }
    } catch (e) {
        syncBaseUrl = null;
    }

    if (!syncBaseUrl) {
        const storedApi = localStorage.getItem('projecttracker_sync_base_url') || localStorage.getItem('doformy_api_url') || '';
        const withoutApi = storedApi.replace(/\/api$/, '');
        try {
            const stored = new URL(withoutApi);
            if (!isLoopbackHost((stored.hostname || '').toLowerCase())) {
                syncBaseUrl = stored.origin;
            }
        } catch (e) {
            syncBaseUrl = null;
        }
    }

    const qrText = syncBaseUrl
        ? `${githubPagesUrl}?sync=${encodeURIComponent(syncBaseUrl)}`
        : githubPagesUrl;

    btn.onclick = () => {
        qrContainer.innerHTML = '';
        try {
            new QRCode(qrContainer, {
                text: qrText,
                width: 200,
                height: 200,
                colorDark: '#2C3E50',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
            modal.style.display = 'block';
        } catch (e) {
            console.error('DoFormy: Chyba pri generovaní QR kódu', e);
        }
    };

    if (span) {
        span.onclick = () => {
            modal.style.display = 'none';
        };
    }

    window.onclick = event => {
        if (event.target === modal) modal.style.display = 'none';
    };
}

function updateSidebar(data) {
    const elLevel = document.getElementById('user-level-name');
    if (elLevel) elLevel.textContent = data.user.levelName || 'Fáza 1: Základy';

    const levels = DoFormyEngine.LEVELS;
    const currentIndex = levels.findIndex(level => level.name === data.user.levelName);
    if (currentIndex === -1) return;

    const nextLevel = levels[currentIndex + 1] || levels[currentIndex];
    const currentMin = levels[currentIndex].minExp;
    const nextMin = nextLevel.minExp;
    const expInCurrent = data.user.exp - currentMin;
    const range = (nextMin - currentMin) || 1;
    const percent = Math.min((expInCurrent / range) * 100, 100);

    const elFill = document.getElementById('exp-bar-fill');
    if (elFill) elFill.style.width = `${percent}%`;

    const elExpText = document.getElementById('exp-text');
    if (elExpText) elExpText.textContent = `${data.user.exp} XP (Fáza ${currentIndex + 1})`;
}

function renderKPIBar(data) {
    const todayStr = DoFormyEngine.getTodayStr();
    const stats = data.history[todayStr] || { steps: 0, water: 0, weight: null };
    const elDate = document.getElementById('current-date');

    if (elDate) {
        elDate.textContent = new Date().toLocaleDateString('sk-SK', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
    
    // Steps KPI
    const stepsGoal = data.user.stepsGoal || 6000;
    document.getElementById('kpi-steps-val').textContent = `${stats.steps || 0} / ${stepsGoal}`;
    
    // Water KPI
    const latestWeight = DoFormyEngine.getLatestWeight(data);
    const waterGoal = DoFormyEngine.getWaterGoal(latestWeight);
    document.getElementById('kpi-water-val').textContent = `${stats.water || 0} / ${waterGoal} ml`;
    
    // Weight KPI
    const weightVal = document.getElementById('kpi-weight-val');
    const weightInput = document.getElementById('desktop-weight-input');
    if (latestWeight) {
        weightVal.textContent = `${Number(latestWeight).toFixed(1)} kg`;
        if (document.activeElement !== weightInput) {
            weightInput.value = Number(latestWeight).toFixed(1);
        }
    }

    // Bind actions
    document.getElementById('btn-desktop-water-add').onclick = async () => {
        await syncDesktopChange(() => {
            DoFormyEngine.logWater(currentData, todayStr, 250);
        });
    };

    document.getElementById('btn-desktop-weight-save').onclick = async () => {
        const newWeight = parseFloat(weightInput.value);
        if (newWeight && !isNaN(newWeight) && newWeight > 0) {
            await syncDesktopChange(() => {
                DoFormyEngine.logWeight(currentData, todayStr, newWeight);
            });
        }
    };
}

function renderSidebarWorkout(data) {
    const content = document.getElementById('sidebar-workout-content');
    const workout = DoFormyEngine.getTodayWorkout(data);
    
    if (workout) {
        let html = `<p style="margin-bottom:0.5rem;"><strong>${workout.title}</strong></p><ul>`;
        workout.exercises.forEach(ex => {
            html += `<li>${ex.name} (${ex.sets}x${ex.reps})</li>`;
        });
        html += '</ul>';
        content.innerHTML = html;
    } else {
        content.innerHTML = '<p class="muted">Dnes je deň oddychu. Sústreď sa na regeneráciu.</p>';
    }
}

let charts = { weight: null, steps: null, water: null };

function getLocalDateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderCharts(data) {
    renderWeightChartLong(data);
    renderStepsChart(data);
    renderWaterChart(data);
}

function renderWeightChartLong(data) {
    const ctx = document.getElementById('chart-weight-long');
    if (!ctx) return;

    const history = DoFormyEngine.getWeightHistory(data).slice(-30);
    if (history.length === 0) return;

    if (charts.weight) charts.weight.destroy();

    const trendTag = document.getElementById('weight-trend-tag');
    if (history.length >= 2) {
        const diff = history[history.length - 1].weight - history[0].weight;
        trendTag.textContent = `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg (30d)`;
        trendTag.style.background = diff <= 0 ? '#E8F8EF' : '#FDEDEC';
        trendTag.style.color = diff <= 0 ? '#2ECC71' : '#E74C3C';
    }

    charts.weight = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => h.date.slice(5)),
            datasets: [{
                label: 'Váha',
                data: history.map(h => h.weight),
                borderColor: '#2C3E50',
                backgroundColor: 'rgba(44, 62, 80, 0.05)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#2C3E50'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, grid: { color: '#F0F4F2' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderStepsChart(data) {
    const ctx = document.getElementById('chart-steps-bar');
    if (!ctx) return;

    const labels = [];
    const stepData = [];
    const today = new Date();
    const goal = data.user.stepsGoal || 6000;

    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dStr = getLocalDateKey(d);
        labels.push(d.toLocaleDateString('sk-SK', { weekday: 'short' }));
        stepData.push(data.history[dStr]?.steps || 0);
    }

    if (charts.steps) charts.steps.destroy();
    charts.steps = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: stepData,
                backgroundColor: stepData.map(v => v >= goal ? '#2ECC71' : '#ECF0F1'),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderWaterChart(data) {
    const ctx = document.getElementById('chart-water-area');
    if (!ctx) return;

    const labels = [];
    const waterData = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dStr = getLocalDateKey(d);
        labels.push(d.toLocaleDateString('sk-SK', { weekday: 'short' }));
        waterData.push(data.history[dStr]?.water || 0);
    }

    if (charts.water) charts.water.destroy();
    charts.water = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: waterData,
                borderColor: '#3498DB',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderConsistencyGrid(data) {
    const container = document.getElementById('consistency-grid');
    if (!container) return;
    container.innerHTML = '';

    const today = new Date();
    const goal = data.user.stepsGoal || 6000;

    // Last 14 days grid
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dStr = getLocalDateKey(d);
        const stats = data.history[dStr] || { steps: 0, water: 0, workout: [] };
        
        let score = 0;
        if ((stats.steps || 0) >= goal) score++;
        if ((stats.water || 0) >= 2000) score++;
        if (stats.workout && stats.workout.length > 0) score += 2;

        const dayEl = document.createElement('div');
        dayEl.className = `consistency-day level-${score}`;
        dayEl.setAttribute('data-date', `${d.toLocaleDateString('sk-SK')} (${score} body)`);
        container.appendChild(dayEl);
    }
}

function renderMilestone(data) {
    const currentIndex = DoFormyEngine.LEVELS.findIndex(level => level.name === data.user.levelName);
    const next = DoFormyEngine.LEVELS[currentIndex + 1];
    const elMilestone = document.getElementById('milestone-desc');
    if (!elMilestone) return;

    if (next) {
        elMilestone.textContent = `Získajte ešte ${next.minExp - data.user.exp} XP, aby ste sa stali ${next.name}.`;
    } else {
        elMilestone.textContent = 'Dosiahli ste vrchol. Ste Skala.';
    }
}

function setupHardReset() {
    const btn = document.getElementById('btn-desktop-hard-reset');
    if (!btn) return;
    btn.onclick = () => {
        if (confirm('Naozaj chcete vymazať celú lokálnu históriu na tomto počítači? Dáta sa znovu stiahnu zo servera.')) {
            localStorage.removeItem('doformy_data');
            location.reload();
        }
    };
}
