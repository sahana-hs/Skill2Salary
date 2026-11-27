import fs from 'fs';
import path from 'path';

export interface SalaryTrainingRow {
  jobRole: string;
  city: string;
  educationLevel: string;
  experienceYears: number;
  employmentStatus: string;
  skills: string[];
  annualSalaryInr: number;
}

export interface ModelMetrics {
  modelName: string;
  mae: number;
  mse: number;
  rmse: number;
  r2: number;
  isBest: boolean;
}

export interface DatasetStats {
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
}

export interface RegressionTreeNode {
  isLeaf: boolean;
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: RegressionTreeNode;
  right?: RegressionTreeNode;
}

export interface TrainedModelArtifact {
  version: string;
  trainedAt: string;
  bestModelName: string;
  metrics: ModelMetrics[];
  datasetStats: DatasetStats;
  featureNames: string[];
  roles: string[];
  cities: string[];
  educationLevels: string[];
  employmentStatuses: string[];
  skillVocab: string[];
  skillIdf: Record<string, number>;
  expMean: number;
  expStd: number;
  skillCountMean: number;
  skillCountStd: number;
  residualStd: number;
  linearWeights: number[];
  rfTrees: RegressionTreeNode[];
  gbInitialPrediction: number;
  gbLearningRate: number;
  gbTrees: RegressionTreeNode[];
}

export interface SalaryPredictionInput {
  jobRole: string;
  city: string;
  educationLevel: string;
  experienceYears: number;
  employmentStatus: string;
  skills: string[];
}

export interface SalaryFactor {
  factor: string;
  impactInr: number;
  direction: 'positive' | 'neutral' | 'negative';
  detail: string;
}

export interface SalaryPredictionOutput {
  predictedSalary: number;
  minSalary: number;
  maxSalary: number;
  monthlySalary: number;
  modelUsed: string;
  modelR2: number;
  modelRmse: number;
  factors: SalaryFactor[];
  isDemoEstimate: boolean;
}

// Deterministic PRNG (Mulberry32) for reproducible train/test splits and forest sampling
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function modeString(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = '';
  let bestCount = -1;
  for (const [k, c] of counts.entries()) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best || 'Unknown';
}

function medianNumber(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function loadAndCleanDataset(csvPath: string): {
  rows: SalaryTrainingRow[];
  rawRows: number;
  duplicatesRemoved: number;
  missingValuesImputed: number;
} {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('Salary dataset CSV is empty or malformed.');
  }

  const rawRowsList: Array<Record<string, string>> = [];
  const headers = parseCsvLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length !== headers.length) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx];
    });
    rawRowsList.push(obj);
  }

  const rawRows = rawRowsList.length;

  // Step 1: Deduplicate identical records
  const seen = new Set<string>();
  const deduped: Array<Record<string, string>> = [];
  let duplicatesRemoved = 0;

  for (const r of rawRowsList) {
    const key = headers.map((h) => r[h]).join('|');
    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(key);
    deduped.push(r);
  }

  // Step 2: Compute imputation statistics for missing values
  const validCities = deduped.map((r) => r.city).filter(Boolean);
  const validEdus = deduped.map((r) => r.education_level).filter(Boolean);
  const validRoles = deduped.map((r) => r.job_role).filter(Boolean);
  const validStatuses = deduped.map((r) => r.employment_status).filter(Boolean);
  const validExps = deduped
    .map((r) => Number(r.experience_years))
    .filter((n) => !Number.isNaN(n) && rIsNumeric(n));

  const cityMode = modeString(validCities);
  const eduMode = modeString(validEdus);
  const roleMode = modeString(validRoles);
  const statusMode = modeString(validStatuses);
  const expMedian = medianNumber(validExps);

  let missingValuesImputed = 0;
  const cleaned: SalaryTrainingRow[] = [];

  for (const r of deduped) {
    const salaryNum = Number(r.annual_salary_inr);
    if (!r.annual_salary_inr || Number.isNaN(salaryNum) || salaryNum <= 0) {
      continue;
    }

    let jobRole = r.job_role;
    if (!jobRole) {
      jobRole = roleMode;
      missingValuesImputed++;
    }

    let city = r.city;
    if (!city) {
      city = cityMode;
      missingValuesImputed++;
    }

    let educationLevel = r.education_level;
    if (!educationLevel) {
      educationLevel = eduMode;
      missingValuesImputed++;
    }

    let employmentStatus = r.employment_status;
    if (!employmentStatus) {
      employmentStatus = statusMode;
      missingValuesImputed++;
    }

    let experienceYears = Number(r.experience_years);
    if (r.experience_years === '' || Number.isNaN(experienceYears)) {
      experienceYears = expMedian;
      missingValuesImputed++;
    }

    const skills = (r.skills || '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    cleaned.push({
      jobRole,
      city,
      educationLevel,
      experienceYears,
      employmentStatus,
      skills,
      annualSalaryInr: salaryNum,
    });
  }

  return { rows: cleaned, rawRows, duplicatesRemoved, missingValuesImputed };
}

