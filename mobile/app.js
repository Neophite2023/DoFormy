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

function formatStatusTime(timestamp) {
    if (!timestamp) return 'zatial nie';

    try {
        return new Intl.DateTimeFormat('sk-SK', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(timestamp));
    } catch (e) {
        return new Date(timestamp).toLocaleString('sk-SK');
    }
}

function renderStorageStatus() {
    const status = DoFormyEngine.getStorageStatus();
    const availability = document.getElementById('storage-availability');
    const lastSave = document.getElementById('storage-last-save');
    const lastSync = document.getElementById('storage-last-sync');
    const pending = document.getElementById('storage-pending');
    const detail = document.getElementById('storage-detail');
    const error = document.getElementById('storage-last-error');

    if (availability) {
        availability.textContent = status.storageAvailable ? 'Pripravene' : 'Chyba';
    }

    if (lastSave) {
        lastSave.textContent = formatStatusTime(status.lastLocalSaveAt);
    }

    if (lastSync) {
        lastSync.textContent = formatStatusTime(status.lastSyncAt);
    }

    if (pending) {
        pending.textContent = status.dirty ? 'Ano' : 'Nie';
    }

    if (detail) {
        if (!status.apiUrl) {
            detail.textContent = 'Server URL nie je nastavena. Data ostavaju len v tomto iPhone.';
        } else if (!status.online) {
            detail.textContent = 'Ste offline. Zmeny sa ukladaju do iPhonu a na server pojdu neskor.';
        } else if (status.dirty) {
            detail.textContent = 'Na zariadeni su lokalne zmeny, ktore este neboli odoslane na server.';
        } else if (status.lastSyncAt) {
            detail.textContent = 'Lokalne data su zapisane a posledny sync prebehol uspesne.';
        } else {
            detail.textContent = 'Lokalne ulozisko je pripravene, ale este neprebehol ziadny sync.';
        }
    }

    if (error) {
        if (status.lastStorageError) {
            error.textContent = `Chyba uloziska: ${status.lastStorageError}`;
            error.style.display = 'block';
        } else if (status.lastSyncStatus === 'error' && status.lastError) {
            error.textContent = `Posledna chyba synchronizacie: ${status.lastError}`;
            error.style.display = 'block';
        } else {
            error.textContent = '';
            error.style.display = 'none';
        }
    }
}

function refreshStatusUi() {
    updateSyncStatusDisplay();
    renderStorageStatus();
}

function handlePersistenceError(error) {
    console.error('DoFormy: Persistence failed', error);
    refreshStatusUi();
    alert(`Lokalne ulozenie zlyhalo: ${error?.message || error}`);
}

async function bootstrapMobileData() {
    DoFormyEngine.initSync();

    const localData = DoFormyEngine.readStoredJson(DoFormyEngine.DATA_STORAGE_KEY, null);

    return DoFormyEngine.normalizeData(localData || DoFormyEngine.getInitialData());
    /*

    // Tiché stiahnutie dát zo servera pri štarte (len ak máme URL)
    // Toto zabezpečí, že mobil bude mať aktuálnu resetVersion a ciele (stepsGoal).
    if (DoFormyEngine.getApiUrl()) {
        try {
            const serverData = await DoFormyEngine.getData({ fallbackToLocal: false });
            if (serverData && serverData.user) {
                const serverReset = Number(serverData.user.resetVersion) || 0;
                const localReset = Number(normalized.user.resetVersion) || 0;

                if (serverReset > localReset) {
                    console.log('DoFormy: Detegovaný globálny reset dát zo servera.');
                    // Hard reset: zahodíme všetko lokálne a použijeme čistý stav zo servera
                    normalized = serverData;
                } else {
                    // Bežný tichý update profilu (XP, level, verzia)
                    normalized.user = DoFormyEngine.mergeUser(normalized.user, serverData.user);
                }
                
                normalized = DoFormyEngine.persistLocalData(normalized, { dirty: false });
                DoFormyEngine.markSyncSuccess();
            }
        } catch (e) {
            console.warn('DoFormy: Tiché načítanie profilu zlyhalo (offline?)');
        }
    }

    return normalized;
    */
}

async function refreshMobileProfileFromServer() {
    if (!DoFormyEngine.getApiUrl()) return;

    try {
        const serverData = await DoFormyEngine.getData({ fallbackToLocal: false });
        if (!serverData || !serverData.user) return;

        const serverReset = Number(serverData.user.resetVersion) || 0;
        const localReset = Number(currentData?.user?.resetVersion) || 0;

        if (serverReset > localReset) {
            currentData = DoFormyEngine.normalizeData(serverData);
        } else {
            const merged = DoFormyEngine.normalizeData(currentData || DoFormyEngine.getInitialData());
            merged.user = DoFormyEngine.mergeUser(merged.user, serverData.user);
            currentData = merged;
        }

        currentData = DoFormyEngine.persistLocalData(currentData, { dirty: false });
        DoFormyEngine.markSyncSuccess();
        initUI(currentData);
        refreshStatusUi();
    } catch (e) {
        console.warn('DoFormy: Tiche nacitanie profilu zlyhalo (offline?)');
    }
}

