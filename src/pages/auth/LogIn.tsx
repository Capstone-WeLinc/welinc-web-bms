import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
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
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const ssoToken = searchParams.get('token');
    if (!ssoToken) {
      // If no token is provided, redirect directly to the unified portal
      const portalUrl = import.meta.env.VITE_PORTAL_URL || 'http://localhost:5176';
      window.location.href = `${portalUrl}/login`;
      return;
    }

    try {
      localStorage.setItem('token', ssoToken);
      api.defaults.headers.common.Authorization = `Bearer ${ssoToken}`;

      const decoded = decodeJwt<JwtPayload>(ssoToken);
      const bmsRole = decoded.roles?.find((r) => String(r.system).toUpperCase() === 'BMS');

      if (!bmsRole) {
        setError('Your account does not have access to the Booking Management System.');
        localStorage.clear();
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
      navigate(getRoleDashboard(userData.role), { replace: true });
    } catch (err) {
      console.error('[SSO Token Parsing Error]', err);
      setError('Invalid or expired authentication token.');
      localStorage.clear();
    }
  }, [searchParams, setUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1240] p-6">
      <div className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-black/40 text-center">
        {error ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center text-red-400">
              <AlertCircle size={48} />
            </div>
            <h2 className="text-xl font-bold text-white">Authentication Failed</h2>
            <p className="text-white/60 text-sm">{error}</p>
            <button
              onClick={() => {
                const portalUrl = import.meta.env.VITE_PORTAL_URL || 'http://localhost:5176';
                window.location.href = `${portalUrl}/login`;
              }}
              className="mt-4 w-full bg-[#e8b800] hover:bg-[#d4a600] text-[#1a1f6e] font-bold py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Back to Portal Login
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="animate-spin text-[#e8b800] mx-auto" size={40} />
            <h2 className="text-xl font-bold text-white">Verifying SSO Session</h2>
            <p className="text-white/50 text-sm">Please wait while we redirect you to your dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}
