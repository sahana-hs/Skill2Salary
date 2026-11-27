import React, { useCallback, useEffect, useState } from 'react';
import {
  Bookmark,
  Briefcase,
  IndianRupee,
  LayoutDashboard,
  Layers,
  Loader2,
  LogOut,
  Menu,
  Settings,
  Target,
  User as UserIcon,
  X,
} from 'lucide-react';
import { api, setAuthToken } from '../services/api';
import { DashboardSummary, SkillCatalogItem } from '../types';
import { DashboardTab, OverviewView } from './views/OverviewView';
import { ProfileView } from './views/ProfileView';
import { SalaryPredictionView } from './views/SalaryPredictionView';
import { SkillGapView } from './views/SkillGapView';
import { SkillRecommendationsView } from './views/SkillRecommendationsView';
import { JobsView } from './views/JobsView';
import { SettingsView } from './views/SettingsView';

interface DashboardLayoutProps {
  onLogout: () => void;
}

const NAV_ITEMS: Array<{
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'profile', label: 'My Profile', icon: UserIcon },
  { id: 'salary', label: 'Salary Prediction', icon: IndianRupee },
  { id: 'skill-gap', label: 'Skill Gap Analysis', icon: Target },
  { id: 'recommendations', label: 'Skill Recommendations', icon: Layers },
  { id: 'jobs', label: 'Recommended Jobs', icon: Briefcase },
  { id: 'saved', label: 'Saved Jobs', icon: Bookmark },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [skillsCatalog, setSkillsCatalog] = useState<SkillCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const loadDashboard = useCallback(async () => {
    setError(null);
    try {
      const [sumRes, catRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getSkillsCatalog(),
      ]);
      setSummary(sumRes);
      setSkillsCatalog(catRes.skills);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleLogoutClick = async () => {
    try {
      await api.logout();
    } catch {
      // ignore network error on logout
    }
    setAuthToken(null);
    onLogout();
  };

  const activeNavLabel =
    NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Overview';

  const selectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700" />
          Loading your career intelligence workspace...
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center space-y-4">
          <p className="font-display text-lg font-bold text-slate-900">
            Unable to load dashboard
          </p>
          <p className="text-sm text-slate-600">{error || 'Session expired.'}</p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={loadDashboard}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={handleLogoutClick}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
            >
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
        <span className="font-display text-base font-bold tracking-tight text-white">
          Skill to Salary
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-slate-400 hover:text-white"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button
          type="button"
          onClick={handleLogoutClick}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-slate-900/60 flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside className="w-64 h-full" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-sm text-slate-500 truncate">
              <span>Dashboard</span>
              <span className="mx-2 text-slate-300">/</span>
              <span className="font-semibold text-slate-900">{activeNavLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => selectTab('profile')}
            className="flex items-center gap-2.5 text-left hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            {!avatarFailed ? (
              <img
                src="/src/assets/images/avatar_demo_candidate_1795676856517.jpg"
                alt={summary.user.fullName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center">
                {summary.user.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-900 leading-tight">
                {summary.user.fullName}
              </p>
              <p className="text-[11px] text-slate-500 leading-tight">
                {summary.profile.preferredRole}
              </p>
            </div>
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView summary={summary} onNavigateTab={selectTab} />
          )}
          {activeTab === 'profile' && (
            <ProfileView
              user={summary.user}
              profile={summary.profile}
              skillsCatalog={skillsCatalog}
              onProfileSaved={loadDashboard}
            />
          )}
          {activeTab === 'salary' && (
            <SalaryPredictionView
              profile={summary.profile}
              initialPrediction={summary.latestPrediction}
            />
          )}
          {activeTab === 'skill-gap' && (
            <SkillGapView
              profile={summary.profile}
              initialGap={summary.skillGap}
              onProfileUpdated={loadDashboard}
            />
          )}
          {activeTab === 'recommendations' && (
            <SkillRecommendationsView
              profile={summary.profile}
              initialRecommendations={summary.recommendations}
            />
          )}
          {activeTab === 'jobs' && (
            <JobsView mode="recommended" onSavedCountChanged={loadDashboard} />
          )}
          {activeTab === 'saved' && (
            <JobsView mode="saved" onSavedCountChanged={loadDashboard} />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              user={summary.user}
              onNavigateProfile={() => selectTab('profile')}
            />
          )}
        </main>
      </div>
    </div>
  );
};
