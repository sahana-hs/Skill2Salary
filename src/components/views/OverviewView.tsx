import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  CheckCircle2,
  IndianRupee,
  Lightbulb,
  Target,
  TrendingUp,
} from 'lucide-react';
import { formatINR, formatLPA } from '../../services/api';
import { DashboardSummary } from '../../types';

export type DashboardTab =
  | 'overview'
  | 'profile'
  | 'salary'
  | 'skill-gap'
  | 'recommendations'
  | 'jobs'
  | 'saved'
  | 'settings';

interface OverviewViewProps {
  summary: DashboardSummary;
  onNavigateTab: (tab: DashboardTab) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ summary, onNavigateTab }) => {
  const {
    profile,
    latestPrediction,
    skillGap,
    recommendations,
    topJobs,
    matchingJobsCount,
    salaryProjection,
    insights,
  } = summary;

  const jobChartData = topJobs.slice(0, 5).map((item) => ({
    name:
      item.job.title.length > 16 ? `${item.job.title.slice(0, 15)}…` : item.job.title,
    match: item.matchPercentage,
    skillOverlap: item.skillOverlapPct,
  }));

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Welcome back, {summary.user.fullName}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Target Role: <span className="font-medium text-slate-900">{profile.preferredRole}</span>
            <span className="mx-2 text-slate-300">·</span>
            Location: <span className="font-medium text-slate-900">{profile.city}</span>
            <span className="mx-2 text-slate-300">·</span>
            Experience:{' '}
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {profile.experienceYears} yrs
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('profile')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Update Profile &amp; Skills
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('salary')}
          className="text-left p-5 bg-white border border-slate-200 hover:border-blue-300 rounded-xl transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Predicted Annual Salary</span>
            <IndianRupee className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatINR(latestPrediction.predictedSalary)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
            {formatINR(latestPrediction.monthlySalary)} / mo · {latestPrediction.modelUsed}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('skill-gap')}
          className="text-left p-5 bg-white border border-slate-200 hover:border-blue-300 rounded-xl transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Skill Compatibility</span>
            <Target className="w-4 h-4 text-cyan-700" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {skillGap.compatibilityScore}%
          </p>
          <p className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
            {skillGap.matchedSkills.length} of {skillGap.requiredSkillsDetail.length} core skills matched
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('jobs')}
          className="text-left p-5 bg-white border border-slate-200 hover:border-blue-300 rounded-xl transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Matching Jobs</span>
            <Briefcase className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {matchingJobsCount}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Demo openings ≥55% overall fit
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('recommendations')}
          className="text-left p-5 bg-white border border-slate-200 hover:border-blue-300 rounded-xl transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Skills To Learn</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {recommendations.length}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Prioritized for {profile.preferredRole}
          </p>
        </button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Salary Trajectory Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                5-Year Salary Trajectory Forecast (INR)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Projected by {latestPrediction.modelUsed} for {profile.preferredRole} in {profile.city}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('salary')}
              className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer whitespace-nowrap"
            >
              Open Estimator
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salaryProjection} margin={{ top: 10, right: 12, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salaryFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickFormatter={(v) => `₹${(Number(v) / 100000).toFixed(1)}L`}
                />
                <Tooltip
                  formatter={(value) => [formatINR(Number(value)), 'Estimated CTC']}
                  contentStyle={{
                    borderRadius: '8px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="predictedSalary"
                  stroke="#1D4ED8"
                  strokeWidth={2.5}
                  fill="url(#salaryFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Job Compatibility Bar Chart */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Top Job Match Scores
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Overall fit vs. weighted skill overlap (%)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('jobs')}
              className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer whitespace-nowrap"
            >
              View All Jobs
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jobChartData} layout="vertical" margin={{ top: 5, right: 16, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: '#334155' }}
                />
                <Tooltip
                  formatter={(val, name) => [
                    `${val}%`,
                    name === 'match' ? 'Overall Fit' : 'Skill Overlap',
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="match" fill="#1D4ED8" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="skillOverlap" fill="#0891B2" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Skill Gap Summary + Insights + Recent Top Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Skill Gap & Career Insights */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Skill Gap Snapshot
              </h2>
              <span className="text-sm font-bold font-mono tabular-nums text-blue-700">
                {skillGap.compatibilityScore}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 rounded-full transition-all"
                style={{ width: `${skillGap.compatibilityScore}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Matched ({skillGap.matchedSkills.length})
                </p>
                <p className="text-slate-600 leading-relaxed">
                  {skillGap.matchedSkills.length > 0
                    ? skillGap.matchedSkills.join(' · ')
                    : 'No matched skills yet'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-amber-700 mb-1.5">
                  Missing ({skillGap.missingSkills.length})
                </p>
                <p className="text-slate-600 leading-relaxed">
                  {skillGap.missingSkills.length > 0
                    ? skillGap.missingSkills.join(' · ')
                    : 'None — full match'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-200">
            <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-cyan-700" />
              Career Improvement Insights
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600">
              {insights.map((tip, i) => (
                <li key={i} className="leading-relaxed">
                  {i + 1}. {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Top Recommended Jobs Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Top Recommended Jobs (Demo Listings)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ranked by skill overlap, TF-IDF cosine similarity, experience, and location
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('saved')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 cursor-pointer whitespace-nowrap"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Saved ({summary.savedJobsCount})
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            {topJobs.slice(0, 4).map((m) => (
              <div
                key={m.job.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{m.job.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {m.job.companyName} · {m.job.location} ·{' '}
                    <span className="font-mono tabular-nums">
                      {formatLPA(m.job.salaryMin)}–{formatLPA(m.job.salaryMax)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono tabular-nums text-blue-700">
                      {m.matchPercentage}% Match
                    </p>
                    <p className="text-xs text-slate-500">{m.experienceMatch}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('jobs')}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