function updateSyncStatusDisplay() {
    const bar = document.getElementById('sync-status-bar');
    if (!bar) return;

    const apiUrl = DoFormyEngine.getApiUrl();
    const status = DoFormyEngine.getStorageStatus();
    const lastSave = formatStatusTime(status.lastLocalSaveAt);

    if (!status.storageAvailable) {
        bar.textContent = `Lokalne ulozenie zlyhalo: ${status.lastStorageError || 'neznama chyba'}`;
        bar.className = 'sync-status-bar error';
        bar.style.display = 'block';
        return;
    }

    if (status.lastSyncStatus === 'error' && status.lastError && apiUrl) {
        bar.textContent = `Synchronizacia zlyhala: ${status.lastError}. Posledny lokalny zapis: ${lastSave}.`;
        bar.className = 'sync-status-bar error';
        bar.style.display = 'block';
        return;
    }

    if (!apiUrl) {
        bar.textContent = status.lastLocalSaveAt
            ? `Server URL nie je nastavena. Posledny lokalny zapis do iPhonu: ${lastSave}.`
            : 'Server URL nie je nastavena. Synchronizacia je vypnuta.';
        bar.className = 'sync-status-bar warning';
        bar.style.display = 'block';
        return;
    }

    if (!navigator.onLine) {
        bar.textContent = status.lastLocalSaveAt
            ? `Ste offline. Posledny lokalny zapis do iPhonu: ${lastSave}.`
            : 'Ste offline. Data sa ulozia len lokalne.';
        bar.className = 'sync-status-bar warning';
        bar.style.display = 'block';
        return;
    }

    if (status.dirty) {
        bar.textContent = `Mate lokalne zmeny cakajuce na sync. Posledny zapis: ${lastSave}.`;
        bar.className = 'sync-status-bar warning';
        bar.style.display = 'block';
        return;
    }

    bar.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
    currentData = await bootstrapMobileData();

    initUI(currentData);
    initSettings();
    initNavigation();
    initSync();
    refreshStatusUi();

    window.addEventListener('online', refreshStatusUi);
    window.addEventListener('offline', refreshStatusUi);
    window.addEventListener('syncSuccess', refreshStatusUi);
    window.addEventListener('syncError', refreshStatusUi);

    refreshMobileProfileFromServer();
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
            refreshStatusUi();
        } else {
            DoFormyEngine.setApiUrl(apiUrl);
        }

        try {
            currentData = await DoFormyEngine.syncNow(currentData, { throwOnError: true });
            initUI(currentData);
            setState('sync-success');
            scheduleReset(3000);
            refreshStatusUi();
        } catch (e) {
            setState('sync-error');
            scheduleReset(4000);
            const bar = document.getElementById('sync-status-bar');
            if (bar) {
                bar.textContent = `❌ Synchronizácia zlyhala: ${e?.message || 'Server nedostupný'}`;
                bar.className = 'sync-status-bar error';
                bar.style.display = 'block';
            }
            renderStorageStatus();
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
            refreshStatusUi();
            alert('URL uložená.');
        } else {
            localStorage.removeItem('doformy_api_url');
            localStorage.removeItem('projecttracker_sync_base_url');
            DoFormyEngine.setApiUrl(null);
            if (currentApiUrl) currentApiUrl.textContent = 'Aktuálne: (nepripojené)';
            refreshStatusUi();
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
            currentData = DoFormyEngine.persistLocalData(currentData, { dirty: false });
            DoFormyEngine.markSyncSuccess();
            refreshStatusUi();
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
            refreshStatusUi();
            alert('Dáta zosynchronizované.');
        } catch (e) {
            alert('Chyba: ' + e.message);
        }
    };

    const btnResetAll = document.getElementById('btn-reset-all');
    if (btnResetAll) {
        btnResetAll.onclick = async () => {
            if (!DoFormyEngine.getApiUrl()) {
                alert('Reset vyžaduje pripojenie k serveru, aby sa dáta vymazali všade.');
                return;
            }

            const confirmed = confirm('Naozaj chcete vymazať VŠETKY dáta? Táto akcia sa nedá vrátiť.');
            if (!confirmed) return;

            try {
                btnResetAll.disabled = true;
                btnResetAll.textContent = 'Resetujem...';
                
                currentData = await DoFormyEngine.resetServer();
                alert('Systém bol úspešne zresetovaný na všetkých zariadeniach.');
                location.reload();
            } catch (e) {
                alert('Reset zlyhal: ' + e.message);
                btnResetAll.disabled = false;
                btnResetAll.textContent = 'Resetovať systém';
            }
        };
    }
}

