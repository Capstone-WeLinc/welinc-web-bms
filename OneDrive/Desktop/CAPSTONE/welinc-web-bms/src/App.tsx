// @ts-ignore: Cannot find declaration file for module 'react'
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './contexts/AppContext';
import Layout from './components/Sidebar';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProfile from './pages/admin/AdminProfile';
import AdminSettings from './pages/admin/AdminSettings';
import Users from './pages/admin/UserManagement';
import LogIn from './pages/auth/LogIn';
import BookingModule from './pages/admin/BookingModule';

function App() {
  const { user } = useApp();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LogIn />} />
        <Route
          path="/admin/dashboard"
          element={
            user ? (
              <Layout>
                <AdminDashboard />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/settings"
          element={
            user ? (
              <Layout>
                <AdminSettings />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/profile"
          element={
            user ? (
              <Layout>
                <AdminProfile />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/users"
          element={
            user ? (
              <Layout>
                <Users />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/booking"
          element={
            user ? (
              <Layout>
                <BookingModule />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/bookings"
          element={<Navigate to="/admin/booking" replace />}
        />
        <Route
          path="*"
          element={
            <Navigate to={user ? '/admin/dashboard' : '/login'} replace />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
