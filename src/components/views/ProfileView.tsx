import React, { useMemo, useState } from 'react';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import { api } from '../../services/api';
import { CandidateProfile, SkillCatalogItem, User } from '../../types';

interface ProfileViewProps {
  user: User;
  profile: CandidateProfile;
  skillsCatalog: SkillCatalogItem[];
  onProfileSaved: () => Promise<void>;
}

const INDIAN_STATES = [
  'Karnataka',
  'Telangana',
  'Maharashtra',
  'Tamil Nadu',
  'Delhi',
  'Kerala',
  'Gujarat',
  'West Bengal',
  'Uttar Pradesh',
  'Rajasthan',
];

const CITIES = [
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Mumbai',
  'Delhi NCR',
  'Kochi',
  'Ahmedabad',
];

const ROLES = [
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

const EDUCATION_LEVELS = [
  'B.Tech / B.E.',
  'M.Tech / M.E.',
  'MCA',
  'M.Sc',
  'BCA',
  'B.Sc',
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  profile,
  skillsCatalog,
  onProfileSaved,
}) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [state, setState] = useState(profile.state);
  const [city, setCity] = useState(profile.city);
  const [educationLevel, setEducationLevel] = useState(profile.educationLevel);
  const [degree, setDegree] = useState(profile.degree);
  const [branch, setBranch] = useState(profile.branch);
  const [graduationYear, setGraduationYear] = useState(profile.graduationYear);
  const [experienceYears, setExperienceYears] = useState(profile.experienceYears);
  const [employmentStatus, setEmploymentStatus] = useState(profile.employmentStatus);
  const [preferredRole, setPreferredRole] = useState(profile.preferredRole);
  const [preferredLocation, setPreferredLocation] = useState(profile.preferredLocation);
  const [expectedSalary, setExpectedSalary] = useState(profile.expectedSalary);
  const [employmentType, setEmploymentType] = useState(profile.employmentType);
  const [skills, setSkills] = useState<string[]>(profile.skills);

  const [skillQuery, setSkillQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredSuggestions = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    const existingLower = new Set(skills.map((s) => s.toLowerCase()));
    return skillsCatalog
      .filter((item) => !existingLower.has(item.name.toLowerCase()))
      .filter((item) => !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
      .slice(0, 12);
  }, [skillQuery, skills, skillsCatalog]);

  const addSkill = (skillName: string) => {
    const trimmed = skillName.trim();
    if (!trimmed) return;
    if (skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
    setSkills((prev) => [...prev, trimmed]);
    setSkillQuery('');
  };

  const removeSkill = (skillName: string) => {
    setSkills((prev) => prev.filter((s) => s !== skillName));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (skills.length === 0) {
      setError('Please add at least one technical or professional skill.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateProfile({
        fullName: fullName.trim(),
        state,
        city,
        location: `${city}, ${state}`,
        educationLevel,
        degree,
        branch,
        graduationYear: Number(graduationYear),
        experienceYears: Number(experienceYears),
        employmentStatus,
        skills,
        preferredRole,
        preferredLocation,
        expectedSalary: Number(expectedSalary),
        employmentType,
      });
      await onProfileSaved();
      setSuccess(res.message || 'Profile saved and AI recommendations updated.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Candidate Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            Saving your profile automatically recalculates your ML salary estimate, skill gaps, and
            job compatibility rankings.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save &amp; Run AI Analysis
        </button>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {/* Personal Information */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Personal Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Email Address</label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 text-slate-500 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">State</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Professional & Academic Information */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Academic &amp; Professional Background
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Education Qualification
            </label>
            <select
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {EDUCATION_LEVELS.map((ed) => (
                <option key={ed} value={ed}>
                  {ed}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Degree</label>
            <input
              type="text"
              required
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              placeholder="e.g., Bachelor of Technology"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Branch / Specialization
            </label>
            <input
              type="text"
              required
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="e.g., Computer Science"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Graduation Year
            </label>
            <input
              type="number"
              min={1990}
              max={2035}
              required
              value={graduationYear}
              onChange={(e) => setGraduationYear(Number(e.target.value))}
              className="w-full px-3.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Experience (Years)
            </label>
            <input
              type="number"
              min={0}
              max={35}
              step={0.5}
              required
              value={experienceYears}
              onChange={(e) => setExperienceYears(Number(e.target.value))}
              className="w-full px-3.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Current Employment Status
            </label>
            <select
              value={employmentStatus}
              onChange={(e) => setEmploymentStatus(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="Student / Final Year">Student / Final Year</option>
              <option value="Fresher / Job Seeker">Fresher / Job Seeker</option>
              <option value="Employed">Employed</option>
              <option value="Freelancer">Freelancer</option>
            </select>
          </div>
        </div>
      </section>

      {/* Searchable Technical Skills Picker */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Technical &amp; Professional Skills
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Search and click skills to add them, or type a custom skill and press Add.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600">
            {skills.length} selected
          </span>
        </div>

        {/* Selected Skills */}
        <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-slate-50 border border-slate-200 rounded-lg">
          {skills.length === 0 ? (
            <span className="text-xs text-slate-500">No skills selected yet.</span>
          ) : (
            skills.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => removeSkill(skill)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors cursor-pointer"
                title={`Remove ${skill}`}
              >
                {skill}
                <X className="w-3.5 h-3.5" />
              </button>
            ))
          )}
        </div>

        {/* Search & Custom Add */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={skillQuery}
              onChange={(e) => setSkillQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill(skillQuery);
                }
              }}
              placeholder="Search skills (e.g., Python, React, SQL, Docker, AWS)..."
              className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="button"
            onClick={() => addSkill(skillQuery)}
            disabled={!skillQuery.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Skill
          </button>
        </div>

        {/* Quick Select Catalog */}
        <div className="flex flex-wrap gap-2">
          {filteredSuggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => addSkill(item.name)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              {item.name}
            </button>
          ))}
        </div>
      </section>

      {/* Career Preferences */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h2 className="font-display text-base font-semibold text-slate-900">Career Preferences</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Preferred Job Role
            </label>
            <select
              value={preferredRole}
              onChange={(e) => setPreferredRole(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Preferred Location
            </label>
            <select
              value={preferredLocation}
              onChange={(e) => setPreferredLocation(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="Any">Any Location / Remote</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Expected Annual Salary (₹ INR)
            </label>
            <input
              type="number"
              min={150000}
              max={10000000}
              step={25000}
              required
              value={expectedSalary}
              onChange={(e) => setExpectedSalary(Number(e.target.value))}
              className="w-full px-3.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Employment Type
            </label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="Full-Time">Full-Time</option>
              <option value="Internship">Internship</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
        </div>
      </section>
    </form>
  );
};
