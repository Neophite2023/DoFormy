import { DoFormyEngine } from '../shared/engine.js';

const THEME_STORAGE_KEY = 'doformy_theme';
const THEME_COLOR_LIGHT = '#2ECC71';
const THEME_COLOR_DARK = '#0B1220';

function setMetaThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', theme === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}

function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    setMetaThemeColor(nextTheme);
    return nextTheme;
}

function initTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
        return applyTheme(saved);
    }

    const prefersDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const initial = prefersDark ? 'dark' : 'light';
    localStorage.setItem(THEME_STORAGE_KEY, initial);
    return applyTheme(initial);
}

function setTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
}

initTheme();

let currentData = null;

async function bootstrapMobileData() {
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

    let normalized = DoFormyEngine.normalizeData(localData || DoFormyEngine.getInitialData());

    // Tiché stiahnutie dát zo servera pri štarte (len ak máme URL)
    // Toto zabezpečí, že mobil bude mať aktuálnu resetVersion a ciele (stepsGoal).
    if (DoFormyEngine.getApiUrl()) {
        try {
            const serverData = await DoFormyEngine.getData({ fallbackToLocal: false });
            if (serverData && serverData.user) {
                // Zlúčime používateľa, aby sme mali aktuálnu resetVersion a exp.
                normalized.user = DoFormyEngine.mergeUser(normalized.user, serverData.user);
                
                // DÔLEŽITÉ: Už tu neprepisujeme normalized celými serverovými dátami (ani pri resete),
                // aby sme nezhodili neodoslané lokálne zmeny v histórii pred manuálnym Syncom.
                
                localStorage.setItem('doformy_data', JSON.stringify(normalized));
            }
        } catch (e) {
            console.warn('DoFormy: Tiché načítanie profilu zlyhalo (offline?)');
        }
    }

    return normalized;
}

function updateSyncStatusDisplay() {
    const bar = document.getElementById('sync-status-bar');
    if (!bar) return;

    const apiUrl = DoFormyEngine.getApiUrl();
    if (!apiUrl) {
        bar.textContent = '⚠️ Server URL nie je nastavená. Synchronizácia je vypnutá.';
        bar.className = 'sync-status-bar warning';
        bar.style.display = 'block';
    } else if (!navigator.onLine) {
        bar.textContent = '📡 Ste offline. Dáta sa uložia len lokálne.';
        bar.className = 'sync-status-bar warning';
        bar.style.display = 'block';
    } else {
        bar.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    currentData = await bootstrapMobileData();

    initUI(currentData);
    initSettings();
    initNavigation();
    initSync();
    initNotifications();
    updateSyncStatusDisplay();
});

function initNavigation() {
    const navBtns = document.querySelectorAll('.do-nav .nav-btn');
    navBtns.forEach(btn => {
        btn.onclick = () => {
            const view = btn.dataset.view;
            navBtns.forEach(button => button.classList.remove('active'));
            btn.classList.add('active');

            document.getElementById('do-app').style.display = view === 'home' ? 'flex' : 'none';
            document.getElementById('view-settings').style.display = view === 'settings' ? 'block' : 'none';
        };
    });
}

function initSync() {
    const btnSync = document.getElementById('btn-sync');
    if (!btnSync) return;

    let resetTimeout = null;

    const setState = (state) => {
        btnSync.classList.remove('syncing', 'sync-success', 'sync-error');
        if (state) btnSync.classList.add(state);
    };

    const scheduleReset = (ms) => {
        if (resetTimeout) window.clearTimeout(resetTimeout);
        resetTimeout = window.setTimeout(() => setState(null), ms);
    };

    btnSync.onclick = async () => {
        if (resetTimeout) window.clearTimeout(resetTimeout);
        resetTimeout = null;
        setState('syncing');
        btnSync.disabled = true;
        
        let apiUrl = DoFormyEngine.getApiUrl() || localStorage.getItem('doformy_api_url') || localStorage.getItem('projecttracker_sync_base_url');
        if (!apiUrl) {
            apiUrl = prompt('Zadajte server URL (napr. https://doma-pc.tail85a624.ts.net:8000/api):');
            if (!apiUrl) {
                setState(null);
                btnSync.disabled = false;
                return;
            }
            if (!apiUrl.endsWith('/api')) apiUrl += '/api';
            localStorage.setItem('doformy_api_url', apiUrl);
            localStorage.setItem('projecttracker_sync_base_url', apiUrl);
            DoFormyEngine.setApiUrl(apiUrl);
            updateSyncStatusDisplay();
        } else {
            DoFormyEngine.setApiUrl(apiUrl);
        }

        try {
            currentData = await DoFormyEngine.syncNow(currentData, { throwOnError: true });
            initUI(currentData);
            setState('sync-success');
            scheduleReset(3000);
            updateSyncStatusDisplay();
        } catch (e) {
            setState('sync-error');
            scheduleReset(4000);
            const bar = document.getElementById('sync-status-bar');
            if (bar) {
                bar.textContent = `❌ Synchronizácia zlyhala: ${e?.message || 'Server nedostupný'}`;
                bar.className = 'sync-status-bar error';
                bar.style.display = 'block';
            }
            alert('Sync zlyhal: ' + (e?.message || e) + `\n\nPouzite URL: ${DoFormyEngine.getApiUrl() || '(nepripojene)'}`);
        } finally {
            btnSync.disabled = false;
        }
    };
}

