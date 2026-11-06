import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { decodeJwt, getCurrentUser, getRoleDashboard, mapBackendRole, mapBackendUser, type JwtPayload } from '../../lib/auth';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../lib/api';
import type { User, UserRole } from '../../lib/types';

type AuthenticatedUser = User & {
  system: string;
  roles: JwtPayload['roles'];
};

function getInitials(identifier: string) {
  return (
    identifier
      .split(/[.@\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'WL'
  );
}

export default function Login() {
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const applyToken = (token: string) => {
    const decoded = decodeJwt<JwtPayload>(token);
    const bmsRole = decoded.roles?.find(
      (r) => String(r.system).toUpperCase() === 'BMS',
    );

    if (!bmsRole) {
      throw new Error(
        'Your account does not have access to BMS. Contact your administrator.',
      );
    }

    localStorage.setItem('token', token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    const role = mapBackendRole(bmsRole.role) as UserRole;
    const userData: AuthenticatedUser = {
      id: decoded.sub,
      username: decoded.email,
      role,
      fullName: decoded.email,
      email: decoded.email,
      contact: '',
      profilePicture: null,
      deletionRequestStatus: 'NONE',
      status: 'Active',
      createdAt: '',
      initials: getInitials(decoded.email),
      system: bmsRole.system,
      roles: decoded.roles ?? [],
    };

    localStorage.setItem('welinc_user', JSON.stringify(userData));
    setUser(userData);
    void api.get('/auth/me').then((res) => {
      const profile = mapBackendUser(res.data);
      const namedUser = { ...profile, role: userData.role };
      setUser(namedUser);
      localStorage.setItem('welinc_user', JSON.stringify(namedUser));
    }).catch(() => {
      // Keep the token-backed user if the profile request is temporarily unavailable.
    });
    const roleLabel = role === 'Administrator' ? 'Admin' : role === 'Customer Service' ? 'CS' : 'Ops';
    toast.success('Login successful', { description: `Welcome, ${roleLabel}.` });
    navigate(getRoleDashboard(userData.role), { replace: true });
  };

  useEffect(() => {
    // 1. Already logged in? Go straight to the dashboard.
    const existing = getCurrentUser();
    if (existing) {
      navigate(getRoleDashboard(existing.role), { replace: true });
      return;
    }

    // No URL token handoff is supported until Auth owners approve an SSO contract.
    if (searchParams.get('sessionExpired') === '1') {
      setError('Your session expired. Please sign in again.');
    }
    setChecking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);

    try {
      const { data } = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      if (!data?.accessToken) {
        throw new Error('No access token returned by the server.');
      }

      applyToken(data.accessToken);
    } catch (err: any) {
      const responseData = err?.response?.data;
      if (responseData?.isLocked) {
        setError('Your account is locked. Contact your Admin to unlock.');
      } else if (responseData?.remainingAttempts !== undefined) {
        setError(`Invalid credentials. ${responseData.remainingAttempts} attempts remaining.`);
      } else if (err?.response?.status === 401) {
        setError('Invalid email or password.');
      } else if (err?.response?.status === 400) {
        const msg = responseData?.message;
        setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Validation error. Please check your inputs.');
      } else {
        setError(err?.message || 'Login failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030848] p-6">
        <div className="bg-[#131842]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-black/40 text-center">
          <div className="space-y-4">
            <Truck className="animate-pulse text-[#e8b800] mx-auto" size={40} />
            <h2 className="text-xl font-bold text-white">Signing you in</h2>
            <p className="text-white/50 text-sm">Please wait a moment.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#030848]">
      {/* Left Pane: Brand Info */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/welinc-truck.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f3c]/95 via-[#131842]/80 to-[#0a0f3c]/95" />

        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[#e8b800]/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-[#e8b800]/5 blur-3xl translate-y-1/3 -translate-x-1/3" />

        <div className="relative z-10 flex flex-col h-full p-12 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#e8b800] flex items-center justify-center shadow-lg shadow-[#e8b800]/30">
              <span className="text-[#0a0f3c] font-extrabold text-lg tracking-tight">WL</span>
            </div>
            <span className="text-xl font-black text-white tracking-tight">WeLinc Logistics</span>
          </div>

          <div>
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
              WeLinc Logistics<br />
              <span className="text-[#e8b800]">Booking</span><br />
              Management System
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-sm">
              Centralized platform for managing bookings, scheduling, and job orders across your logistics operations.
            </p>
          </div>
          <div />
        </div>
      </div>

      {/* Right Pane: Login Card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f3c] via-[#080b2e] to-[#080b2e]" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#131842]/60 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#131842]/30 blur-3xl" />

        <div className="relative z-10 w-full max-w-md">
          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#e8b800] flex items-center justify-center">
              <span className="text-[#0a0f3c] font-extrabold text-sm">WL</span>
            </div>
            <span className="text-lg font-black text-white">WeLinc Logistics</span>
          </div>

          {/* Glassmorphism panel */}
          <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
            <div className="mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[#e8b800] flex items-center justify-center mb-5 shadow-lg shadow-[#e8b800]/20">
                <Truck size={22} className="text-[#0a0f3c]" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Sign In</h2>
              <p className="text-white/50 text-sm">Enter your credentials to access your workspace</p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-400/20 rounded-xl p-4 mb-5">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@welinc.com"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 text-base bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#e8b800]/40 focus:border-[#e8b800]/50 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-white/70">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[#e8b800]/80 hover:text-[#e8b800] transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3 text-base bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#e8b800]/40 focus:border-[#e8b800]/50 transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white hover:text-white/80 cursor-pointer transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={submitting}
                className="w-full bg-[#e8b800] hover:bg-[#d4a600] text-[#0a0f3c] font-black py-3.5 rounded-xl text-base transition-all cursor-pointer disabled:opacity-60 shadow-lg shadow-[#e8b800]/20 hover:shadow-[#e8b800]/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                {submitting ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
