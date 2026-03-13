import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Sidebar from './components/Sidebar';
import ChallengeChecker from './components/ChallengeChecker';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import LogSession from './pages/LogSession';
import Heatmap from './pages/Heatmap';
import Analytics from './pages/Analytics';
import Predictions from './pages/Predictions';
import Chatbot from './pages/Chatbot';
import Recommendations from './pages/Recommendations';
import Profile from './pages/Profile';
import StudyKit from './pages/StudyKit';
import LearningMap from './pages/LearningMap';
import PomodoroTimer from './pages/PomodoroTimer';
import './App.css';

const routerBasename =
  window.location.hostname === 'saikumarreddyappidi.github.io'
    ? '/smartstudy'
    : '/';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? '/dashboard' : '/'} replace />;
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-fade">{children}</div>
      </main>
      <ChallengeChecker />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={routerBasename}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<PrivateRoute><AppLayout><Dashboard /></AppLayout></PrivateRoute>} />
          <Route path="/log" element={<PrivateRoute><AppLayout><LogSession /></AppLayout></PrivateRoute>} />
          <Route path="/heatmap" element={<PrivateRoute><AppLayout><Heatmap /></AppLayout></PrivateRoute>} />
          <Route path="/analytics" element={<PrivateRoute><AppLayout><Analytics /></AppLayout></PrivateRoute>} />
          <Route path="/predictions" element={<PrivateRoute><AppLayout><Predictions /></AppLayout></PrivateRoute>} />
          <Route path="/chatbot" element={<PrivateRoute><AppLayout><Chatbot /></AppLayout></PrivateRoute>} />
          <Route path="/recommendations" element={<PrivateRoute><AppLayout><Recommendations /></AppLayout></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><AppLayout><Profile /></AppLayout></PrivateRoute>} />
          <Route path="/studykit" element={<PrivateRoute><AppLayout><StudyKit /></AppLayout></PrivateRoute>} />
          <Route path="/learningmap" element={<PrivateRoute><AppLayout><LearningMap /></AppLayout></PrivateRoute>} />
          <Route path="/timer" element={<PrivateRoute><AppLayout><PomodoroTimer /></AppLayout></PrivateRoute>} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
