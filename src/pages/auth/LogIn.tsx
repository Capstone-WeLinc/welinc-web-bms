import { Navigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { getRoleDashboard } from '../../lib/auth';
export default function Login(){const {user}=useApp();return user?<Navigate to={getRoleDashboard(user.role)} replace/>:<p>Opening shared sign-in...</p>;}
