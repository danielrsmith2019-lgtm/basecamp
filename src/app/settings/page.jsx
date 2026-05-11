'use client';

/**
 * Settings Page — Profile, Body Metrics, Training Preferences, Data Management.
 * 
 * Reads from profiles + user_settings tables.
 * Saves on blur/change so the user doesn't need a "Save" button for most fields.
 * TDEE auto-calculates from body metrics using Mifflin-St Jeor.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase';
import {
  getProfile,
  updateProfile,
  getUserSettings,
  updateUserSettings,
  getWorkouts,
} from '@/lib/database';
import { useWorkouts } from '@/lib/WorkoutContext';
import { useRouter } from 'next/navigation';
import { User, Activity, Dumbbell, Database, Upload, Download, Trash2, Check, AlertTriangle } from 'lucide-react';

// ── TDEE Calculation (Mifflin-St Jeor) ──
// Men:   (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + 5
// Women: (10 × weight_kg) + (6.25 × height_cm) - (5 × age) - 161
// We default to the male formula since we don't collect sex yet.
// Activity multipliers convert BMR → TDEE.
const ACTIVITY_MULTIPLIERS = {
  sedentary: { label: 'Sedentary (desk job)', value: 1.2 },
  light: { label: 'Light (1-2 days/week)', value: 1.375 },
  moderate: { label: 'Moderate (3-5 days/week)', value: 1.55 },
  active: { label: 'Active (6-7 days/week)', value: 1.725 },
  very_active: { label: 'Very Active (2x/day)', value: 1.9 },
};

function calculateTDEE(weight, height, age, activityLevel) {
  if (!weight || !height || !age) return null;
  // Convert lbs → kg, inches → cm
  const weightKg = weight * 0.453592;
  const heightCm = height * 2.54;
  const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel]?.value || 1.55;
  return Math.round(bmr * multiplier);
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { workouts } = useWorkouts();
  const router = useRouter();

  // ── State ──
  const [profile, setProfile] = useState({ display_name: '', avatar_url: '' });
  const [settings, setSettings] = useState({
    weight: '',
    goal_weight: '',
    height: '',
    age: '',
    calorie_target: 2000,
    protein_target: 150,
    training_days_per_week: 5,
    experience_level: 'intermediate',
    primary_goal: 'hybrid',
    unit_system: 'imperial',
    activity_level: 'moderate',
  });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  // ── Load profile + settings on mount ──
  useEffect(() => {
    if (!user) return;

    async function load() {
      const [profileData, settingsData] = await Promise.all([
        getProfile(user.id),
        getUserSettings(user.id),
      ]);

      if (profileData) {
        setProfile({
          display_name: profileData.display_name || '',
          avatar_url: profileData.avatar_url || '',
        });
      }

      if (settingsData) {
        setSettings(prev => ({
          ...prev,
          weight: settingsData.weight || '',
          goal_weight: settingsData.goal_weight || '',
          height: settingsData.height || '',
          age: settingsData.age || '',
          calorie_target: settingsData.calorie_target || 2000,
          protein_target: settingsData.protein_target || 150,
          training_days_per_week: settingsData.training_days_per_week || 5,
          experience_level: settingsData.experience_level || 'intermediate',
          primary_goal: settingsData.primary_goal || 'hybrid',
          unit_system: settingsData.unit_system || 'imperial',
          activity_level: settingsData.activity_level || 'moderate',
        }));
      }

      setLoading(false);
    }

    load();
  }, [user]);

  // ── TDEE calculation ──
  const tdee = useMemo(() => {
    return calculateTDEE(
      Number(settings.weight),
      Number(settings.height),
      Number(settings.age),
      settings.activity_level
    );
  }, [settings.weight, settings.height, settings.age, settings.activity_level]);

  // ── Auto-save helpers ──
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

  // ── Profile field change ──
  function handleProfileChange(field, value) {
    setProfile(prev => ({ ...prev, [field]: value }));
  }

  function handleProfileBlur(field) {
    saveProfile({ [field]: profile[field] });
  }

  // ── Settings field change ──
  function handleSettingsChange(field, value) {
    const updated = { ...settings, [field]: value };
    setSettings(updated);

    // For dropdowns/selects, save immediately (no blur event)
    if (['experience_level', 'primary_goal', 'unit_system', 'activity_level', 'training_days_per_week'].includes(field)) {
      saveSettings({ [field]: value });
    }
  }

  function handleSettingsBlur(field) {
    const value = settings[field];
    // Convert numeric fields
    const numericFields = ['weight', 'goal_weight', 'height', 'age', 'calorie_target', 'protein_target'];
    const saveValue = numericFields.includes(field) ? (value === '' ? null : Number(value)) : value;
    saveSettings({ [field]: saveValue });
  }

  // ── Avatar upload ──
  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarUploading(true);
    const supabase = createClient();

    // Upload to Supabase Storage (bucket: avatars)
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Avatar upload failed:', uploadError.message);
      setAvatarUploading(false);
      // If bucket doesn't exist yet, show a helpful message
      if (uploadError.message.includes('not found') || uploadError.statusCode === 404) {
        setSaveStatus('error');
        alert('Avatar storage is not set up yet. Go to Supabase Dashboard → Storage → Create a bucket called "avatars" with public access.');
      }
      return;
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Save URL to profile
    setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
    await saveProfile({ avatar_url: publicUrl });
    setAvatarUploading(false);
  }

  // ── Data Export ──
  async function handleExport() {
    if (!user) return;

    const exportData = {
      exported_at: new Date().toISOString(),
      user_email: user.email,
      profile,
      settings,
      workouts,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `basecamp-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Data Import ──
  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('importing');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate it looks like a BaseCamp export
      if (!data.workouts || !data.settings) {
        setImportStatus('error');
        return;
      }

      // Update settings
      await updateUserSettings(user.id, data.settings);
      setSettings(data.settings);

      // Update profile if present
      if (data.profile) {
        await updateProfile(user.id, data.profile);
        setProfile(data.profile);
      }

      setImportStatus('success');
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
      console.error('Import failed:', err);
      setImportStatus('error');
      setTimeout(() => setImportStatus(null), 3000);
    }

    // Reset the file input
    e.target.value = '';
  }

  // ── Delete Account ──
  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE' || !user) return;

    const supabase = createClient();

    // Delete user data (RLS cascade will handle related tables)
    // Then delete the auth account
    const { error } = await supabase.auth.admin?.deleteUser?.(user.id)
      || await supabase.rpc('delete_user'); // Fallback

    // Sign out regardless — even if delete partially failed,
    // the user wanted out
    await signOut();
    router.push('/login');
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="stride-card p-6 animate-pulse">
            <div className="h-5 w-32 bg-surface rounded mb-4" />
            <div className="space-y-3">
              <div className="h-10 bg-surface rounded" />
              <div className="h-10 bg-surface rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary">Settings</h2>
        {saveStatus && (
          <span className={`text-xs flex items-center gap-1 ${
            saveStatus === 'saved' ? 'text-green-400' :
            saveStatus === 'saving' ? 'text-gray-400' :
            'text-red-400'
          }`}>
            {saveStatus === 'saved' && <><Check size={12} /> Saved</>}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'error' && 'Save failed'}
          </span>
        )}
      </div>

      {/* ── SECTION 1: PROFILE ── */}
      <div className="stride-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <User size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Profile</h3>
        </div>

        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-surface border border-gray-700 flex items-center justify-center overflow-hidden">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={24} className="text-muted" />
                )}
              </div>
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <label className="px-3 py-1.5 bg-surface border border-gray-700 rounded-lg text-xs text-secondary hover:text-primary hover:border-gray-600 cursor-pointer transition-colors inline-flex items-center gap-1.5">
                <Upload size={12} />
                Upload Photo
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
              <p className="text-[10px] text-muted mt-1">JPG or PNG, max 2MB</p>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Display Name</label>
            <input
              type="text"
              value={profile.display_name}
              onChange={(e) => handleProfileChange('display_name', e.target.value)}
              onBlur={() => handleProfileBlur('display_name')}
              className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-800 rounded-xl text-gray-500 text-sm cursor-not-allowed"
            />
            <p className="text-[10px] text-muted mt-1">Email cannot be changed</p>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: BODY METRICS ── */}
      <div className="stride-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Activity size={16} className="text-green-400" />
          <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Body Metrics</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Weight (lbs)</label>
            <input
              type="number"
              value={settings.weight}
              onChange={(e) => handleSettingsChange('weight', e.target.value)}
              onBlur={() => handleSettingsBlur('weight')}
              placeholder="175"
              className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Goal Weight (lbs)</label>
            <input
              type="number"
              value={settings.goal_weight}
              onChange={(e) => handleSettingsChange('goal_weight', e.target.value)}
              onBlur={() => handleSettingsBlur('goal_weight')}
              placeholder="170"
              className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Height (inches)</label>
            <input
              type="number"
              value={settings.height}
              onChange={(e) => handleSettingsChange('height', e.target.value)}
              onBlur={() => handleSettingsBlur('height')}
              placeholder="70"
              className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Age</label>
            <input
              type="number"
              value={settings.age}
              onChange={(e) => handleSettingsChange('age', e.target.value)}
              onBlur={() => handleSettingsBlur('age')}
              placeholder="28"
              className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Activity Level */}
        <div className="mt-4">
          <label className="block text-xs text-gray-400 mb-1.5">Activity Level</label>
          <select
            value={settings.activity_level}
            onChange={(e) => handleSettingsChange('activity_level', e.target.value)}
            className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none"
          >
            {Object.entries(ACTIVITY_MULTIPLIERS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* TDEE Display */}
        {tdee && (
          <div className="mt-5 p-4 bg-surface rounded-xl border border-gray-800">
            <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Estimated Daily Energy Expenditure</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary font-mono">{tdee.toLocaleString()}</span>
              <span className="text-sm text-muted">calories/day</span>
            </div>
            <p className="text-xs text-secondary mt-2">
              Based on Mifflin-St Jeor equation. This is your maintenance — eat below to lose weight, above to gain.
            </p>
          </div>
        )}

        {/* Nutrition Targets */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Daily Calorie Target</label>
            <input
              type="number"
              value={settings.calorie_target}
              onChange={(e) => handleSettingsChange('calorie_target', e.target.value)}
              onBlur={() => handleSettingsBlur('calorie_target')}
              className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Daily Protein Target (g)</label>
            <input
              type="number"
              value={settings.protein_target}
              onChange={(e) => handleSettingsChange('protein_target', e.target.value)}
              onBlur={() => handleSettingsBlur('protein_target')}
              className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 3: TRAINING PREFERENCES ── */}
      <div className="stride-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Dumbbell size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Training Preferences</h3>
        </div>

        <div className="space-y-4">
          {/* Training Days */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Training Days Per Week</label>
            <select
              value={settings.training_days_per_week}
              onChange={(e) => handleSettingsChange('training_days_per_week', Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none"
            >
              {[2, 3, 4, 5, 6, 7].map(n => (
                <option key={n} value={n}>{n} days</option>
              ))}
            </select>
          </div>

          {/* Primary Goal */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Primary Goal</label>
            <select
              value={settings.primary_goal}
              onChange={(e) => handleSettingsChange('primary_goal', e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none"
            >
              <option value="marathon">Marathon Training + Strength</option>
              <option value="half_marathon">Half Marathon + Strength</option>
              <option value="strength">Strength / Powerlifting</option>
              <option value="hypertrophy">Hypertrophy / Muscle Building</option>
              <option value="hybrid">Hybrid (Run + Lift equally)</option>
              <option value="general_fitness">General Fitness</option>
              <option value="weight_loss">Weight Loss + Fitness</option>
            </select>
          </div>

          {/* Experience Level */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Experience Level</label>
            <div className="grid grid-cols-3 gap-2">
              {['beginner', 'intermediate', 'advanced'].map(level => (
                <button
                  key={level}
                  onClick={() => handleSettingsChange('experience_level', level)}
                  className={`py-2.5 rounded-xl text-sm font-medium capitalize transition-all ${
                    settings.experience_level === level
                      ? 'bg-accent text-white'
                      : 'bg-surface border border-gray-700 text-secondary hover:border-gray-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: DATA MANAGEMENT ── */}
      <div className="stride-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Database size={16} className="text-purple-400" />
          <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Data Management</h3>
        </div>

        <div className="space-y-4">
          {/* Export */}
          <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-gray-800">
            <div>
              <p className="text-sm font-medium text-primary">Export All Data</p>
              <p className="text-xs text-muted mt-0.5">Download workouts, settings, and profile as JSON</p>
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-accent hover:brightness-110 text-white text-xs font-medium rounded-lg transition-all flex items-center gap-1.5"
            >
              <Download size={12} />
              Export
            </button>
          </div>

          {/* Import */}
          <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-gray-800">
            <div>
              <p className="text-sm font-medium text-primary">Import From Backup</p>
              <p className="text-xs text-muted mt-0.5">
                {importStatus === 'importing' ? 'Importing...' :
                 importStatus === 'success' ? '✅ Import complete!' :
                 importStatus === 'error' ? '❌ Invalid backup file' :
                 'Restore from a BaseCamp JSON export'}
              </p>
            </div>
            <label className="px-4 py-2 bg-surface border border-gray-600 hover:border-gray-500 text-secondary text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer">
              <Upload size={12} />
              Import
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>

          {/* Delete Account */}
          <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">Delete Account</p>
                <p className="text-xs text-gray-400 mt-1">
                  Permanently delete your account and all data. This cannot be undone.
                </p>

                {!showDeleteDialog ? (
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="mt-3 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    Delete My Account
                  </button>
                ) : (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-red-300">
                      Type <span className="font-mono font-bold">DELETE</span> to confirm:
                    </p>
                    <input
                      type="text"
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder="DELETE"
                      className="w-full px-4 py-2.5 bg-[#0A0F1A] border border-red-500/30 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirm !== 'DELETE'}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 size={12} />
                        Permanently Delete
                      </button>
                      <button
                        onClick={() => { setShowDeleteDialog(false); setDeleteConfirm(''); }}
                        className="px-4 py-2 bg-surface border border-gray-700 text-secondary text-xs font-medium rounded-lg hover:border-gray-600 transition-colors"
                      >
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