function rIsNumeric(n: number): boolean {
  return Number.isFinite(n);
}

// Build feature vector for a row given fitted encoder state
function vectorizeRow(
  row: {
    jobRole: string;
    city: string;
    educationLevel: string;
    experienceYears: number;
    employmentStatus: string;
    skills: string[];
  },
  meta: {
    roles: string[];
    cities: string[];
    educationLevels: string[];
    employmentStatuses: string[];
    skillVocab: string[];
    skillIdf: Record<string, number>;
    expMean: number;
    expStd: number;
    skillCountMean: number;
    skillCountStd: number;
  }
): number[] {
  const vec: number[] = [];

  // Bias term for linear regression (tree models ignore constant feature harmlessly)
  vec.push(1.0);

  // Standardized experience and non-linear experience term
  const expScaled = (row.experienceYears - meta.expMean) / (meta.expStd || 1);
  vec.push(expScaled);
  vec.push(Math.sqrt(Math.max(0, row.experienceYears)));

  // Standardized skill count
  const skillCountScaled = (row.skills.length - meta.skillCountMean) / (meta.skillCountStd || 1);
  vec.push(skillCountScaled);

  // One-hot encodings
  for (const r of meta.roles) vec.push(row.jobRole === r ? 1 : 0);
  for (const c of meta.cities) vec.push(row.city === c ? 1 : 0);
  for (const e of meta.educationLevels) vec.push(row.educationLevel === e ? 1 : 0);
  for (const s of meta.employmentStatuses) vec.push(row.employmentStatus === s ? 1 : 0);

  // TF-IDF normalized skill features
  const normalizedSet = row.skills.map((sk) => sk.trim().toLowerCase());
  const tfCounts = new Map<string, number>();
  for (const sk of normalizedSet) {
    tfCounts.set(sk, (tfCounts.get(sk) || 0) + 1);
  }
  const len = Math.max(1, normalizedSet.length);
  const tfidfPart: number[] = [];
  let normSq = 0;
  for (const vocabSkill of meta.skillVocab) {
    const tf = (tfCounts.get(vocabSkill.toLowerCase()) || 0) / len;
    const idf = meta.skillIdf[vocabSkill] || 1;
    const val = tf * idf;
    tfidfPart.push(val);
    normSq += val * val;
  }
  const norm = Math.sqrt(normSq) || 1;
  for (const v of tfidfPart) {
    vec.push(v / norm);
  }

  return vec;
}

