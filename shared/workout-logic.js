/**
 * Logika tréningov a plánovania
 */
export const DoFormyWorkout = {
    PLAN: [
        { day: 1, type: 'workout', label: 'Pondelok: Tréning' },
        { day: 2, type: 'walk', label: 'Utorok: Chôdza' },
        { day: 3, type: 'workout', label: 'Streda: Tréning' },
        { day: 4, type: 'walk', label: 'Štvrtok: Chôdza' },
        { day: 5, type: 'workout', label: 'Piatok: Tréning' },
        { day: 6, type: 'walk', label: 'Sobota: Dlhá prechádzka' },
        { day: 0, type: 'rest', label: 'Nedeľa: Oddych' }
    ],

    getTaskForDate(date) {
        const dayOfWeek = date.getDay();
        return this.PLAN.find(p => p.day === dayOfWeek);
    },

    getExercisesForLevel(level) {
        return [
            { name: 'Drepy', reps: 8 + level * 2, sets: 2 },
            { name: 'Kliky (aj o kolená)', reps: 5 + level, sets: 2 },
            { name: 'Príťahy (jednoručka)', reps: 8 + level, sets: 2 },
            { name: 'Tlaky nad hlavu', reps: 8 + level, sets: 2 },
            { name: 'Plank', reps: '20s + ' + (level * 5) + 's', sets: 2 }
        ];
    }
};