function initSettings() {
    const apiInput = document.getElementById('api-url-input');
    const currentApiUrl = document.getElementById('current-api-url');

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
        themeToggle.checked = currentTheme === 'dark';
        themeToggle.onchange = () => {
            setTheme(themeToggle.checked ? 'dark' : 'light');
        };
    }

    const savedUrl = localStorage.getItem('doformy_api_url') || localStorage.getItem('projecttracker_sync_base_url') || '';
    if (apiInput) apiInput.value = savedUrl;
    if (currentApiUrl) currentApiUrl.textContent = `Aktuálne: ${savedUrl || '(nepripojené)'}`;

    document.getElementById('btn-save-api').onclick = () => {
        let url = (apiInput ? apiInput.value : '').trim();
        if (url) {
            if (!url.endsWith('/api')) url += '/api';
            localStorage.setItem('doformy_api_url', url);
            localStorage.setItem('projecttracker_sync_base_url', url);
            DoFormyEngine.setApiUrl(url);
            if (currentApiUrl) currentApiUrl.textContent = `Aktuálne: ${url}`;
            updateSyncStatusDisplay();
            alert('URL uložená.');
        } else {
            localStorage.removeItem('doformy_api_url');
            localStorage.removeItem('projecttracker_sync_base_url');
            DoFormyEngine.setApiUrl(null);
            if (currentApiUrl) currentApiUrl.textContent = 'Aktuálne: (nepripojené)';
            updateSyncStatusDisplay();
            alert('URL vymazaná.');
        }
    };

    document.getElementById('btn-sync-download').onclick = async () => {
        try {
            if (!DoFormyEngine.getApiUrl()) {
                alert('Najprv nastavte Server URL.');
                return;
            }
            currentData = await DoFormyEngine.getData({ fallbackToLocal: false });
            localStorage.setItem('doformy_data', JSON.stringify(currentData));
            alert('Dáta stiahnuté.');
            location.reload();
        } catch (e) {
            alert('Chyba: ' + e.message);
        }
    };

    document.getElementById('btn-sync-upload').onclick = async () => {
        try {
            if (!DoFormyEngine.getApiUrl()) {
                alert('Najprv nastavte Server URL.');
                return;
            }
            currentData = await DoFormyEngine.syncData(currentData);
            alert('Dáta zosynchronizované.');
        } catch (e) {
            alert('Chyba: ' + e.message);
        }
    };
}

async function initNotifications() {
    try {
        if ('Notification' in window) {
            await Notification.requestPermission();
        }
    } catch (e) {
        console.log('Notifications not available');
    }
}

function initUI(data) {
    const todayStr = DoFormyEngine.getTodayStr();
    const phase = DoFormyEngine.getCurrentPhase(data.user.startDate);
    const stats = data.history[todayStr] || { workout: [], steps: 0, habit: false, weight: null, water: 0 };

    document.getElementById('user-level').textContent = data.user.levelName || 'Fáza 1';
    document.getElementById('user-exp').textContent = `${data.user.exp} XP`;

    renderWorkoutCard(todayStr, stats, phase);
    renderWeightCard(todayStr);
    renderWaterCard(todayStr, stats);
    renderStepsCard(todayStr, stats);
    renderHabitCard(todayStr);

    const stepsGoal = document.getElementById('steps-goal');
    if (stepsGoal) {
        stepsGoal.textContent = data.user.stepsGoal || 5000;
    }
}

