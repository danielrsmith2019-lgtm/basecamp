'use client';

import { formatDate } from '@/utils/runUtils';
import { PRIcon, ActivityIcon } from '@/utils/icons';
import { Trophy } from 'lucide-react';
import Link from 'next/link';

export default function RecentPRs({ prs = [] }) {
  if (prs.length === 0) return null;
  const recent = prs.slice(0, 5);

  return (
    <div className="stride-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-phase-peak" />
          <p className="stride-section-label mb-0">Recent PRs</p>
        </div>
        <Link href="/records" className="text-xs text-accent hover:underline">View all →</Link>
      </div>
      <div className="space-y-2">
        {recent.map(pr => (
          <div key={pr.id} className={`flex items-center justify-between p-2.5 rounded-lg border-l-4
            ${pr.sport === 'run' ? 'border-activity-run bg-activity-run/5' : 'border-activity-lift bg-activity-lift/5'}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                <ActivityIcon type={pr.sport === 'run' ? 'run' : 'lift'} size={16} />
              </div>
              <div>
                <p className="text-xs font-medium text-primary">{pr.label}</p>
                <p className={`stride-data text-sm font-bold ${pr.sport === 'run' ? 'text-activity-run' : 'text-activity-lift'}`}>
                  {pr.value}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-muted">{formatDate(pr.date)}</p>
              <span className="stride-badge bg-status-done/20 text-status-done text-[9px] mt-0.5 flex items-center gap-0.5 w-fit ml-auto">
                <Trophy size={8} /> PR
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}