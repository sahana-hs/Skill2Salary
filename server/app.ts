import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { z } from 'zod';
import {
  getAllJobsWithSkills,
  getUserSkillsList,
  loadSkillsCatalog,
  syncUserSkills,
} from './db';
import { getTrainedModel, predictSalaryWithFactors } from './ml/salaryPipeline';
import {
  analyzeSkillGap,
  generateSkillRecommendations,
  normalizeSkillName,
  recommendJobs,
} from './ml/recommender';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    fullName: string;
    email: string;
    role: string;
  };
  tokenHash?: string;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeHttpUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // ignore invalid URL
  }
  return 'https://developer.mozilla.org/';
}

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(80),
    email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128),
    confirmPassword: z.string().min(6, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
});

const resetPasswordSchema = z
  .object({
    email: z.string().trim().email().toLowerCase(),
    resetCode: z.string().trim().min(6, 'Reset code must be 6 characters'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').max(128),
    confirmPassword: z.string().min(6),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  location: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(60),
  educationLevel: z.string().trim().min(2).max(60),
  degree: z.string().trim().min(1).max(80),
  branch: z.string().trim().min(1).max(100),
  graduationYear: z.coerce.number().int().min(1990).max(2035),
  experienceYears: z.coerce.number().min(0).max(40),
  employmentStatus: z.string().trim().min(2).max(60),
  skills: z.array(z.string().trim().min(1).max(50)).max(40),
  preferredRole: z.string().trim().min(2).max(80),
  preferredLocation: z.string().trim().min(2).max(80),
  expectedSalary: z.coerce.number().int().min(100000).max(20000000),
  employmentType: z.string().trim().min(2).max(50),
});

const salaryPredictSchema = z.object({
  jobRole: z.string().trim().min(2).max(80).optional(),
  city: z.string().trim().min(2).max(60).optional(),
  educationLevel: z.string().trim().min(2).max(60).optional(),
  experienceYears: z.coerce.number().min(0).max(40).optional(),
  employmentStatus: z.string().trim().min(2).max(60).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
});

const skillRoleSchema = z.object({
  targetRole: z.string().trim().min(2).max(80).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
});

export function createApp(db: Database.Database): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Ensure ML model is trained & cached at app initialization
  getTrainedModel();

  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const rawToken = authHeader.slice(7).trim();
    if (!rawToken) {
      res.status(401).json({ error: 'Invalid session token.' });
      return;
    }

    const tokenHash = hashToken(rawToken);
    const session = db
      .prepare(
        `SELECT s.user_id, s.expires_at, u.full_name, u.email, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash) as
      | {
          user_id: number;
          expires_at: string;
          full_name: string;
          email: string;
          role: string;
        }
      | undefined;

    if (!session) {
      res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
      return;
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }

    req.user = {
      id: session.user_id,
      fullName: session.full_name,
      email: session.email,
      role: session.role,
    };
    req.tokenHash = tokenHash;
    next();
  };

  function getUserProfileBundle(userId: number) {
    const userRow = db
      .prepare('SELECT id, full_name, email, role, created_at FROM users WHERE id = ?')
      .get(userId) as
      | { id: number; full_name: string; email: string; role: string; created_at: string }
      | undefined;

    if (!userRow) return null;

    const profileRow = db
      .prepare('SELECT * FROM candidate_profiles WHERE user_id = ?')
      .get(userId) as
      | {
          id: number;
          user_id: number;
          location: string;
          state: string;
          city: string;
          education_level: string;
          degree: string;
          branch: string;
          graduation_year: number;
          experience_years: number;
          employment_status: string;
          preferred_role: string;
          preferred_location: string;
          expected_salary: number;
          employment_type: string;
          updated_at: string;
        }
      | undefined;

    const skills = getUserSkillsList(db, userId);

    return {
      user: {
        id: userRow.id,
        fullName: userRow.full_name,
        email: userRow.email,
        role: userRow.role,
        createdAt: userRow.created_at,
      },
      profile: profileRow
        ? {
            location: profileRow.location,
            state: profileRow.state,
            city: profileRow.city,
            educationLevel: profileRow.education_level,
            degree: profileRow.degree,
            branch: profileRow.branch,
            graduationYear: profileRow.graduation_year,
            experienceYears: profileRow.experience_years,
            employmentStatus: profileRow.employment_status,
            preferredRole: profileRow.preferred_role,
            preferredLocation: profileRow.preferred_location,
            expectedSalary: profileRow.expected_salary,
            employmentType: profileRow.employment_type,
            updatedAt: profileRow.updated_at,
            skills,
          }
        : {
            location: 'Bengaluru, Karnataka',
            state: 'Karnataka',
            city: 'Bengaluru',
            educationLevel: 'B.Tech / B.E.',
            degree: 'B.Tech',
            branch: 'Computer Science & Engineering',
            graduationYear: 2025,
            experienceYears: 0,
            employmentStatus: 'Student / Final Year',
            preferredRole: 'Python Developer',
            preferredLocation: 'Bengaluru',
            expectedSalary: 600000,
            employmentType: 'Full-Time',
            updatedAt: new Date().toISOString(),
            skills,
          },
    };
  }

  // ==================== SYSTEM & MODEL ENDPOINTS ====================

  app.get('/api/health', (_req, res) => {
    try {
      const jobCount = (db.prepare('SELECT COUNT(*) as c FROM jobs').get() as { c: number }).c;
      const skillCount = (db.prepare('SELECT COUNT(*) as c FROM skills').get() as { c: number }).c;
      const model = getTrainedModel();
      res.json({
        status: 'ok',
        database: 'sqlite-connected',
        jobsSeeded: jobCount,
        skillsCatalog: skillCount,
        mlModel: model.bestModelName,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ status: 'error', message: (err as Error).message });
    }
  });

  app.get('/api/model/metrics', (_req, res) => {
    const model = getTrainedModel();
    res.json({
      bestModelName: model.bestModelName,
      trainedAt: model.trainedAt,
      metrics: model.metrics,
      datasetStats: model.datasetStats,
    });
  });

  app.get('/api/skills/catalog', (_req, res) => {
    const rows = db
      .prepare('SELECT id, name, category, market_demand_score, learning_url, learning_source_label FROM skills ORDER BY market_demand_score DESC, name ASC')
      .all() as Array<{
      id: number;
      name: string;
      category: string;
      market_demand_score: number;
      learning_url: string;
      learning_source_label: string;
    }>;

    res.json({
      skills: rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        demandScore: r.market_demand_score,
        learningUrl: safeHttpUrl(r.learning_url),
        learningSource: r.learning_source_label,
      })),
    });
  });

  // ==================== AUTH ENDPOINTS ====================

  app.post('/api/auth/register', (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid registration data',
        details: parsed.error.issues,
      });
      return;
    }

    const { fullName, email, password } = parsed.data;
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const userRes = db
      .prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)')
      .run(fullName, email, passwordHash);
    const userId = Number(userRes.lastInsertRowid);

    // Create default starter profile so dashboard works immediately
    db.prepare(
      `INSERT INTO candidate_profiles (
        user_id, location, state, city, education_level, degree, branch,
        graduation_year, experience_years, employment_status, preferred_role,
        preferred_location, expected_salary, employment_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      'Bengaluru, Karnataka',
      'Karnataka',
      'Bengaluru',
      'B.Tech / B.E.',
      'B.Tech',
      'Computer Science & Engineering',
      2025,
      0,
      'Student / Final Year',
      'Python Developer',
      'Bengaluru',
      600000,
      'Full-Time'
    );

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
      userId,
      tokenHash,
      expiresAt
    );

    const bundle = getUserProfileBundle(userId);
    res.status(201).json({
      token,
      expiresAt,
      ...bundle,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials' });
      return;
    }

    const { email, password } = parsed.data;
    const user = db
      .prepare('SELECT id, full_name, email, password_hash, role FROM users WHERE email = ?')
      .get(email) as
      | { id: number; full_name: string; email: string; password_hash: string; role: string }
      | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
      user.id,
      tokenHash,
      expiresAt
    );

    const bundle = getUserProfileBundle(user.id);
    res.json({
      token,
      expiresAt,
      ...bundle,
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.tokenHash) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.tokenHash);
    }
    res.json({ message: 'Logged out successfully.' });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const bundle = getUserProfileBundle(req.user!.id);
    if (!bundle) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json(bundle);
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Valid email required' });
      return;
    }

    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(parsed.data.email) as
      | { id: number; email: string }
      | undefined;

    if (!user) {
      // Return generic confirmation without revealing account existence unless demo check
      res.json({
        message: 'If an account matches this email, a demonstration verification code has been generated.',
      });
      return;
    }

    const resetCode = String(Math.floor(100000 + crypto.randomInt(0, 899999)));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO password_resets (user_id, reset_code, expires_at) VALUES (?, ?, ?)').run(
      user.id,
      resetCode,
      expiresAt
    );

    res.json({
      message: 'Demonstration reset code generated (no external email server configured in academic mode).',
      demoResetCode: resetCode,
      expiresAt,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid reset request' });
      return;
    }

    const { email, resetCode, newPassword } = parsed.data;
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
    if (!user) {
      res.status(400).json({ error: 'Invalid email or reset code.' });
      return;
    }

    const row = db
      .prepare(
        `SELECT id, expires_at FROM password_resets
         WHERE user_id = ? AND reset_code = ? AND used = 0
         ORDER BY id DESC LIMIT 1`
      )
      .get(user.id, resetCode) as { id: number; expires_at: string } | undefined;

    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Reset code is invalid or expired.' });
      return;
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

    res.json({ message: 'Password updated successfully. Please sign in with your new password.' });
  });

  // ==================== PROFILE ENDPOINTS ====================

  app.get('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const bundle = getUserProfileBundle(req.user!.id);
    if (!bundle) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    res.json(bundle);
  });

  const upsertProfileHandler = (req: AuthenticatedRequest, res: Response): void => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Validation failed for profile fields',
        details: parsed.error.issues,
      });
      return;
    }

    const data = parsed.data;
    const userId = req.user!.id;
    const locationStr = data.location || `${data.city}, ${data.state}`;

    if (data.fullName) {
      db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(data.fullName, userId);
    }

    db.prepare(
      `INSERT INTO candidate_profiles (
        user_id, location, state, city, education_level, degree, branch,
        graduation_year, experience_years, employment_status, preferred_role,
        preferred_location, expected_salary, employment_type, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        location = excluded.location,
        state = excluded.state,
        city = excluded.city,
        education_level = excluded.education_level,
        degree = excluded.degree,
        branch = excluded.branch,
        graduation_year = excluded.graduation_year,
        experience_years = excluded.experience_years,
        employment_status = excluded.employment_status,
        preferred_role = excluded.preferred_role,
        preferred_location = excluded.preferred_location,
        expected_salary = excluded.expected_salary,
        employment_type = excluded.employment_type,
        updated_at = datetime('now')`
    ).run(
      userId,
      locationStr,
      data.state,
      data.city,
      data.educationLevel,
      data.degree,
      data.branch,
      data.graduationYear,
      data.experienceYears,
      data.employmentStatus,
      data.preferredRole,
      data.preferredLocation,
      data.expectedSalary,
      data.employmentType
    );

    syncUserSkills(db, userId, data.skills);

    // Automatically refresh analysis records on profile update so dashboard stays synced
    const allJobs = getAllJobsWithSkills(db);
    const catalog = loadSkillsCatalog();
    const prediction = predictSalaryWithFactors({
      jobRole: data.preferredRole,
      city: data.city,
      educationLevel: data.educationLevel,
      experienceYears: data.experienceYears,
      employmentStatus: data.employmentStatus,
      skills: data.skills,
    });

    db.prepare(
      `INSERT INTO salary_predictions (
        user_id, model_used, predicted_salary, min_salary, max_salary,
        monthly_salary, input_snapshot_json, factors_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      prediction.modelUsed,
      prediction.predictedSalary,
      prediction.minSalary,
      prediction.maxSalary,
      prediction.monthlySalary,
      JSON.stringify({
        jobRole: data.preferredRole,
        city: data.city,
        educationLevel: data.educationLevel,
        experienceYears: data.experienceYears,
        skills: data.skills,
      }),
      JSON.stringify(prediction.factors)
    );

    const gap = analyzeSkillGap(data.skills, data.preferredRole, allJobs);
    db.prepare(
      `INSERT INTO skill_gap_results (
        user_id, target_role, compatibility_score, matched_skills_json,
        missing_skills_json, required_skills_json
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      gap.targetRole,
      gap.compatibilityScore,
      JSON.stringify(gap.matchedSkills),
      JSON.stringify(gap.missingSkills),
      JSON.stringify(gap.requiredSkillsDetail)
    );

    const recs = generateSkillRecommendations(data.skills, data.preferredRole, allJobs, catalog);
    db.prepare('DELETE FROM skill_recommendations WHERE user_id = ?').run(userId);
    const insertRec = db.prepare(
      `INSERT INTO skill_recommendations (
        user_id, target_role, skill_name, priority, reason,
        target_jobs_json, learning_url, learning_source, demand_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of recs) {
      insertRec.run(
        userId,
        data.preferredRole,
        r.skillName,
        r.priority,
        r.reason,
        JSON.stringify(r.targetJobs),
        r.learningUrl,
        r.learningSource,
        r.demandScore
      );
    }

    const bundle = getUserProfileBundle(userId);
    res.json({
      message: 'Profile saved and AI insights updated.',
      ...bundle,
    });
  };

  app.post('/api/profile', requireAuth, upsertProfileHandler);
  app.put('/api/profile', requireAuth, upsertProfileHandler);

  // ==================== SALARY PREDICTION ENDPOINTS ====================

  app.post('/api/salary/predict', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = salaryPredictSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid prediction input' });
      return;
    }

    const bundle = getUserProfileBundle(req.user!.id);
    const prof = bundle?.profile;

    const input = {
      jobRole: parsed.data.jobRole || prof?.preferredRole || 'Python Developer',
      city: parsed.data.city || prof?.city || 'Bengaluru',
      educationLevel: parsed.data.educationLevel || prof?.educationLevel || 'B.Tech / B.E.',
      experienceYears:
        parsed.data.experienceYears !== undefined
          ? parsed.data.experienceYears
          : prof?.experienceYears ?? 0,
      employmentStatus:
        parsed.data.employmentStatus || prof?.employmentStatus || 'Fresher / Job Seeker',
      skills: parsed.data.skills && parsed.data.skills.length > 0 ? parsed.data.skills : prof?.skills || [],
    };

    const result = predictSalaryWithFactors(input);
    const insertRes = db
      .prepare(
        `INSERT INTO salary_predictions (
          user_id, model_used, predicted_salary, min_salary, max_salary,
          monthly_salary, input_snapshot_json, factors_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user!.id,
        result.modelUsed,
        result.predictedSalary,
        result.minSalary,
        result.maxSalary,
        result.monthlySalary,
        JSON.stringify(input),
        JSON.stringify(result.factors)
      );

    res.json({
      id: Number(insertRes.lastInsertRowid),
      input,
      ...result,
    });
  });

  app.get('/api/salary/history', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT id, model_used, predicted_salary, min_salary, max_salary, monthly_salary,
                input_snapshot_json, factors_json, created_at
         FROM salary_predictions
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 20`
      )
      .all(req.user!.id) as Array<{
      id: number;
      model_used: string;
      predicted_salary: number;
      min_salary: number;
      max_salary: number;
      monthly_salary: number;
      input_snapshot_json: string;
      factors_json: string;
      created_at: string;
    }>;

    res.json({
      history: rows.map((r) => ({
        id: r.id,
        modelUsed: r.model_used,
        predictedSalary: r.predicted_salary,
        minSalary: r.min_salary,
        maxSalary: r.max_salary,
        monthlySalary: r.monthly_salary,
        inputSnapshot: JSON.parse(r.input_snapshot_json),
        factors: JSON.parse(r.factors_json),
        createdAt: r.created_at,
      })),
    });
  });

  // ==================== SKILL GAP & RECOMMENDATION ENDPOINTS ====================

  app.post('/api/skills/analyze', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = skillRoleSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid skill analysis input' });
      return;
    }

    const bundle = getUserProfileBundle(req.user!.id);
    const targetRole = parsed.data.targetRole || bundle?.profile.preferredRole || 'Python Developer';
    const userSkills =
      parsed.data.skills && parsed.data.skills.length > 0
        ? parsed.data.skills
        : bundle?.profile.skills || [];

    const allJobs = getAllJobsWithSkills(db);
    const gap = analyzeSkillGap(userSkills, targetRole, allJobs);

    const insertRes = db
      .prepare(
        `INSERT INTO skill_gap_results (
          user_id, target_role, compatibility_score, matched_skills_json,
          missing_skills_json, required_skills_json
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user!.id,
        gap.targetRole,
        gap.compatibilityScore,
        JSON.stringify(gap.matchedSkills),
        JSON.stringify(gap.missingSkills),
        JSON.stringify(gap.requiredSkillsDetail)
      );

    res.json({
      id: Number(insertRes.lastInsertRowid),
      userSkills,
      ...gap,
    });
  });

  app.get('/api/skills/gaps', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT id, target_role, compatibility_score, matched_skills_json,
                missing_skills_json, required_skills_json, created_at
         FROM skill_gap_results
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 10`
      )
      .all(req.user!.id) as Array<{
      id: number;
      target_role: string;
      compatibility_score: number;
      matched_skills_json: string;
      missing_skills_json: string;
      required_skills_json: string;
      created_at: string;
    }>;

    res.json({
      gaps: rows.map((r) => ({
        id: r.id,
        targetRole: r.target_role,
        compatibilityScore: r.compatibility_score,
        matchedSkills: JSON.parse(r.matched_skills_json),
        missingSkills: JSON.parse(r.missing_skills_json),
        requiredSkillsDetail: JSON.parse(r.required_skills_json),
        createdAt: r.created_at,
      })),
    });
  });

  app.post('/api/skills/recommend', requireAuth, (req: AuthenticatedRequest, res) => {
    const parsed = skillRoleSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
      return;
    }

    const bundle = getUserProfileBundle(req.user!.id);
    const targetRole = parsed.data.targetRole || bundle?.profile.preferredRole || 'Python Developer';
    const userSkills =
      parsed.data.skills && parsed.data.skills.length > 0
        ? parsed.data.skills
        : bundle?.profile.skills || [];

    const allJobs = getAllJobsWithSkills(db);
    const catalog = loadSkillsCatalog();
    const recs = generateSkillRecommendations(userSkills, targetRole, allJobs, catalog);

    db.prepare('DELETE FROM skill_recommendations WHERE user_id = ?').run(req.user!.id);
    const insertRec = db.prepare(
      `INSERT INTO skill_recommendations (
        user_id, target_role, skill_name, priority, reason,
        target_jobs_json, learning_url, learning_source, demand_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of recs) {
      insertRec.run(
        req.user!.id,
        targetRole,
        r.skillName,
        r.priority,
        r.reason,
        JSON.stringify(r.targetJobs),
        safeHttpUrl(r.learningUrl),
        r.learningSource,
        r.demandScore
      );
    }

    res.json({
      targetRole,
      recommendations: recs,
    });
  });

  app.get('/api/skills/recommendations', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT id, target_role, skill_name, priority, reason, target_jobs_json,
                learning_url, learning_source, demand_score, created_at
         FROM skill_recommendations
         WHERE user_id = ?
         ORDER BY id ASC`
      )
      .all(req.user!.id) as Array<{
      id: number;
      target_role: string;
      skill_name: string;
      priority: 'High' | 'Medium' | 'Recommended';
      reason: string;
      target_jobs_json: string;
      learning_url: string;
      learning_source: string;
      demand_score: number;
      created_at: string;
    }>;

    res.json({
      recommendations: rows.map((r) => ({
        id: r.id,
        targetRole: r.target_role,
        skillName: r.skill_name,
        priority: r.priority,
        reason: r.reason,
        targetJobs: JSON.parse(r.target_jobs_json),
        learningUrl: safeHttpUrl(r.learning_url),
        learningSource: r.learning_source,
        demandScore: r.demand_score,
        createdAt: r.created_at,
      })),
    });
  });

  // ==================== JOB RECOMMENDATION ENDPOINTS ====================

  function filterJobs<T extends { title: string; location: string; experienceMin: number; experienceMax: number; salaryMin: number; salaryMax: number; description: string; requiredSkills: Array<{ name: string }> }>(
    items: T[],
    query: Record<string, unknown>
  ): T[] {
    const location = typeof query.location === 'string' ? query.location.trim().toLowerCase() : '';
    const role = typeof query.role === 'string' ? query.role.trim().toLowerCase() : '';
    const skill = typeof query.skill === 'string' ? normalizeSkillName(query.skill) : '';
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const maxExp = query.experience !== undefined && query.experience !== '' ? Number(query.experience) : NaN;
    const minSalary = query.minSalary !== undefined && query.minSalary !== '' ? Number(query.minSalary) : NaN;

    return items.filter((item) => {
      if (location && location !== 'all' && !item.location.toLowerCase().includes(location)) {
        return false;
      }
      if (role && role !== 'all' && !item.title.toLowerCase().includes(role)) {
        return false;
      }
      if (skill) {
        const hasSkill = item.requiredSkills.some((s) => normalizeSkillName(s.name).includes(skill));
        if (!hasSkill) return false;
      }
      if (!Number.isNaN(maxExp)) {
        if (item.experienceMin > maxExp) return false;
      }
      if (!Number.isNaN(minSalary)) {
        if (item.salaryMax < minSalary) return false;
      }
      if (search) {
        const hay = `${item.title} ${item.location} ${item.description} ${item.requiredSkills.map((s) => s.name).join(' ')}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  app.get('/api/jobs', (req, res) => {
    const allJobs = getAllJobsWithSkills(db);
    const filtered = filterJobs(allJobs, req.query as Record<string, unknown>);
    res.json({
      isDemonstrationData: true,
      notice: 'Job records shown below are curated demonstration listings for academic evaluation.',
      jobs: filtered,
    });
  });

  app.get('/api/jobs/recommended', requireAuth, (req: AuthenticatedRequest, res) => {
    const bundle = getUserProfileBundle(req.user!.id);
    const allJobs = getAllJobsWithSkills(db);

    const savedRows = db
      .prepare('SELECT job_id FROM saved_jobs WHERE user_id = ?')
      .all(req.user!.id) as Array<{ job_id: string }>;
    const savedSet = new Set(savedRows.map((r) => r.job_id));

    const ranked = recommendJobs(
      {
        skills: bundle?.profile.skills || [],
        experienceYears: bundle?.profile.experienceYears ?? 0,
        preferredRole: bundle?.profile.preferredRole || 'Python Developer',
        preferredLocation: bundle?.profile.preferredLocation || 'Bengaluru',
      },
      allJobs
    );

    const filtered = ranked.filter((match) => {
      const matches = filterJobs([match.job], req.query as Record<string, unknown>);
      return matches.length > 0;
    });

    res.json({
      isDemonstrationData: true,
      notice: 'Recommendations are computed in real time from your saved profile against our demonstration job dataset.',
      recommendations: filtered.map((m) => ({
        ...m,
        isSaved: savedSet.has(m.job.id),
      })),
    });
  });

  app.get('/api/jobs/saved', requireAuth, (req: AuthenticatedRequest, res) => {
    const bundle = getUserProfileBundle(req.user!.id);
    const allJobs = getAllJobsWithSkills(db);
    const savedRows = db
      .prepare('SELECT job_id, created_at FROM saved_jobs WHERE user_id = ? ORDER BY id DESC')
      .all(req.user!.id) as Array<{ job_id: string; created_at: string }>;
    const savedMap = new Map(savedRows.map((r) => [r.job_id, r.created_at]));

    const ranked = recommendJobs(
      {
        skills: bundle?.profile.skills || [],
        experienceYears: bundle?.profile.experienceYears ?? 0,
        preferredRole: bundle?.profile.preferredRole || 'Python Developer',
        preferredLocation: bundle?.profile.preferredLocation || 'Bengaluru',
      },
      allJobs.filter((j) => savedMap.has(j.id))
    );

    res.json({
      savedJobs: ranked.map((m) => ({
        ...m,
        isSaved: true,
        savedAt: savedMap.get(m.job.id),
      })),
    });
  });

  app.get('/api/jobs/:id', (req, res) => {
    const allJobs = getAllJobsWithSkills(db);
    const job = allJobs.find((j) => j.id === req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job listing not found.' });
      return;
    }
    res.json({ job });
  });

  app.post('/api/jobs/:id/save', requireAuth, (req: AuthenticatedRequest, res) => {
    const jobId = String(req.params.id);
    const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job listing not found.' });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM saved_jobs WHERE user_id = ? AND job_id = ?')
      .get(req.user!.id, jobId) as { id: number } | undefined;

    if (existing) {
      db.prepare('DELETE FROM saved_jobs WHERE id = ?').run(existing.id);
      res.json({ saved: false, jobId, message: 'Removed from saved jobs.' });
      return;
    }

    db.prepare('INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)').run(req.user!.id, jobId);
    res.json({ saved: true, jobId, message: 'Job saved to your shortlist.' });
  });

  // ==================== DASHBOARD OVERVIEW ENDPOINT ====================

  app.get('/api/dashboard/summary', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const bundle = getUserProfileBundle(userId);
    if (!bundle) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const allJobs = getAllJobsWithSkills(db);
    const catalog = loadSkillsCatalog();

    // Get latest salary prediction or compute one on the fly
    let latestSalaryRow = db
      .prepare('SELECT * FROM salary_predictions WHERE user_id = ? ORDER BY id DESC LIMIT 1')
      .get(userId) as
      | {
          id: number;
          model_used: string;
          predicted_salary: number;
          min_salary: number;
          max_salary: number;
          monthly_salary: number;
          factors_json: string;
          created_at: string;
        }
      | undefined;

    if (!latestSalaryRow) {
      const pred = predictSalaryWithFactors({
        jobRole: bundle.profile.preferredRole,
        city: bundle.profile.city,
        educationLevel: bundle.profile.educationLevel,
        experienceYears: bundle.profile.experienceYears,
        employmentStatus: bundle.profile.employmentStatus,
        skills: bundle.profile.skills,
      });
      const ins = db
        .prepare(
          `INSERT INTO salary_predictions (
            user_id, model_used, predicted_salary, min_salary, max_salary,
            monthly_salary, input_snapshot_json, factors_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          userId,
          pred.modelUsed,
          pred.predictedSalary,
          pred.minSalary,
          pred.maxSalary,
          pred.monthlySalary,
          JSON.stringify(bundle.profile),
          JSON.stringify(pred.factors)
        );
      latestSalaryRow = db
        .prepare('SELECT * FROM salary_predictions WHERE id = ?')
        .get(Number(ins.lastInsertRowid)) as typeof latestSalaryRow;
    }

    // Latest skill gap
    const gap = analyzeSkillGap(bundle.profile.skills, bundle.profile.preferredRole, allJobs);
    const recs = generateSkillRecommendations(
      bundle.profile.skills,
      bundle.profile.preferredRole,
      allJobs,
      catalog
    );

    const rankedJobs = recommendJobs(
      {
        skills: bundle.profile.skills,
        experienceYears: bundle.profile.experienceYears,
        preferredRole: bundle.profile.preferredRole,
        preferredLocation: bundle.profile.preferredLocation,
      },
      allJobs
    );

    const savedRows = db
      .prepare('SELECT job_id FROM saved_jobs WHERE user_id = ?')
      .all(userId) as Array<{ job_id: string }>;
    const savedSet = new Set(savedRows.map((r) => r.job_id));

    const matchingJobsCount = rankedJobs.filter((j) => j.matchPercentage >= 55).length;

    // Salary projection curve by years of experience (0 to +5 years) using real ML model
    const currentExp = bundle.profile.experienceYears;
    const salaryProjection = [0, 1, 2, 3, 4, 5].map((offset) => {
      const exp = Number((currentExp + offset).toFixed(1));
      const p = predictSalaryWithFactors({
        jobRole: bundle.profile.preferredRole,
        city: bundle.profile.city,
        educationLevel: bundle.profile.educationLevel,
        experienceYears: exp,
        employmentStatus: bundle.profile.employmentStatus,
        skills: bundle.profile.skills,
      });
      return {
        label: offset === 0 ? 'Current' : `+${offset} yr`,
        experienceYears: exp,
        predictedSalary: p.predictedSalary,
        minSalary: p.minSalary,
        maxSalary: p.maxSalary,
      };
    });

    const insights: string[] = [];
    if (gap.missingSkills.length > 0) {
      insights.push(
        `Learning ${gap.missingSkills.slice(0, 2).join(' and ')} would raise your ${bundle.profile.preferredRole} readiness from ${gap.compatibilityScore}% toward 90%+.`
      );
    } else {
      insights.push(
        `Your current stack covers all core skills for ${bundle.profile.preferredRole} listings in our dataset.`
      );
    }
    if (bundle.profile.skills.length < 5) {
      insights.push(
        'Adding Git, SQL, and a cloud/container tool (Docker or AWS) improves both job match rank and estimated CTC.'
      );
    }
    const topJob = rankedJobs[0];
    if (topJob) {
      insights.push(
        `Highest match: ${topJob.job.title} at ${topJob.job.companyName} (${topJob.locationMatch ? topJob.job.location : 'Open location'}) with ${topJob.matchPercentage}% compatibility.`
      );
    }

    res.json({
      ...bundle,
      latestPrediction: {
        modelUsed: latestSalaryRow!.model_used,
        predictedSalary: latestSalaryRow!.predicted_salary,
        minSalary: latestSalaryRow!.min_salary,
        maxSalary: latestSalaryRow!.max_salary,
        monthlySalary: latestSalaryRow!.monthly_salary,
        factors: JSON.parse(latestSalaryRow!.factors_json),
        createdAt: latestSalaryRow!.created_at,
      },
      skillGap: gap,
      recommendations: recs,
      topJobs: rankedJobs.slice(0, 6).map((m) => ({
        ...m,
        isSaved: savedSet.has(m.job.id),
      })),
      matchingJobsCount,
      savedJobsCount: savedSet.size,
      salaryProjection,
      insights,
    });
  });

  return app;
}
