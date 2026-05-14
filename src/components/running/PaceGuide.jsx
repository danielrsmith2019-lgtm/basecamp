'use client';

/**
 * PaceGuide — Reference cards for running effort zones.
 * Ported from STRIDE's PaceGuide.jsx.
 * 
 * Pace values calibrated from Dan's current half marathon pace (~8:00/mi).
 * These should be adjustable in settings later.
 */

const PACE_ZONES = [
  {
    name: 'Recovery',
    pace: '9:30-10:00',
    rpe: '2–3',
    description: 'Barely moving. Full recovery between hard sessions.',
    color: 'border-phase-recovery',
    bgColor: 'bg-phase-recovery/10',
    textColor: 'text-phase-recovery',
  },
  {
    name: 'Easy',
    pace: '8:30-9:00',
    rpe: '3–4',
    description: 'Conversational. Can speak full sentences. Most of your miles live here.',
    color: 'border-phase-base',
    bgColor: 'bg-phase-base/10',
    textColor: 'text-phase-base',
  },
  {
    name: 'Long Run',
    pace: '8:45-9:15',
    rpe: '4–5',
    description: 'Relaxed and controlled. Slightly slower than easy. Save energy for the distance.',
    color: 'border-phase-taper',
    bgColor: 'bg-phase-taper/10',
    textColor: 'text-phase-taper',
  },
  {
    name: 'Marathon Pace',
    pace: '8:10-8:25',
    rpe: '5–6',
    description: 'Comfortably hard. Short phrases only. Your race-day target.',
    color: 'border-phase-build',
    bgColor: 'bg-phase-build/10',
    textColor: 'text-phase-build',
  },
  {
    name: 'Tempo',
    pace: '7:30-7:50',
    rpe: '6–7',
    description: 'Hard. A few words at a time. Controlled discomfort. Builds lactate threshold.',
    color: 'border-phase-peak',
    bgColor: 'bg-phase-peak/10',
    textColor: 'text-phase-peak',
  },
  {
    name: 'Interval',
    pace: '3:20-3:30 /800m',
    rpe: '8–9',
    description: 'Very hard. Cannot speak. Short bursts with recovery between. Builds VO2max.',
    color: 'border-status-skipped',
    bgColor: 'bg-status-skipped/10',
    textColor: 'text-status-skipped',
  },
  {
    name: 'Strides',
    pace: '~6:30-7:00 effort',
    rpe: '7–8',
    description: 'Fast and controlled, not sprinting. 100m bursts after easy runs. Builds speed without fatigue.',
    color: 'border-accent',
    bgColor: 'bg-accent/10',
    textColor: 'text-accent',
  },
];

export default function PaceGuide() {
  return (
    <div>
      <p className="text-secondary text-sm mb-6">
        Paces calibrated from your current half marathon pace. 
        All training paces are <span className="font-semibold text-primary">relative</span> — 
        as fitness improves, reassess after every down week.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PACE_ZONES.map((zone) => (
          <div
            key={zone.name}
            className={`
              bc-card stride-accent-left p-4
              border-t-2 ${zone.color}
            `}
          >
            {/* Zone name + RPE */}
            <div className="flex items-center justify-between mb-2">
              <span className={`font-semibold ${zone.textColor}`}>
                {zone.name}
              </span>
              <span className="stride-badge bg-surface text-secondary">
                RPE {zone.rpe}
              </span>
            </div>

            {/* Pace in big monospace */}
            <p className="stride-data text-xl font-bold text-primary mb-2">
              {zone.pace}
            </p>

            {/* Description */}
            <p className="text-xs text-secondary leading-relaxed">
              {zone.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}