import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardHome } from './pages/DashboardHome';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { EmployeeProfile } from './pages/EmployeeProfile';
import { AttendanceTracking } from './pages/AttendanceTracking';
import { LeaveManagement } from './pages/LeaveManagement';
import { Notifications } from './pages/Notifications';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { VerifyEmail } from './pages/VerifyEmail';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Protected Dashboard Routes */}
          <Route path="/" element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardHome />} />
              <Route path="employees" element={<EmployeeManagement />} />
              <Route path="employees/:id" element={<EmployeeProfile />} />
              <Route path="attendance" element={<AttendanceTracking />} />
              <Route path="leave-management" element={<LeaveManagement />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
