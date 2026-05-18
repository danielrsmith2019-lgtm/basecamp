import {
  Footprints,
  Flame,
  Zap,
  Mountain,
  Flag,
  Wind,
  Moon,
  HelpCircle,
  Heart,
  Dumbbell,
  Target,
  Bike,
  Trophy,
  BarChart3,
  ClipboardList,
  Check,
  X,
  Minus,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Timer,
  Gauge,
  Shield,
  AlertTriangle,
  Info,
  BedDouble,
  CircleDot,
  Activity,
  CalendarCheck,
  Scale,
  Repeat,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════
// RUN TYPE ICONS
// ═══════════════════════════════════════════════════════

const RUN_ICONS = {
  'Easy Run':  Footprints,
  'Tempo':     Flame,
  'Intervals': Zap,
  'Long Run':  Mountain,
  'Race':      Flag,
  'Shakeout':  Wind,
  'REST':      Moon,
  'Rest':      Moon,
  'Rest/Lift': Moon,
  'Optional':  HelpCircle,
  'Recovery':  Heart,
};

export function getRunIcon(runType) {
  return RUN_ICONS[runType] || Footprints;
}

export function RunTypeIcon({ runType, size = 18, className = 'text-activity-run' }) {
  const Icon = getRunIcon(runType);
  return <Icon size={size} strokeWidth={2} className={className} />;
}


// ═══════════════════════════════════════════════════════
// LIFT SESSION ICONS
// ═══════════════════════════════════════════════════════

const SESSION_ICONS = {
  'push':       Dumbbell,
  'pull':       Activity,
  'leg':        Target,
  'upper':      Dumbbell,
  'lower':      Target,
  'full body':  Activity,
  'abs':        Shield,
  'arm':        Dumbbell,
  'back':       Activity,
  'chest':      Dumbbell,
  'shoulder':   Dumbbell,
};

export function getLiftIcon(sessionName) {
  const lower = (sessionName || '').toLowerCase();
  for (const [key, icon] of Object.entries(SESSION_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return Dumbbell;
}

export function LiftSessionIcon({ sessionName, size = 18, className = 'text-activity-lift' }) {
  const Icon = getLiftIcon(sessionName);
  return <Icon size={size} strokeWidth={2} className={className} />;
}


// ═══════════════════════════════════════════════════════
// ACTIVITY TYPE ICONS
// ═══════════════════════════════════════════════════════

const ACTIVITY_ICONS = {
  run:    Footprints,
  lift:   Dumbbell,
  cardio: Bike,
  rest:   Moon,
  other:  Activity,
};

export function ActivityIcon({ type, size = 18, className }) {
  const Icon = ACTIVITY_ICONS[type] || Activity;
  const defaultColor = {
    run:    'text-activity-run',
    lift:   'text-activity-lift',
    cardio: 'text-activity-cardio',
    rest:   'text-activity-rest',
    other:  'text-secondary',
  };
  return <Icon size={size} strokeWidth={2} className={className || defaultColor[type] || 'text-secondary'} />;
}


// ═══════════════════════════════════════════════════════
// STATUS ICONS
// ═══════════════════════════════════════════════════════

export function StatusIcon({ status, size = 14, className }) {
  if (status === 'completed') return <Check    size={size} strokeWidth={2.5} className={className || 'text-status-done'}    />;
  if (status === 'skipped')   return <X        size={size} strokeWidth={2.5} className={className || 'text-status-skipped'} />;
  return                              <Minus   size={size} strokeWidth={2}   className={className || 'text-muted'}           />;
}


// ═══════════════════════════════════════════════════════
// READINESS ICONS
// Maps readiness score (1–5) to a Lucide icon + color
// ═══════════════════════════════════════════════════════

export const READINESS_ICON_MAP = [
  { score: 1, Icon: BedDouble,    label: 'Exhausted', color: '#8E8E93',  bg: '#F2F2F7'  }, // gray
  { score: 2, Icon: TrendingDown, label: 'Low',       color: '#FF3B30',  bg: '#FFEBEE'  }, // red
  { score: 3, Icon: Minus,        label: 'Okay',      color: '#FF9500',  bg: '#FFF3E0'  }, // orange
  { score: 4, Icon: Zap,          label: 'Good',      color: '#007AFF',  bg: '#E3F2FD'  }, // blue
  { score: 5, Icon: Flame,        label: 'Fired Up',  color: '#34C759',  bg: '#E8F5E9'  }, // green
];

/**
 * Renders a readiness icon for a given score (1–5).
 * Usage: <ReadinessIcon score={4} size={24} />
 */
export function ReadinessIcon({ score, size = 24, showBg = false, className }) {
  const config = READINESS_ICON_MAP.find(r => r.score === score) || READINESS_ICON_MAP[2];
  const { Icon, color, bg } = config;

  if (showBg) {
    return (
      <div style={{
        width: size + 16,
        height: size + 16,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={size} strokeWidth={2} style={{ color }} className={className} />
      </div>
    );
  }

  return <Icon size={size} strokeWidth={2} style={{ color }} className={className} />;
}


// ═══════════════════════════════════════════════════════
// FEATURE / DECORATIVE ICONS
// ═══════════════════════════════════════════════════════

export {
  Flame        as StreakIcon,
  Trophy       as PRIcon,
  BarChart3    as VolumeIcon,
  Gauge        as PaceIcon,
  Timer        as TimerIcon,
  Mountain     as DistanceIcon,
  AlertTriangle as WarningIcon,
  Info         as InfoIcon,
  BedDouble    as RestIcon,
  TrendingUp   as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  ArrowRight   as ArrowIcon,
  CalendarCheck as PlanIcon,
  Scale        as BalanceIcon,
  Repeat       as ConsistencyIcon,
  Target       as GoalIcon,
  Heart        as RecoveryIcon,
};


// ═══════════════════════════════════════════════════════
// INSIGHT TYPE ICONS
// ═══════════════════════════════════════════════════════

const INSIGHT_ICONS_BY_ID = {
  'leg-run-conflict':   AlertTriangle,
  'volume-spike':       TrendingUp,
  'rest-needed':        BedDouble,
  'rest-soon':          Moon,
  'overtraining-rpe':   Heart,
  'effort-creep':       Activity,
  'skip-pattern-runs':  Footprints,
  'skip-pattern-lifts': Dumbbell,
  'pace-creep-easy':    Gauge,
};

const INSIGHT_ICONS_BY_TYPE = {
  'warning':    AlertTriangle,
  'suggestion': Shield,
  'info':       Gauge,
};

export function InsightIcon({ type, insightId, size = 20, className }) {
  let Icon = null;
  if (insightId) {
    for (const [prefix, icon] of Object.entries(INSIGHT_ICONS_BY_ID)) {
      if (insightId.startsWith(prefix)) { Icon = icon; break; }
    }
  }
  if (!Icon) Icon = INSIGHT_ICONS_BY_TYPE[type] || Gauge;

  const defaultColor = {
    warning:    'text-phase-peak',
    suggestion: 'text-phase-build',
    info:       'text-secondary',
  };

  return <Icon size={size} strokeWidth={2} className={className || defaultColor[type] || 'text-secondary'} />;
}