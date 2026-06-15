import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

interface Props {
  children: React.ReactElement;
  allowedRoles?: string[]; // role names as stored in user.role (e.g. 'Administrator')
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user } = useApp();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      // Not authorized for this route
      return <Navigate to="/login" replace />;
    }
  }

  return children;
}