// Ridge-regularized Linear Regression solved via Gaussian Elimination
function trainLinearRegression(X: number[][], y: number[], ridgeLambda = 1.5): number[] {
  const n = X.length;
  const p = X[0].length;
  const A: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const b: number[] = new Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    const xi = X[i];
    const yi = y[i];
    for (let j = 0; j < p; j++) {
      const xij = xi[j];
      if (xij === 0) continue;
      b[j] += xij * yi;
      for (let k = j; k < p; k++) {
        A[j][k] += xij * xi[k];
      }
    }
  }

  for (let j = 0; j < p; j++) {
    for (let k = 0; k < j; k++) {
      A[j][k] = A[k][j];
    }
    if (j > 0) {
      A[j][j] += ridgeLambda;
    } else {
      A[j][j] += 1e-6;
    }
  }

  // Gaussian elimination with partial pivoting
  const aug = A.map((row, idx) => [...row, b[idx]]);
  for (let col = 0; col < p; col++) {
    let maxRow = col;
    for (let r = col + 1; r < p; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = r;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = Math.abs(aug[col][col]) < 1e-10 ? 1e-10 : aug[col][col];
    for (let j = col; j <= p; j++) {
      aug[col][j] /= pivot;
    }
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let j = col; j <= p; j++) {
        aug[r][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map((row) => row[p]);
}

function predictLinear(weights: number[], x: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i] * x[i];
  }
  return sum;
}

// CART Regression Tree Builder
function fitRegressionTree(
  X: number[][],
  y: number[],
  indices: number[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
  maxFeatures: number,
  rng: () => number
): RegressionTreeNode {
  const n = indices.length;
  let sum = 0;
  for (const idx of indices) sum += y[idx];
  const mean = sum / Math.max(1, n);

  if (depth >= maxDepth || n < minSamplesSplit) {
    return { isLeaf: true, value: mean };
  }

  const numFeatures = X[0].length;
  const candidateFeatures: number[] = [];
  for (let f = 1; f < numFeatures; f++) candidateFeatures.push(f);

  // Shuffle features if subsampling
  if (maxFeatures < candidateFeatures.length) {
    for (let i = candidateFeatures.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidateFeatures[i], candidateFeatures[j]] = [candidateFeatures[j], candidateFeatures[i]];
    }
  }
  const selectedFeatures = candidateFeatures.slice(0, maxFeatures);

  let totalSq = 0;
  for (const idx of indices) {
    const diff = y[idx] - mean;
    totalSq += diff * diff;
  }

  let bestGain = 1e-6;
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestLeft: number[] = [];
  let bestRight: number[] = [];

  for (const f of selectedFeatures) {
    const pairs = indices.map((idx) => ({ v: X[idx][f], y: y[idx], idx }));
    pairs.sort((a, b) => a.v - b.v);

    let leftSum = 0;
    let leftSq = 0;
    let rightSum = sum;
    let rightSq = 0;
    for (const p of pairs) rightSq += p.y * p.y;

    for (let i = 0; i < n - 1; i++) {
      const val = pairs[i].v;
      const yi = pairs[i].y;
      leftSum += yi;
      leftSq += yi * yi;
      rightSum -= yi;
      rightSq -= yi * yi;

      if (val === pairs[i + 1].v) continue;

      const leftCount = i + 1;
      const rightCount = n - leftCount;
      if (leftCount < 2 || rightCount < 2) continue;

      const leftErr = leftSq - (leftSum * leftSum) / leftCount;
      const rightErr = rightSq - (rightSum * rightSum) / rightCount;
      const gain = totalSq - (leftErr + rightErr);

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = f;
        bestThreshold = (val + pairs[i + 1].v) / 2;
      }
    }
  }

  if (bestFeature === -1) {
    return { isLeaf: true, value: mean };
  }

  for (const idx of indices) {
    if (X[idx][bestFeature] <= bestThreshold) bestLeft.push(idx);
    else bestRight.push(idx);
  }

  if (bestLeft.length === 0 || bestRight.length === 0) {
    return { isLeaf: true, value: mean };
  }

  return {
    isLeaf: false,
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: fitRegressionTree(X, y, bestLeft, depth + 1, maxDepth, minSamplesSplit, maxFeatures, rng),
    right: fitRegressionTree(X, y, bestRight, depth + 1, maxDepth, minSamplesSplit, maxFeatures, rng),
  };
}

