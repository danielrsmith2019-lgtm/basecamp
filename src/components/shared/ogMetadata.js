/**
 * OG Meta Tags for BaseCamp
 * Add to app/layout.js metadata export or <head>.
 *
 * Usage in Next.js 16 app/layout.js:
 *
 *   import { ogMetadata } from '@/components/shared/ogMetadata';
 *   export const metadata = { ...ogMetadata, title: 'BaseCamp' };
 *
 * Or merge into existing metadata export.
 */

export const ogMetadata = {
  title: 'BaseCamp — Multimodal Fitness OS',
  description:
    'The fitness operating system for hybrid athletes. Run. Lift. Conquer the interference effect.',
  metadataBase: new URL('https://basecamp.fit'),
  openGraph: {
    title: 'BaseCamp — Multimodal Fitness OS',
    description:
      'The fitness operating system for hybrid athletes. Run. Lift. Conquer the interference effect.',
    url: 'https://basecamp.fit',
    siteName: 'BaseCamp',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BaseCamp — Multimodal Fitness OS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BaseCamp — Multimodal Fitness OS',
    description:
      'The fitness operating system for hybrid athletes. Run. Lift. Conquer the interference effect.',
    images: ['/og-image.png'],
  },
};

/**
 * Workout-specific OG tags for shared workout deep links.
 * Use in a dynamic route like /workout/[id]/page.js:
 *
 *   export async function generateMetadata({ params }) {
 *     const workout = await getWorkout(params.id);
 *     return getWorkoutOGMetadata(workout);
 *   }
 */
export function getWorkoutOGMetadata(workout) {
  const type = workout?.type || 'workout';
  const title = workout?.title || `${type.charAt(0).toUpperCase() + type.slice(1)} Workout`;

  let description = 'Check out this workout on BaseCamp!';
  if (workout?.type === 'run' && workout?.distance_miles) {
    description = `${workout.distance_miles}mi run${workout.pace ? ` at ${workout.pace}/mi` : ''}`;
  } else if (
    (workout?.type === 'lift' || workout?.type === 'strength') &&
    workout?.total_volume
  ) {
    description = `${Number(workout.total_volume).toLocaleString()} lbs total volume${workout.exercises ? ` · ${workout.exercises} exercises` : ''}`;
  }

  return {
    title: `${title} | BaseCamp`,
    description,
    openGraph: {
      title: `${title} | BaseCamp`,
      description,
      url: `https://basecamp.fit/workout/${workout?.id || ''}`,
      siteName: 'BaseCamp',
      type: 'article',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | BaseCamp`,
      description,
      images: ['/og-image.png'],
    },
  };
}