'use client';

import { useState, useEffect } from 'react';
import { X, Layers, Trash2, ChevronRight, Plus } from 'lucide-react';
import { getWorkoutTemplates, deleteWorkoutTemplate, saveWorkoutTemplate } from '@/lib/database';

export default function WorkoutTemplates({ userId, onLoad, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    getWorkoutTemplates(userId).then(t => {
      setTemplates(t);
      setLoading(false);
    });
  }, [userId]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this template?')) return;
    setTemplates(prev => prev.filter(t => t.id !== id));
    await deleteWorkoutTemplate(userId, id);
  }

  function handleLoad(template) {
    // Update lastUsed + useCount in the background
    if (userId) {
      const updated = {
        ...template,
        lastUsed: new Date().toISOString(),
        useCount: (template.useCount || 0) + 1,
      };
      saveWorkoutTemplate(userId, updated);
    }
    onLoad(template.exercises, template.name);
  }

  function formatLastUsed(iso) {
    if (!iso) return 'Never used';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50"
      onClick={onClose}>
      <div className="bg-surface border border-border rounded-t-[24px] sm:rounded-[20px] shadow-xl max-w-lg w-full flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 80px)', marginBottom: '80px' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-lift-accent" />
            <h3 className="text-[17px] font-semibold text-primary">Templates</h3>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center text-secondary hover:text-primary">
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            <p className="text-center text-sm text-tertiary py-8">Loading…</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-10">
              <Layers size={32} className="text-tertiary mx-auto mb-3" />
              <p className="text-sm font-semibold text-primary">No templates yet</p>
              <p className="bc-caption mt-1">Finish a lift and tap "Save as template"</p>
            </div>
          ) : (
            templates.map(t => {
              const groups = [...new Set((t.exercises || []).map(e => e.muscleGroup).filter(Boolean))];
              const names  = (t.exercises || []).slice(0, 3).map(e => e.name).join(', ');
              const more   = (t.exercises || []).length > 3 ? ` +${(t.exercises || []).length - 3}` : '';
              return (
                <div key={t.id} className="bc-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary">{t.name}</p>
                      <p className="bc-caption mt-0.5">
                        {(t.exercises || []).length} exercise{(t.exercises || []).length !== 1 ? 's' : ''} · {formatLastUsed(t.lastUsed)}
                      </p>
                      {names && (
                        <p className="text-[10px] text-tertiary mt-0.5 truncate">{names}{more}</p>
                      )}
                      {groups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {groups.slice(0, 4).map(g => (
                            <span key={g}
                              className="text-[10px] font-medium px-1.5 py-0.5 bg-lift-bg text-lift-accent rounded-full">
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                      <button onClick={() => handleDelete(t.id)}
                        className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center text-tertiary hover:text-bc-red transition-colors min-w-[44px] min-h-[44px]">
                        <Trash2 size={14} />
                      </button>
                      <button onClick={() => handleLoad(t)}
                        className="flex items-center gap-1 px-3 py-2 bg-bc-blue text-white text-xs font-semibold rounded-[10px] min-h-[44px] active:scale-95 transition-transform">
                        Load <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: new from scratch */}
        <div className="p-5 pt-3 border-t border-border flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-3 border border-dashed border-border rounded-[12px] text-sm font-medium text-secondary flex items-center justify-center gap-2 hover:text-primary hover:border-secondary transition-colors min-h-[44px]">
            <Plus size={14} /> New from scratch
          </button>
        </div>
      </div>
    </div>
  );
}