function renderWorkoutCard(todayStr, stats, phase) {
    const workout = DoFormyEngine.getWorkoutForDay(new Date(), phase);
    const btnWorkout = document.getElementById('btn-workout');
    const workoutDesc = document.getElementById('workout-desc');

    if (workout) {
        let html = `<p style="color:var(--do-primary); font-weight:700; margin-bottom:0.5rem;">Tempo: ${workout.tempo}</p>`;
        workout.exercises.forEach(ex => {
            const completed = stats.workout?.find(w => w.name === ex.name)?.reps || '';
            html += `
                <div class="ex-row">
                    <span>${ex.name} <small>(${ex.sets} série)</small></span>
                    <input type="number" placeholder="${ex.reps}" value="${completed}" data-name="${ex.name}" class="reps-input">
                </div>
            `;
        });

        workoutDesc.innerHTML = html;
        btnWorkout.style.display = 'block';
        btnWorkout.textContent = stats.workout && stats.workout.length > 0 ? 'Aktualizovať' : 'Hotovo';

        document.querySelectorAll('.reps-input').forEach(input => {
            input.onchange = e => {
                const name = e.target.dataset.name;
                const val = e.target.value;
                saveWorkoutProgress(todayStr, name, val);
            };
        });

        btnWorkout.onclick = () => {
            btnWorkout.textContent = 'Uložené';
            setTimeout(() => {
                btnWorkout.textContent = 'Aktualizovať';
            }, 2000);
        };
    } else {
        workoutDesc.innerHTML = `<p>Dnes je tvoj deň na <strong>aktívnu regeneráciu</strong>. Sústreď sa na kroky pri ceste do práce.</p>
                                 <button id="btn-preview-workout" class="btn-do" style="margin-top:1rem; width:100%;">Zobraziť tréningový plán</button>`;
        btnWorkout.style.display = 'none';

        document.getElementById('btn-preview-workout').onclick = () => {
            const mondayWorkout = DoFormyEngine.getWorkoutForDay(new Date(2026, 2, 23), phase);
            alert('Váš aktuálny plán:\n' + mondayWorkout.exercises.map(ex => '- ' + ex.name + ': ' + ex.reps).join('\n'));
        };
    }
}

function renderWeightCard(todayStr) {
    const latestWeight = DoFormyEngine.getLatestWeight(currentData);
    const startWeight = DoFormyEngine.getStartWeight(currentData);
    const weightVal = document.getElementById('weight-val');
    const weightChange = document.getElementById('weight-change');
    const weightInput = document.getElementById('weight-input');

    if (latestWeight) {
        weightVal.textContent = `${Number(latestWeight).toFixed(1)} kg`;
        weightInput.value = Number(latestWeight).toFixed(1);

        if (startWeight && startWeight !== latestWeight) {
            const diff = (latestWeight - startWeight).toFixed(1);
            const arrow = diff > 0 ? '↑' : '↓';
            weightChange.textContent = `${arrow} ${Math.abs(diff).toFixed(1)} kg od začiatku`;
        } else {
            weightChange.textContent = '';
        }
    } else {
        weightVal.textContent = '-- kg';
        weightChange.textContent = 'Zadajte prvú váhu';
    }

    document.getElementById('btn-weight-save').onclick = async () => {
        const newWeight = parseFloat(weightInput.value);
        if (newWeight && !isNaN(newWeight) && newWeight > 0) {
            DoFormyEngine.logWeight(currentData, todayStr, newWeight);
            currentData = await DoFormyEngine.saveData(currentData, false);
            initUI(currentData);
        }
    };
}

function renderWaterCard(todayStr, stats) {
    const latestWeight = DoFormyEngine.getLatestWeight(currentData);
    const waterGoal = DoFormyEngine.getWaterGoal(latestWeight);
    const currentWater = stats.water || 0;

    document.getElementById('water-val').textContent = `${currentWater} / ${waterGoal} ml`;
    document.getElementById('water-fill').style.width = `${Math.min((currentWater / waterGoal) * 100, 100)}%`;

    document.getElementById('btn-water-add').onclick = async () => {
        DoFormyEngine.logWater(currentData, todayStr, 250);
        currentData = await DoFormyEngine.saveData(currentData, false);
        initUI(currentData);
    };

    const btnReset = document.getElementById('btn-water-reset');
    if (btnReset) {
        btnReset.onclick = async () => {
            if (!confirm('Vynulovať vodu na 0 ml?')) return;
            DoFormyEngine.logWater(currentData, todayStr, 0, true);
            currentData = await DoFormyEngine.saveData(currentData, false);
            initUI(currentData);
        };
    }
}

function renderStepsCard(todayStr, stats) {
    document.getElementById('steps-val').textContent = stats.steps || 0;
    document.getElementById('btn-steps').onclick = () => addSteps(todayStr);
}

function renderHabitCard(todayStr) {
    document.getElementById('habit-desc').textContent = 'Zlepši techniku o 1%';
    document.getElementById('btn-habit').onclick = () => completeHabit(todayStr);
}

async function saveWorkoutProgress(date, name, val) {
    DoFormyEngine.logWorkoutEntry(currentData, date, name, val);
    currentData = await DoFormyEngine.saveData(currentData, false);
}

async function addSteps(date) {
    const add = prompt('Nové kroky:', '1000');
    if (add) {
        DoFormyEngine.logSteps(currentData, date, parseInt(add, 10));
        currentData = await DoFormyEngine.saveData(currentData, false);
        initUI(currentData);
    }
}

async function completeHabit(date) {
    DoFormyEngine.logHabit(currentData, date);
    currentData = await DoFormyEngine.saveData(currentData, false);
    initUI(currentData);
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => {
        console.warn('SW registration failed:', e);
    });
}
