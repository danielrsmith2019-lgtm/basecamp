'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

const ENERGY_OPTIONS = [
  { value: 1, emoji: '😴', label: 'Drained'   },
  { value: 2, emoji: '😐', label: 'Tired'     },
  { value: 3, emoji: '🙂', label: 'Okay'      },
  { value: 4, emoji: '😊', label: 'Good'      },
  { value: 5, emoji: '⚡', label: 'Energized' },
];

export default function ReadinessCheckIn({ onComplete, onClose }) {
  const [sleep, setSleep]    = useState('');
  const [energy, setEnergy]  = useState(null);
  const [soreness, setSoreness] = useState(null);

  const canSubmit = sleep !== '' && energy !== null && soreness !== null;

  function handleSubmit() {
    if (!canSubmit) return;
    onComplete({
      sleepHours:  parseFloat(sleep),
      energyLevel: energy,
      soreness,
      date: new Date().toISOString().split('T')[0],
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end
                 sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px]
                   shadow-xl max-w-sm w-full p-6"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-[17px] font-semibold text-primary">Morning check-in</h3>
            <p className="bc-caption mt-0.5">Takes about 10 seconds</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-canvas flex items-center justify-center
                       text-secondary hover:text-primary transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-6">
          {/* ── Sleep ── */}
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-2">
              Hours of sleep
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={sleep}
                onChange={e => setSleep(e.target.value)}
                placeholder="7.5"
                className="bc-input bc-data w-28 text-center"
              />
              <span className="text-sm text-secondary">hours last night</span>
            </div>
          </div>

          {/* ── Energy ── */}
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-2">
              Energy level
            </label>
            <div className="flex gap-2">
              {ENERGY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setEnergy(opt.value)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-[14px]
                              border transition-all`}
                  style={{
                    background:   energy === opt.value ? '#E3F2FD' : '#F9F9FB',
                    borderColor:  energy === opt.value ? '#007AFF' : 'rgba(60,60,67,0.12)',
                  }}>
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-[9px] text-secondary">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Soreness ── */}
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-2">
              Muscle soreness
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setSoreness(n)}
                  className="flex-1 py-2.5 rounded-[10px] bc-data text-sm
                             border transition-all"
                  style={{
                    background:  soreness === n
                      ? n <= 2 ? '#E8F5E9' : n <= 3 ? '#FFF3E0' : '#FFEBEE'
                      : '#F9F9FB',
                    borderColor: soreness === n
                      ? n <= 2 ? '#2E7D32' : n <= 3 ? '#E65100' : '#C62828'
                      : 'rgba(60,60,67,0.12)',
                    color: soreness === n
                      ? n <= 2 ? '#2E7D32' : n <= 3 ? '#E65100' : '#C62828'
                      : '#8E8E93',
                  }}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-tertiary">None</span>
              <span className="text-[10px] text-tertiary">Very sore</span>
            </div>
          </div>
        </div>

        {/* ── Submit ── */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bc-btn-primary mt-6 disabled:opacity-40 disabled:cursor-not-allowed">
          Save check-in
        </button>
      </div>
    </div>
  );
}