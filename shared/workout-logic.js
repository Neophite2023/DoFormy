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

    isWorkoutDay(date) {
        const day = date.getDay();
        return day === 1 || day === 3 || day === 5;
    },

    getWorkoutIndex(date) {
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const anchor = new Date(2026, 2, 23); // Monday
        const direction = target >= anchor ? 1 : -1;
        const current = new Date(anchor);
        let count = 0;

        while (direction === 1 ? current <= target : current > target) {
            if (this.isWorkoutDay(current)) count++;
            current.setDate(current.getDate() + direction);
        }

        return direction === 1 ? Math.max(0, count - 1) : Math.abs(count);
    },

    getExercisesForLevel(level) {
        const phaseConfig = {
            1: { sets: 3, reps: '10', plank: '30 sekúnd' },
            2: { sets: 3, reps: '12', plank: '35 sekúnd' },
            3: { sets: 4, reps: '10', plank: '40 sekúnd' },
            4: { sets: 4, reps: '12', plank: '45 sekúnd' },
            5: { sets: 5, reps: '10', plank: '50 sekúnd' }
        };
        const clampedLevel = Math.min(5, Math.max(1, Number(level) || 1));
        const config = phaseConfig[clampedLevel];
        const isVariantA = this.getWorkoutIndex(new Date()) % 2 === 0;
        const alternating = isVariantA ? 'Kliky s vlastnou váhou' : 'Bench press s jednoručkami';

        return [
            { name: 'Drepy', reps: config.reps, sets: config.sets },
            { name: alternating, reps: config.reps, sets: config.sets },
            { name: 'Príťahy jednoručiek v predklone', reps: config.reps, sets: config.sets },
            { name: 'Tlaky nad hlavou s jednoručkami', reps: config.reps, sets: config.sets },
            { name: 'Plank', reps: config.plank, sets: config.sets }
        ];
    }
};
