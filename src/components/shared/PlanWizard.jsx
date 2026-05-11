'use client';

/**
 * PlanWizard — Multi-step form for collecting plan generation inputs.
 * 
 * Step 1: Goal (race type, target time, race date)
 * Step 2: Current Fitness (weekly mileage, lifting experience, lifting goal)
 * Step 3: Schedule (available days, time per session, equipment)
 * 
 * On submit, calls the /api/generate-plan endpoint and returns the plan.
 */

import { useState } from 'react';
import { Target, Activity, Calendar, ChevronRight, ChevronLeft, Loader2, Sparkles } from 'lucide-react';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const INITIAL_STATE = {
  // Step 1: Goal
  raceType: 'none',
  targetTime: '',
  raceDate: '',
  planStyle: 'mileage',  // 'mileage' = specific distances, 'time' = duration/effort

  // Step 2: Fitness
  weeklyMileage: '',
  liftingExperience: 'intermediate',
  liftingGoal: 'maintenance',

  // Step 3: Schedule
  availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  runsPerWeek: 3,
  liftsPerWeek: 3,
  longRunDay: 'saturday',
  fullRestDays: ['sunday'],
  maxMinutesPerSession: 60,
  equipment: 'full_gym',
};

export default function PlanWizard({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_STATE);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleDay(day) {
    setForm(prev => {
      const isSelected = prev.availableDays.includes(day);
      const newAvailable = isSelected
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day];
      // If adding a day back to training, remove it from full rest days
      const newRest = isSelected
        ? prev.fullRestDays
        : prev.fullRestDays.filter(d => d !== day);
      return { ...prev, availableDays: newAvailable, fullRestDays: newRest };
    });
  }

  function toggleFullRestDay(day) {
    setForm(prev => {
      const isRest = prev.fullRestDays.includes(day);
      const newRest = isRest
        ? prev.fullRestDays.filter(d => d !== day)
        : [...prev.fullRestDays, day];
      // If marking as full rest, remove from training days
      const newAvailable = isRest
        ? prev.availableDays
        : prev.availableDays.filter(d => d !== day);
      // If long run was on this day, clear it
      const newLongRun = !isRest && prev.longRunDay === day ? '' : prev.longRunDay;
      return { ...prev, fullRestDays: newRest, availableDays: newAvailable, longRunDay: newLongRun };
    });
  }

  function canAdvance() {
    if (step === 1) {
      if (form.raceType !== 'none' && !form.raceDate) return false;
      return true;
    }
    if (step === 2) {
      return form.weeklyMileage !== '';
    }
    if (step === 3) {
      return form.availableDays.length >= 2 && form.fullRestDays.length >= 1;
    }
    return true;
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Plan generation failed');
      }

      const plan = await res.json();
      onComplete(plan);
    } catch (err) {
      console.error('Plan generation error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setGenerating(false);
    }
  }

  // ── Generating overlay ──
  if (generating) {
    return (
      <div className="stride-card p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Loader2 size={28} className="text-accent animate-spin" />
          </div>
          <div>
            <p className="text-primary font-semibold">Building Your Plan</p>
            <p className="text-secondary text-sm mt-1">
              Applying exercise science rules, scheduling around conflicts, building progressive overload...
            </p>
          </div>
          <div className="flex gap-1 mt-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-accent"
                style={{
                  animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  opacity: 0.3,
                }}
              />
            ))}
          </div>
          <style jsx>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.3); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="stride-card overflow-hidden">
      {/* ── Progress Bar ── */}
      <div className="flex border-b border-gray-800">
        {[
          { num: 1, label: 'Your Goal', icon: Target },
          { num: 2, label: 'Your Fitness', icon: Activity },
          { num: 3, label: 'Your Schedule', icon: Calendar },
        ].map(({ num, label, icon: Icon }) => (
          <button
            key={num}
            onClick={() => num < step && setStep(num)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors
              ${step === num ? 'text-accent border-b-2 border-accent bg-accent/5' :
                step > num ? 'text-green-400 cursor-pointer hover:bg-white/5' :
                'text-muted cursor-default'}`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
              ${step > num ? 'bg-green-400/20 text-green-400' :
                step === num ? 'bg-accent/20 text-accent' :
                'bg-surface text-muted'}`}>
              {step > num ? '✓' : num}
            </div>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Step Content ── */}
      <div className="p-6">

        {/* ── STEP 1: GOAL ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-primary mb-1">What are you training for?</h3>
              <p className="text-sm text-secondary">We'll build your plan around this goal.</p>
            </div>

            {/* Race Type */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Race / Goal Type</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: 'marathon', label: 'Marathon (26.2 mi)', desc: 'Full marathon training with strength' },
                  { value: 'half_marathon', label: 'Half Marathon (13.1 mi)', desc: 'Half marathon with strength maintenance' },
                  { value: 'none', label: 'No Race — General Fitness', desc: 'Balanced hybrid training' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update('raceType', opt.value)}
                    className={`p-4 rounded-xl border text-left transition-all
                      ${form.raceType === opt.value
                        ? 'border-accent bg-accent/5'
                        : 'border-gray-700 bg-surface hover:border-gray-600'}`}
                  >
                    <p className="text-sm font-medium text-primary">{opt.label}</p>
                    <p className="text-xs text-muted mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Time (only for race goals) */}
            {form.raceType !== 'none' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Target {form.raceType === 'marathon' ? 'Marathon' : 'Half Marathon'} Time
                </label>
                <input
                  type="text"
                  value={form.targetTime}
                  onChange={(e) => update('targetTime', e.target.value)}
                  placeholder={form.raceType === 'marathon' ? '3:59:00' : '1:45:00'}
                  className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <p className="text-[10px] text-muted mt-1">Format: H:MM:SS (leave blank if no specific target)</p>
              </div>
            )}

            {/* Race Date (only for race goals) */}
            {form.raceType !== 'none' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Race Date</label>
                <input
                  type="date"
                  value={form.raceDate}
                  onChange={(e) => update('raceDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            )}

            {/* Plan Style */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Plan Style</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: 'mileage', label: 'Mileage-Based', desc: 'Specific distances for every run. "Run 6 miles at 8:30 pace." Best for runners training by the numbers.' },
                  { value: 'time', label: 'Time-Based', desc: 'Run by duration and effort. "45 min easy run." Better for beginners or when pace doesn\'t matter.' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update('planStyle', opt.value)}
                    className={`p-4 rounded-xl border text-left transition-all
                      ${form.planStyle === opt.value
                        ? 'border-cyan-500 bg-cyan-500/5'
                        : 'border-gray-700 bg-surface hover:border-gray-600'}`}
                  >
                    <p className="text-sm font-medium text-primary">{opt.label}</p>
                    <p className="text-xs text-muted mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: CURRENT FITNESS ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-primary mb-1">Where are you now?</h3>
              <p className="text-sm text-secondary">This helps us set the right starting volume and intensity.</p>
            </div>

            {/* Weekly Mileage */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Current Weekly Running Mileage</label>
              <input
                type="number"
                value={form.weeklyMileage}
                onChange={(e) => update('weeklyMileage', e.target.value)}
                placeholder="15"
                className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              <p className="text-[10px] text-muted mt-1">Miles per week. Enter 0 if you're not running yet.</p>
            </div>

            {/* Lifting Experience */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Lifting Experience</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'beginner', label: 'Beginner', desc: '< 6 months' },
                  { value: 'intermediate', label: 'Intermediate', desc: '6 mo – 2 yrs' },
                  { value: 'advanced', label: 'Advanced', desc: '2+ years' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update('liftingExperience', opt.value)}
                    className={`p-3 rounded-xl border text-center transition-all
                      ${form.liftingExperience === opt.value
                        ? 'border-accent bg-accent/5'
                        : 'border-gray-700 bg-surface hover:border-gray-600'}`}
                  >
                    <p className="text-sm font-medium text-primary">{opt.label}</p>
                    <p className="text-[10px] text-muted mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Lifting Goal */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Lifting Goal</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: 'strength', label: 'Strength', desc: 'Heavy weight, low reps (3-5). Focus on getting stronger.' },
                  { value: 'hypertrophy', label: 'Hypertrophy', desc: 'Moderate weight, moderate reps (8-12). Focus on muscle growth.' },
                  { value: 'maintenance', label: 'Maintenance', desc: 'Keep current strength while prioritizing running.' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update('liftingGoal', opt.value)}
                    className={`p-4 rounded-xl border text-left transition-all
                      ${form.liftingGoal === opt.value
                        ? 'border-blue-500 bg-blue-500/5'
                        : 'border-gray-700 bg-surface hover:border-gray-600'}`}
                  >
                    <p className="text-sm font-medium text-primary">{opt.label}</p>
                    <p className="text-xs text-muted mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: SCHEDULE ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-primary mb-1">Design your week</h3>
              <p className="text-sm text-secondary">Pick your training days, rest days, and preferences. We'll build around your schedule.</p>
            </div>

            {/* Day Grid — combined training + rest selector */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Weekly Layout</label>
              <p className="text-[10px] text-muted mb-2">Tap once for training day, tap again for full rest day.</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((day, i) => {
                  const isTraining = form.availableDays.includes(day);
                  const isFullRest = form.fullRestDays.includes(day);

                  return (
                    <button
                      key={day}
                      onClick={() => {
                        if (isTraining) {
                          // Training → Full Rest
                          toggleDay(day);
                          toggleFullRestDay(day);
                        } else if (isFullRest) {
                          // Full Rest → Unselected
                          toggleFullRestDay(day);
                        } else {
                          // Unselected → Training
                          toggleDay(day);
                        }
                      }}
                      className={`py-3 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-0.5
                        ${isTraining ? 'bg-accent text-white' :
                          isFullRest ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          'bg-surface border border-gray-700 text-muted hover:border-gray-600'}`}
                    >
                      {DAY_LABELS[i]}
                      <span className="text-[8px] opacity-70">
                        {isTraining ? 'train' : isFullRest ? 'rest' : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-accent" />
                  <span className="text-[10px] text-muted">Training ({form.availableDays.length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-purple-500/40" />
                  <span className="text-[10px] text-muted">Full Rest ({form.fullRestDays.length})</span>
                </div>
                {form.fullRestDays.length < 1 && (
                  <span className="text-[10px] text-orange-400">← At least 1 full rest day required</span>
                )}
              </div>
            </div>

            {/* Runs & Lifts Per Week */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Runs Per Week</label>
                <select
                  value={form.runsPerWeek}
                  onChange={(e) => update('runsPerWeek', Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none"
                >
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n} run{n !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Lifts Per Week</label>
                <select
                  value={form.liftsPerWeek}
                  onChange={(e) => update('liftsPerWeek', Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none"
                >
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n} session{n !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-muted -mt-3">
              Total: {form.runsPerWeek + form.liftsPerWeek} sessions/week
              {form.runsPerWeek + form.liftsPerWeek > form.availableDays.length && (
                <span className="text-orange-400"> — some days will have both a run and a lift</span>
              )}
            </p>

            {/* Long Run Day */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Long Run Day</label>
              <select
                value={form.longRunDay}
                onChange={(e) => update('longRunDay', e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none"
              >
                {form.availableDays.map(day => (
                  <option key={day} value={day}>
                    {DAY_LABELS[DAYS.indexOf(day)]}
                    {(day === 'saturday' || day === 'sunday') ? ' (recommended)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted mt-1">
                The day before your long run will be rest or easy to ensure fresh legs.
              </p>
            </div>

            {/* Time Per Session */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Max Time Per Session (minutes)</label>
              <select
                value={form.maxMinutesPerSession}
                onChange={(e) => update('maxMinutesPerSession', Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={75}>75 minutes</option>
                <option value={90}>90 minutes</option>
                <option value={120}>120 minutes</option>
              </select>
            </div>

            {/* Equipment */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Equipment Access</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: 'full_gym', label: 'Full Gym', desc: 'Barbells, dumbbells, cables, machines' },
                  { value: 'home_basic', label: 'Home — Basic', desc: 'Dumbbells + pull-up bar' },
                  { value: 'bodyweight', label: 'Bodyweight Only', desc: 'No equipment needed' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => update('equipment', opt.value)}
                    className={`p-4 rounded-xl border text-left transition-all
                      ${form.equipment === opt.value
                        ? 'border-purple-500 bg-purple-500/5'
                        : 'border-gray-700 bg-surface hover:border-gray-600'}`}
                  >
                    <p className="text-sm font-medium text-primary">{opt.label}</p>
                    <p className="text-xs text-muted mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* ── Navigation Buttons ── */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
          <div>
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-secondary text-sm hover:text-primary transition-colors"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            ) : (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-secondary text-sm hover:text-primary transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-accent hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all"
            >
              Next
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all"
            >
              <Sparkles size={14} />
              Generate Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}