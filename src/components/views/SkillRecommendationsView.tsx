import React, { useState } from 'react';
import { BookOpen, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { CandidateProfile, SkillRecommendation } from '../../types';

interface SkillRecommendationsViewProps {
  profile: CandidateProfile;
  initialRecommendations: SkillRecommendation[];
}

export const SkillRecommendationsView: React.FC<SkillRecommendationsViewProps> = ({
  profile,
  initialRecommendations,
}) => {
  const [recommendations, setRecommendations] =
    useState<SkillRecommendation[]>(initialRecommendations);
  const [targetRole, setTargetRole] = useState(profile.preferredRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async (role: string) => {
    setTargetRole(role);
    setLoading(true);
    setError(null);
    try {
      const res = await api.refreshSkillRecommendations({
        targetRole: role,
        skills: profile.skills,
      });
      setRecommendations(res.recommendations);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Skill Recommendations &amp; Learning Paths
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Prioritized skills derived from your missing job requirements and market demand for{' '}
            <span className="font-medium text-slate-900">{targetRole}</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleRefresh(targetRole)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Recalculate Roadmap
        </button>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Recommendations Table/Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map((rec, index) => (
          <div
            key={rec.skillName}
            className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-mono tabular-nums text-slate-500">
                    Recommendation 0{index + 1} · Demand {rec.demandScore}/100
                  </p>
                  <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                    {rec.skillName}
                  </h2>
                </div>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    rec.priority === 'High'
                      ? 'text-red-700'
                      : rec.priority === 'Medium'
                      ? 'text-amber-700'
                      : 'text-cyan-700'
                  }`}
                >
                  {rec.priority} Priority
                </span>
              </div>

              <p className="text-sm text-slate-600 mt-3 leading-relaxed">{rec.reason}</p>

              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Required by: </span>
                {rec.targetJobs.join(' · ')}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                {rec.learningSource}
              </span>
              <a
                href={rec.learningUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
              >
                Open Documentation
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Learning Resource Disclaimer */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600">
        All external learning links point directly to official language, framework, or platform
        documentation (e.g., Python Docs, React Docs, Scikit-learn, Docker, PostgreSQL, MDN). No
        third-party paid course claims are fabricated.
      </div>
    </div>
  );
};
