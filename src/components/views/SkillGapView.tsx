import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { CandidateProfile, SkillGapResult } from '../../types';

interface SkillGapViewProps {
  profile: CandidateProfile;
  initialGap: SkillGapResult;
  onProfileUpdated: () => Promise<void>;
}

const TARGET_ROLES = [
  'Python Developer',
  'Data Scientist',
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Machine Learning Engineer',
  'Data Analyst',
  'Cloud / DevOps Engineer',
  'Java Developer',
  'Android Developer',
];

export const SkillGapView: React.FC<SkillGapViewProps> = ({
  profile,
  initialGap,
  onProfileUpdated,
}) => {
  const [targetRole, setTargetRole] = useState(initialGap.targetRole || profile.preferredRole);
  const [gap, setGap] = useState<SkillGapResult>(initialGap);
  const [loading, setLoading] = useState(false);
  const [addingSkill, setAddingSkill] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeRole = async (role: string) => {
    setTargetRole(role);
    setError(null);
    setLoading(true);
    try {
      const res = await api.analyzeSkillGap({
        targetRole: role,
        skills: profile.skills,
      });
      setGap(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAddSkill = async (skillName: string) => {
    setAddingSkill(skillName);
    setError(null);
    try {
      const updatedSkills = Array.from(new Set([...profile.skills, skillName]));
      await api.updateProfile({
        ...profile,
        skills: updatedSkills,
      });
      await onProfileUpdated();
      const updatedGap = await api.analyzeSkillGap({
        targetRole,
        skills: updatedSkills,
      });
      setGap(updatedGap);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingSkill(null);
    }
  };

  const chartData = gap.requiredSkillsDetail.map((item) => ({
    skill: item.name,
    demandFrequency: item.frequencyPct,
    matched: item.matched,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Skill Gap Analysis</h1>
          <p className="text-sm text-slate-600 mt-1">
            Compares your current skills against role requirements aggregated from our job dataset.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={targetRole}
            onChange={(e) => handleAnalyzeRole(e.target.value)}
            aria-label="Select target job role"
            className="px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {TARGET_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleAnalyzeRole(targetRole)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Analyze
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Compatibility Score Progress Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Target Role Readiness</p>
            <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
              {gap.targetRole}
            </h2>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-3xl font-bold font-mono tabular-nums text-blue-700">
              {gap.compatibilityScore}%
            </p>
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              {gap.matchedSkills.length} of {gap.requiredSkillsDetail.length} required skills matched
            </p>
          </div>
        </div>

        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-700 rounded-full transition-all duration-300"
            style={{ width: `${gap.compatibilityScore}%` }}
          />
        </div>
      </div>

      {/* Matched vs Missing + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Matched Skills ({gap.matchedSkills.length})
            </h3>
            {gap.matchedSkills.length === 0 ? (
              <p className="text-sm text-slate-500">
                None of the core skills for {gap.targetRole} are currently in your profile.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {gap.matchedSkills.map((skill) => (
                  <li key={skill} className="py-2.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-900">{skill}</span>
                    <span className="text-xs font-medium text-emerald-700">Possessed</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Missing Skills ({gap.missingSkills.length})
            </h3>
            {gap.missingSkills.length === 0 ? (
              <p className="text-sm text-emerald-700 font-medium">
                You cover all aggregated core skills for {gap.targetRole}.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {gap.missingSkills.map((skill) => (
                  <li key={skill} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-900">{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleQuickAddSkill(skill)}
                      disabled={addingSkill === skill}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {addingSkill === skill ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Add to Profile
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Role Requirement Chart */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Required Skill Demand Frequency (%)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Blue = matched in your profile · Amber = missing skill gap
          </p>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis
                  type="category"
                  dataKey="skill"
                  width={120}
                  tick={{ fontSize: 12, fill: '#1E293B' }}
                />
                <Tooltip
                  formatter={(val) => [`${val}% of role listings`, 'Demand Frequency']}
                  contentStyle={{ borderRadius: '8px', borderColor: '#E2E8F0', fontSize: '12px' }}
                />
                <Bar dataKey="demandFrequency" radius={[0, 4, 4, 0]} barSize={18}>
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={`skill-bar-${idx}`}
                      fill={entry.matched ? '#1D4ED8' : '#D97706'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
