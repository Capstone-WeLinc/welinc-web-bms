import { ConfirmProvider } from './components/shared/confirm/ConfirmProvider';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useApp } from './contexts/AppContext';
import Layout from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import CsDashboard from './pages/customerservice/CsDashboard';
import CsDailySales from './pages/customerservice/CsDailySales';
import CsBookings from './pages/customerservice/CsBookings';
import AdminProfile from './pages/admin/AdminProfile';
import CsProfile from './pages/customerservice/CsProfile';
import AdminSettings from './pages/admin/AdminSettings';
import Users from './pages/admin/CrewManagement';
import LogIn from './pages/auth/LogIn';
import ForgotPassword from './pages/auth/ForgotPassword';
import BookingModule from './pages/admin/BookingModule';
import Scheduling from './pages/admin/Scheduling';
import AdminJobOrder from './pages/admin/JobOrder';
import OperationsDashboard from './pages/operations/OperationsDashboard';
import OperationsProfile from './pages/operations/OperationsProfile';
import OperationsJobOrder from './pages/operations/OperationsJobOrder';
import VehicleAvailability from './pages/admin/VehicleAvailability';
import Reports from './pages/admin/Reports';
import AdminSalesReport from './pages/admin/AdminSalesReport';
import AdminDashboard from './pages/admin/AdminDashboard';
import PostService from './pages/admin/PostService';
import ServicesOffered from './pages/admin/ServicesOffered';
import CsPostService from './pages/customerservice/CsPostService';
import { getRoleDashboard } from './lib/auth';
import ActivityLogs from './pages/admin/ActivityLogs';
import Approvals from './pages/admin/Approvals';
import MySubmissions from './pages/customerservice/MySubmissions';
import BookingTracking from './pages/public/BookingTracking';


function App() {
  const { user } = useApp();
  const landingPath = user ? getRoleDashboard(user.role) : '/login';

  return (
    <BrowserRouter>
      <>
      <ConfirmProvider />
      <Routes>
        <Route path="/admin/users" element={<Navigate to="/admin/crew" replace />} />
        <Route path="/track/:bookingId" element={<BookingTracking />} />
        <Route path="/login" element={<LogIn />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

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
          path="/admin/crew"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <Users />
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
        <Route path="/admin/activity-logs" element={<ProtectedRoute allowedRoles={['Administrator']}><Layout><ActivityLogs /></Layout></ProtectedRoute>} />
        <Route path="/admin/approvals" element={<ProtectedRoute allowedRoles={['Administrator']}><Layout><Approvals /></Layout></ProtectedRoute>} />
        <Route path="/admin/services-offered" element={<ProtectedRoute allowedRoles={['Administrator']}><Layout><ServicesOffered /></Layout></ProtectedRoute>} />

        <Route
          path="/admin/scheduling"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <Scheduling canAssign={false} />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/job-order"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <AdminJobOrder />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/vehicle-availability"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <VehicleAvailability />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/sales-report"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <AdminSalesReport />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <Reports />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/post-service"
          element={
            <ProtectedRoute allowedRoles={['Administrator']}>
              <Layout>
                <PostService />
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
                <CsBookings />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/cs/my-submissions" element={<ProtectedRoute allowedRoles={['Customer Service']}><Layout><MySubmissions /></Layout></ProtectedRoute>} />
        <Route
          path="/cs/daily-sales"
          element={
            <ProtectedRoute allowedRoles={['Customer Service']}>
              <Layout>
                <CsDailySales />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cs/post-service"
          element={
            <ProtectedRoute allowedRoles={['Customer Service']}>
              <Layout>
                <CsPostService />
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
          path="/operations/dashboard"
          element={
            <ProtectedRoute allowedRoles={['Operations']}>
              <Layout>
                <OperationsDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/operations/scheduling"
          element={
            <ProtectedRoute allowedRoles={['Operations']}>
              <Layout>
                <Scheduling canAssign />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/operations/vehicle-availability"
          element={
            <ProtectedRoute allowedRoles={['Operations']}>
              <Layout>
                <VehicleAvailability />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/operations/job-order"
          element={
            <ProtectedRoute allowedRoles={['Operations']}>
              <Layout>
                <OperationsJobOrder />
              </Layout>
            </ProtectedRoute>
          }
        />


        <Route
          path="/operations/profile"
          element={
            <ProtectedRoute allowedRoles={['Operations']}>
              <Layout>
                <OperationsProfile />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to={landingPath} replace />} />
      </Routes>
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          classNames: {
            toast: 'border-2 border-emerald-400 bg-emerald-50 text-emerald-800 shadow-none',
            success: 'border-emerald-400 bg-emerald-50 text-emerald-800',
          },
        }}
      />
      </>
    </BrowserRouter>
  );
}

export default App;