function predictTree(node: RegressionTreeNode, x: number[]): number {
  let curr = node;
  while (!curr.isLeaf) {
    if (curr.featureIndex !== undefined && curr.threshold !== undefined) {
      curr = x[curr.featureIndex] <= curr.threshold ? curr.left! : curr.right!;
    } else {
      break;
    }
  }
  return curr.value ?? 0;
}

function trainRandomForest(X: number[][], y: number[], numTrees = 26, rng: () => number): RegressionTreeNode[] {
  const n = X.length;
  const p = X[0].length - 1;
  const maxFeatures = Math.max(4, Math.floor(p * 0.48));
  const trees: RegressionTreeNode[] = [];

  for (let t = 0; t < numTrees; t++) {
    const sampleIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      sampleIndices.push(Math.floor(rng() * n));
    }
    trees.push(fitRegressionTree(X, y, sampleIndices, 0, 7, 4, maxFeatures, rng));
  }
  return trees;
}

function predictRandomForest(trees: RegressionTreeNode[], x: number[]): number {
  let sum = 0;
  for (const tree of trees) sum += predictTree(tree, x);
  return sum / trees.length;
}

function trainGradientBoosting(
  X: number[][],
  y: number[],
  numEstimators = 45,
  learningRate = 0.14,
  rng: () => number
): { initialPrediction: number; learningRate: number; trees: RegressionTreeNode[] } {
  const n = X.length;
  const p = X[0].length - 1;
  const maxFeatures = Math.max(6, Math.floor(p * 0.75));
  const initialPrediction = y.reduce((a, b) => a + b, 0) / n;
  const predictions = new Array(n).fill(initialPrediction);
  const allIndices = Array.from({ length: n }, (_, i) => i);
  const trees: RegressionTreeNode[] = [];

  for (let m = 0; m < numEstimators; m++) {
    const residuals = y.map((yi, i) => yi - predictions[i]);
    const tree = fitRegressionTree(X, residuals, allIndices, 0, 4, 4, maxFeatures, rng);
    trees.push(tree);
    for (let i = 0; i < n; i++) {
      predictions[i] += learningRate * predictTree(tree, X[i]);
    }
  }

  return { initialPrediction, learningRate, trees };
}

function predictGradientBoosting(
  initialPrediction: number,
  learningRate: number,
  trees: RegressionTreeNode[],
  x: number[]
): number {
  let pred = initialPrediction;
  for (const tree of trees) {
    pred += learningRate * predictTree(tree, x);
  }
  return pred;
}

function evaluateRegression(yTrue: number[], yPred: number[]): { mae: number; mse: number; rmse: number; r2: number } {
  const n = yTrue.length;
  const meanY = yTrue.reduce((a, b) => a + b, 0) / n;
  let absErr = 0;
  let sqErr = 0;
  let totSq = 0;

  for (let i = 0; i < n; i++) {
    const err = yTrue[i] - yPred[i];
    absErr += Math.abs(err);
    sqErr += err * err;
    const diffMean = yTrue[i] - meanY;
    totSq += diffMean * diffMean;
  }

  const mae = Math.round(absErr / n);
  const mse = Math.round(sqErr / n);
  const rmse = Math.round(Math.sqrt(sqErr / n));
  const r2 = Number((1 - sqErr / Math.max(1, totSq)).toFixed(4));
  return { mae, mse, rmse, r2 };
}

let cachedArtifact: TrainedModelArtifact | null = null;

