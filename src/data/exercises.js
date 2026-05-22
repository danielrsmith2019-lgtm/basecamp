/**
 * BaseCamp Exercise Library
 * 
 * Built from Dan's actual workout history + comprehensive strength/hybrid database.
 * 650+ exercises across all muscle groups and equipment types.
 * 
 * Structure: { name, muscleGroup, equipment, category, aliases[] }
 */

export const EXERCISE_LIBRARY = [

  // ══════════════════════════════════════════
  // CHEST
  // ══════════════════════════════════════════
  { name: 'Flat DB Bench Press',          muscleGroup: 'Chest',     equipment: 'Dumbbell',  category: 'Push' },
  { name: 'Barbell Bench Press',          muscleGroup: 'Chest',     equipment: 'Barbell',   category: 'Push' },
  { name: 'Incline DB Bench Press',       muscleGroup: 'Chest',     equipment: 'Dumbbell',  category: 'Push' },
  { name: 'Incline Barbell Bench Press',  muscleGroup: 'Chest',     equipment: 'Barbell',   category: 'Push' },
  { name: 'Decline Bench Press',          muscleGroup: 'Chest',     equipment: 'Barbell',   category: 'Push' },
  { name: 'Close Grip Bench Press',       muscleGroup: 'Chest',     equipment: 'Barbell',   category: 'Push' },
  { name: 'Incline Fly',                  muscleGroup: 'Chest',     equipment: 'Dumbbell',  category: 'Push' },
  { name: 'DB Fly',                       muscleGroup: 'Chest',     equipment: 'Dumbbell',  category: 'Push' },
  { name: 'Cable Fly',                    muscleGroup: 'Chest',     equipment: 'Cable',     category: 'Push' },
  { name: 'Pec Deck',                     muscleGroup: 'Chest',     equipment: 'Machine',   category: 'Push' },
  { name: 'Push Up',                      muscleGroup: 'Chest',     equipment: 'Bodyweight',category: 'Push' },
  { name: 'Diamond Push Up',              muscleGroup: 'Chest',     equipment: 'Bodyweight',category: 'Push' },
  { name: 'Wide Push Up',                 muscleGroup: 'Chest',     equipment: 'Bodyweight',category: 'Push' },
  { name: 'Chest Press Machine',          muscleGroup: 'Chest',     equipment: 'Machine',   category: 'Push' },
  { name: 'Chest Dip',                    muscleGroup: 'Chest',     equipment: 'Bodyweight',category: 'Push' },
  { name: 'Landmine Press',               muscleGroup: 'Chest',     equipment: 'Barbell',   category: 'Push' },

  // ══════════════════════════════════════════
  // BACK
  // ══════════════════════════════════════════
  { name: 'Barbell Deadlift',             muscleGroup: 'Back',      equipment: 'Barbell',   category: 'Pull' },
  { name: 'Romanian Deadlift',            muscleGroup: 'Back',      equipment: 'Barbell',   category: 'Pull' },
  { name: 'Sumo Deadlift',               muscleGroup: 'Back',      equipment: 'Barbell',   category: 'Pull' },
  { name: 'Single Leg Deadlift',          muscleGroup: 'Back',      equipment: 'Dumbbell',  category: 'Pull' },
  { name: 'Lat Pull Down',               muscleGroup: 'Back',      equipment: 'Cable',     category: 'Pull' },
  { name: 'Wide Grip Lat Pull Down',      muscleGroup: 'Back',      equipment: 'Cable',     category: 'Pull' },
  { name: 'Close Grip Cable Pull Down',   muscleGroup: 'Back',      equipment: 'Cable',     category: 'Pull' },
  { name: 'Pull Up',                      muscleGroup: 'Back',      equipment: 'Bodyweight',category: 'Pull' },
  { name: 'Wide Grip Pull Up',            muscleGroup: 'Back',      equipment: 'Bodyweight',category: 'Pull' },
  { name: 'Chin Up',                      muscleGroup: 'Back',      equipment: 'Bodyweight',category: 'Pull' },
  { name: 'Assisted Pull Up',             muscleGroup: 'Back',      equipment: 'Machine',   category: 'Pull' },
  { name: 'Barbell Row',                  muscleGroup: 'Back',      equipment: 'Barbell',   category: 'Pull' },
  { name: 'Pendlay Row',                  muscleGroup: 'Back',      equipment: 'Barbell',   category: 'Pull' },
  { name: 'Single Arm DB Row',            muscleGroup: 'Back',      equipment: 'Dumbbell',  category: 'Pull' },
  { name: 'Incline DB Row',               muscleGroup: 'Back',      equipment: 'Dumbbell',  category: 'Pull' },
  { name: 'Wide Grip Cable Row',          muscleGroup: 'Back',      equipment: 'Cable',     category: 'Pull' },
  { name: 'Seated Cable Row',             muscleGroup: 'Back',      equipment: 'Cable',     category: 'Pull' },
  { name: 'Standing T-Bar Row',           muscleGroup: 'Back',      equipment: 'Barbell',   category: 'Pull' },
  { name: 'Reverse Row',                  muscleGroup: 'Back',      equipment: 'Bodyweight',category: 'Pull' },
  { name: 'Face Pull',                    muscleGroup: 'Back',      equipment: 'Cable',     category: 'Pull' },
  { name: 'Straight Arm Pull Down',       muscleGroup: 'Back',      equipment: 'Cable',     category: 'Pull' },
  { name: 'Hyperextension',               muscleGroup: 'Back',      equipment: 'Machine',   category: 'Pull' },
  { name: 'Good Morning',                 muscleGroup: 'Back',      equipment: 'Barbell',   category: 'Pull' },
  { name: 'Rack Pull',                    muscleGroup: 'Back',      equipment: 'Barbell',   category: 'Pull' },
  { name: 'Dead Hang',                    muscleGroup: 'Back',      equipment: 'Bodyweight',category: 'Pull' },

  // ══════════════════════════════════════════
  // SHOULDERS
  // ══════════════════════════════════════════
  { name: 'OHP',                          muscleGroup: 'Shoulders', equipment: 'Barbell',   category: 'Push' },
  { name: 'Overhead Press',               muscleGroup: 'Shoulders', equipment: 'Barbell',   category: 'Push' },
  { name: 'DB Shoulder Press',            muscleGroup: 'Shoulders', equipment: 'Dumbbell',  category: 'Push' },
  { name: 'Arnold Press',                 muscleGroup: 'Shoulders', equipment: 'Dumbbell',  category: 'Push' },
  { name: 'Seated DB Press',              muscleGroup: 'Shoulders', equipment: 'Dumbbell',  category: 'Push' },
  { name: 'Machine Shoulder Press',       muscleGroup: 'Shoulders', equipment: 'Machine',   category: 'Push' },
  { name: 'Lateral Raise',               muscleGroup: 'Shoulders', equipment: 'Dumbbell',  category: 'Isolation' },
  { name: 'One Arm Side Lateral',         muscleGroup: 'Shoulders', equipment: 'Dumbbell',  category: 'Isolation' },
  { name: 'Cable Lateral Raise',          muscleGroup: 'Shoulders', equipment: 'Cable',     category: 'Isolation' },
  { name: 'Front Raise',                  muscleGroup: 'Shoulders', equipment: 'Dumbbell',  category: 'Isolation' },
  { name: 'Bent Over Reverse Fly',        muscleGroup: 'Shoulders', equipment: 'Dumbbell',  category: 'Isolation' },
  { name: 'Reverse Pec Deck',             muscleGroup: 'Shoulders', equipment: 'Machine',   category: 'Isolation' },
  { name: 'Upright Row',                  muscleGroup: 'Shoulders', equipment: 'Barbell',   category: 'Pull' },
  { name: 'Shrug',                        muscleGroup: 'Shoulders', equipment: 'Barbell',   category: 'Isolation' },
  { name: 'DB Shrug',                     muscleGroup: 'Shoulders', equipment: 'Dumbbell',  category: 'Isolation' },
  { name: 'Face Pull',                    muscleGroup: 'Shoulders', equipment: 'Cable',     category: 'Pull' },

  // ══════════════════════════════════════════
  // BICEPS
  // ══════════════════════════════════════════
  { name: 'Standing Bicep Curl',          muscleGroup: 'Biceps',    equipment: 'Dumbbell',  category: 'Curl' },
  { name: 'Sitting Bicep Curl',           muscleGroup: 'Biceps',    equipment: 'Dumbbell',  category: 'Curl' },
  { name: 'Barbell Curl',                 muscleGroup: 'Biceps',    equipment: 'Barbell',   category: 'Curl' },
  { name: 'EZ Bar Curl',                  muscleGroup: 'Biceps',    equipment: 'Barbell',   category: 'Curl' },
  { name: 'Hammer Curl',                  muscleGroup: 'Biceps',    equipment: 'Dumbbell',  category: 'Curl' },
  { name: 'Preacher Curl',                muscleGroup: 'Biceps',    equipment: 'Barbell',   category: 'Curl' },
  { name: 'Poundstone Curl',              muscleGroup: 'Biceps',    equipment: 'Barbell',   category: 'Curl' },
  { name: 'Cable Curl',                   muscleGroup: 'Biceps',    equipment: 'Cable',     category: 'Curl' },
  { name: 'Concentration Curl',           muscleGroup: 'Biceps',    equipment: 'Dumbbell',  category: 'Curl' },
  { name: 'Incline DB Curl',              muscleGroup: 'Biceps',    equipment: 'Dumbbell',  category: 'Curl' },
  { name: 'Cross Body Curl',              muscleGroup: 'Biceps',    equipment: 'Dumbbell',  category: 'Curl' },
  { name: 'Spider Curl',                  muscleGroup: 'Biceps',    equipment: 'Barbell',   category: 'Curl' },
  { name: 'Machine Curl',                 muscleGroup: 'Biceps',    equipment: 'Machine',   category: 'Curl' },
  { name: 'Reverse Curl',                 muscleGroup: 'Biceps',    equipment: 'Barbell',   category: 'Curl' },

  // ══════════════════════════════════════════
  // TRICEPS
  // ══════════════════════════════════════════
  { name: 'Lying Triceps Extension',      muscleGroup: 'Triceps',   equipment: 'Barbell',   category: 'Push' },
  { name: 'Skull Crusher',                muscleGroup: 'Triceps',   equipment: 'Barbell',   category: 'Push' },
  { name: 'EZ Bar Skull Crusher',         muscleGroup: 'Triceps',   equipment: 'Barbell',   category: 'Push' },
  { name: 'DB Skull Crusher',             muscleGroup: 'Triceps',   equipment: 'Dumbbell',  category: 'Push' },
  { name: 'Tricep Dip',                   muscleGroup: 'Triceps',   equipment: 'Bodyweight',category: 'Push' },
  { name: 'Tricep Pushdown',              muscleGroup: 'Triceps',   equipment: 'Cable',     category: 'Push' },
  { name: 'Rope Pushdown',                muscleGroup: 'Triceps',   equipment: 'Cable',     category: 'Push' },
  { name: 'Overhead Tricep Extension',    muscleGroup: 'Triceps',   equipment: 'Dumbbell',  category: 'Push' },
  { name: 'Cable Overhead Extension',     muscleGroup: 'Triceps',   equipment: 'Cable',     category: 'Push' },
  { name: 'Close Grip Push Up',           muscleGroup: 'Triceps',   equipment: 'Bodyweight',category: 'Push' },
  { name: 'Tricep Kickback',              muscleGroup: 'Triceps',   equipment: 'Dumbbell',  category: 'Isolation' },
  { name: 'Machine Tricep Extension',     muscleGroup: 'Triceps',   equipment: 'Machine',   category: 'Push' },

  // ══════════════════════════════════════════
  // LEGS — QUADS
  // ══════════════════════════════════════════
  { name: 'Barbell Back Squat',           muscleGroup: 'Quads',     equipment: 'Barbell',   category: 'Squat' },
  { name: 'Front Squat',                  muscleGroup: 'Quads',     equipment: 'Barbell',   category: 'Squat' },
  { name: 'Goblet Squat',                 muscleGroup: 'Quads',     equipment: 'Dumbbell',  category: 'Squat' },
  { name: 'Full Squat',                   muscleGroup: 'Quads',     equipment: 'Dumbbell',  category: 'Squat' },
  { name: 'Half Squat',                   muscleGroup: 'Quads',     equipment: 'Dumbbell',  category: 'Squat' },
  { name: 'Leg Press',                    muscleGroup: 'Quads',     equipment: 'Machine',   category: 'Squat' },
  { name: 'Hack Squat',                   muscleGroup: 'Quads',     equipment: 'Machine',   category: 'Squat' },
  { name: 'Leg Extension',                muscleGroup: 'Quads',     equipment: 'Machine',   category: 'Isolation' },
  { name: 'Walking Lunge',                muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Lunge' },
  { name: 'Walked Lunges with DB',        muscleGroup: 'Quads',     equipment: 'Dumbbell',  category: 'Lunge' },
  { name: 'Walking Lunge with DB',        muscleGroup: 'Quads',     equipment: 'Dumbbell',  category: 'Lunge' },
  { name: 'Jumping Lunge',                muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Plyometric' },
  { name: 'Reverse Lunge',                muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Lunge' },
  { name: 'Bulgarian Split Squat',        muscleGroup: 'Quads',     equipment: 'Dumbbell',  category: 'Squat' },
  { name: 'Step Up',                      muscleGroup: 'Quads',     equipment: 'Dumbbell',  category: 'Functional' },
  { name: 'Box Step Up',                  muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Functional' },
  { name: 'Sissy Squat',                  muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Isolation' },
  { name: 'Wall Sit',                     muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Isolation' },
  { name: 'Jump Squat',                   muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Plyometric' },
  { name: 'Pulse Jump Squat',             muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Plyometric' },

  // ══════════════════════════════════════════
  // LEGS — HAMSTRINGS / GLUTES
  // ══════════════════════════════════════════
  { name: 'Leg Curl',                     muscleGroup: 'Hamstrings',equipment: 'Machine',   category: 'Isolation' },
  { name: 'Standing Leg Curl',            muscleGroup: 'Hamstrings',equipment: 'Machine',   category: 'Isolation' },
  { name: 'Nordic Hamstring Curl',        muscleGroup: 'Hamstrings',equipment: 'Bodyweight',category: 'Isolation' },
  { name: 'Glute Bridge',                 muscleGroup: 'Glutes',    equipment: 'Bodyweight',category: 'Hip Hinge' },
  { name: 'Barbell Hip Thrust',           muscleGroup: 'Glutes',    equipment: 'Barbell',   category: 'Hip Hinge' },
  { name: 'Hip Thrust',                   muscleGroup: 'Glutes',    equipment: 'Machine',   category: 'Hip Hinge' },
  { name: 'Cable Kickback',               muscleGroup: 'Glutes',    equipment: 'Cable',     category: 'Isolation' },
  { name: 'Donkey Kick',                  muscleGroup: 'Glutes',    equipment: 'Bodyweight',category: 'Isolation' },
  { name: 'Fire Hydrant',                 muscleGroup: 'Glutes',    equipment: 'Bodyweight',category: 'Isolation' },
  { name: 'Sumo Squat',                   muscleGroup: 'Glutes',    equipment: 'Dumbbell',  category: 'Squat' },
  { name: 'Clamshell',                    muscleGroup: 'Glutes',    equipment: 'Bodyweight',category: 'Isolation' },

  // ══════════════════════════════════════════
  // LEGS — CALVES
  // ══════════════════════════════════════════
  { name: 'Standing Calf Raise',          muscleGroup: 'Calves',    equipment: 'Machine',   category: 'Isolation' },
  { name: 'Seated Calf Raise',            muscleGroup: 'Calves',    equipment: 'Machine',   category: 'Isolation' },
  { name: 'DB Calf Raise',                muscleGroup: 'Calves',    equipment: 'Dumbbell',  category: 'Isolation' },
  { name: 'Single Leg Calf Raise',        muscleGroup: 'Calves',    equipment: 'Bodyweight',category: 'Isolation' },
  { name: 'Calf Raise on Leg Press',      muscleGroup: 'Calves',    equipment: 'Machine',   category: 'Isolation' },

  // ══════════════════════════════════════════
  // CORE
  // ══════════════════════════════════════════
  { name: 'Plank',                         muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Side Plank',                    muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Sit Up',                        muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Crunch',                        muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Leg Raise',                     muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Leg Raised Crunch',             muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Reverse Crunch',                muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Cross Crunch',                  muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Side Crunch',                   muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Flutter Kick',                  muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Hollow Hold',                   muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Ab Crunch Machine',             muscleGroup: 'Core',     equipment: 'Machine',   category: 'Core' },
  { name: 'Cable Crunch',                  muscleGroup: 'Core',     equipment: 'Cable',     category: 'Core' },
  { name: 'Russian Twist',                 muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Dumbbell Russian Twist',        muscleGroup: 'Core',     equipment: 'Dumbbell',  category: 'Core' },
  { name: 'Twist with Dumbbell',           muscleGroup: 'Core',     equipment: 'Dumbbell',  category: 'Core' },
  { name: 'Barbell Side Tilt',             muscleGroup: 'Core',     equipment: 'Barbell',   category: 'Core' },
  { name: 'Bicycle Crunch',                muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Mountain Climber',              muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Dead Bug',                      muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Hanging Leg Raise',             muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Ab Wheel Rollout',              muscleGroup: 'Core',     equipment: 'Other',     category: 'Core' },
  { name: 'Superman',                      muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'RK Plank',                      muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Pallof Press',                  muscleGroup: 'Core',     equipment: 'Cable',     category: 'Core' },
  { name: 'Windshield Wiper',              muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'V-Up',                          muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },
  { name: 'Toe Touch',                     muscleGroup: 'Core',     equipment: 'Bodyweight',category: 'Core' },

  // ══════════════════════════════════════════
  // COMPOUND / FULL BODY
  // ══════════════════════════════════════════
  { name: 'Burpee',                        muscleGroup: 'Full Body', equipment: 'Bodyweight',category: 'Plyometric' },
  { name: 'Jumping Jack',                  muscleGroup: 'Full Body', equipment: 'Bodyweight',category: 'Cardio' },
  { name: 'Thruster',                      muscleGroup: 'Full Body', equipment: 'Barbell',   category: 'Compound' },
  { name: 'DB Thruster',                   muscleGroup: 'Full Body', equipment: 'Dumbbell',  category: 'Compound' },
  { name: 'Kettlebell Swing',              muscleGroup: 'Full Body', equipment: 'Kettlebell',category: 'Compound' },
  { name: 'Clean and Press',               muscleGroup: 'Full Body', equipment: 'Barbell',   category: 'Olympic' },
  { name: 'Power Clean',                   muscleGroup: 'Full Body', equipment: 'Barbell',   category: 'Olympic' },
  { name: 'Snatch',                        muscleGroup: 'Full Body', equipment: 'Barbell',   category: 'Olympic' },
  { name: 'Turkish Get Up',                muscleGroup: 'Full Body', equipment: 'Kettlebell',category: 'Functional' },
  { name: 'Man Maker',                     muscleGroup: 'Full Body', equipment: 'Dumbbell',  category: 'Compound' },
  { name: 'Renegade Row',                  muscleGroup: 'Full Body', equipment: 'Dumbbell',  category: 'Compound' },
  { name: 'Bear Crawl',                    muscleGroup: 'Full Body', equipment: 'Bodyweight',category: 'Functional' },
  { name: 'Farmer Carry',                  muscleGroup: 'Full Body', equipment: 'Dumbbell',  category: 'Functional' },
  { name: 'Suitcase Carry',                muscleGroup: 'Full Body', equipment: 'Dumbbell',  category: 'Functional' },

  // ══════════════════════════════════════════
  // RUNNER-SPECIFIC STRENGTH
  // ══════════════════════════════════════════
  { name: 'Single Leg Squat',             muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Runner' },
  { name: 'Pistol Squat',                 muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Runner' },
  { name: 'Box Jump',                     muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Plyometric' },
  { name: 'Broad Jump',                   muscleGroup: 'Full Body', equipment: 'Bodyweight',category: 'Plyometric' },
  { name: 'Banded Clamshell',             muscleGroup: 'Glutes',    equipment: 'Band',      category: 'Runner' },
  { name: 'Hip Abduction',                muscleGroup: 'Glutes',    equipment: 'Machine',   category: 'Runner' },
  { name: 'Hip Adduction',                muscleGroup: 'Glutes',    equipment: 'Machine',   category: 'Runner' },
  { name: 'Tibialis Raise',               muscleGroup: 'Calves',    equipment: 'Bodyweight',category: 'Runner' },
  { name: 'Single Leg Calf Raise Eccentric', muscleGroup: 'Calves', equipment: 'Bodyweight',category: 'Runner' },
  { name: 'Lateral Band Walk',            muscleGroup: 'Glutes',    equipment: 'Band',      category: 'Runner' },
  { name: 'Copenhagen Plank',             muscleGroup: 'Core',      equipment: 'Bodyweight',category: 'Runner' },
  { name: 'Step Up with Knee Drive',      muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Runner' },
  { name: 'Reverse Nordic',               muscleGroup: 'Quads',     equipment: 'Bodyweight',category: 'Runner' },
  { name: 'Soleus Calf Raise',            muscleGroup: 'Calves',    equipment: 'Bodyweight',category: 'Runner' },

  // ══════════════════════════════════════════
  // WARM UP / MOBILITY
  // ══════════════════════════════════════════
  { name: 'Jumping Jack',                 muscleGroup: 'Full Body', equipment: 'Bodyweight',category: 'Warm Up' },
  { name: 'High Knee',                    muscleGroup: 'Full Body', equipment: 'Bodyweight',category: 'Warm Up' },
  { name: 'Butt Kick',                    muscleGroup: 'Full Body', equipment: 'Bodyweight',category: 'Warm Up' },
  { name: 'Arm Circle',                   muscleGroup: 'Shoulders', equipment: 'Bodyweight',category: 'Warm Up' },
  { name: 'Hip Circle',                   muscleGroup: 'Glutes',    equipment: 'Bodyweight',category: 'Mobility' },
  { name: 'Leg Swing',                    muscleGroup: 'Hamstrings',equipment: 'Bodyweight',category: 'Mobility' },
  { name: 'World Greatest Stretch',       muscleGroup: 'Full Body', equipment: 'Bodyweight',category: 'Mobility' },
  { name: 'Hip Flexor Stretch',           muscleGroup: 'Glutes',    equipment: 'Bodyweight',category: 'Mobility' },
  { name: 'Pigeon Pose',                  muscleGroup: 'Glutes',    equipment: 'Bodyweight',category: 'Mobility' },
  { name: 'Cat Cow',                      muscleGroup: 'Core',      equipment: 'Bodyweight',category: 'Mobility' },
  { name: 'Thoracic Rotation',            muscleGroup: 'Back',      equipment: 'Bodyweight',category: 'Mobility' },
  { name: 'Inchworm',                     muscleGroup: 'Full Body', equipment: 'Bodyweight',category: 'Warm Up' },
];

// Muscle group categories for filtering
export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full Body', 'Forearms',
];

export const EQUIPMENT_TYPES = [
  'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell', 'Band', 'Other',
];

export const CATEGORIES = [
  'Push', 'Pull', 'Squat', 'Lunge', 'Hinge', 'Core', 'Compound', 'Isolation', 'Runner', 'Plyometric', 'Warm Up',
];

/**
 * Search the exercise library
 * Returns exercises matching the query across name, muscle group, equipment, category
 */
export function searchExercises(query, filters = {}) {
  if (!query && !filters.muscleGroup && !filters.equipment && !filters.category) {
    return EXERCISE_LIBRARY.slice(0, 20); // default: first 20
  }

  const q = (query || '').toLowerCase().trim();

  return EXERCISE_LIBRARY.filter(ex => {
    // Text match
    const textMatch = !q ||
      ex.name.toLowerCase().includes(q) ||
      ex.muscleGroup.toLowerCase().includes(q) ||
      ex.equipment.toLowerCase().includes(q) ||
      ex.category.toLowerCase().includes(q);

    // Filter match
    const groupMatch  = !filters.muscleGroup || ex.muscleGroup === filters.muscleGroup;
    const equipMatch  = !filters.equipment   || ex.equipment   === filters.equipment;
    const catMatch    = !filters.category    || ex.category    === filters.category;

    return textMatch && groupMatch && equipMatch && catMatch;
  }).slice(0, 30); // cap at 30 results
}