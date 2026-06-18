// @ts-ignore: Cannot find declaration file for module 'react'
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './contexts/AppContext';
import Layout from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import CsDashboard from './pages/customerservice/CsDashboard';
import AdminProfile from './pages/admin/AdminProfile';
import CsProfile from './pages/customerservice/CsProfile';
import AdminSettings from './pages/admin/AdminSettings';
import Users from './pages/admin/UserManagement';
import LogIn from './pages/auth/LogIn';
import BookingModule from './pages/admin/BookingModule';
import Scheduling from './pages/admin/Scheduling';
import OperationsDashboard from './pages/operations/OperationsDashboard';
import Vehicles from './pages/admin/Vehicles';
import Garages from './pages/admin/Garages';
import Drivers from './pages/admin/Drivers';
import { getRoleDashboard } from './lib/auth';

function App() {
  const { user } = useApp();
  const landingPath = user ? getRoleDashboard(user.role) : '/login';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LogIn />} />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <AdminDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <AdminSettings />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <AdminProfile />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <Users />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/vehicles"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <Vehicles />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/garages"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <Garages />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/drivers"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <Drivers />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/booking"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <BookingModule />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/admin/bookings" element={<Navigate to="/admin/booking" replace />} />

        <Route
          path="/admin/scheduling"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <Scheduling />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/cs/dashboard"
          element={
            <ProtectedRoute allowedRoles={['Customer Service']}>
              <Layout>
                <CsDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cs/bookings"
          element={
            <ProtectedRoute allowedRoles={['Customer Service']}>
              <Layout>
                <BookingModule />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cs/profile"
          element={
            <ProtectedRoute allowedRoles={['Customer Service']}>
              <Layout>
                <CsProfile />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cs/settings"
          element={
            <ProtectedRoute allowedRoles={['Customer Service']}>
              <Layout>
                <AdminSettings />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/operations/dashboard"
          element={
            <ProtectedRoute allowedRoles={['Operations']}>
              <Layout>
                <OperationsDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to={landingPath} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
