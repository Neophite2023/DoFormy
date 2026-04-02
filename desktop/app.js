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
        setupQR();
        setupQuit();
        setupNavigation();

        setInterval(async () => {
            if (!navigator.onLine || DoFormyEngine.isSyncing) return;
            try {
                currentData = await DoFormyEngine.syncNow(currentData);
                refreshUI();
            } catch (e) {
                // polling má byť tichý
            }
        }, 2000);
    } catch (e) {
        console.error('DoFormy: Chyba pri inicializácii', e);
    }
}

function refreshUI() {
    if (!currentData) return;
    updateSidebar(currentData);
    updateMain(currentData);
}

async function syncDesktopChange(applyChange) {
    applyChange();
    currentData = await DoFormyEngine.saveData(currentData, false);
    refreshUI();
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

    const currentUrl = window.location.href;
    const githubPagesUrl = 'https://neophite2023.github.io/DoFormy/mobile/index.html';
    const qrText = currentUrl.includes('localhost')
        ? githubPagesUrl
        : currentUrl.replace('desktop/index.html', 'mobile/index.html');

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

function updateMain(data) {
    const today = new Date();
    const todayStr = DoFormyEngine.getTodayStr();
    const stats = data.history[todayStr] || { workout: [], steps: 0, habit: false, weight: null, water: 0 };
    const elDate = document.getElementById('current-date');

    if (elDate) {
        elDate.textContent = today.toLocaleDateString('sk-SK', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    renderTodayWidgets(todayStr, stats);
    renderWeeklyStats(data, today);
    renderMilestone(data);
}

function renderTodayWidgets(todayStr, stats) {
    const workout = DoFormyEngine.getTodayWorkout(currentData);
    const workoutDesc = document.getElementById('today-workout-desc');

    if (workout) {
        let html = `<strong>${workout.title}</strong><br>Tempo: ${workout.tempo}<br><ul>`;
        workout.exercises.forEach(ex => {
            html += `<li>${ex.name} - ${ex.sets}x${ex.reps}</li>`;
        });
        html += '</ul>';
        workoutDesc.innerHTML = html;
    } else {
        workoutDesc.innerHTML = '<strong>Regenerácia</strong><br>Dnes oddychový deň';
    }

    const latestWeight = DoFormyEngine.getLatestWeight(currentData);
    const waterGoal = DoFormyEngine.getWaterGoal(latestWeight);
    const currentWater = stats.water || 0;
    document.getElementById('today-water-desc').textContent = `${currentWater} / ${waterGoal} ml`;
    document.getElementById('water-bar-fill').style.width = `${Math.min((currentWater / waterGoal) * 100, 100)}%`;

    const weightInput = document.getElementById('desktop-weight-input');
    if (latestWeight) {
        const displayWeight = Number(latestWeight).toFixed(1);
        document.getElementById('today-weight-desc').textContent = `${displayWeight} kg`;
        if (document.activeElement !== weightInput) {
            weightInput.value = displayWeight;
        }
    } else {
        document.getElementById('today-weight-desc').textContent = '-- kg';
    }

    document.getElementById('btn-desktop-water-add').onclick = async () => {
        try {
            await syncDesktopChange(() => {
                DoFormyEngine.logWater(currentData, todayStr, 250);
            });
        } catch (e) {
            console.error('Desktop water sync failed', e);
        }
    };

    const btnSaveWeight = document.getElementById('btn-desktop-weight-save');
    btnSaveWeight.onclick = async () => {
        const newWeight = parseFloat(weightInput.value);
        if (newWeight && !isNaN(newWeight) && newWeight > 0) {
            btnSaveWeight.textContent = '...';
            try {
                await syncDesktopChange(() => {
                    DoFormyEngine.logWeight(currentData, todayStr, newWeight);
                });
                btnSaveWeight.textContent = 'OK';
                setTimeout(() => {
                    btnSaveWeight.textContent = 'Uložiť';
                }, 1500);
            } catch (e) {
                console.error('Desktop weight sync failed', e);
                btnSaveWeight.textContent = 'ERR';
                setTimeout(() => {
                    btnSaveWeight.textContent = 'Uložiť';
                }, 2000);
            }
        }
    };

    renderDesktopWeightChart(currentData);
}

let weightChart = null;
function renderDesktopWeightChart(data) {
    const ctx = document.getElementById('desktop-weight-chart');
    if (!ctx) return;

    const weightHistory = DoFormyEngine.getWeightHistory(data);
    if (weightHistory.length === 0) {
        if (weightChart) {
            weightChart.destroy();
            weightChart = null;
        }
        return;
    }

    if (weightChart) weightChart.destroy();
    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: weightHistory.map(w => w.date.slice(5)),
            datasets: [{
                data: weightHistory.map(w => w.weight),
                borderColor: '#2ECC71',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: weightHistory.length === 1 ? 5 : 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: weightHistory.length > 1 },
                y: { display: false }
            }
        }
    });
}

function renderWeeklyStats(data, today) {
    const weeklyContainer = document.getElementById('weekly-stats');
    if (!weeklyContainer) return;

    weeklyContainer.innerHTML = '';

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const stats = data.history[dStr] || { workout: false, steps: 0, habit: false, weight: null, water: 0 };

        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-stat';
        dayDiv.innerHTML = `
            <small>${d.toLocaleDateString('sk-SK', { weekday: 'short' })}</small>
            <div class="dot-container">
                <div class="dot ${(stats.workout && stats.workout.length > 0) ? 'active' : ''}"></div>
                <div class="dot ${stats.habit ? 'active' : ''}"></div>
                <div class="dot ${(stats.steps || 0) >= (data.user.stepsGoal || 6000) ? 'active' : ''}"></div>
            </div>
        `;
        weeklyContainer.appendChild(dayDiv);
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
