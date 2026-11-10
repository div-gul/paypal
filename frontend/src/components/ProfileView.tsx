import React, { useState } from 'react';
import { AuthUser, api } from '../api/client';
import { Card, Button, Badge } from './ui';
import {
  User,
  Mail,
  Shield,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Lock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface ProfileViewProps {
  user: AuthUser;
  onUserUpdated: (updatedUser: AuthUser) => void;
  onAccountDeleted: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUserUpdated,
  onAccountDeleted,
}) => {
  const [name, setName] = useState(user.name);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const isGuest = user.role === 'guest';
  const hasPasswordAuth = user.hasPassword !== false;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');

    if (!name.trim()) {
      setSaveError('Name cannot be empty.');
      return;
    }

    if (showPasswordChange && newPassword) {
      if (newPassword !== confirmPassword) {
        setSaveError('New passwords do not match.');
        return;
      }
      if (newPassword.length < 12) {
        setSaveError('Password must be at least 12 characters.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: { name: string; currentPassword?: string; newPassword?: string } = {
        name: name.trim(),
      };
      if (showPasswordChange && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await api.updateProfile(payload);
      onUserUpdated(res.user);
      setSaveSuccess('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm account removal.');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.deleteAccount();
      setShowDeleteModal(false);
      onAccountDeleted();
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Active Member';

  const userInitial = (user.name || user.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shadow-soft">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-ink tracking-tight">Account & Profile</h1>
            <p className="text-xs sm:text-sm text-ink-muted">Manage your household credentials, identity, and account preferences.</p>
          </div>
        </div>
      </div>

      {/* Account Overview Card */}
      <Card className="p-6 bg-surface border-secondary-tint shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand text-white flex items-center justify-center text-xl font-bold shadow-soft">
              {userInitial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink">{user.name}</h2>
                <Badge variant={isGuest ? 'warning' : 'success'}>
                  {isGuest ? 'Demo Guest' : 'Household Owner'}
                </Badge>
              </div>
              <p className="text-xs text-ink-muted flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                <span>{user.email}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted bg-paper/60 px-3.5 py-2 rounded-xl border border-secondary-tint">
            <Calendar className="w-3.5 h-3.5 text-brand" />
            <span>Member since: <strong className="text-ink font-semibold">{memberSince}</strong></span>
          </div>
        </div>
      </Card>

      {/* Profile Edition Form */}
      <Card className="p-6 bg-surface border-secondary-tint shadow-card">
        <div className="flex items-center gap-2 mb-5 pb-3 border-b border-secondary-tint">
          <Shield className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-bold text-ink">Personal Information</h3>
        </div>

        {saveSuccess && (
          <div className="mb-5 p-3.5 rounded-xl bg-good/10 border border-good/25 text-good text-xs flex items-center gap-2.5 font-medium shadow-soft">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-good" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {saveError && (
          <div className="mb-5 p-3.5 rounded-xl bg-danger/10 border border-danger/25 text-danger text-xs flex items-center gap-2.5 font-medium shadow-soft">
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{saveError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name or household alias"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border rounded-xl border-secondary-tint bg-white text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5 flex items-center justify-between">
                <span>Account Email</span>
                <span className="text-[10px] text-ink-muted flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Tied to login
                </span>
              </label>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border rounded-xl border-secondary-tint/60 bg-paper text-ink-muted cursor-not-allowed min-h-[44px]"
              />
            </div>
          </div>

          {/* Password update section (if applicable) */}
          {!isGuest && (
            <div className="pt-2">
              {!showPasswordChange ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(true)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-brand hover:text-brand-dark transition cursor-pointer py-1"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{hasPasswordAuth ? 'Change account password' : 'Set a password for email login'}</span>
                </button>
              ) : (
                <div className="mt-3 p-4 rounded-xl border border-secondary-tint bg-paper/40 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-brand" />
                      <span>{hasPasswordAuth ? 'Change Password' : 'Set Password'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordChange(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="text-xs text-ink-muted hover:text-ink cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {hasPasswordAuth && (
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-3.5 py-2 text-xs border rounded-xl border-secondary-tint bg-white text-ink min-h-[40px]"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min 12 chars (letters, numbers, symbols)"
                        className="w-full px-3.5 py-2 text-xs border rounded-xl border-secondary-tint bg-white text-ink min-h-[40px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full px-3.5 py-2 text-xs border rounded-xl border-secondary-tint bg-white text-ink min-h-[40px]"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    Must include at least 12 characters, uppercase & lowercase letters, a number, and a special character.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="pt-3 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving}
              className="px-5 py-2 text-xs sm:text-sm font-semibold min-h-[42px]"
            >
              {isSaving ? 'Saving changes...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Danger Zone: Account Deletion */}
      <Card className="p-6 bg-surface border-danger/30 shadow-card">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-danger/20">
          <Trash2 className="w-4 h-4 text-danger" />
          <h3 className="text-sm font-bold text-danger">Danger Zone</h3>
        </div>

        {isGuest ? (
          <div className="p-4 rounded-xl bg-paper border border-secondary-tint text-ink-muted text-xs flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-ink">Shared Demo Environment</p>
              <p className="mt-0.5">
                You are currently signed in as the simulated guest household. This demo account is persistent and shared; to test personal account deletion, register or sign in with your own account.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-ink">Delete Account & Wipe Data</h4>
              <p className="text-xs text-ink-muted mt-0.5">
                Permanently delete your profile, customized pantry items, order history, and preferences. This action cannot be reversed.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteError('');
                setDeleteConfirmationText('');
                setShowDeleteModal(true);
              }}
              className="text-danger border-danger/40 hover:bg-danger/10 hover:border-danger shrink-0 text-xs min-h-[42px]"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              <span>Delete Account</span>
            </Button>
          </div>
        )}
      </Card>

      {/* Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface border border-secondary-tint rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">Confirm Account Deletion</h3>
                <p className="text-xs text-ink-muted">This action is permanent and immediate.</p>
              </div>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              Are you sure you want to delete your account (<strong className="text-ink">{user.email}</strong>)? All your pantry inventories, saved order drafts, and simulation settings will be deleted forever.
            </p>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Type <span className="text-danger font-mono font-bold">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={e => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 text-xs border rounded-xl border-secondary-tint bg-white text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger min-h-[40px]"
              />
            </div>

            {deleteError && (
              <p className="text-xs text-danger font-medium">{deleteError}</p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-secondary-tint">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:text-ink hover:bg-paper transition cursor-pointer min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-danger hover:bg-red-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[40px] shadow-soft"
              >
                {isDeleting ? 'Deleting account...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
