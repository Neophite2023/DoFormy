/**
 * DoFormy Engine 2.5 - ProjectTracker sync system
 */
export const DoFormyEngine = {
    API_URL: (() => {
        try {
            const path = window.location.pathname || '';
            if (path.includes('/desktop/')) {
                return `${window.location.origin}/api`;
            }
        } catch (e) {
            // ignore (non-browser env)
        }

        const explicit = localStorage.getItem('doformy_api_url') || localStorage.getItem('projecttracker_sync_base_url');
        if (explicit) return explicit;

        return null;
    })(),
    
    isSyncing: false,

    normalizeApiUrl(url) {
        if (!url) return null;
        const trimmed = String(url).trim().replace(/\/+$/, '');
        if (!trimmed) return null;
        return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    },

    setApiUrl(url, options = {}) {
        const { persist = true } = options;
        const normalized = this.normalizeApiUrl(url);

        this.API_URL = normalized;

        if (!persist) return;

        if (normalized) {
            localStorage.setItem('doformy_api_url', normalized);
        } else {
            localStorage.removeItem('doformy_api_url');
        }
    },

    getApiUrl() {
        return this.API_URL;
    },

    initSync() {
        const params = new URLSearchParams(window.location.search);
        const syncUrl = params.get('sync');
        if (syncUrl) {
            const apiUrl = this.normalizeApiUrl(syncUrl);
            let acceptSyncUrl = true;

            try {
                if (apiUrl) {
                    const parsed = new URL(apiUrl);
                    const host = (parsed.hostname || '').toLowerCase();
                    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
                        acceptSyncUrl = false;
                    }
                }
            } catch (e) {
                acceptSyncUrl = false;
            }

            if (acceptSyncUrl && apiUrl) {
                this.setApiUrl(apiUrl);
                localStorage.setItem('projecttracker_sync_base_url', apiUrl);
                return;
            }

            const fallbackStored = localStorage.getItem('projecttracker_sync_base_url') || localStorage.getItem('doformy_api_url');
            if (fallbackStored) {
                this.setApiUrl(fallbackStored);
                return;
            }
            return;
        }

        try {
            const path = window.location.pathname || '';
            if (path.includes('/desktop/')) {
                this.setApiUrl(`${window.location.origin}/api`, { persist: false });
                return;
            }
        } catch (e) {
            // ignore
        }

        const explicit = localStorage.getItem('doformy_api_url');
        if (explicit) {
            this.setApiUrl(explicit);
            return;
        }

        const storedUrl = localStorage.getItem('projecttracker_sync_base_url');
        if (storedUrl) {
            this.setApiUrl(storedUrl);
            return;
        }
    },

    LEVELS: [
        { name: 'Fáza 1: Základy', minExp: 0, desc: 'Budovanie techniky s vlastnou váhou. Činky zatiaľ odpočívajú.' },
        { name: 'Fáza 2: Prvá záťaž', minExp: 500, desc: 'Pomalé zavádzanie 15kg činky do vybraných cvikov.' },
        { name: 'Fáza 3: Sila a Objem', minExp: 1500, desc: 'Plné využitie 15kg záťaže pre rast svalov.' },
        { name: 'Fáza 4: Kontrola (TUT)', minExp: 3000, desc: 'Maximálna intenzita s pomalým tempom.' },
        { name: 'Fáza 5: Elita', minExp: 5000, desc: 'Komplexné a náročné silové prvky.' }
    ],

    WORKOUT_DATABASE: {
        'Fáza 1: Základy': {
            sets: 3, reps: '8-12', tempo: 'Kontrolované',
            exercises: [
                { name: 'Drepy (vlastná váha)', reps: '12-15' },
                { name: 'Kliky (o stôl alebo gauč)', reps: '8-10' },
                { name: 'Príťahy k zárubni dverí', reps: '10 (ťahová technika)' },
                { name: 'Výpady vzad (vlastná váha)', reps: '10 striedavo' },
                { name: 'Plank na kolenách/špičkách', reps: '20-30 sekúnd' }
            ]
        },
        'Fáza 2: Prvá záťaž': {
            sets: 3, reps: '8-12', tempo: 'Pomalé',
            exercises: [
                { name: 'Goblet drep (1x15kg)', reps: '8-10' },
                { name: 'Kliky (na zemi)', reps: 'Max' },
                { name: 'Príťahy v predklone (1x15kg)', reps: '8 na každú ruku' },
                { name: 'Rumunský mŕtvy ťah (bez váhy)', reps: '12 (učenie pohybu)' },
                { name: 'Plank (na špičkách)', reps: '40 sekúnd' }
            ]
        },
        'Fáza 3: Sila a Objem': {
            sets: 4, reps: '10-12', tempo: 'Plynulé',
            exercises: [
                { name: 'Bulharské drepy (vlastná váha)', reps: '10 na nohu' },
                { name: 'Tlak nad hlavu (1x15kg)', reps: '6-8 na každú ruku' },
                { name: 'Kliky (vlastná váha)', reps: '12-15' },
                { name: 'Rumunský mŕtvy ťah (2x15kg)', reps: '10' },
                { name: 'Floor Press (2x15kg)', reps: '10' }
            ]
        },
        'Fáza 4: Kontrola (TUT)': {
            sets: 4, reps: '6-10', tempo: '3s negatívna fáza',
            exercises: [
                { name: 'Pomalé drepy (15kg)', reps: '10' },
                { name: 'Kliky (pomalé)', reps: 'Max' },
                { name: 'Príťahy (2s stlačenie)', reps: '10' },
                { name: 'Výpady s 15kg činkou', reps: '8 na nohu' },
                { name: 'Plank s váhou (15kg)', reps: '30 sekúnd' }
            ]
        },
        'Fáza 5: Elita': {
            sets: 5, reps: '12-15', tempo: 'Kruhové / bez pauzy',
            exercises: [
                { name: 'Angličáky (Burpees)', reps: '12' },
                { name: 'Thrusters (Drep+Tlak 15kg)', reps: '10' },
                { name: 'Kliky s úzkym úchopom', reps: 'Max' },
                { name: 'Turecký vztyk (1x15kg)', reps: '3 na stranu' },
                { name: 'Horolezec (Mountain Climber)', reps: '45 sekúnd' }
            ]
        }
    },

    normalizeData(data) {
        const base = data && typeof data === 'object' ? data : {};
        const user = base.user && typeof base.user === 'object' ? base.user : {};
        const history = base.history && typeof base.history === 'object' ? base.history : {};
        const normalizedHistory = {};

        for (const [date, record] of Object.entries(history)) {
            normalizedHistory[date] = this.normalizeHistoryRecord(record);
        }

        return {
            user: {
                exp: Number(user.exp) || 0,
                levelName: user.levelName || this.LEVELS[0].name,
                stepsGoal: Number(user.stepsGoal) || 6000,
                startDate: user.startDate || new Date().toISOString(),
                resetVersion: Number(user.resetVersion) || 0,
                ...(user.id ? { id: user.id } : {})
            },
            history: normalizedHistory
        };
    },

    normalizeHistoryRecord(record) {
        const source = record && typeof record === 'object' ? record : {};
        const weight = source.weight;
        return {
            steps: Number(source.steps) || 0,
            workout: Array.isArray(source.workout)
                ? source.workout
                    .filter(exercise => exercise && exercise.name)
                    .map(exercise => ({ name: exercise.name, reps: Number(exercise.reps) || 0 }))
                : [],
            weight: weight === null || weight === undefined || weight === '' ? null : Number(weight),
            water: Number(source.water) || 0,
            last_updated: Number(source.last_updated) || 0,
            sync_meta: this.normalizeSyncMeta(source)
        };
    },

    normalizeSyncMeta(record) {
        const source = record && typeof record === 'object' ? record : {};
        const syncMeta = source.sync_meta && typeof source.sync_meta === 'object' ? source.sync_meta : {};
        
        // DÔLEŽITÉ: Nepoužívame last_updated ako fallback, lebo to spôsobuje, 
        // že zmena v jednom poli (napr. kroky) "zdanlivo" zaktualizuje aj ostatné polia.
        // Ak kľúč v sync_meta chýba, vrátime 0, čo znamená "staré dáta".
        const fallback = 0;

        return {
            steps: syncMeta.steps === undefined || syncMeta.steps === null ? fallback : Number(syncMeta.steps),
            workout: syncMeta.workout === undefined || syncMeta.workout === null ? fallback : Number(syncMeta.workout),
            weight: syncMeta.weight === undefined || syncMeta.weight === null ? fallback : Number(syncMeta.weight),
            water: syncMeta.water === undefined || syncMeta.water === null ? fallback : Number(syncMeta.water)
        };
    },

    ensureHistoryRecord(data, date) {
        if (!data.history[date]) {
            data.history[date] = {
                steps: 0,
                workout: [],
                weight: null,
                water: 0,
                last_updated: 0,
                sync_meta: {}
            };
        }

        data.history[date] = this.normalizeHistoryRecord(data.history[date]);
        return data.history[date];
    },

    touchHistoryField(record, field, timestamp = Date.now()) {
        if (!record.sync_meta || typeof record.sync_meta !== 'object') {
            record.sync_meta = {};
        }

        record.sync_meta[field] = timestamp;
        record.last_updated = Math.max(Number(record.last_updated) || 0, timestamp);
    },

    pickLatestValue(localValue, serverValue, localTime, serverTime) {
        const localDefined = localValue !== null && localValue !== undefined;
        const serverDefined = serverValue !== null && serverValue !== undefined;

        if (!localDefined) return serverValue;
        if (!serverDefined) return localValue;
        if (localTime > serverTime) return localValue;
        if (serverTime > localTime) return serverValue;
        return localValue;
    },

    async getData(options = {}) {
        const { fallbackToLocal = true } = options;

        try {
            if (!this.API_URL) throw new Error('Server URL not set');
            const res = await fetch(`${this.API_URL}/data`);
            if (!res.ok) throw new Error("API error");
            return this.normalizeData(await res.json());
        } catch (e) {
            if (!fallbackToLocal) throw e;

            console.warn('Fetch from server failed, using local data', e);
            const local = localStorage.getItem('doformy_data');
            return this.normalizeData(local ? JSON.parse(local) : this.getInitialData());
        }
    },

    async saveData(data, syncToServer = true, strictServerSync = false) {
        const normalizedData = this.normalizeData(data);

        const currentLevel = [...this.LEVELS].reverse().find(level => normalizedData.user.exp >= level.minExp) || this.LEVELS[0];
        normalizedData.user.levelName = currentLevel.name;

        localStorage.setItem('doformy_data', JSON.stringify(normalizedData));

        if (syncToServer && this.API_URL) {
            try {
                const res = await fetch(`${this.API_URL}/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(normalizedData)
                });

                if (!res.ok) {
                    throw new Error(`Server save failed: ${res.status}`);
                }
            } catch (e) {
                console.warn('Sync to server failed (offline?)', e);
                if (strictServerSync) throw e;
            }
        }

        return normalizedData;
    },

    _syncTimeout: null,
    autoSync(data, callback) {
        if (this._syncTimeout) clearTimeout(this._syncTimeout);
        this._syncTimeout = setTimeout(async () => {
            console.log('DoFormy: Spúšťam automatickú synchronizáciu...');
            const newData = await this.syncData(data);
            if (callback) callback(newData);
        }, 2000);
    },

    emitEvent(eventName, detail = {}) {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
    },

    async checkServerHealth() {
        try {
            if (!this.API_URL) throw new Error('Server URL not set');
            const res = await fetch(`${this.API_URL}/info`);
            if (!res.ok) throw new Error("Health check failed");
            return await res.json();
        } catch (e) {
            const apiUrl = this.API_URL || '(not set)';
            throw new Error(`Server offline (${apiUrl}): ${e?.message || e}`);
        }
    },

    async syncNow(localData, options = {}) {
        const { throwOnError = false } = options;

        if (this.isSyncing) {
            console.log('DoFormy: Sync already in progress, skipping');
            return localData;
        }

        if (!this.API_URL) {
            this.emitEvent('syncError', { message: 'Server URL not set' });
            if (throwOnError) throw new Error('Server URL not set');
            return localData;
        }

        if (!navigator.onLine) {
            this.emitEvent('syncError', { message: 'Offline' });
            if (throwOnError) throw new Error('Offline');
            return localData;
        }

        this.isSyncing = true;
        this.emitEvent('syncStart', {});

        try {
            await this.checkServerHealth();

            const normalizedLocal = this.normalizeData(localData);

            const pushRes = await fetch(`${this.API_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(normalizedLocal)
            });

            if (pushRes.status === 409) {
                this.emitEvent('syncError', { message: 'Sync conflict' });
                if (throwOnError) throw new Error('Sync conflict');
                return localData;
            }

            if (!pushRes.ok) {
                throw new Error(`Push failed: ${pushRes.status}`);
            }

            const pushResult = await pushRes.json();
            const normalizedServer = this.normalizeData({
                user: pushResult.user,
                history: pushResult.history
            });

            // Server already returns merged data from local + server state.
            // Persisting this payload avoids client-side re-merge regressions.
            const finalData = await this.saveData(normalizedServer, false, false);
            this.emitEvent('syncSuccess', { source: 'server' });
            return finalData;

        } catch (e) {
            console.error('DoFormy: Sync failed', e);
            this.emitEvent('syncError', { message: e.message });
            if (throwOnError) throw e;
            return localData;
        } finally {
            this.isSyncing = false;
        }
    },

    async syncData(localData) {
        const normalizedLocal = this.normalizeData(localData);
        const serverData = await this.getData({ fallbackToLocal: false });
        const normalizedServer = this.normalizeData(serverData);

        const localReset = Number(normalizedLocal.user.resetVersion) || 0;
        const serverReset = Number(normalizedServer.user.resetVersion) || 0;

        if (serverReset > localReset) {
            // Server signaled a reset; drop local test data so clients cannot repopulate the DB.
            return await this.saveData(normalizedServer, false);
        }

        const merged = this.mergeData(normalizedLocal, normalizedServer);
        return await this.saveData(merged, true, true);
    },

    mergeData(localData, serverData) {
        if (!serverData || !serverData.user) return this.normalizeData(localData);
        if (!localData || !localData.user) return this.normalizeData(serverData);

        const normalizedLocal = this.normalizeData(localData);
        const normalizedServer = this.normalizeData(serverData);
        const merged = {
            user: this.mergeUser(normalizedLocal.user, normalizedServer.user),
            history: {}
        };

        const allDates = new Set([
            ...Object.keys(normalizedLocal.history),
            ...Object.keys(normalizedServer.history)
        ]);

        for (const date of allDates) {
            merged.history[date] = this.mergeDayRecord(
                normalizedLocal.history[date],
                normalizedServer.history[date]
            );
        }

        return merged;
    },

    mergeUser(localUser, serverUser) {
        const localExp = Number(localUser.exp) || 0;
        const serverExp = Number(serverUser.exp) || 0;
        const localReset = Number(localUser.resetVersion) || 0;
        const serverReset = Number(serverUser.resetVersion) || 0;

        return {
            ...(serverUser.id ? { id: serverUser.id } : {}),
            exp: Math.max(localExp, serverExp),
            levelName: (localExp >= serverExp ? localUser.levelName : serverUser.levelName) || this.LEVELS[0].name,
            stepsGoal: localUser.stepsGoal ?? serverUser.stepsGoal ?? 6000,
            // startDate should follow server when available.
            startDate: serverUser.startDate || localUser.startDate || new Date().toISOString(),
            resetVersion: Math.max(localReset, serverReset)
        };
    },

    mergeDayRecord(local, server) {
        if (!server) return this.normalizeHistoryRecord(local);
        if (!local) return this.normalizeHistoryRecord(server);

        const normalizedLocal = this.normalizeHistoryRecord(local);
        const normalizedServer = this.normalizeHistoryRecord(server);
        const localMeta = normalizedLocal.sync_meta;
        const serverMeta = normalizedServer.sync_meta;

        return {
            steps: Math.max(normalizedLocal.steps || 0, normalizedServer.steps || 0),
            workout: this.mergeWorkout(normalizedLocal.workout, normalizedServer.workout),
            weight: this.pickLatestValue(
                normalizedLocal.weight,
                normalizedServer.weight,
                localMeta.weight,
                serverMeta.weight
            ),
            water: Math.max(normalizedLocal.water || 0, normalizedServer.water || 0),
            last_updated: Math.max(
                normalizedLocal.last_updated || 0,
                normalizedServer.last_updated || 0,
                localMeta.steps,
                localMeta.workout,
                localMeta.weight,
                localMeta.water,
                serverMeta.steps,
                serverMeta.workout,
                serverMeta.weight,
                serverMeta.water
            ),
            sync_meta: {
                steps: Math.max(localMeta.steps, serverMeta.steps),
                workout: Math.max(localMeta.workout, serverMeta.workout),
                weight: Math.max(localMeta.weight, serverMeta.weight),
                water: Math.max(localMeta.water, serverMeta.water)
            }
        };
    },

    mergeWorkout(localWorkout, serverWorkout) {
        if (!localWorkout || localWorkout.length === 0) return serverWorkout || [];
        if (!serverWorkout || serverWorkout.length === 0) return localWorkout || [];

        const merged = [...serverWorkout];

        for (const localEx of localWorkout) {
            const idx = merged.findIndex(item => item.name === localEx.name);
            if (idx >= 0) {
                merged[idx].reps = Math.max(merged[idx].reps || 0, localEx.reps || 0);
            } else {
                merged.push(localEx);
            }
        }

        return merged;
    },

    getInitialData() {
        return this.normalizeData({
            user: { exp: 0, levelName: 'Fáza 1: Základy', stepsGoal: 6000, startDate: new Date().toISOString() },
            history: {}
        });
    },

    getWorkoutForDay(date, levelName) {
        const day = date.getDay();
        const workoutDays = [1, 3, 5];
        const config = this.WORKOUT_DATABASE[levelName] || this.WORKOUT_DATABASE['Fáza 1: Základy'];

        if (workoutDays.includes(day)) {
            return {
                title: `${levelName} (Tréning)`,
                exercises: config.exercises.map(ex => ({ ...ex, sets: config.sets })),
                tempo: config.tempo
            };
        }
        return null;
    },

    getCurrentPhase(startDate) {
        const start = new Date(startDate);
        const now = new Date();
        const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

        const phases = [
            { month: 0, name: 'Fáza 1: Základy' },
            { month: 3, name: 'Fáza 2: Prvá záťaž' },
            { month: 6, name: 'Fáza 3: Sila a Objem' },
            { month: 9, name: 'Fáza 4: Kontrola (TUT)' },
            { month: 12, name: 'Fáza 5: Elita' }
        ];

        for (let i = phases.length - 1; i >= 0; i--) {
            if (months >= phases[i].month) return phases[i].name;
        }
        return phases[0].name;
    },

    getWaterGoal(weightKg) {
        if (!weightKg || weightKg <= 0) return 2500;
        return Math.round(weightKg * 35);
    },

    getTodayWorkout(data) {
        const today = new Date();
        const todayStr = this.getTodayStr();
        const stats = data.history[todayStr] || {};
        const levelName = data.user.levelName || 'Fáza 1: Základy';

        const day = today.getDay();
        const workoutDays = [1, 3, 5];
        const config = this.WORKOUT_DATABASE[levelName] || this.WORKOUT_DATABASE['Fáza 1: Základy'];

        if (workoutDays.includes(day)) {
            return {
                title: `${levelName} (Tréning)`,
                tempo: config.tempo,
                exercises: config.exercises.map(ex => {
                    const completed = stats.workout?.find(w => w.name === ex.name);
                    return {
                        name: ex.name,
                        reps: ex.reps,
                        sets: config.sets,
                        completed: completed?.reps || 0
                    };
                })
            };
        }
        return null;
    },

    logWeight(data, date, weight) {
        const record = this.ensureHistoryRecord(data, date);
        record.weight = parseFloat(weight);
        this.touchHistoryField(record, 'weight');
        return data;
    },

    logWater(data, date, amount, reset = false) {
        const record = this.ensureHistoryRecord(data, date);

        if (reset) {
            record.water = 0;
        } else {
            record.water = (record.water || 0) + amount;
        }

        this.touchHistoryField(record, 'water');
        return data;
    },

    logSteps(data, date, steps) {
        const record = this.ensureHistoryRecord(data, date);
        record.steps = (record.steps || 0) + steps;
        this.touchHistoryField(record, 'steps');
        return data;
    },

    logWorkoutEntry(data, date, name, reps) {
        const record = this.ensureHistoryRecord(data, date);
        const nextReps = Number(reps) || 0;
        const existingIdx = record.workout.findIndex(entry => entry.name === name);

        if (existingIdx >= 0) {
            record.workout[existingIdx].reps = nextReps;
        } else {
            record.workout.push({ name, reps: nextReps });
        }

        this.touchHistoryField(record, 'workout');
        return data;
    },

    getWeightHistory(data) {
        const history = [];
        const dates = Object.keys(data.history).sort();

        for (const date of dates) {
            const weight = data.history[date]?.weight;
            if (weight) {
                history.push({ date, weight });
            }
        }

        return history.slice(-30);
    },

    getLatestWeight(data) {
        const dates = Object.keys(data.history).sort().reverse();
        for (const date of dates) {
            const weight = data.history[date]?.weight;
            if (weight) return weight;
        }
        return null;
    },

    getStartWeight(data) {
        const dates = Object.keys(data.history).sort();
        for (const date of dates) {
            const weight = data.history[date]?.weight;
            if (weight) return weight;
        }
        return null;
    },

    async requestNotificationPermission() {
        if (!('Notification' in window)) return 'denied';
        return await Notification.requestPermission();
    },

    scheduleWorkoutNotification(hour = 8) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return false;

        setInterval(() => {
            const now = new Date();
            if (now.getHours() === hour && now.getMinutes() === 0) {
                const day = now.getDay();
                const workoutDays = [1, 3, 5];
                if (workoutDays.includes(day)) {
                    new Notification('DoFormy - Tréning', {
                        body: 'Dnes je tréningový deň! 💪',
                        icon: '../assets/icon-192.png',
                        tag: 'workout-reminder'
                    });
                }
            }
        }, 60000);

        return true;
    },

    isWorkoutDay() {
        const day = new Date().getDay();
        return [1, 3, 5].includes(day);
    },

    getTodayStr() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
};
