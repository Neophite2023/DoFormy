import { DoFormyEngine } from '../shared/engine.js';

let currentData = null;
let weightChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentData = await DoFormyEngine.getData();
    await initNotifications();
    initUI(currentData);
    initSettings();
    initNavigation();
    initSync();
});

function initNavigation() {
    const navBtns = document.querySelectorAll('.do-nav .nav-btn');
    navBtns.forEach(btn => {
        btn.onclick = () => {
            const view = btn.dataset.view;
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.getElementById('do-app').style.display = view === 'home' ? 'flex' : 'none';
            document.getElementById('view-settings').style.display = view === 'settings' ? 'block' : 'none';
        };
    });
}

function initSync() {
    const btnSync = document.getElementById('btn-sync');
    console.log('initSync called, btnSync:', btnSync);
    
    // Debug - show current API URL on screen
    const apiUrl = DoFormyEngine.getApiUrl();
    console.log('Current API URL:', apiUrl);
    
    if (!btnSync) {
        console.error('btn-sync button NOT FOUND!');
        return;
    }
    
    btnSync.onclick = async () => {
        alert('🔄 Sync started!\nURL: ' + DoFormyEngine.getApiUrl());
        console.log('Sync clicked, API URL:', DoFormyEngine.getApiUrl());
        btnSync.textContent = '⏳';
        
        try {
            // Get local data first
            const localRaw = localStorage.getItem('doformy_data');
            const localData = localRaw ? JSON.parse(localRaw) : DoFormyEngine.getInitialData();
            console.log('Local data loaded, exp:', localData.user.exp);
            alert('Local data: ' + localData.user.exp + ' XP');
            
            // Fetch server data
            alert('Fetching server data...');
            const serverData = await DoFormyEngine.getData();
            console.log('Server data received:', serverData);
            alert('Server data: ' + serverData.user.exp + ' XP');
            
            // Merge
            alert('Merging...');
            const merged = await DoFormyEngine.syncData(localData);
            console.log('Merged, new exp:', merged.user.exp);
            alert('Done! New XP: ' + merged.user.exp);
            
            currentData = merged;
            btnSync.textContent = '✓';
            setTimeout(() => btnSync.textContent = '🔄', 3000);
            location.reload();
        } catch (e) {
            console.error('Sync error:', e);
            alert('❌ Error: ' + e.message);
            btnSync.textContent = '❌';
            setTimeout(() => btnSync.textContent = '🔄', 3000);
        }
    };
}

function initSettings() {
    const apiInput = document.getElementById('api-url-input');
    const currentApiUrl = document.getElementById('current-api-url');
    const savedUrl = DoFormyEngine.getApiUrl();
    
    apiInput.value = savedUrl === 'http://localhost:8000/api' ? '' : savedUrl;
    currentApiUrl.textContent = `Aktuálne: ${savedUrl}`;
    
    document.getElementById('btn-save-api').onclick = () => {
        const url = apiInput.value.trim();
        if (url) {
            DoFormyEngine.setApiUrl(url);
            currentApiUrl.textContent = `Aktuálne: ${url}`;
            alert('URL uložená! Reštartujte aplikáciu.');
        } else {
            DoFormyEngine.setApiUrl('http://localhost:8000/api');
            currentApiUrl.textContent = `Aktuálne: http://localhost:8000/api`;
            alert('URL resetovaná na localhost!');
        }
    };
    
    document.getElementById('btn-sync-download').onclick = async () => {
        try {
            const data = await DoFormyEngine.getData();
            currentData = data;
            alert('Dáta stiahnuté zo servera!');
            location.reload();
        } catch (e) {
            alert('Chyba: ' + e.message);
        }
    };
    
    document.getElementById('btn-sync-upload').onclick = async () => {
        try {
            await DoFormyEngine.saveData(currentData);
            alert('Dáta nahraté na server!');
        } catch (e) {
            alert('Chyba: ' + e.message);
        }
    };
}

async function initNotifications() {
    const permission = await DoFormyEngine.requestNotificationPermission();
    if (permission === 'granted') {
        DoFormyEngine.scheduleWorkoutNotification(8);
    }
}

function initUI(data) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const stats = data.history[todayStr] || { workout: [], steps: 0, habit: false, weight: null, water: 0 };
    const phase = DoFormyEngine.getCurrentPhase(data.user.startDate);

    document.getElementById('user-level').textContent = data.user.levelName;
    document.getElementById('user-exp').textContent = `${data.user.exp} XP`;

    renderWorkoutCard(data, today, todayStr, stats, phase);
    renderWeightCard(data, todayStr);
    renderWaterCard(data, todayStr, stats);
    renderStepsCard(data, todayStr, stats);
    renderHabitCard(data, todayStr, stats);
}

function renderWorkoutCard(data, today, todayStr, stats, phase) {
    const workout = DoFormyEngine.getWorkoutForDay(today, phase);
    const btnWorkout = document.getElementById('btn-workout');
    const workoutDesc = document.getElementById('workout-desc');
    
    if (workout) {
        let html = `<p style="color:var(--do-primary); font-weight:700; margin-bottom:0.5rem;">Tempo: ${workout.tempo}</p>`;
        workout.exercises.forEach((ex, idx) => {
            const completed = stats.workout?.[idx]?.reps || '';
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
            input.onchange = (e) => {
                const name = e.target.dataset.name;
                const val = e.target.value;
                saveWorkoutProgress(data, todayStr, name, val);
            };
        });
    } else {
        workoutDesc.innerHTML = `<p>Dnes je tvoj deň na <strong>aktívnu regeneráciu</strong>. Sústreď sa na kroky pri ceste do práce.</p>
                                 <button id="btn-preview-workout" class="btn-do" style="margin-top:1rem; width:100%;">Zobraziť tréningový plán</button>`;
        btnWorkout.style.display = 'none';
        
        document.getElementById('btn-preview-workout').onclick = () => {
            const mondayWorkout = DoFormyEngine.getWorkoutForDay(new Date(2026, 2, 23), phase);
            alert("Váš aktuálny plán (Fáza 1):\n" + mondayWorkout.exercises.map(ex => "- " + ex.name + ": " + ex.reps).join("\n"));
        };
    }
}

