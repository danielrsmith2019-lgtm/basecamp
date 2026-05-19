'use client';

/**
 * Settings Page — Profile, Body Metrics, Training Preferences, Plan Management, Data Management.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase';
import {
  getProfile, updateProfile,
  getUserSettings, updateUserSettings,
  getWorkouts,
} from '@/lib/database';
import { useWorkouts } from '@/lib/WorkoutContext';
import { useRouter } from 'next/navigation';
import {
  User, Activity, Dumbbell, Database, Upload, Download,
  Trash2, Check, AlertTriangle, Calendar, ChevronDown, ChevronUp,
} from 'lucide-react';

const ACTIVITY_MULTIPLIERS = {
  sedentary:   { label: 'Sedentary (desk job)',    value: 1.2   },
  light:       { label: 'Light (1-2 days/week)',    value: 1.375 },
  moderate:    { label: 'Moderate (3-5 days/week)', value: 1.55  },
  active:      { label: 'Active (6-7 days/week)',   value: 1.725 },
  very_active: { label: 'Very Active (2x/day)',     value: 1.9   },
};

function calculateTDEE(weight, height, age, activityLevel) {
  if (!weight || !height || !age) return null;
  const bmr = (10 * weight * 0.453592) + (6.25 * height * 2.54) - (5 * age) + 5;
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel]?.value || 1.55));
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { workouts, refreshWorkouts } = useWorkouts();
  const router = useRouter();

  const [profile, setProfile] = useState({ display_name: '', avatar_url: '' });
  const [settings, setSettings] = useState({
    weight: '', goal_weight: '', height: '', age: '',
    calorie_target: 2000, protein_target: 150,
    training_days_per_week: 5, experience_level: 'intermediate',
    primary_goal: 'hybrid', unit_system: 'imperial', activity_level: 'moderate',
  });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  // ── Plan management state ──
  const [planDeleteStatus, setPlanDeleteStatus] = useState(null); // null | 'confirming' | 'deleting' | 'done'
  const [activePlanInfo, setActivePlanInfo] = useState(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [profileData, settingsData] = await Promise.all([
        getProfile(user.id),
        getUserSettings(user.id),
      ]);
      if (profileData) setProfile({ display_name: profileData.display_name || '', avatar_url: profileData.avatar_url || '' });
      if (settingsData) {
        setSettings(prev => ({
          ...prev,
          weight: settingsData.weight || '', goal_weight: settingsData.goal_weight || '',
          height: settingsData.height || '', age: settingsData.age || '',
          calorie_target: settingsData.calorie_target || 2000,
          protein_target: settingsData.protein_target || 150,
          training_days_per_week: settingsData.training_days_per_week || 5,
          experience_level: settingsData.experience_level || 'intermediate',
          primary_goal: settingsData.primary_goal || 'hybrid',
          unit_system: settingsData.unit_system || 'imperial',
          activity_level: settingsData.activity_level || 'moderate',
        }));
      }

      // Load active plan info
      try {
        const supabase = createClient();
        const { data: plan } = await supabase
          .from('plans')
          .select('id, name, created_at, plan_data')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();
        if (plan) setActivePlanInfo(plan);
      } catch {}

      setLoading(false);
    }
    load();
  }, [user]);

  const tdee = useMemo(() => calculateTDEE(
    Number(settings.weight), Number(settings.height),
    Number(settings.age), settings.activity_level
  ), [settings.weight, settings.height, settings.age, settings.activity_level]);

  const saveProfile = useCallback(async (updates) => {
    if (!user) return;
    setSaveStatus('saving');
    const result = await updateProfile(user.id, updates);
    setSaveStatus(result ? 'saved' : 'error');
    setTimeout(() => setSaveStatus(null), 2000);
  }, [user]);

  const saveSettings = useCallback(async (updates) => {
    if (!user) return;
    setSaveStatus('saving');
    const result = await updateUserSettings(user.id, updates);
    setSaveStatus(result ? 'saved' : 'error');
    setTimeout(() => setSaveStatus(null), 2000);
  }, [user]);

  function handleProfileChange(field, value) { setProfile(prev => ({ ...prev, [field]: value })); }
  function handleProfileBlur(field) { saveProfile({ [field]: profile[field] }); }

  function handleSettingsChange(field, value) {
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    if (['experience_level', 'primary_goal', 'unit_system', 'activity_level', 'training_days_per_week'].includes(field)) {
      saveSettings({ [field]: value });
    }
  }

  function handleSettingsBlur(field) {
    const value = settings[field];
    const numericFields = ['weight', 'goal_weight', 'height', 'age', 'calorie_target', 'protein_target'];
    saveSettings({ [field]: numericFields.includes(field) ? (value === '' ? null : Number(value)) : value });
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    const supabase = createClient();
    const filePath = `${user.id}/avatar.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (uploadError) {
      console.error('Avatar upload failed:', uploadError.message);
      setAvatarUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
    setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
    await saveProfile({ avatar_url: publicUrl });
    setAvatarUploading(false);
  }

  async function handleExport() {
    if (!user) return;
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), user_email: user.email, profile, settings, workouts }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `basecamp-backup-${new Date().toLocaleDateString('en-CA')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('importing');
    try {
      const data = JSON.parse(await file.text());
      if (!data.workouts || !data.settings) { setImportStatus('error'); return; }
      await updateUserSettings(user.id, data.settings);
      setSettings(data.settings);
      if (data.profile) { await updateProfile(user.id, data.profile); setProfile(data.profile); }
      setImportStatus('success');
      setTimeout(() => setImportStatus(null), 3000);
    } catch {
      setImportStatus('error');
      setTimeout(() => setImportStatus(null), 3000);
    }
    e.target.value = '';
  }

  // ── Delete plan: wipe future planned workouts, deactivate plan ──
  async function handleDeletePlan() {
    if (!user || !activePlanInfo) return;
    setPlanDeleteStatus('deleting');
    try {
      const supabase = createClient();
      const today = new Date().toLocaleDateString('en-CA');

      // Delete only future planned workouts — keep completed history
      await supabase
        .from('workouts')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'planned')
        .gte('date', today);

      // Deactivate the plan
      await supabase
        .from('plans')
        .update({ is_active: false })
        .eq('id', activePlanInfo.id);

      setActivePlanInfo(null);
      setPlanDeleteStatus('done');
      refreshWorkouts?.();
      setTimeout(() => setPlanDeleteStatus(null), 3000);
    } catch (err) {
      console.error('Plan delete error:', err);
      setPlanDeleteStatus(null);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE' || !user) return;
    const supabase = createClient();
    await supabase.rpc('delete_user').catch(() => {});
    await signOut();
    router.push('/login');
  }

  // Plan stats
  const plannedCount = workouts.filter(w => w.status === 'planned' && w.date >= new Date().toLocaleDateString('en-CA')).length;
  const completedCount = workouts.filter(w => w.status === 'completed').length;

  if (loading) {
    return (
      <div className="space-y-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="bc-card p-6">
            <div className="h-4 w-32 bc-skeleton rounded mb-5" />
            <div className="space-y-3">
              <div className="h-10 bc-skeleton rounded-[10px]" />
              <div className="h-10 bc-skeleton rounded-[10px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="bc-caption uppercase tracking-wider">Settings</h2>
        {saveStatus && (
          <span className={`text-xs flex items-center gap-1 font-medium ${
            saveStatus==='saved'?'text-bc-green-dark':saveStatus==='saving'?'text-tertiary':'text-bc-red'}`}>
            {saveStatus==='saved' && <><Check size={12} /> Saved</>}
            {saveStatus==='saving' && 'Saving…'}
            {saveStatus==='error' && 'Save failed'}
          </span>
        )}
      </div>

      {/* ── PROFILE ── */}
      <div className="bc-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <User size={16} className="text-bc-blue" />
          <h3 className="bc-caption uppercase tracking-wider">Profile</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-canvas border border-border flex items-center justify-center overflow-hidden">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  : <User size={24} className="text-tertiary" />}
              </div>
              {avatarUploading && (
                <div className="absolute inset-0 bg-white/60 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-bc-blue border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <label className="px-3 py-1.5 bg-canvas border border-border rounded-[10px] text-xs text-secondary hover:text-primary hover:border-border-strong cursor-pointer transition-colors inline-flex items-center gap-1.5">
                <Upload size={12} />
                Upload Photo
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
              <p className="bc-caption mt-1">JPG or PNG, max 2MB</p>
            </div>
          </div>
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-1.5">Display Name</label>
            <input type="text" value={profile.display_name}
              onChange={e => handleProfileChange('display_name', e.target.value)}
              onBlur={() => handleProfileBlur('display_name')} className="bc-input" />
          </div>
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-1.5">Email</label>
            <input type="email" value={user?.email||''} readOnly className="bc-input opacity-50 cursor-not-allowed" />
            <p className="bc-caption mt-1">Email cannot be changed</p>
          </div>
        </div>
      </div>

      {/* ── BODY METRICS ── */}
      <div className="bc-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Activity size={16} className="text-bc-green" />
          <h3 className="bc-caption uppercase tracking-wider">Body Metrics</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { field:'weight',      label:'Weight (lbs)',      placeholder:'175' },
            { field:'goal_weight', label:'Goal Weight (lbs)', placeholder:'170' },
            { field:'height',      label:'Height (inches)',   placeholder:'70'  },
            { field:'age',         label:'Age',               placeholder:'28'  },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="bc-caption uppercase tracking-wider block mb-1.5">{label}</label>
              <input type="number" value={settings[field]}
                onChange={e => handleSettingsChange(field, e.target.value)}
                onBlur={() => handleSettingsBlur(field)}
                placeholder={placeholder} className="bc-input bc-data" />
            </div>
          ))}
        </div>
        <div className="mt-4">
          <label className="bc-caption uppercase tracking-wider block mb-1.5">Activity Level</label>
          <select value={settings.activity_level} onChange={e => handleSettingsChange('activity_level', e.target.value)}
            className="bc-input cursor-pointer appearance-none">
            {Object.entries(ACTIVITY_MULTIPLIERS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        {tdee && (
          <div className="mt-5 p-4 bg-canvas rounded-[14px] border border-border">
            <p className="bc-caption uppercase tracking-wider mb-2">Estimated Daily Energy Expenditure</p>
            <div className="flex items-baseline gap-2">
              <span className="bc-stat text-bc-orange-dark">{tdee.toLocaleString()}</span>
              <span className="bc-label">calories/day</span>
            </div>
            <p className="text-xs text-secondary mt-2">Based on Mifflin-St Jeor equation.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-1.5">Daily Calorie Target</label>
            <input type="number" value={settings.calorie_target}
              onChange={e => handleSettingsChange('calorie_target', e.target.value)}
              onBlur={() => handleSettingsBlur('calorie_target')} className="bc-input bc-data" />
          </div>
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-1.5">Daily Protein Target (g)</label>
            <input type="number" value={settings.protein_target}
              onChange={e => handleSettingsChange('protein_target', e.target.value)}
              onBlur={() => handleSettingsBlur('protein_target')} className="bc-input bc-data" />
          </div>
        </div>
      </div>

      {/* ── TRAINING PREFERENCES ── */}
      <div className="bc-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Dumbbell size={16} className="text-bc-blue" />
          <h3 className="bc-caption uppercase tracking-wider">Training Preferences</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-1.5">Training Days Per Week</label>
            <select value={settings.training_days_per_week}
              onChange={e => handleSettingsChange('training_days_per_week', Number(e.target.value))}
              className="bc-input cursor-pointer appearance-none">
              {[2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} days</option>)}
            </select>
          </div>
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-1.5">Primary Goal</label>
            <select value={settings.primary_goal} onChange={e => handleSettingsChange('primary_goal', e.target.value)}
              className="bc-input cursor-pointer appearance-none">
              <option value="marathon">Marathon Training + Strength</option>
              <option value="half_marathon">Half Marathon + Strength</option>
              <option value="strength">Strength / Powerlifting</option>
              <option value="hypertrophy">Hypertrophy / Muscle Building</option>
              <option value="hybrid">Hybrid (Run + Lift equally)</option>
              <option value="general_fitness">General Fitness</option>
              <option value="weight_loss">Weight Loss + Fitness</option>
            </select>
          </div>
          <div>
            <label className="bc-caption uppercase tracking-wider block mb-1.5">Experience Level</label>
            <div className="bc-tab-bar">
              {['beginner','intermediate','advanced'].map(level => (
                <button key={level} onClick={() => handleSettingsChange('experience_level', level)}
                  className="bc-tab capitalize"
                  style={{
                    background: settings.experience_level===level ? '#007AFF' : 'transparent',
                    color: settings.experience_level===level ? '#FFFFFF' : '#8E8E93',
                    fontWeight: settings.experience_level===level ? 600 : 500,
                    borderRadius: '10px', flex: 1,
                  }}>
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── TRAINING PLAN MANAGEMENT ── NEW SECTION ── */}
      <div className="bc-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Calendar size={16} className="text-bc-indigo" />
          <h3 className="bc-caption uppercase tracking-wider">Training Plan</h3>
        </div>

        {planDeleteStatus === 'done' ? (
          <div className="p-4 bg-bc-green-light rounded-[14px] border border-bc-green/20 flex items-center gap-3">
            <Check size={16} className="text-bc-green-dark flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-bc-green-dark">Plan cleared</p>
              <p className="bc-caption">Future planned sessions removed. Your completed workouts are preserved.</p>
            </div>
          </div>
        ) : activePlanInfo ? (
          <div className="space-y-4">
            {/* Plan summary */}
            <div className="p-4 bg-canvas rounded-[14px] border border-border">
              <p className="text-sm font-semibold text-primary mb-1">{activePlanInfo.name || 'Active Plan'}</p>
              <div className="flex items-center gap-4 text-xs text-secondary flex-wrap">
                <span><span className="bc-data text-primary">{completedCount}</span> sessions completed</span>
                <span><span className="bc-data text-primary">{plannedCount}</span> sessions remaining</span>
              </div>
            </div>

            {/* Delete plan */}
            <div className="p-4 bg-bc-orange-light rounded-[14px] border border-bc-orange/20">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-bc-orange mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-bc-orange-dark">Delete Training Plan</p>
                  <p className="bc-caption mt-1">
                    Removes all future planned sessions. Completed workouts and your history are <span className="font-semibold">not</span> affected.
                  </p>

                  {planDeleteStatus !== 'confirming' ? (
                    <button
                      onClick={() => setPlanDeleteStatus('confirming')}
                      className="mt-3 px-4 py-2 bg-bc-orange-light border border-bc-orange/30 text-bc-orange-dark
                                 text-xs font-medium rounded-[10px] hover:bg-bc-orange/10 transition-colors min-h-[44px]">
                      Delete Plan
                    </button>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs text-bc-orange-dark font-medium">
                        This will remove <span className="bc-data">{plannedCount}</span> future planned sessions. Continue?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeletePlan}
                          disabled={planDeleteStatus === 'deleting'}
                          className="px-4 py-2 bg-bc-orange text-white text-xs font-semibold rounded-[10px]
                                     hover:opacity-90 disabled:opacity-50 transition-all min-h-[44px]">
                          {planDeleteStatus === 'deleting' ? 'Deleting…' : 'Yes, Delete Plan'}
                        </button>
                        <button
                          onClick={() => setPlanDeleteStatus(null)}
                          className="px-4 py-2 bg-canvas border border-border text-secondary text-xs
                                     font-medium rounded-[10px] hover:border-border-strong transition-colors min-h-[44px]">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bc-empty py-6">
            <p className="bc-empty-title">No active plan</p>
            <p className="bc-empty-text">Generate a plan from the Plan tab to get started.</p>
          </div>
        )}
      </div>

      {/* ── DATA MANAGEMENT ── */}
      <div className="bc-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Database size={16} className="text-bc-purple" />
          <h3 className="bc-caption uppercase tracking-wider">Data Management</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-canvas rounded-[14px] border border-border">
            <div>
              <p className="text-sm font-semibold text-primary">Export All Data</p>
              <p className="bc-caption mt-0.5">Download workouts, settings, and profile as JSON</p>
            </div>
            <button onClick={handleExport} className="bc-btn-secondary flex items-center gap-1.5 !py-2 !px-3">
              <Download size={12} /> Export
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-canvas rounded-[14px] border border-border">
            <div>
              <p className="text-sm font-semibold text-primary">Import From Backup</p>
              <p className={`bc-caption mt-0.5 ${importStatus==='success'?'text-bc-green-dark':importStatus==='error'?'text-bc-red':''}`}>
                {importStatus==='importing'?'Importing…':importStatus==='success'?'✓ Import complete!':importStatus==='error'?'✗ Invalid backup file':'Restore from a BaseCamp JSON export'}
              </p>
            </div>
            <label className="bc-btn-secondary flex items-center gap-1.5 !py-2 !px-3 cursor-pointer">
              <Upload size={12} /> Import
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>

          <div className="p-4 bg-bc-red-light rounded-[14px] border border-bc-red/20">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-bc-red mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-bc-red-dark">Delete Account</p>
                <p className="bc-caption mt-1">Permanently delete your account and all data. This cannot be undone.</p>
                {!showDeleteDialog ? (
                  <button onClick={() => setShowDeleteDialog(true)}
                    className="mt-3 px-4 py-2 bg-bc-red-light border border-bc-red/30 text-bc-red-dark
                               text-xs font-medium rounded-[10px] hover:bg-bc-red/10 transition-colors min-h-[44px]">
                    Delete My Account
                  </button>
                ) : (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-bc-red-dark">Type <span className="bc-data font-bold">DELETE</span> to confirm:</p>
                    <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                      placeholder="DELETE" className="bc-input bc-data"
                      style={{ borderColor: 'var(--color-bc-red)', boxShadow: 'none' }} />
                    <div className="flex gap-2">
                      <button onClick={handleDeleteAccount} disabled={deleteConfirm!=='DELETE'}
                        className="px-4 py-2 bg-bc-red text-white text-xs font-semibold rounded-[10px]
                                   hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 min-h-[44px]">
                        <Trash2 size={12} /> Permanently Delete
                      </button>
                      <button onClick={() => { setShowDeleteDialog(false); setDeleteConfirm(''); }}
                        className="px-4 py-2 bg-canvas border border-border text-secondary text-xs font-medium rounded-[10px] hover:border-border-strong transition-colors min-h-[44px]">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}