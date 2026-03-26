/**
 * Správa dát v localStorage pre FitnessPal
 */
export const ProgressStore = {
    KEY: 'doformy_data',

    getData() {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : this.getInitialData();
    },

    getInitialData() {
        return {
            user: {
                level: 1,
                dailyStepsGoal: 5000,
                name: 'Začiatočník'
            },
            history: {}, // formát: { '2023-10-27': { taskCompleted: true, steps: 3400, miniCompleted: false } }
            currentStreak: 0
        };
    },

    saveData(data) {
        localStorage.setItem(this.KEY, JSON.stringify(data));
    },

    updateDailyStats(date, stats) {
        const data = this.getData();
        data.history[date] = { ...data.history[date], ...stats };
        this.saveData(data);
    },

    getTodayStats() {
        const today = new Date().toISOString().split('T')[0];
        const data = this.getData();
        return data.history[today] || { taskCompleted: false, steps: 0, miniCompleted: false };
    }
};