function renderWeightCard(data, todayStr) {
    const latestWeight = DoFormyEngine.getLatestWeight(data);
    const startWeight = DoFormyEngine.getStartWeight(data);
    const weightHistory = DoFormyEngine.getWeightHistory(data);
    
    const weightVal = document.getElementById('weight-val');
    const weightChange = document.getElementById('weight-change');
    const weightInput = document.getElementById('weight-input');
    
    if (latestWeight) {
        weightVal.textContent = `${latestWeight} kg`;
        weightInput.value = latestWeight;
        
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
            DoFormyEngine.logWeight(data, todayStr, newWeight);
            await DoFormyEngine.saveData(data);
            location.reload();
        }
    };

    weightInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('btn-weight-save').click();
        }
    });

    renderWeightChart(weightHistory);
}

function renderWeightChart(weightHistory) {
    const ctx = document.getElementById('weight-chart');
    if (!ctx || weightHistory.length < 2) return;

    if (weightChart) {
        weightChart.destroy();
    }

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
                pointRadius: 3,
                pointBackgroundColor: '#2ECC71'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { display: false },
                y: { 
                    display: false,
                    suggestedMin: Math.min(...weightHistory.map(w => w.weight)) - 2,
                    suggestedMax: Math.max(...weightHistory.map(w => w.weight)) + 2
                }
            }
        }
    });
}

function renderWaterCard(data, todayStr, stats) {
    const latestWeight = DoFormyEngine.getLatestWeight(data);
    const waterGoal = DoFormyEngine.getWaterGoal(latestWeight);
    const currentWater = stats.water || 0;
    
    document.getElementById('water-val').textContent = `${currentWater} / ${waterGoal} ml`;
    
    const percent = Math.min((currentWater / waterGoal) * 100, 100);
    document.getElementById('water-fill').style.width = `${percent}%`;
    
    document.getElementById('btn-water-add').onclick = async () => {
        if (!data.history[todayStr]) {
            data.history[todayStr] = { workout: [], steps: 0, habit: false, weight: null, water: 0 };
        }
        data.history[todayStr].water = (data.history[todayStr].water || 0) + 250;
        await DoFormyEngine.saveData(data);
        location.reload();
    };
    
    document.getElementById('btn-water-reset').onclick = async () => {
        if (!data.history[todayStr]) {
            data.history[todayStr] = { workout: [], steps: 0, habit: false, weight: null, water: 0 };
        }
        data.history[todayStr].water = 0;
        await DoFormyEngine.saveData(data);
        location.reload();
    };
}

function renderStepsCard(data, todayStr, stats) {
    document.getElementById('steps-val').textContent = stats.steps;
    document.getElementById('btn-steps').onclick = () => addSteps(data, todayStr);
}

function renderHabitCard(data, todayStr, stats) {
    document.getElementById('habit-desc').textContent = 'Zlepši techniku o 1%';
    document.getElementById('btn-habit').onclick = () => completeHabit(data, todayStr);
}

async function saveWorkoutProgress(data, date, name, val) {
    if (!data.history[date]) {
        data.history[date] = { workout: [], steps: 0, habit: false, weight: null, water: 0 };
    }
    if (!data.history[date].workout) {
        data.history[date].workout = [];
    }
    
    const existingIdx = data.history[date].workout.findIndex(w => w.name === name);
    if (existingIdx >= 0) {
        data.history[date].workout[existingIdx].reps = parseInt(val) || 0;
    } else {
        data.history[date].workout.push({ name, reps: parseInt(val) || 0 });
    }
    
    await DoFormyEngine.saveData(data);
}

async function addSteps(data, date) {
    const add = prompt('Nové kroky:', '1000');
    if (add) {
        if (!data.history[date]) {
            data.history[date] = { workout: [], steps: 0, habit: false, weight: null, water: 0 };
        }
        data.history[date].steps = (data.history[date].steps || 0) + parseInt(add);
        await DoFormyEngine.saveData(data);
        location.reload();
    }
}

async function completeHabit(data, date) {
    if (!data.history[date]) {
        data.history[date] = { workout: [], steps: 0, habit: false, weight: null, water: 0 };
    }
    data.history[date].habit = true;
    data.user.exp += 10;
    await DoFormyEngine.saveData(data);
    location.reload();
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(async (registration) => {
        console.log('DoFormy SW registered:', registration);
        
        if ('periodicSync' in registration) {
            try {
                await registration.periodicSync.register('workout-reminder', {
                    minInterval: 24 * 60 * 60 * 1000,
                    data: { tag: 'workout-reminder' }
                });
                console.log('Periodic sync registered');
            } catch (e) {
                console.warn('Periodic sync failed:', e);
            }
        }
    }).catch((e) => {
        console.warn('SW registration failed:', e);
    });
}
