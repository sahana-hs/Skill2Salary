export interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  createdAt?: string;
}

export interface CandidateProfile {
  location: string;
  state: string;
  city: string;
  educationLevel: string;
  degree: string;
  branch: string;
  graduationYear: number;
  experienceYears: number;
  employmentStatus: string;
  preferredRole: string;
  preferredLocation: string;
  expectedSalary: number;
  employmentType: string;
  updatedAt: string;
  skills: string[];
}

export interface SalaryFactor {
  factor: string;
  impactInr: number;
  direction: 'positive' | 'neutral' | 'negative';
  detail: string;
}

export interface SalaryPredictionResult {
  id?: number;
  modelUsed: string;
  predictedSalary: number;
  minSalary: number;
  maxSalary: number;
  monthlySalary: number;
  modelR2?: number;
  modelRmse?: number;
  factors: SalaryFactor[];
  isDemoEstimate?: boolean;
  input?: Record<string, unknown>;
  inputSnapshot?: Record<string, unknown>;
  createdAt?: string;
}

export interface SkillGapResult {
  id?: number;
  targetRole: string;
  compatibilityScore: number;
  matchedCount?: number;
  requiredCount?: number;
  matchedSkills: string[];
  missingSkills: string[];
  requiredSkillsDetail: Array<{
    name: string;
    matched: boolean;
    importance: number;
    frequencyPct: number;
  }>;
  createdAt?: string;
}

export interface SkillRecommendation {
  id?: number;
  targetRole?: string;
  skillName: string;
  priority: 'High' | 'Medium' | 'Recommended';
  reason: string;
  targetJobs: string[];
  demandScore: number;
  learningUrl: string;
  learningSource: string;
}

export interface JobRecord {
  id: string;
  title: string;
  companyName: string;
  location: string;
  state: string;
  experienceMin: number;
  experienceMax: number;
  salaryMin: number;
  salaryMax: number;
  employmentType: string;
  description: string;
  applicationUrl: string;
  isDemoListing: boolean;
  requiredSkills: Array<{
    name: string;
    importanceWeight: number;
    isCore: boolean;
    demandScore: number;
    learningUrl: string;
    learningSource: string;
  }>;
}

export interface JobMatch {
  job: JobRecord;
  matchPercentage: number;
  skillOverlapPct: number;
  cosineSimilarityPct: number;
  experienceMatch: 'Suitable' | 'Stretch Role' | 'Overqualified';
  locationMatch: boolean;
  roleMatch: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  isSaved: boolean;
  savedAt?: string;
}

export interface ModelMetricsResponse {
  bestModelName: string;
  trainedAt: string;
  metrics: Array<{
    modelName: string;
    mae: number;
    mse: number;
    rmse: number;
    r2: number;
    isBest: boolean;
  }>;
  datasetStats: {
    datasetName: string;
    isDemonstrationData: boolean;
    disclaimer: string;
    rawRows: number;
    duplicatesRemoved: number;
    missingValuesImputed: number;
    cleanedRows: number;
    trainRows: number;
    testRows: number;
    featureCount: number;
    roles: string[];
    cities: string[];
    educationLevels: string[];
    employmentStatuses: string[];
  };
}

export interface SkillCatalogItem {
  id: number;
  name: string;
  category: string;
  demandScore: number;
  learningUrl: string;
  learningSource: string;
}

export interface DashboardSummary {
  user: User;
  profile: CandidateProfile;
  latestPrediction: SalaryPredictionResult;
  skillGap: SkillGapResult;
  recommendations: SkillRecommendation[];
  topJobs: JobMatch[];
  matchingJobsCount: number;
  savedJobsCount: number;
  salaryProjection: Array<{
    label: string;
    experienceYears: number;
    predictedSalary: number;
    minSalary: number;
    maxSalary: number;
  }>;
  insights: string[];
}
