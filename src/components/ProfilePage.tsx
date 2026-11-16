import { profileActivity, type AccountEvent, type EventCatalog } from '../lib/account-activity';
import ModalHeader from './ui/ModalHeader';
import PageHeader from './pageheader/Pageheader';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../lib/api';
import { formatPhoneLocal } from '../lib/phone';
import { toast } from 'sonner';
import { AlertTriangle, User } from 'lucide-react';
import type { UserActivityLog } from '../lib/types';

interface Props {
  roleLabel: string;
}

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_HINT = 'At least 8 characters, including uppercase, lowercase, number, and special character';

const cardClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';
const inputClass = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-800 placeholder:text-slate-500 transition-colors focus:border-[#1a1f6e] focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/15 disabled:cursor-default disabled:text-slate-800';
const lockedInputClass = 'h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700';
const primaryButtonClass = 'inline-flex h-10 items-center justify-center rounded-lg bg-[#030848] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1a1f6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass = 'inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  return err.response?.data?.message || err.message || fallback;
}

function getInitials(fullName: string): string {
  return fullName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('') || '??';
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: fullName, lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** The part typed after the fixed +63 prefix: "+639171234567" becomes "9171234567". */
function toLocalDigits(contact?: string | null): string {
  const local = formatPhoneLocal(contact).replace(/\s/g, '');
  return /^09\d{9}$/.test(local) ? local.slice(1) : local;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function activityTitle(action: string): string {
  switch (action) {
    case 'LOGIN': return 'Login';
    case 'PASSWORD_CHANGE': return 'Password changed';
    case 'LOGOUT_ALL': return 'Signed out of all devices';
    case 'PROFILE_UPDATE': return 'Profile updated';
    case 'DELETION_REQUEST': return 'Account deletion requested';
    default: return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
}

function parseDeviceInfo(info?: string | null): { browser: string; os: string } {
  const ua = info || navigator.userAgent;
  let browser = 'Unknown browser';
  let os = 'Unknown device';

  if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';

  return { browser, os };
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-slate-900">{children}</h3>;
}

export default function ProfilePage({ roleLabel }: Props) {
  const { user, setUser } = useApp();

  const { firstName: initialFirst, lastName: initialLast } = splitName(user?.fullName || '');
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(toLocalDigits(user?.contact));
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [activity, setActivity] = useState<UserActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [deletionRequest,setDeletionRequest]=useState<{status:string;decisionNote?:string}|null>(null);
  const [emailPassword,setEmailPassword]=useState('');
  const [emailCode,setEmailCode]=useState('');
  const [emailPending,setEmailPending]=useState(false);
  async function refreshDeletion(){const {data}=await api.get('/auth/profile/deletion-request');setDeletionRequest(data.request);}
  async function loadActivity(){const [feed,catalog]=await Promise.all([api.get<{data:AccountEvent[]}>('/auth/profile/activity',{params:{limit:5}}),api.get<EventCatalog>('/auth/activity/catalog',{sessionCall:true})]);setActivity(profileActivity(catalog.data,feed.data.data));}
  async function verifyEmail(){try{await api.post('/auth/profile/email/verify',{code:emailCode});setEmailPending(false);storeUser({...user!,email});toast.success('Email updated');}catch(error){toast.error(getApiErrorMessage(error,'Email verification failed'));}}


  const initials = useMemo(() => getInitials(user?.fullName || ''), [user?.fullName]);
  const passwordMeetsRule = PASSWORD_RULE.test(newPassword);
  const latestLoginId = activity.find((log) => log.type === 'SIGNED_IN')?.id;

  function resetDetails() {
    const { firstName: f, lastName: l } = splitName(user?.fullName || '');
    setFirstName(f);
    setLastName(l);
    setEmail(user?.email || '');
    setPhone(toLocalDigits(user?.contact));
  }

  useEffect(() => {
    if (!editing) resetDetails();
    // Only re-sync from the account when it changes, not while the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.fullName, user?.email, user?.contact]);

  useEffect(() => {
    void refreshDeletion().catch(()=>{});
    loadActivity()
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, []);

  async function refreshActivity() {
    try {
      await loadActivity();
    } catch {
      // The list keeps its last loaded rows.
    }
  }

  function storeUser(next: NonNullable<typeof user>) {
    setUser(next);

  }

  async function handleSaveProfile() {
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    if (!fullName) {
      toast.error('Name required', { description: 'Please enter your first name.' });
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits && !/^(09\d{9}|9\d{9})$/.test(digits)) {
      toast.error('Invalid phone number', { description: 'Enter the 10-digit mobile number after +63, e.g. 917 123 4567.' });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await api.patch('/auth/profile', {
        name: fullName,
        contact: digits ? `+63${digits.slice(-10)}` : null,
      });
      const updated = res.data;
      if(email.trim()!==user?.email){await api.post('/auth/profile/email',{newEmail:email.trim(),currentPassword:emailPassword});setEmailPending(true);setEmailPassword('');}
      storeUser({
        ...user!,
        fullName: updated.name,
        email: updated.email || '',
        contact: updated.contact || '',
        profilePicture: updated.profilePicture,
        deletionRequestStatus: deletionRequest?.status,
        initials: getInitials(updated.name),
      });
      setEditing(false);
      toast.success('Profile updated', { description: 'Your personal details have been saved.' });
      refreshActivity();
    } catch (error) {
      toast.error('Failed to update profile', { description: getApiErrorMessage(error, 'Please try again.') });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleUpdatePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Missing fields', { description: 'Please fill in all password fields.' });
      return;
    }
    if (!passwordMeetsRule) {
      toast.error('Password too weak', { description: `${PASSWORD_HINT}.` });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Password mismatch', { description: 'New password and confirm password do not match.' });
      return;
    }

    setSavingPassword(true);
    try {
      await api.patch('/auth/profile/password', { currentPassword, newPassword, confirmPassword });
      toast.success('Password updated', { description: 'Your password has been changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      refreshActivity();
    } catch (error) {
      toast.error('Failed to update password', { description: getApiErrorMessage(error, 'Please check your current password and try again.') });
    } finally {
      setSavingPassword(false);
    }
  }

  function openDeleteModal() {
    setDeletePassword('');
    setShowDeleteModal(true);
  }

  function closeDeleteModal() {
    setShowDeleteModal(false);
    setDeletePassword('');
  }

  async function handleConfirmDeletion() {
    if (!deletePassword) {
      toast.error('Password required', { description: 'Please enter your password to confirm.' });
      return;
    }

    let reauthToken:string;
    setVerifyingPassword(true);
    try {
      const verifyRes = await api.post('/auth/profile/verify-password', { password: deletePassword, purpose: 'ACCOUNT_DELETION' });
      reauthToken=verifyRes.data.reauthToken;
      if (!reauthToken) {
        toast.error('Incorrect password', { description: 'Please check your password and try again.' });
        return;
      }
    } catch (error) {
      toast.error('Verification failed', { description: getApiErrorMessage(error, 'Unable to verify password.') });
      return;
    } finally {
      setVerifyingPassword(false);
    }

    setRequestingDeletion(true);
    try {
      await api.post('/auth/profile/deletion-request',{reauthToken});
      await refreshDeletion();
      toast.success('Account deletion requested', { description: 'Your administrator has been notified.' });
      refreshActivity();
      closeDeleteModal();
    } catch (error) {
      toast.error('Request failed', { description: getApiErrorMessage(error, 'Please try again.') });
    } finally {
      setRequestingDeletion(false);
    }
  }

  const savedPhone = formatPhoneLocal(user?.contact);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader icon={User} title="PROFILE" subtitle="Manage your personal details" subtitleClassName="mt-1 text-sm text-slate-500" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Summary card: stretches to the full height of the right column */}
        <aside className="lg:col-span-3">
          <div className={`${cardClass} flex h-full flex-col items-center p-6 text-center`}>
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#030848] text-3xl font-bold text-white">
              {user?.profilePicture
                ? <img src={user.profilePicture} alt={user.fullName} className="h-full w-full object-cover" />
                : initials}
            </div>
            <h2 className="mt-4 break-words text-lg font-bold text-slate-900">{user?.fullName || '—'}</h2>
            <span className="mt-2 inline-flex items-center rounded-full border border-slate-800 px-6 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900">
              {roleLabel}
            </span>
            <div className="mt-4 w-full space-y-1 text-sm text-slate-800">
              <p className="break-words">{user?.email || 'No email on record'}</p>
              <p>{savedPhone || 'No phone on record'}</p>
            </div>
          </div>
        </aside>

        <div className="space-y-6 lg:col-span-9">
          {/* Personal Details: read-only until Edit Details is pressed */}
          <section className={`${cardClass} p-6`}>
            <CardTitle>Personal Details</CardTitle>
            <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
              <div>
                <label htmlFor="profile-first-name" className={labelClass}>First Name</label>
                <input id="profile-first-name" type="text" value={firstName} disabled={!editing} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="profile-last-name" className={labelClass}>Last Name</label>
                <input id="profile-last-name" type="text" value={lastName} disabled={!editing} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="profile-email" className={labelClass}>Email Address</label>
                <input id="profile-email" type="email" value={email} disabled={!editing} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="profile-phone" className={labelClass}>Phone Number</label>
                {/* One field with a fixed +63 prefix, so it lines up with the other inputs. */}
                <div className="flex h-11 w-full overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors focus-within:border-[#1a1f6e] focus-within:ring-2 focus-within:ring-[#1a1f6e]/15">
                  <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">+63</span>
                  <input
                    id="profile-phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={phone}
                    disabled={!editing}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9XX XXX XXXX"
                    className="min-w-0 flex-1 bg-transparent px-4 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none disabled:cursor-default disabled:text-slate-800"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="profile-role" className={labelClass}>Role</label>
                <input id="profile-role" type="text" value={user?.role || roleLabel} disabled className={lockedInputClass} />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {editing ? (
                <>
                  <button type="button" onClick={() => { resetDetails(); setEditing(false); }} disabled={savingProfile} className={secondaryButtonClass}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveProfile} disabled={savingProfile} className={primaryButtonClass}>
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setEditing(true)} className={primaryButtonClass}>Edit Details</button>
              )}
            </div>
          </section>

          {editing && email!==user?.email && <label className="block">Confirm your current password to change email<input type="password" autoComplete="current-password" value={emailPassword} onChange={event=>setEmailPassword(event.target.value)} className={inputClass}/></label>}
          {emailPending && <section className={cardClass+' p-6'}><h3>Confirm your new email</h3><p>Enter the code sent to the new email address.</p><input aria-label="Email verification code" autoComplete="one-time-code" value={emailCode} onChange={event=>setEmailCode(event.target.value)} maxLength={6}/><button onClick={()=>void verifyEmail()}>Verify email</button><button onClick={()=>void api.delete('/auth/profile/email').then(()=>setEmailPending(false))}>Cancel email change</button></section>}
          {deletionRequest?.status==='PENDING' && <button onClick={()=>void api.delete('/auth/profile/deletion-request').then(()=>refreshDeletion()).catch(()=>toast.error('Could not cancel deletion request'))}>Cancel deletion request</button>}
          {deletionRequest?.status==='REJECTED' && <p>Deletion request rejected: {deletionRequest.decisionNote}</p>}
          {/* Password */}
          <section className={`${cardClass} p-6`}>
            <CardTitle>Password</CardTitle>
            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="profile-current-password" className={labelClass}>Current Password</label>
                <input id="profile-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" className={inputClass} />
              </div>
              <div>
              <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
                <div>
                  <label htmlFor="profile-new-password" className={labelClass}>New Password</label>
                  <input id="profile-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" aria-describedby="profile-password-hint" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="profile-confirm-password" className={labelClass}>Confirm New Password</label>
                  <input id="profile-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" className={inputClass} />
                </div>
              </div>
              <p id="profile-password-hint" className={`mt-2 text-xs ${passwordMeetsRule ? 'text-emerald-700' : 'text-red-700'}`}>
                {passwordMeetsRule ? 'Password meets the requirements' : PASSWORD_HINT}
              </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={handleUpdatePassword} disabled={savingPassword} className={primaryButtonClass}>
                {savingPassword ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </section>

          {/* Account deletion */}
          <section className="flex flex-col gap-5 rounded-2xl border border-red-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 gap-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <div className="min-w-0">
                <CardTitle>Account deletion</CardTitle>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Requesting deletion notifies your administrator. Approval ends your access; personal information is erased after the recovery period.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openDeleteModal}
              disabled={deletionRequest?.status === 'PENDING'}
              className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-red-300 bg-white px-5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletionRequest?.status === 'PENDING' ? 'Deletion Pending' : 'Request Account Deletion'}
            </button>
          </section>

          {/* Recent account activity */}
          <section className={cardClass}>
            <div className="border-b border-slate-100 px-6 py-4">
              <CardTitle>Recent account activity</CardTitle>
            </div>
            {activityLoading ? (
              <p className="px-6 py-5 text-sm text-slate-400">Loading activity...</p>
            ) : activity.length === 0 ? (
              <p className="px-6 py-5 text-sm text-slate-400">No recent activity found.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activity.map((log) => {
                  const { browser, os } = parseDeviceInfo(log.deviceInfo);
                  const isCurrentSession = log.id === latestLoginId;
                  return (
                    <li key={log.id} className="flex items-start gap-3 px-6 py-3.5">
                      <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef2fb]">
                        <span className={`h-2.5 w-2.5 rounded-full ${isCurrentSession ? 'bg-[#030848]' : 'bg-slate-400'}`} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{activityTitle(log.action)} - {os}</p>
                        <p className="text-xs text-slate-500">
                          {isCurrentSession ? 'Current session started' : `${browser}${log.location ? ` · ${log.location}` : ''}`}
                        </p>
                        <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div role="dialog" aria-modal="true" aria-labelledby="account-deletion-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <ModalHeader
              plain
              titleId="account-deletion-title"
              icon={AlertTriangle}
              title="Request account deletion"
              onClose={closeDeleteModal}
              closeDisabled={verifyingPassword || requestingDeletion}
              closeLabel="Close account deletion"
            />
            <div className="p-6">
              <p className="mb-6 text-center text-base text-slate-700">
                Are you sure you want to request account deletion?
              </p>
              <div className="mb-6">
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password to confirm"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0a0f2e]/20"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmDeletion}
                  disabled={!deletePassword || verifyingPassword || requestingDeletion}
                  className="flex-1 rounded-xl bg-[#8b0000] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#a50000] disabled:opacity-50"
                >
                  {verifyingPassword || requestingDeletion ? 'Processing...' : 'Yes'}
                </button>
                <button
                  onClick={closeDeleteModal}
                  disabled={verifyingPassword || requestingDeletion}
                  className="flex-1 rounded-xl border border-[#8b0000] bg-white px-4 py-3 text-sm font-semibold text-[#8b0000] transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
