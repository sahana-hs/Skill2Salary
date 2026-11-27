import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import { api, formatINR, formatLPA } from '../../services/api';
import { JobMatch } from '../../types';

interface JobsViewProps {
  mode: 'recommended' | 'saved';
  onSavedCountChanged?: () => void;
}

export const JobsView: React.FC<JobsViewProps> = ({ mode, onSavedCountChanged }) => {
  const [jobs, setJobs] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobMatch | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [maxExperience, setMaxExperience] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [skillFilter, setSkillFilter] = useState('');

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'saved') {
        const res = await api.getSavedJobs();
        setJobs(res.savedJobs);
      } else {
        const res = await api.getRecommendedJobs({
          search,
          location: locationFilter,
          role: roleFilter,
          experience: maxExperience,
          minSalary,
          skill: skillFilter,
        });
        setJobs(res.recommendations);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [mode, locationFilter, roleFilter, maxExperience, minSalary]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  const handleToggleSave = async (jobId: string) => {
    setSavingId(jobId);
    try {
      const res = await api.toggleSaveJob(jobId);
      if (mode === 'saved' && !res.saved) {
        setJobs((prev) => prev.filter((item) => item.job.id !== jobId));
      } else {
        setJobs((prev) =>
          prev.map((item) =>
            item.job.id === jobId ? { ...item, isSaved: res.saved } : item
          )
        );
      }
      if (selectedJob && selectedJob.job.id === jobId) {
        setSelectedJob({ ...selectedJob, isSaved: res.saved });
      }
      onSavedCountChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {mode === 'saved' ? 'Saved Jobs Shortlist' : 'Recommended Jobs'}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {mode === 'saved'
            ? 'Your bookmarked demonstration roles with live compatibility scoring.'
            : 'Ranked by skill overlap, TF-IDF cosine similarity, experience suitability, and location.'}
        </p>
      </div>

      {/* Honest Demonstration Data Notice */}
      <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-700">
        <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <p>
          <strong>Demonstration Job Dataset:</strong> Listings shown here are curated demonstration
          records for academic evaluation, not live external openings.
        </p>
      </div>

      {/* Filter Bar (Recommended Mode) */}
      {mode === 'recommended' && (
        <form
          onSubmit={handleSearchSubmit}
          className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
        >
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, company, or skill..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            aria-label="Filter by location"
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="all">All Locations</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Hyderabad">Hyderabad</option>
            <option value="Pune">Pune</option>
            <option value="Chennai">Chennai</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Delhi NCR">Delhi NCR</option>
            <option value="Kochi">Kochi</option>
            <option value="Ahmedabad">Ahmedabad</option>
            <option value="Remote">Remote</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="all">All Roles</option>
            <option value="Python">Python Developer</option>
            <option value="Data Scientist">Data Scientist</option>
            <option value="Full Stack">Full Stack Developer</option>
            <option value="Frontend">Frontend Developer</option>
            <option value="Backend">Backend Developer</option>
            <option value="Machine Learning">ML / AI Engineer</option>
            <option value="Data Analyst">Data Analyst</option>
            <option value="DevOps">Cloud / DevOps</option>
            <option value="Java">Java Developer</option>
            <option value="Android">Android Developer</option>
          </select>

          <select
            value={minSalary}
            onChange={(e) => setMinSalary(e.target.value)}
            aria-label="Filter by minimum salary"
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="">Any Salary</option>
            <option value="500000">₹5+ LPA</option>
            <option value="800000">₹8+ LPA</option>
            <option value="1200000">₹12+ LPA</option>
            <option value="1600000">₹16+ LPA</option>
          </select>

          <div className="flex gap-2">
            <input
              type="text"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              placeholder="Skill (e.g. SQL)"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap cursor-pointer"
            >
              Filter
            </button>
          </div>
        </form>
      )}

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-sm text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
          Evaluating job matches...
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="font-semibold text-slate-800">
            {mode === 'saved' ? 'No saved jobs yet' : 'No matching demonstration jobs found'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'saved'
              ? 'Save jobs from the Recommended Jobs tab to compare them here.'
              : 'Try broadening your location, salary, or skill filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {jobs.map((match) => (
            <div
              key={match.job.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      Demonstration Listing · {match.job.employmentType}
                    </p>
                    <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                      {match.job.title}
                    </h2>
                    <p className="text-sm font-medium text-slate-700 mt-0.5">
                      {match.job.companyName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold font-mono tabular-nums text-blue-700">
                      {match.matchPercentage}% Match
                    </p>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      Skill {match.skillOverlapPct}% · NLP {match.cosineSimilarityPct}%
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {match.job.location}
                  </span>
                  <span className="font-mono tabular-nums">
                    Exp: {match.job.experienceMin}–{match.job.experienceMax} yrs ({match.experienceMatch})
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {formatLPA(match.job.salaryMin)} – {formatLPA(match.job.salaryMax)}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-600 line-clamp-2">{match.job.description}</p>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                  <p>
                    <span className="font-semibold text-emerald-700">Matched Skills: </span>
                    <span className="text-slate-700">
                      {match.matchedSkills.length > 0 ? match.matchedSkills.join(', ') : 'None yet'}
                    </span>
                  </p>
                  {match.missingSkills.length > 0 && (
                    <p>
                      <span className="font-semibold text-amber-700">Missing Skills: </span>
                      <span className="text-slate-600">{match.missingSkills.join(', ')}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleToggleSave(match.job.id)}
                  disabled={savingId === match.job.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    match.isSaved
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {match.isSaved ? 'Saved' : 'Save Job'}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedJob(match)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  View Job
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">
                  Demonstration Listing · {selectedJob.job.companyName}
                </p>
                <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                  {selectedJob.job.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                aria-label="Close job details"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <p className="text-slate-500">Compatibility</p>
                <p className="font-mono tabular-nums font-bold text-blue-700 text-base mt-0.5">
                  {selectedJob.matchPercentage}%
                </p>
              </div>
              <div>
                <p className="text-slate-500">Estimated CTC</p>
                <p className="font-mono tabular-nums font-bold text-slate-900 text-sm mt-0.5">
                  {formatINR(selectedJob.job.salaryMin)} – {formatINR(selectedJob.job.salaryMax)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Location &amp; Exp</p>
                <p className="font-medium text-slate-900 text-sm mt-0.5">
                  {selectedJob.job.location} · {selectedJob.job.experienceMin}–
                  {selectedJob.job.experienceMax}y
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Role Description</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{selectedJob.job.description}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Skill Comparison Breakdown
              </h3>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {selectedJob.job.requiredSkills.map((req) => {
                  const hasSkill = selectedJob.matchedSkills.includes(req.name);
                  return (
                    <div
                      key={req.name}
                      className="px-3.5 py-2 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-900">{req.name}</span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          hasSkill ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {hasSkill && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {hasSkill ? 'Matched' : 'Gap'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleToggleSave(selectedJob.job.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5" />
                {selectedJob.isSaved ? 'Remove Bookmark' : 'Save Job'}
              </button>

              <a
                href={selectedJob.job.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
              >
                Official Tech Reference
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
