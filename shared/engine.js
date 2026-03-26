/**
 * DoFormy Engine 2.3 - Bezpečný a realistický štart
 */
export const DoFormyEngine = {
    API_URL: localStorage.getItem('doformy_api_url') || 'http://localhost:8000/api',

    setApiUrl(url) {
        localStorage.setItem('doformy_api_url', url);
        this.API_URL = url;
    },

    getApiUrl() {
        return this.API_URL;
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
            sets: 4, reps: '6-10', tempo: '3s Negatívna fáza',
            exercises: [
                { name: 'Pomalé drepy (15kg)', reps: '10' },
                { name: 'Kliky (pomalé)', reps: 'Max' },
                { name: 'Príťahy (2s stlačenie)', reps: '10' },
                { name: 'Výpady s 15kg činkou', reps: '8 na nohu' },
                { name: 'Plank s váhou (15kg)', reps: '30 sekúnd' }
            ]
        },
        'Fáza 5: Elita': {
            sets: 5, reps: '12-15', tempo: 'Kruhové / Bez pauzy',
            exercises: [
                { name: 'Angličáky (Burpees)', reps: '12' },
                { name: 'Thrusters (Drep+Tlak 15kg)', reps: '10' },
                { name: 'Kliky s úzkym úchopom', reps: 'Max' },
                { name: 'Turecký vztyk (1x15kg)', reps: '3 na stranu' },
                { name: 'Horolezec (Mountain Climber)', reps: '45 sekúnd' }
            ]
        }
    },

    async getData() {
        try {
            const res = await fetch(`${this.API_URL}/data`);
            if (!res.ok) throw new Error("API error");
            return await res.json();
        } catch (e) {
            const local = localStorage.getItem('doformy_data');
            return local ? JSON.parse(local) : this.getInitialData();
        }
    },

    async saveData(data) {
        const currentLevel = [...this.LEVELS].reverse().find(l => data.user.exp >= l.minExp);
        data.user.levelName = currentLevel.name;
        localStorage.setItem('doformy_data', JSON.stringify(data));
        try {
            await fetch(`${this.API_URL}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) { console.warn('Sync failed'); }
    },

    async syncData(localData) {
        const serverData = await this.getData();
        
        const merged = this.mergeData(localData, serverData);
        
        localStorage.setItem('doformy_data', JSON.stringify(merged));
        
        try {
            await fetch(`${this.API_URL}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(merged)
            });
        } catch (e) { console.warn('Sync save failed'); }
        
        return merged;
    },

    mergeData(localData, serverData) {
        const merged = {
            user: localData.user.exp >= serverData.user.exp ? localData.user : serverData.user,
            history: { ...serverData.history }
        };
        
        for (const date in localData.history) {
            const localRec = localData.history[date];
            const serverRec = serverData.history[date];
            
            if (!serverRec) {
                merged.history[date] = localRec;
            } else {
                merged.history[date] = this.mergeDayRecord(localRec, serverRec);
            }
        }
        
        return merged;
    },

    mergeDayRecord(local, server) {
        return {
            steps: (local.steps || 0) + (server.steps || 0),
            habit: local.habit || server.habit,
            workout: this.mergeWorkout(local.workout, server.workout),
            weight: local.weight || server.weight,
            water: Math.max(local.water || 0, server.water || 0)
        };
    },

    mergeWorkout(localWorkout, serverWorkout) {
        if (!localWorkout || localWorkout.length === 0) return serverWorkout;
        if (!serverWorkout || serverWorkout.length === 0) return localWorkout;
        
        const merged = [...serverWorkout];
        
        for (const localEx of localWorkout) {
            const idx = merged.findIndex(m => m.name === localEx.name);
            if (idx >= 0) {
                merged[idx].reps = Math.max(merged[idx].reps || 0, localEx.reps || 0);
            } else {
                merged.push(localEx);
            }
        }
        
        return merged;
    },

    getInitialData() {
        return {
            user: { exp: 0, levelName: 'Fáza 1: Základy', stepsGoal: 6000, startDate: new Date().toISOString() },
            history: {} 
        };
    },

    getWorkoutForDay(date, levelName) {
        const day = date.getDay();
        const workoutDays = [1, 3, 5]; // Po, St, Pi
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
        const todayStr = today.toISOString().split('T')[0];
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
        if (!data.history[date]) {
            data.history[date] = { steps: 0, habit: false, workout: [], weight: null, water: 0 };
        }
        data.history[date].weight = parseFloat(weight);
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
    }
};
