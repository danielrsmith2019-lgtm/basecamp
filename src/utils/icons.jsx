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
  'Easy Run':    Footprints,
  'Tempo':       Flame,
  'Intervals':   Zap,
  'Long Run':    Mountain,
  'Race':        Flag,
  'Shakeout':    Wind,
  'REST':        Moon,
  'Rest':        Moon,
  'Rest/Lift':   Moon,
  'Optional':    HelpCircle,
  'Recovery':    Heart,
};

/**
 * Returns the Lucide icon component for a run type.
 * Usage: const Icon = getRunIcon('Tempo'); <Icon size={18} />
 */
export function getRunIcon(runType) {
  return RUN_ICONS[runType] || Footprints;
}

/**
 * Renders a run type icon with consistent sizing and color.
 */
export function RunTypeIcon({ runType, size = 18, className = 'text-activity-run' }) {
  const Icon = getRunIcon(runType);
  return <Icon size={size} strokeWidth={2} className={className} />;
}


// ═══════════════════════════════════════════════════════
// LIFT SESSION ICONS
// ═══════════════════════════════════════════════════════

const SESSION_ICONS = {
  'push':        Dumbbell,
  'pull':        Activity,
  'leg':         Target,
  'upper':       Dumbbell,
  'lower':       Target,
  'full body':   Activity,
  'abs':         Shield,
  'arm':         Dumbbell,
  'back':        Activity,
  'chest':       Dumbbell,
  'shoulder':    Dumbbell,
};

/**
 * Returns the Lucide icon component for a lift session.
 */
export function getLiftIcon(sessionName) {
  const lower = (sessionName || '').toLowerCase();
  for (const [key, icon] of Object.entries(SESSION_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return Dumbbell;
}

/**
 * Renders a lift session icon with consistent sizing and color.
 */
export function LiftSessionIcon({ sessionName, size = 18, className = 'text-activity-lift' }) {
  const Icon = getLiftIcon(sessionName);
  return <Icon size={size} strokeWidth={2} className={className} />;
}


// ═══════════════════════════════════════════════════════
// ACTIVITY TYPE ICONS (for cards, schedule, log)
// ═══════════════════════════════════════════════════════

const ACTIVITY_ICONS = {
  run:    Footprints,
  lift:   Dumbbell,
  cardio: Bike,
  rest:   Moon,
  other:  Activity,
};

/**
 * Renders the icon for any workout type.
 */
export function ActivityIcon({ type, size = 18, className }) {
  const Icon = ACTIVITY_ICONS[type] || Activity;
  const defaultColor = {
    run: 'text-activity-run',
    lift: 'text-activity-lift',
    cardio: 'text-activity-cardio',
    rest: 'text-activity-rest',
    other: 'text-secondary',
  };
  return <Icon size={size} strokeWidth={2} className={className || defaultColor[type] || 'text-secondary'} />;
}


// ═══════════════════════════════════════════════════════
// STATUS ICONS
// ═══════════════════════════════════════════════════════

/**
 * Renders a status icon: check, x, or dash.
 */
export function StatusIcon({ status, size = 14, className }) {
  if (status === 'completed') {
    return <Check size={size} strokeWidth={2.5} className={className || 'text-status-done'} />;
  }
  if (status === 'skipped') {
    return <X size={size} strokeWidth={2.5} className={className || 'text-status-skipped'} />;
  }
  return <Minus size={size} strokeWidth={2} className={className || 'text-muted'} />;
}


// ═══════════════════════════════════════════════════════
// FEATURE / DECORATIVE ICONS
// ═══════════════════════════════════════════════════════

export {
  Flame as StreakIcon,
  Trophy as PRIcon,
  BarChart3 as VolumeIcon,
  Gauge as PaceIcon,
  Timer as TimerIcon,
  Mountain as DistanceIcon,
  AlertTriangle as WarningIcon,
  Info as InfoIcon,
  BedDouble as RestIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  ArrowRight as ArrowIcon,
  CalendarCheck as PlanIcon,
  Scale as BalanceIcon,
  Repeat as ConsistencyIcon,
  Target as GoalIcon,
  Heart as RecoveryIcon,
};


// ═══════════════════════════════════════════════════════
// INSIGHT TYPE ICONS
// ═══════════════════════════════════════════════════════

const INSIGHT_ICONS_BY_ID = {
  'leg-run-conflict':  AlertTriangle,
  'volume-spike':      TrendingUp,
  'rest-needed':       BedDouble,
  'rest-soon':         Moon,
  'overtraining-rpe':  Heart,
  'effort-creep':      Activity,
  'skip-pattern-runs': Footprints,
  'skip-pattern-lifts': Dumbbell,
  'pace-creep-easy':   Gauge,
};

const INSIGHT_ICONS_BY_TYPE = {
  'warning':    AlertTriangle,
  'suggestion': Shield,
  'info':       Gauge,
};

/**
 * Renders an insight icon. Tries to match by insight ID first
 * for a specific icon, falls back to type-based icon.
 */
export function InsightIcon({ type, insightId, size = 20, className }) {
  // Try specific icon by ID prefix
  let Icon = null;
  if (insightId) {
    for (const [prefix, icon] of Object.entries(INSIGHT_ICONS_BY_ID)) {
      if (insightId.startsWith(prefix)) {
        Icon = icon;
        break;
      }
    }
  }

  // Fall back to type-based
  if (!Icon) {
    Icon = INSIGHT_ICONS_BY_TYPE[type] || Gauge;
  }

  const defaultColor = {
    warning: 'text-phase-peak',
    suggestion: 'text-phase-build',
    info: 'text-secondary',
  };

  return <Icon size={size} strokeWidth={2} className={className || defaultColor[type] || 'text-secondary'} />;
}