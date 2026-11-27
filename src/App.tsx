import { useState } from 'react';
import { AuthViews } from './components/AuthViews';
import { DashboardLayout } from './components/DashboardLayout';
import { LandingPage } from './components/LandingPage';
import { CandidateProfile, User } from './types';

type AppRoute = 'landing' | 'login' | 'register' | 'dashboard';

export default function App() {
  const [route, setRoute] = useState<AppRoute>('landing');
  const [_sessionUser, setSessionUser] = useState<User | null>(null);
  const [_sessionProfile, setSessionProfile] = useState<CandidateProfile | null>(null);

  const handleAuthSuccess = (user: User, profile: CandidateProfile) => {
    setSessionUser(user);
    setSessionProfile(profile);
    setRoute('dashboard');
  };

  const handleLogout = () => {
    setSessionUser(null);
    setSessionProfile(null);
    setRoute('landing');
  };

  if (route === 'dashboard') {
    return <DashboardLayout onLogout={handleLogout} />;
  }

  if (route === 'login' || route === 'register') {
    return (
      <AuthViews
        initialMode={route}
        onBackHome={() => setRoute('landing')}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  return (
    <LandingPage
      onNavigateAuth={(mode) => setRoute(mode)}
    />
  );
}
