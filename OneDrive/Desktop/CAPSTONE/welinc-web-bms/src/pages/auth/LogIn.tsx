import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Truck } from 'lucide-react';
import { getRoleDashboard, mapBackendRole } from '../../lib/auth';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../lib/api';
import type { User, UserRole } from '../../lib/types';

interface JwtPayload {
  sub: string;
  username: string;
  system: string;
  roles: {
    role: string;
    system: string;
  }[];
}

function decodeJwt<T>(token: string): T {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Invalid token');
  }

  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  );

  return JSON.parse(json) as T;
}

type AuthenticatedUser = User & {
  system: string;
  roles: JwtPayload['roles'];
};

function getInitials(username: string) {
  return username
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'WL';
}

export default function Login() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [forgotPassword, setForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={getRoleDashboard(user.role as UserRole)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        username: username.trim(),
        password,
        system: 'BMS',
      });

      const token = response.data.accessToken;
      localStorage.setItem('token', token);
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      const decoded = decodeJwt<JwtPayload>(token);
      const bmsRole = decoded.roles?.find((r) => String(r.system).toUpperCase() === 'BMS');

      if (!bmsRole) {
        setError('User has no BMS access');
        setLoading(false);
        return;
      }

      const role = mapBackendRole(bmsRole.role) as UserRole;
      const userData: AuthenticatedUser = {
        id: decoded.sub,
        username: decoded.username,
        role,
        fullName: decoded.username,
        email: '',
        contact: '',
        status: 'Active',
        createdAt: '',
        initials: getInitials(decoded.username),
        system: decoded.system,
        roles: decoded.roles ?? [],
      };

      localStorage.setItem('welinc_user', JSON.stringify(userData));
      setUser(userData);
      navigate(getRoleDashboard(userData.role));
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string };
      if (err.response?.status === 401) {
        setError('Invalid username or password');
      } else {
        setError(
          err.message
            ? `Login failed: ${err.message}`
            : 'Unable to connect to the authentication server. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0d1240]">
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100058644/42c68fef-2874-4f.avif)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1240]/90 via-[#1a1f6e]/80 to-[#0d1240]/95" />
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-[#e8b800]/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-[#e8b800]/5 blur-3xl translate-y-1/3 -translate-x-1/3" />
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />

        <div className="relative z-10 flex flex-col h-full p-12 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#e8b800] flex items-center justify-center shadow-lg shadow-[#e8b800]/30">
              <img
                src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100058644/296c4c4a-9502-46.jpg"
                alt="WeLinc"
                crossOrigin="anonymous"
                className="h-8 w-auto"
              />
            </div>
            <span className="text-xl font-black text-white tracking-tight">WeLinc Logistics</span>
          </div>

          <div>
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
              Booking<br />
              <span className="text-[#e8b800]">Management</span><br />
              System
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xs">
              The <span className="text-[#e8b800] font-semibold">#hasslefree</span> transport solution for modern logistics teams.
            </p>
          </div>

          <div />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1240] via-[#111747] to-[#0a0e35]" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#1a1f6e]/40 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-[#1a1f6e]/20 blur-3xl" />

        <div className="relative z-10 w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#e8b800] flex items-center justify-center">
              <img
                src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100058644/296c4c4a-9502-46.jpg"
                alt="WeLinc"
                crossOrigin="anonymous"
                className="h-7 w-auto"
              />
            </div>
            <span className="text-lg font-black text-white">WeLinc Logistics</span>
          </div>

          <div className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
            <div className="mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[#e8b800] flex items-center justify-center mb-5 shadow-lg shadow-[#e8b800]/20">
                <Truck size={22} className="text-[#1a1f6e]" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Welcome back</h2>
              <p className="text-white/50 text-sm">Sign in to access your dashboard</p>
            </div>

            {forgotPassword && (
              <div className="flex items-start gap-2.5 bg-blue-500/10 border border-blue-400/20 rounded-xl p-4 mb-5">
                <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-300">Please contact your administrator to reset your password.</p>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-400/20 rounded-xl p-4 mb-5">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  className="w-full px-4 py-3 text-base bg-white/[0.07] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#e8b800]/40 focus:border-[#e8b800]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-4 py-3 text-base bg-white/[0.07] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#e8b800]/40 focus:border-[#e8b800]/50 transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 cursor-pointer transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setForgotPassword(true)}
                    className="text-sm text-[#e8b800]/70 hover:text-[#e8b800] cursor-pointer transition-colors font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#e8b800] hover:bg-[#d4a600] text-[#1a1f6e] font-black py-3.5 rounded-xl text-base transition-all cursor-pointer disabled:opacity-60 shadow-lg shadow-[#e8b800]/20 hover:shadow-[#e8b800]/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