function initUI(data) {
    const todayStr = DoFormyEngine.getTodayStr();
    const phase = DoFormyEngine.getCurrentPhase(data.user.startDate);
    const stats = data.history[todayStr] || { workout: [], steps: 0, weight: null, water: 0 };

    document.getElementById('user-level').textContent = data.user.levelName || 'Fáza 1';
    document.getElementById('user-exp').textContent = `${data.user.exp} XP`;

    renderWorkoutCard(todayStr, stats, phase);
    renderWeightCard(todayStr);
    renderWaterCard(todayStr, stats);
    renderStepsCard(todayStr, stats);

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
            const completed = stats.workout?.find(w => w.name === ex.name);
            const checked = completed?.reps ? 'checked' : '';
            const repsValue = completed?.reps || '';
            html += `
                <div class="ex-row">
                    <label class="ex-check-label">
                        <input type="checkbox" class="ex-done-check" data-name="${ex.name}" ${checked}>
                        <span class="ex-check-icon">☑</span>
                    </label>
                    <span class="ex-name">${ex.name} <small>(${ex.sets} série)</small></span>
                    <input type="number" placeholder="${ex.reps}" value="${repsValue}" data-name="${ex.name}" class="reps-input" style="display:none;">
                </div>
            `;
        });

        workoutDesc.innerHTML = html;
        btnWorkout.style.display = 'block';
        btnWorkout.innerHTML = '✔';
        
        document.querySelectorAll('.ex-done-check').forEach(check => {
            const row = check.closest('.ex-row');
            const repsInput = row.querySelector('.reps-input');
            
            check.onchange = () => {
                repsInput.style.display = check.checked ? 'inline-block' : 'none';
                if (!check.checked) repsInput.value = '';
            };
            
            if (check.checked) repsInput.style.display = 'inline-block';
        });

        document.querySelectorAll('.reps-input').forEach(input => {
            input.onchange = e => {
                const name = e.target.dataset.name;
                const val = e.target.value;
                saveWorkoutProgress(todayStr, name, val);
            };
        });

        btnWorkout.onclick = async () => {
            const checked = document.querySelectorAll('.ex-done-check:checked');
            if (checked.length === 0) {
                btnWorkout.style.background = 'var(--do-error)';
                setTimeout(() => btnWorkout.style.background = '', 1000);
                return;
            }
            
            for (const check of checked) {
                const row = check.closest('.ex-row');
                const repsInput = row.querySelector('.reps-input');
                const val = repsInput.value || '0';
                await saveWorkoutProgress(todayStr, check.dataset.name, val);
            }
            
            btnWorkout.innerHTML = '✓';
            btnWorkout.style.background = 'var(--do-success)';
            setTimeout(() => {
                btnWorkout.innerHTML = '✔';
                btnWorkout.style.background = '';
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
            try {
                DoFormyEngine.logWeight(currentData, todayStr, newWeight);
                currentData = await DoFormyEngine.saveData(currentData, false);
                initUI(currentData);
                refreshStatusUi();
            } catch (e) {
                handlePersistenceError(e);
            }
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
        try {
            DoFormyEngine.logWater(currentData, todayStr, 250);
            currentData = await DoFormyEngine.saveData(currentData, false);
            initUI(currentData);
            refreshStatusUi();
        } catch (e) {
            handlePersistenceError(e);
        }
    };

    const btnReset = document.getElementById('btn-water-reset');
    if (btnReset) {
        btnReset.onclick = async () => {
            if (!confirm('Vynulovať vodu na 0 ml?')) return;
            try {
                DoFormyEngine.logWater(currentData, todayStr, 0, true);
                currentData = await DoFormyEngine.saveData(currentData, false);
                initUI(currentData);
                refreshStatusUi();
            } catch (e) {
                handlePersistenceError(e);
            }
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
    try {
        DoFormyEngine.logWorkoutEntry(currentData, date, name, val);
        currentData = await DoFormyEngine.saveData(currentData, false);
        refreshStatusUi();
    } catch (e) {
        handlePersistenceError(e);
    }
}

async function addSteps(date) {
    const add = prompt('Nové kroky:', '1000');
    if (add) {
        try {
            DoFormyEngine.logSteps(currentData, date, parseInt(add, 10));
            currentData = await DoFormyEngine.saveData(currentData, false);
            initUI(currentData);
            refreshStatusUi();
        } catch (e) {
            handlePersistenceError(e);
        }
    }
}

async function completeHabit(date) {
    try {
        DoFormyEngine.logHabit(currentData, date);
        currentData = await DoFormyEngine.saveData(currentData, false);
        initUI(currentData);
        refreshStatusUi();
    } catch (e) {
        handlePersistenceError(e);
    }
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => {
        console.warn('SW registration failed:', e);
    });
}
