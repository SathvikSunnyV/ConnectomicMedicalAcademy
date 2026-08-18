import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ImpersonationBanner from './components/ImpersonationBanner.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Welcome from './pages/Welcome.jsx';
import Register from './pages/Register.jsx';
import VerifyOtp from './pages/VerifyOtp.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Sections from './pages/Sections.jsx';
import SectionDetail from './pages/SectionDetail.jsx';
import BookDetail from './pages/BookDetail.jsx';
import ChapterDetail from './pages/ChapterDetail.jsx';
import FacultyHub from './pages/FacultyHub.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminPortal from './pages/AdminPortal.jsx';
import TestCentre from './pages/TestCentre.jsx';
import TakeTest from './pages/TakeTest.jsx';
import TestReview from './pages/TestReview.jsx';
import Progress from './pages/Progress.jsx';
import { useAuth } from './context/AuthContext.jsx';

export default function App() {
  const { currentUser } = useAuth();

  return (
    <>
      <Navbar />
      <ImpersonationBanner />
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/onboarding" element={<ProtectedRoute roles={['student', 'onboarding']}><Onboarding /></ProtectedRoute>} />
        <Route path="/sections" element={<ProtectedRoute><Sections /></ProtectedRoute>} />
        <Route path="/sections/:sectionId" element={<ProtectedRoute><SectionDetail /></ProtectedRoute>} />
        <Route path="/sections/:sectionId/books/:bookId" element={<ProtectedRoute><BookDetail /></ProtectedRoute>} />
        <Route path="/sections/:sectionId/books/:bookId/chapters/:chapterId" element={<ProtectedRoute><ChapterDetail /></ProtectedRoute>} />

        <Route path="/tests" element={<ProtectedRoute roles={['student']}><TestCentre /></ProtectedRoute>} />
        <Route path="/tests/:testId/take" element={<ProtectedRoute roles={['student']}><TakeTest /></ProtectedRoute>} />
        <Route path="/tests/attempts/:attemptId" element={<ProtectedRoute roles={['student']}><TestReview /></ProtectedRoute>} />
        <Route path="/progress" element={<ProtectedRoute roles={['student']}><Progress /></ProtectedRoute>} />

        <Route path="/faculty" element={<ProtectedRoute roles={['faculty']}><FacultyHub /></ProtectedRoute>} />

        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminPortal /></ProtectedRoute>} />
      </Routes>

      <footer>
        Connectomic Medical Academy — built around Prof. Konuri's Seven Hills of Knowledge.
        {!currentUser && <> · <Link to="/admin-login">Admin</Link></>}
      </footer>
    </>
  );
}