export function trainAndSaveSalaryModel(
  csvPath = path.resolve(process.cwd(), 'datasets/indian_tech_salaries.csv'),
  artifactPath = path.resolve(process.cwd(), 'datasets/trained_model.json')
): TrainedModelArtifact {
  const { rows, rawRows, duplicatesRemoved, missingValuesImputed } = loadAndCleanDataset(csvPath);
  const rng = createRng(42);

  // Deterministic shuffle before 80/20 split
  const shuffled = [...rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const splitIdx = Math.floor(shuffled.length * 0.8);
  const trainRows = shuffled.slice(0, splitIdx);
  const testRows = shuffled.slice(splitIdx);

  // Collect categorical vocabularies from full cleaned dataset
  const roles = Array.from(new Set(rows.map((r) => r.jobRole))).sort();
  const cities = Array.from(new Set(rows.map((r) => r.city))).sort();
  const educationLevels = Array.from(new Set(rows.map((r) => r.educationLevel))).sort();
  const employmentStatuses = Array.from(new Set(rows.map((r) => r.employmentStatus))).sort();

  const skillSet = new Set<string>();
  for (const r of rows) {
    for (const sk of r.skills) skillSet.add(sk);
  }
  const skillVocab = Array.from(skillSet).sort();

  // Compute IDF and numerical scaling strictly from training split (no data leakage)
  const docFreq = new Map<string, number>();
  for (const r of trainRows) {
    const uniqueInRow = new Set(r.skills.map((s) => s.toLowerCase()));
    for (const sk of uniqueInRow) {
      docFreq.set(sk, (docFreq.get(sk) || 0) + 1);
    }
  }
  const skillIdf: Record<string, number> = {};
  for (const sk of skillVocab) {
    const df = docFreq.get(sk.toLowerCase()) || 0;
    skillIdf[sk] = Math.log((trainRows.length + 1) / (df + 1)) + 1;
  }

  const trainExps = trainRows.map((r) => r.experienceYears);
  const expMean = trainExps.reduce((a, b) => a + b, 0) / trainExps.length;
  const expStd = Math.sqrt(trainExps.reduce((a, b) => a + (b - expMean) ** 2, 0) / trainExps.length) || 1;

  const trainSkillCounts = trainRows.map((r) => r.skills.length);
  const skillCountMean = trainSkillCounts.reduce((a, b) => a + b, 0) / trainSkillCounts.length;
  const skillCountStd =
    Math.sqrt(trainSkillCounts.reduce((a, b) => a + (b - skillCountMean) ** 2, 0) / trainSkillCounts.length) || 1;

  const meta = {
    roles,
    cities,
    educationLevels,
    employmentStatuses,
    skillVocab,
    skillIdf,
    expMean,
    expStd,
    skillCountMean,
    skillCountStd,
  };

  const featureNames = [
    'bias',
    'experience_scaled',
    'experience_sqrt',
    'skill_count_scaled',
    ...roles.map((r) => `role_${r}`),
    ...cities.map((c) => `city_${c}`),
    ...educationLevels.map((e) => `edu_${e}`),
    ...employmentStatuses.map((s) => `status_${s}`),
    ...skillVocab.map((sk) => `tfidf_${sk}`),
  ];

  const XTrain = trainRows.map((r) => vectorizeRow(r, meta));
  const yTrain = trainRows.map((r) => r.annualSalaryInr);
  const XTest = testRows.map((r) => vectorizeRow(r, meta));
  const yTest = testRows.map((r) => r.annualSalaryInr);

  // Train all 3 models
  const linearWeights = trainLinearRegression(XTrain, yTrain, 1.2);
  const linearPreds = XTest.map((x) => Math.max(250000, predictLinear(linearWeights, x)));
  const linearEval = evaluateRegression(yTest, linearPreds);

  const rfTrees = trainRandomForest(XTrain, yTrain, 28, rng);
  const rfPreds = XTest.map((x) => Math.max(250000, predictRandomForest(rfTrees, x)));
  const rfEval = evaluateRegression(yTest, rfPreds);

  const gb = trainGradientBoosting(XTrain, yTrain, 45, 0.14, rng);
  const gbPreds = XTest.map((x) => Math.max(250000, predictGradientBoosting(gb.initialPrediction, gb.learningRate, gb.trees, x)));
  const gbEval = evaluateRegression(yTest, gbPreds);

  const rawMetrics: ModelMetrics[] = [
    { modelName: 'Linear Regression', ...linearEval, isBest: false },
    { modelName: 'Random Forest Regressor', ...rfEval, isBest: false },
    { modelName: 'Gradient Boosting Regressor', ...gbEval, isBest: false },
  ];

  // Select best model by highest R2 (tie-breaker: lowest RMSE)
  let bestIdx = 0;
  for (let i = 1; i < rawMetrics.length; i++) {
    if (
      rawMetrics[i].r2 > rawMetrics[bestIdx].r2 ||
      (rawMetrics[i].r2 === rawMetrics[bestIdx].r2 && rawMetrics[i].rmse < rawMetrics[bestIdx].rmse)
    ) {
      bestIdx = i;
    }
  }
  rawMetrics[bestIdx].isBest = true;
  const bestModelName = rawMetrics[bestIdx].modelName;
  const residualStd = rawMetrics[bestIdx].rmse;

  const artifact: TrainedModelArtifact = {
    version: '1.0.0',
    trainedAt: new Date().toISOString(),
    bestModelName,
    metrics: rawMetrics,
    datasetStats: {
      datasetName: 'Indian Tech Salary Demonstration Dataset (indian_tech_salaries.csv)',
      isDemonstrationData: true,
      disclaimer:
        'This model is trained on a curated synthetic/demonstration dataset calibrated to typical Indian tech CTC ranges. Predictions are illustrative academic estimates, not guaranteed market offers.',
      rawRows,
      duplicatesRemoved,
      missingValuesImputed,
      cleanedRows: rows.length,
      trainRows: trainRows.length,
      testRows: testRows.length,
      featureCount: featureNames.length,
      roles,
      cities,
      educationLevels,
      employmentStatuses,
    },
    featureNames,
    roles,
    cities,
    educationLevels,
    employmentStatuses,
    skillVocab,
    skillIdf,
    expMean,
    expStd,
    skillCountMean,
    skillCountStd,
    residualStd,
    linearWeights,
    rfTrees,
    gbInitialPrediction: gb.initialPrediction,
    gbLearningRate: gb.learningRate,
    gbTrees: gb.trees,
  };

  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(artifact), 'utf-8');
  cachedArtifact = artifact;
  return artifact;
}

