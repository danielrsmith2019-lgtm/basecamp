const sampleLiftData = [
  {
    id: 'lift-001',
    date: '2026-04-20',
    type: 'lift',
    status: 'completed',
    planId: null,
    details: {
      sessionName: 'Push (Light)',
      muscleGroups: ['Chest', 'Shoulders', 'Triceps'],
      exercises: [
        {
          name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 135, reps: 10, rpe: 5, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 135, reps: 10, rpe: 5, completed: true },
            { setNumber: 3, targetWeight: null, targetReps: null, weight: 135, reps: 8, rpe: 6, completed: true },
          ],
        },
        {
          name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 40, reps: 10, rpe: 6, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 40, reps: 8, rpe: 7, completed: true },
          ],
        },
        {
          name: 'Lateral Raises', muscleGroup: 'Shoulders', equipment: 'Dumbbell',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 20, reps: 15, rpe: 6, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 20, reps: 12, rpe: 7, completed: true },
          ],
        },
      ],
      totalVolume: 5560,
      totalSets: 7,
      duration: 45,
      notes: 'Light session — race week',
    },
    createdAt: '2026-04-20T17:00:00Z',
    updatedAt: '2026-04-20T17:00:00Z',
  },
  {
    id: 'lift-002',
    date: '2026-04-21',
    type: 'lift',
    status: 'completed',
    planId: null,
    details: {
      sessionName: 'Pull (Light)',
      muscleGroups: ['Back', 'Biceps'],
      exercises: [
        {
          name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 120, reps: 10, rpe: 5, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 120, reps: 10, rpe: 6, completed: true },
            { setNumber: 3, targetWeight: null, targetReps: null, weight: 120, reps: 8, rpe: 6, completed: true },
          ],
        },
        {
          name: 'Dumbbell Row', muscleGroup: 'Back', equipment: 'Dumbbell',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 60, reps: 10, rpe: 5, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 60, reps: 10, rpe: 6, completed: true },
          ],
        },
        {
          name: 'Hammer Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 30, reps: 12, rpe: 6, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 30, reps: 10, rpe: 7, completed: true },
          ],
        },
      ],
      totalVolume: 6420,
      totalSets: 7,
      duration: 40,
      notes: null,
    },
    createdAt: '2026-04-21T17:00:00Z',
    updatedAt: '2026-04-21T17:00:00Z',
  },
  {
    id: 'lift-003',
    date: '2026-04-28',
    type: 'lift',
    status: 'completed',
    planId: null,
    details: {
      sessionName: 'Push',
      muscleGroups: ['Chest', 'Shoulders', 'Triceps'],
      exercises: [
        {
          name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 185, reps: 8, rpe: 7, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 185, reps: 7, rpe: 8, completed: true },
            { setNumber: 3, targetWeight: null, targetReps: null, weight: 185, reps: 6, rpe: 9, completed: true },
          ],
        },
        {
          name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 65, reps: 10, rpe: 7, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 65, reps: 8, rpe: 8, completed: true },
          ],
        },
        {
          name: 'Overhead Press', muscleGroup: 'Shoulders', equipment: 'Barbell',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 95, reps: 8, rpe: 7, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 95, reps: 6, rpe: 8, completed: true },
          ],
        },
        {
          name: 'Tricep Pushdown', muscleGroup: 'Triceps', equipment: 'Cable',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 50, reps: 15, rpe: 6, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 50, reps: 12, rpe: 7, completed: true },
          ],
        },
      ],
      totalVolume: 8395,
      totalSets: 9,
      duration: 55,
      notes: 'First full-intensity push since the half',
    },
    createdAt: '2026-04-28T17:00:00Z',
    updatedAt: '2026-04-28T17:00:00Z',
  },
  {
    id: 'lift-004',
    date: '2026-05-04',
    type: 'lift',
    status: 'completed',
    planId: null,
    details: {
      sessionName: 'Pull',
      muscleGroups: ['Back', 'Biceps'],
      exercises: [
        {
          name: 'Pull-Ups', muscleGroup: 'Back', equipment: 'Bodyweight',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 0, reps: 10, rpe: 7, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 0, reps: 8, rpe: 8, completed: true },
            { setNumber: 3, targetWeight: null, targetReps: null, weight: 0, reps: 7, rpe: 9, completed: true },
          ],
        },
        {
          name: 'Barbell Row', muscleGroup: 'Back', equipment: 'Barbell',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 155, reps: 8, rpe: 7, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 155, reps: 8, rpe: 8, completed: true },
          ],
        },
        {
          name: 'Face Pulls', muscleGroup: 'Back', equipment: 'Cable',
          sets: [
            { setNumber: 1, targetWeight: null, targetReps: null, weight: 40, reps: 15, rpe: 5, completed: true },
            { setNumber: 2, targetWeight: null, targetReps: null, weight: 40, reps: 15, rpe: 6, completed: true },
          ],
        },
      ],
      totalVolume: 3680,
      totalSets: 7,
      duration: 42,
      notes: null,
    },
    createdAt: '2026-05-04T17:00:00Z',
    updatedAt: '2026-05-04T17:00:00Z',
  },
  {
    id: 'lift-005',
    date: '2026-05-06',
    type: 'lift',
    status: 'planned',
    planId: null,
    details: {
      sessionName: 'Legs (Moderate)',
      muscleGroups: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
      exercises: [
        {
          name: 'Goblet Squat', muscleGroup: 'Quads', equipment: 'Dumbbell',
          sets: [
            { setNumber: 1, targetWeight: 50, targetReps: 12, weight: null, reps: null, rpe: null, completed: false },
            { setNumber: 2, targetWeight: 50, targetReps: 12, weight: null, reps: null, rpe: null, completed: false },
            { setNumber: 3, targetWeight: 50, targetReps: 10, weight: null, reps: null, rpe: null, completed: false },
          ],
        },
        {
          name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', equipment: 'Barbell',
          sets: [
            { setNumber: 1, targetWeight: 135, targetReps: 10, weight: null, reps: null, rpe: null, completed: false },
            { setNumber: 2, targetWeight: 135, targetReps: 10, weight: null, reps: null, rpe: null, completed: false },
          ],
        },
        {
          name: 'Walking Lunges', muscleGroup: 'Quads', equipment: 'Dumbbell',
          sets: [
            { setNumber: 1, targetWeight: 35, targetReps: 10, weight: null, reps: null, rpe: null, completed: false },
            { setNumber: 2, targetWeight: 35, targetReps: 10, weight: null, reps: null, rpe: null, completed: false },
          ],
        },
        {
          name: 'Standing Calf Raise', muscleGroup: 'Calves', equipment: 'Machine',
          sets: [
            { setNumber: 1, targetWeight: 100, targetReps: 15, weight: null, reps: null, rpe: null, completed: false },
            { setNumber: 2, targetWeight: 100, targetReps: 15, weight: null, reps: null, rpe: null, completed: false },
          ],
        },
      ],
      totalVolume: null,
      totalSets: null,
      duration: null,
      notes: null,
    },
    createdAt: '2026-05-06T12:00:00Z',
    updatedAt: '2026-05-06T12:00:00Z',
  },
];

export default sampleLiftData;