import React, { Suspense, lazy } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ImpersonationBanner from './components/ImpersonationBanner.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

import Welcome from './pages/Welcome.jsx';
import Register from './pages/Register.jsx';
import VerifyOtp from './pages/VerifyOtp.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Sections from './pages/Sections.jsx';
import LevelSections from './pages/LevelSections.jsx';
import SectionDetail from './pages/SectionDetail.jsx';
import BookDetail from './pages/BookDetail.jsx';
import ChapterDetail from './pages/ChapterDetail.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import TestCentre from './pages/TestCentre.jsx';
import Progress from './pages/Progress.jsx';
import BlogFeed from './pages/BlogFeed.jsx';
import BlogPost from './pages/BlogPost.jsx';
import NotFound from './pages/NotFound.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Lazy-loaded: these are the heaviest, least-frequently-visited routes
// (faculty/admin tooling, the in-test-taking flow), so keeping them out of
// the initial bundle meaningfully reduces first-load size for students on
// mid-range Android phones, who mostly just browse chapters/tests/progress.
const FacultyHub = lazy(() => import('./pages/FacultyHub.jsx'));
const AdminPortal = lazy(() => import('./pages/AdminPortal.jsx'));
const TakeTest = lazy(() => import('./pages/TakeTest.jsx'));
const TestReview = lazy(() => import('./pages/TestReview.jsx'));

function RouteLoadingFallback() {
  return <div className="spinner" />;
}

export default function App() {
  const { currentUser } = useAuth();

  return (
    <>
      <Navbar />
      <ImpersonationBanner />
      <ErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/onboarding" element={<ProtectedRoute roles={['student', 'onboarding']}><Onboarding /></ProtectedRoute>} />
            <Route path="/sections" element={<ProtectedRoute><Sections /></ProtectedRoute>} />
            <Route path="/sections/level/:level" element={<ProtectedRoute><LevelSections /></ProtectedRoute>} />
            <Route path="/sections/:sectionId" element={<ProtectedRoute><SectionDetail /></ProtectedRoute>} />
            <Route path="/sections/:sectionId/books/:bookId" element={<ProtectedRoute><BookDetail /></ProtectedRoute>} />
            <Route path="/sections/:sectionId/books/:bookId/chapters/:chapterId" element={<ProtectedRoute><ChapterDetail /></ProtectedRoute>} />

            <Route path="/tests" element={<ProtectedRoute roles={['student']}><TestCentre /></ProtectedRoute>} />
            <Route path="/tests/:testId/take" element={<ProtectedRoute roles={['student']}><TakeTest /></ProtectedRoute>} />
            <Route path="/tests/attempts/:attemptId" element={<ProtectedRoute roles={['student']}><TestReview /></ProtectedRoute>} />
            <Route path="/progress" element={<ProtectedRoute roles={['student']}><Progress /></ProtectedRoute>} />

            <Route path="/blog" element={<ProtectedRoute><BlogFeed /></ProtectedRoute>} />
            <Route path="/blog/:id" element={<ProtectedRoute><BlogPost /></ProtectedRoute>} />

            <Route path="/faculty" element={<ProtectedRoute roles={['faculty']}><FacultyHub /></ProtectedRoute>} />

            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminPortal /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>

      <footer>
        Connectomic Medical Academy — built around Prof. Konuri's Seven Hills of Knowledge.
        {!currentUser && <> · <Link to="/admin-login">Admin</Link></>}
      </footer>
    </>
  );
}