export function getTrainedModel(
  artifactPath = path.resolve(process.cwd(), 'datasets/trained_model.json'),
  csvPath = path.resolve(process.cwd(), 'datasets/indian_tech_salaries.csv')
): TrainedModelArtifact {
  if (cachedArtifact) return cachedArtifact;
  if (fs.existsSync(artifactPath)) {
    const parsed = JSON.parse(fs.readFileSync(artifactPath, 'utf-8')) as TrainedModelArtifact;
    cachedArtifact = parsed;
    return parsed;
  }
  return trainAndSaveSalaryModel(csvPath, artifactPath);
}

function predictWithBest(model: TrainedModelArtifact, input: SalaryPredictionInput): number {
  const vec = vectorizeRow(input, model);
  let raw = 0;
  if (model.bestModelName === 'Linear Regression') {
    raw = predictLinear(model.linearWeights, vec);
  } else if (model.bestModelName === 'Random Forest Regressor') {
    raw = predictRandomForest(model.rfTrees, vec);
  } else {
    raw = predictGradientBoosting(model.gbInitialPrediction, model.gbLearningRate, model.gbTrees, vec);
  }
  return Math.max(280000, Math.round(raw / 5000) * 5000);
}

export function predictSalaryWithFactors(input: SalaryPredictionInput): SalaryPredictionOutput {
  const model = getTrainedModel();
  const normalizedRole = model.roles.includes(input.jobRole) ? input.jobRole : 'Python Developer';
  const normalizedCity = model.cities.includes(input.city) ? input.city : 'Bengaluru';
  const normalizedEdu = model.educationLevels.includes(input.educationLevel) ? input.educationLevel : 'B.Tech / B.E.';
  const normalizedStatus = model.employmentStatuses.includes(input.employmentStatus)
    ? input.employmentStatus
    : 'Fresher / Job Seeker';

  const cleanInput: SalaryPredictionInput = {
    jobRole: normalizedRole,
    city: normalizedCity,
    educationLevel: normalizedEdu,
    experienceYears: Math.max(0, Math.min(25, Number(input.experienceYears) || 0)),
    employmentStatus: normalizedStatus,
    skills: input.skills.filter(Boolean),
  };

  const predictedSalary = predictWithBest(model, cleanInput);
  const spread = Math.max(75000, Math.round((Math.max(predictedSalary * 0.12, model.residualStd * 0.85)) / 5000) * 5000);
  const minSalary = Math.max(240000, predictedSalary - spread);
  const maxSalary = predictedSalary + spread;
  const monthlySalary = Math.round(predictedSalary / 12);

  // Compute genuine counterfactual sensitivity factors from the trained model
  const factors: SalaryFactor[] = [];

  // 1. Experience contribution vs 0 yrs baseline
  const zeroExpPred = predictWithBest(model, { ...cleanInput, experienceYears: 0 });
  const expImpact = predictedSalary - zeroExpPred;
  factors.push({
    factor: `Experience (${cleanInput.experienceYears} yrs)`,
    impactInr: expImpact,
    direction: expImpact > 15000 ? 'positive' : 'neutral',
    detail:
      cleanInput.experienceYears === 0
        ? 'Entry-level baseline (0 years experience).'
        : `Adds approx. ₹${expImpact.toLocaleString('en-IN')} over a 0-year fresher baseline in this role.`,
  });

  // 2. Location contribution vs tier-2 baseline (Kochi)
  const baselineCityPred = predictWithBest(model, { ...cleanInput, city: 'Kochi' });
  const cityImpact = predictedSalary - baselineCityPred;
  factors.push({
    factor: `Location (${cleanInput.city})`,
    impactInr: cityImpact,
    direction: cityImpact > 15000 ? 'positive' : cityImpact < -15000 ? 'negative' : 'neutral',
    detail:
      cityImpact >= 0
        ? `Metro tech hub premium of ₹${cityImpact.toLocaleString('en-IN')} compared to Tier-2 baseline.`
        : `Regional market adjustment of ₹${Math.abs(cityImpact).toLocaleString('en-IN')} vs Tier-2 baseline.`,
  });

  // 3. Technical skills contribution vs minimal 2-skill set
  const minimalSkillPred = predictWithBest(model, { ...cleanInput, skills: cleanInput.skills.slice(0, 1) });
  const skillImpact = predictedSalary - minimalSkillPred;
  factors.push({
    factor: `Skill Stack (${cleanInput.skills.length} skills)`,
    impactInr: skillImpact,
    direction: skillImpact > 15000 ? 'positive' : 'neutral',
    detail:
      cleanInput.skills.length <= 2
        ? 'Adding high-demand role skills (e.g., Docker, Cloud, Frameworks) lifts predicted CTC.'
        : `Your technical breadth contributes ₹${skillImpact.toLocaleString('en-IN')} above single-skill baseline.`,
  });

  // 4. Education qualification impact
  const bcaBaselinePred = predictWithBest(model, { ...cleanInput, educationLevel: 'BCA' });
  const eduImpact = predictedSalary - bcaBaselinePred;
  factors.push({
    factor: `Education (${cleanInput.educationLevel})`,
    impactInr: eduImpact,
    direction: eduImpact > 15000 ? 'positive' : eduImpact < -15000 ? 'negative' : 'neutral',
    detail: `Qualification effect relative to undergraduate baseline in ${cleanInput.jobRole}.`,
  });

  const bestMetric = model.metrics.find((m) => m.isBest) || model.metrics[0];

  return {
    predictedSalary,
    minSalary,
    maxSalary,
    monthlySalary,
    modelUsed: model.bestModelName,
    modelR2: bestMetric.r2,
    modelRmse: bestMetric.rmse,
    factors,
    isDemoEstimate: true,
  };
}
