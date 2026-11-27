export interface JobRecordForMatching {
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

export interface SkillGapOutput {
  targetRole: string;
  compatibilityScore: number;
  matchedCount: number;
  requiredCount: number;
  matchedSkills: string[];
  missingSkills: string[];
  requiredSkillsDetail: Array<{
    name: string;
    matched: boolean;
    importance: number;
    frequencyPct: number;
  }>;
}

export interface SkillRecommendationItem {
  skillName: string;
  priority: 'High' | 'Medium' | 'Recommended';
  reason: string;
  targetJobs: string[];
  demandScore: number;
  learningUrl: string;
  learningSource: string;
}

export interface JobMatchOutput {
  job: JobRecordForMatching;
  matchPercentage: number;
  skillOverlapPct: number;
  cosineSimilarityPct: number;
  experienceMatch: 'Suitable' | 'Stretch Role' | 'Overqualified';
  locationMatch: boolean;
  roleMatch: boolean;
  matchedSkills: string[];
  missingSkills: string[];
}

const SKILL_ALIASES: Record<string, string> = {
  py: 'python',
  python3: 'python',
  js: 'javascript',
  ts: 'typescript',
  reactjs: 'react',
  'react.js': 'react',
  nextjs: 'next.js',
  nodejs: 'node.js',
  node: 'node.js',
  expressjs: 'express.js',
  postgres: 'postgresql',
  ml: 'machine learning',
  dl: 'deep learning',
  'rest apis': 'rest api',
  restful: 'rest api',
  tailwind: 'tailwind css',
  k8s: 'kubernetes',
  cicd: 'ci/cd',
  'ci cd': 'ci/cd',
  cpp: 'c++',
  android: 'android sdk',
  powerbi: 'power bi',
  sklearn: 'scikit-learn',
};

export function normalizeSkillName(skill: string): string {
  const cleaned = skill.trim().toLowerCase();
  return SKILL_ALIASES[cleaned] || cleaned;
}

export function buildTokenTfIdfSimilarity(
  candidateTokens: string[],
  targetTokens: string[],
  corpusDocs: string[][]
): number {
  const candSet = candidateTokens.map(normalizeSkillName);
  const targetSet = targetTokens.map(normalizeSkillName);

  const vocab = Array.from(new Set([...candSet, ...targetSet]));
  if (vocab.length === 0) return 0;

  const N = Math.max(1, corpusDocs.length);
  const idf = new Map<string, number>();
  for (const term of vocab) {
    let df = 0;
    for (const doc of corpusDocs) {
      if (doc.includes(term)) df++;
    }
    idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const term of vocab) {
    const tfA = candSet.filter((t) => t === term).length / Math.max(1, candSet.length);
    const tfB = targetSet.filter((t) => t === term).length / Math.max(1, targetSet.length);
    const w = idf.get(term) || 1;
    const valA = tfA * w;
    const valB = tfB * w;
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function analyzeSkillGap(
  userSkills: string[],
  targetRole: string,
  allJobs: JobRecordForMatching[]
): SkillGapOutput {
  const normalizedUserMap = new Map<string, string>();
  for (const sk of userSkills) {
    normalizedUserMap.set(normalizeSkillName(sk), sk.trim());
  }

  // Match jobs whose title aligns with targetRole; fallback to closest keyword match
  const roleLower = targetRole.trim().toLowerCase();
  let matchingRoleJobs = allJobs.filter((j) => j.title.toLowerCase() === roleLower);
  if (matchingRoleJobs.length === 0) {
    const keywords = roleLower.split(/\s+/).filter((w) => w.length > 2);
    matchingRoleJobs = allJobs.filter((j) =>
      keywords.some((kw) => j.title.toLowerCase().includes(kw))
    );
  }
  if (matchingRoleJobs.length === 0) {
    matchingRoleJobs = allJobs.slice(0, 3);
  }

  // Aggregate required skills across matching role jobs
  const skillStats = new Map<
    string,
    { displayName: string; count: number; totalWeight: number }
  >();

  for (const job of matchingRoleJobs) {
    for (const req of job.requiredSkills) {
      const norm = normalizeSkillName(req.name);
      const existing = skillStats.get(norm);
      if (existing) {
        existing.count += 1;
        existing.totalWeight += req.importanceWeight;
      } else {
        skillStats.set(norm, {
          displayName: req.name,
          count: 1,
          totalWeight: req.importanceWeight,
        });
      }
    }
  }

  const requiredList = Array.from(skillStats.entries())
    .map(([norm, info]) => ({
      norm,
      name: info.displayName,
      frequencyPct: Math.round((info.count / matchingRoleJobs.length) * 100),
      importance: Number((info.totalWeight / info.count).toFixed(2)),
    }))
    .sort((a, b) => b.frequencyPct - a.frequencyPct || b.importance - a.importance)
    .slice(0, 8);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const requiredSkillsDetail: SkillGapOutput['requiredSkillsDetail'] = [];

  for (const req of requiredList) {
    const matched = normalizedUserMap.has(req.norm);
    if (matched) matchedSkills.push(req.name);
    else missingSkills.push(req.name);

    requiredSkillsDetail.push({
      name: req.name,
      matched,
      importance: req.importance,
      frequencyPct: req.frequencyPct,
    });
  }

  const requiredCount = requiredList.length;
  const matchedCount = matchedSkills.length;
  const compatibilityScore =
    requiredCount === 0 ? 0 : Math.round((matchedCount / requiredCount) * 100);

  return {
    targetRole,
    compatibilityScore,
    matchedCount,
    requiredCount,
    matchedSkills,
    missingSkills,
    requiredSkillsDetail,
  };
}

export function generateSkillRecommendations(
  userSkills: string[],
  targetRole: string,
  allJobs: JobRecordForMatching[],
  skillCatalog: Array<{
    name: string;
    category: string;
    demand: number;
    url: string;
    source: string;
  }>
): SkillRecommendationItem[] {
  const userNormSet = new Set(userSkills.map(normalizeSkillName));
  const roleLower = targetRole.trim().toLowerCase();

  const roleJobs = allJobs.filter(
    (j) =>
      j.title.toLowerCase() === roleLower ||
      roleLower
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .some((kw) => j.title.toLowerCase().includes(kw))
  );

  const relevantJobs = roleJobs.length > 0 ? roleJobs : allJobs;

  // Count how many target-role jobs and overall jobs demand each missing skill
  const missingAgg = new Map<
    string,
    {
      displayName: string;
      roleJobCount: number;
      targetJobTitles: Set<string>;
      demandScore: number;
      learningUrl: string;
      learningSource: string;
      importanceSum: number;
    }
  >();

  for (const job of relevantJobs) {
    for (const req of job.requiredSkills) {
      const norm = normalizeSkillName(req.name);
      if (userNormSet.has(norm)) continue;

      const existing = missingAgg.get(norm);
      if (existing) {
        existing.roleJobCount += 1;
        existing.targetJobTitles.add(`${job.title} (${job.location})`);
        existing.importanceSum += req.importanceWeight;
      } else {
        missingAgg.set(norm, {
          displayName: req.name,
          roleJobCount: 1,
          targetJobTitles: new Set([`${job.title} (${job.location})`]),
          demandScore: req.demandScore,
          learningUrl: req.learningUrl,
          learningSource: req.learningSource,
          importanceSum: req.importanceWeight,
        });
      }
    }
  }

  // Also include high-demand complementary skills from catalog if fewer than 6 missing skills
  if (missingAgg.size < 6) {
    for (const cat of skillCatalog) {
      const norm = normalizeSkillName(cat.name);
      if (userNormSet.has(norm) || missingAgg.has(norm)) continue;
      if (cat.demand >= 82) {
        missingAgg.set(norm, {
          displayName: cat.name,
          roleJobCount: 0,
          targetJobTitles: new Set(['Cross-role Industry Standard']),
          demandScore: cat.demand,
          learningUrl: cat.url,
          learningSource: cat.source,
          importanceSum: 0.65,
        });
      }
      if (missingAgg.size >= 8) break;
    }
  }

  const ranked = Array.from(missingAgg.values()).sort((a, b) => {
    const scoreA = a.roleJobCount * 25 + a.demandScore * 0.7 + a.importanceSum * 10;
    const scoreB = b.roleJobCount * 25 + b.demandScore * 0.7 + b.importanceSum * 10;
    return scoreB - scoreA;
  });

  return ranked.slice(0, 7).map((item, idx) => {
    const priority: 'High' | 'Medium' | 'Recommended' =
      item.roleJobCount >= 2 || idx < 2
        ? 'High'
        : item.roleJobCount === 1 || idx < 4
        ? 'Medium'
        : 'Recommended';

    const reason =
      item.roleJobCount > 0
        ? `Required across ${item.roleJobCount} ${targetRole} demonstration opening${
            item.roleJobCount > 1 ? 's' : ''
          } and carries a ${item.demandScore}/100 market demand index.`
        : `High-value engineering capability (${item.demandScore}/100 demand score) that strengthens cross-role employability.`;

    return {
      skillName: item.displayName,
      priority,
      reason,
      targetJobs: Array.from(item.targetJobTitles).slice(0, 3),
      demandScore: item.demandScore,
      learningUrl: item.learningUrl,
      learningSource: item.learningSource,
    };
  });
}

export function recommendJobs(
  candidate: {
    skills: string[];
    experienceYears: number;
    preferredRole: string;
    preferredLocation: string;
  },
  allJobs: JobRecordForMatching[]
): JobMatchOutput[] {
  const userNormSet = new Set(candidate.skills.map(normalizeSkillName));
  const corpusDocs = allJobs.map((j) => [
    ...j.requiredSkills.map((s) => normalizeSkillName(s.name)),
    ...j.title.toLowerCase().split(/\s+/),
  ]);

  const candDoc = [
    ...candidate.skills.map(normalizeSkillName),
    ...candidate.preferredRole.toLowerCase().split(/\s+/),
  ];

  const results: JobMatchOutput[] = allJobs.map((job) => {
    const reqSkills = job.requiredSkills;
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    let totalWeight = 0;
    let matchedWeight = 0;

    for (const req of reqSkills) {
      totalWeight += req.importanceWeight;
      if (userNormSet.has(normalizeSkillName(req.name))) {
        matchedSkills.push(req.name);
        matchedWeight += req.importanceWeight;
      } else {
        missingSkills.push(req.name);
      }
    }

    const skillOverlapPct =
      totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

    const jobDoc = [
      ...reqSkills.map((s) => normalizeSkillName(s.name)),
      ...job.title.toLowerCase().split(/\s+/),
    ];
    const cosineSim = buildTokenTfIdfSimilarity(candDoc, jobDoc, corpusDocs);
    const cosineSimilarityPct = Math.round(cosineSim * 100);

    // Experience compatibility
    let expScore = 100;
    let experienceMatch: 'Suitable' | 'Stretch Role' | 'Overqualified' = 'Suitable';
    if (candidate.experienceYears < job.experienceMin) {
      const gap = job.experienceMin - candidate.experienceYears;
      expScore = Math.max(30, 100 - gap * 28);
      experienceMatch = 'Stretch Role';
    } else if (candidate.experienceYears > job.experienceMax + 1) {
      const over = candidate.experienceYears - job.experienceMax;
      expScore = Math.max(55, 100 - over * 15);
      experienceMatch = 'Overqualified';
    }

    // Role preference alignment
    const prefRoleLower = candidate.preferredRole.trim().toLowerCase();
    const jobTitleLower = job.title.toLowerCase();
    const roleMatch =
      prefRoleLower.length > 0 &&
      (jobTitleLower === prefRoleLower ||
        prefRoleLower
          .split(/\s+/)
          .filter((w) => w.length > 2)
          .some((kw) => jobTitleLower.includes(kw)));
    const roleScore = jobTitleLower === prefRoleLower ? 100 : roleMatch ? 75 : 25;

    // Location preference alignment
    const prefLocLower = candidate.preferredLocation.trim().toLowerCase();
    const jobLocLower = job.location.toLowerCase();
    const locationMatch =
      !prefLocLower ||
      prefLocLower === 'any' ||
      jobLocLower.includes(prefLocLower) ||
      jobLocLower.includes('remote');
    const locationScore = locationMatch ? 100 : 40;

    // Weighted overall compatibility score
    const overall = Math.round(
      skillOverlapPct * 0.55 +
        cosineSimilarityPct * 0.15 +
        expScore * 0.15 +
        roleScore * 0.10 +
        locationScore * 0.05
    );

    return {
      job,
      matchPercentage: Math.min(99, Math.max(12, overall)),
      skillOverlapPct,
      cosineSimilarityPct,
      experienceMatch,
      locationMatch,
      roleMatch,
      matchedSkills,
      missingSkills,
    };
  });

  return results.sort((a, b) => b.matchPercentage - a.matchPercentage);
}
