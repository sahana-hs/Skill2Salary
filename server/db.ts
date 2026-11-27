import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { JobRecordForMatching } from './ml/recommender';
import { predictSalaryWithFactors } from './ml/salaryPipeline';
import { analyzeSkillGap, generateSkillRecommendations } from './ml/recommender';

export interface SkillCatalogEntry {
  name: string;
  category: string;
  demand: number;
  url: string;
  source: string;
}

export function initDatabase(customDbPath?: string): Database.Database {
  const dbPath =
    customDbPath ||
    process.env.DATABASE_PATH ||
    path.resolve(process.cwd(), 'data/skill_to_salary.db');

  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'candidate',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reset_code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS candidate_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      location TEXT NOT NULL DEFAULT 'Bengaluru',
      state TEXT NOT NULL DEFAULT 'Karnataka',
      city TEXT NOT NULL DEFAULT 'Bengaluru',
      education_level TEXT NOT NULL DEFAULT 'B.Tech / B.E.',
      degree TEXT NOT NULL DEFAULT 'Bachelor of Technology',
      branch TEXT NOT NULL DEFAULT 'Computer Science & Engineering',
      graduation_year INTEGER NOT NULL DEFAULT 2025,
      experience_years REAL NOT NULL DEFAULT 0,
      employment_status TEXT NOT NULL DEFAULT 'Student / Final Year',
      preferred_role TEXT NOT NULL DEFAULT 'Python Developer',
      preferred_location TEXT NOT NULL DEFAULT 'Bengaluru',
      expected_salary INTEGER NOT NULL DEFAULT 650000,
      employment_type TEXT NOT NULL DEFAULT 'Full-Time',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      market_demand_score INTEGER NOT NULL DEFAULT 75,
      learning_url TEXT NOT NULL,
      learning_source_label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      proficiency TEXT NOT NULL DEFAULT 'Intermediate',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, skill_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company_name TEXT NOT NULL,
      location TEXT NOT NULL,
      state TEXT NOT NULL,
      experience_min REAL NOT NULL,
      experience_max REAL NOT NULL,
      salary_min INTEGER NOT NULL,
      salary_max INTEGER NOT NULL,
      employment_type TEXT NOT NULL,
      description TEXT NOT NULL,
      application_url TEXT NOT NULL,
      is_demo_listing INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_required_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      skill_id INTEGER NOT NULL,
      importance_weight REAL NOT NULL DEFAULT 1.0,
      is_core INTEGER NOT NULL DEFAULT 1,
      UNIQUE(job_id, skill_id),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS salary_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      model_used TEXT NOT NULL,
      predicted_salary INTEGER NOT NULL,
      min_salary INTEGER NOT NULL,
      max_salary INTEGER NOT NULL,
      monthly_salary INTEGER NOT NULL,
      input_snapshot_json TEXT NOT NULL,
      factors_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skill_gap_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_role TEXT NOT NULL,
      compatibility_score INTEGER NOT NULL,
      matched_skills_json TEXT NOT NULL,
      missing_skills_json TEXT NOT NULL,
      required_skills_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skill_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_role TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      priority TEXT NOT NULL,
      reason TEXT NOT NULL,
      target_jobs_json TEXT NOT NULL,
      learning_url TEXT NOT NULL,
      learning_source TEXT NOT NULL DEFAULT 'Official Documentation',
      demand_score INTEGER NOT NULL DEFAULT 80,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      job_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, job_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
    CREATE INDEX IF NOT EXISTS idx_salary_predictions_user ON salary_predictions(user_id);
    CREATE INDEX IF NOT EXISTS idx_skill_gap_user ON skill_gap_results(user_id);
    CREATE INDEX IF NOT EXISTS idx_saved_jobs_user ON saved_jobs(user_id);
  `);

  seedInitialData(db);
  return db;
}

export function loadSkillsCatalog(): SkillCatalogEntry[] {
  const catalogPath = path.resolve(process.cwd(), 'datasets/skills_catalog.json');
  return JSON.parse(fs.readFileSync(catalogPath, 'utf-8')) as SkillCatalogEntry[];
}

function seedInitialData(db: Database.Database): void {
  const catalog = loadSkillsCatalog();
  const upsertSkill = db.prepare(`
    INSERT INTO skills (name, category, market_demand_score, learning_url, learning_source_label)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      category = excluded.category,
      market_demand_score = excluded.market_demand_score,
      learning_url = excluded.learning_url,
      learning_source_label = excluded.learning_source_label
  `);

  const insertSkillsTx = db.transaction((items: SkillCatalogEntry[]) => {
    for (const s of items) {
      upsertSkill.run(s.name, s.category, s.demand, s.url, s.source);
    }
  });
  insertSkillsTx(catalog);

  // Seed jobs from JSON
  const jobsPath = path.resolve(process.cwd(), 'datasets/indian_tech_jobs.json');
  const rawJobs = JSON.parse(fs.readFileSync(jobsPath, 'utf-8')) as Array<{
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
    requiredSkills: string[];
    description: string;
    applicationUrl: string;
    isDemoListing: boolean;
  }>;

  const getSkillByName = db.prepare('SELECT id FROM skills WHERE LOWER(name) = LOWER(?)');
  const insertJob = db.prepare(`
    INSERT INTO jobs (id, title, company_name, location, state, experience_min, experience_max, salary_min, salary_max, employment_type, description, application_url, is_demo_listing)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      company_name = excluded.company_name,
      location = excluded.location,
      state = excluded.state,
      experience_min = excluded.experience_min,
      experience_max = excluded.experience_max,
      salary_min = excluded.salary_min,
      salary_max = excluded.salary_max,
      employment_type = excluded.employment_type,
      description = excluded.description,
      application_url = excluded.application_url
  `);
  const insertJobSkill = db.prepare(`
    INSERT OR IGNORE INTO job_required_skills (job_id, skill_id, importance_weight, is_core)
    VALUES (?, ?, ?, ?)
  `);

  const seedJobsTx = db.transaction(() => {
    for (const job of rawJobs) {
      insertJob.run(
        job.id,
        job.title,
        job.companyName,
        job.location,
        job.state,
        job.experienceMin,
        job.experienceMax,
        job.salaryMin,
        job.salaryMax,
        job.employmentType,
        job.description,
        job.applicationUrl,
        job.isDemoListing ? 1 : 0
      );

      job.requiredSkills.forEach((skillName, index) => {
        let skillRow = getSkillByName.get(skillName) as { id: number } | undefined;
        if (!skillRow) {
          const info = upsertSkill.run(
            skillName,
            'General',
            75,
            'https://developer.mozilla.org/',
            'Reference Docs'
          );
          skillRow = { id: Number(info.lastInsertRowid) };
        }
        const weight = index < 3 ? 1.25 : 0.9;
        insertJobSkill.run(job.id, skillRow.id, weight, index < 3 ? 1 : 0);
      });
    }
  });
  seedJobsTx();

  // Seed demonstration accounts only if users table is empty
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    const demoPassHash = bcrypt.hashSync('DemoPass@123', 10);

    const demoAccounts = [
      {
        fullName: 'Aarav Sharma',
        email: 'aarav.sharma@demo.in',
        city: 'Bengaluru',
        state: 'Karnataka',
        educationLevel: 'B.Tech / B.E.',
        degree: 'B.Tech',
        branch: 'Computer Science & Engineering',
        graduationYear: 2025,
        experienceYears: 1,
        employmentStatus: 'Fresher / Job Seeker',
        preferredRole: 'Python Developer',
        preferredLocation: 'Bengaluru',
        expectedSalary: 650000,
        employmentType: 'Full-Time',
        skills: ['Python', 'SQL', 'Git', 'HTML', 'CSS', 'Problem Solving'],
        savedJobId: 'job-001',
      },
      {
        fullName: 'Priya Nair',
        email: 'priya.nair@demo.in',
        city: 'Hyderabad',
        state: 'Telangana',
        educationLevel: 'M.Tech / M.E.',
        degree: 'M.Tech',
        branch: 'Data Science & AI',
        graduationYear: 2024,
        experienceYears: 2,
        employmentStatus: 'Employed',
        preferredRole: 'Data Scientist',
        preferredLocation: 'Hyderabad',
        expectedSalary: 1100000,
        employmentType: 'Full-Time',
        skills: ['Python', 'SQL', 'Machine Learning', 'Pandas', 'NumPy', 'Statistics', 'Git'],
        savedJobId: 'job-003',
      },
    ];

    const allJobs = getAllJobsWithSkills(db);

    for (const acc of demoAccounts) {
      const userRes = db
        .prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)')
        .run(acc.fullName, acc.email, demoPassHash);
      const userId = Number(userRes.lastInsertRowid);

      db.prepare(
        `INSERT INTO candidate_profiles (
          user_id, location, state, city, education_level, degree, branch,
          graduation_year, experience_years, employment_status, preferred_role,
          preferred_location, expected_salary, employment_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        `${acc.city}, ${acc.state}`,
        acc.state,
        acc.city,
        acc.educationLevel,
        acc.degree,
        acc.branch,
        acc.graduationYear,
        acc.experienceYears,
        acc.employmentStatus,
        acc.preferredRole,
        acc.preferredLocation,
        acc.expectedSalary,
        acc.employmentType
      );

      syncUserSkills(db, userId, acc.skills);

      // Run initial ML prediction, skill gap, and recommendations for seeded demo accounts
      const prediction = predictSalaryWithFactors({
        jobRole: acc.preferredRole,
        city: acc.city,
        educationLevel: acc.educationLevel,
        experienceYears: acc.experienceYears,
        employmentStatus: acc.employmentStatus,
        skills: acc.skills,
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
          jobRole: acc.preferredRole,
          city: acc.city,
          educationLevel: acc.educationLevel,
          experienceYears: acc.experienceYears,
          skills: acc.skills,
        }),
        JSON.stringify(prediction.factors)
      );

      const gap = analyzeSkillGap(acc.skills, acc.preferredRole, allJobs);
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

      const recs = generateSkillRecommendations(acc.skills, acc.preferredRole, allJobs, catalog);
      const insertRec = db.prepare(
        `INSERT INTO skill_recommendations (
          user_id, target_role, skill_name, priority, reason,
          target_jobs_json, learning_url, learning_source, demand_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const r of recs) {
        insertRec.run(
          userId,
          acc.preferredRole,
          r.skillName,
          r.priority,
          r.reason,
          JSON.stringify(r.targetJobs),
          r.learningUrl,
          r.learningSource,
          r.demandScore
        );
      }

      db.prepare('INSERT OR IGNORE INTO saved_jobs (user_id, job_id) VALUES (?, ?)').run(
        userId,
        acc.savedJobId
      );
    }
  }
}

export function syncUserSkills(db: Database.Database, userId: number, skillNames: string[]): void {
  const uniqueNames = Array.from(new Set(skillNames.map((s) => s.trim()).filter(Boolean)));
  const getSkill = db.prepare('SELECT id FROM skills WHERE LOWER(name) = LOWER(?)');
  const insertSkill = db.prepare(`
    INSERT INTO skills (name, category, market_demand_score, learning_url, learning_source_label)
    VALUES (?, 'Custom', 70, 'https://developer.mozilla.org/', 'Developer Docs')
  `);
  const deleteUserSkills = db.prepare('DELETE FROM user_skills WHERE user_id = ?');
  const insertUserSkill = db.prepare(
    'INSERT OR IGNORE INTO user_skills (user_id, skill_id, proficiency) VALUES (?, ?, ?)'
  );

  const tx = db.transaction(() => {
    deleteUserSkills.run(userId);
    for (const name of uniqueNames) {
      let row = getSkill.get(name) as { id: number } | undefined;
      if (!row) {
        const res = insertSkill.run(name);
        row = { id: Number(res.lastInsertRowid) };
      }
      insertUserSkill.run(userId, row.id, 'Intermediate');
    }
  });
  tx();
}

export function getUserSkillsList(db: Database.Database, userId: number): string[] {
  const rows = db
    .prepare(
      `SELECT s.name
       FROM user_skills us
       JOIN skills s ON s.id = us.skill_id
       WHERE us.user_id = ?
       ORDER BY s.name ASC`
    )
    .all(userId) as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

export function getAllJobsWithSkills(db: Database.Database): JobRecordForMatching[] {
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY id ASC').all() as Array<{
    id: string;
    title: string;
    company_name: string;
    location: string;
    state: string;
    experience_min: number;
    experience_max: number;
    salary_min: number;
    salary_max: number;
    employment_type: string;
    description: string;
    application_url: string;
    is_demo_listing: number;
  }>;

  const reqStmt = db.prepare(`
    SELECT s.name, s.market_demand_score, s.learning_url, s.learning_source_label, jrs.importance_weight, jrs.is_core
    FROM job_required_skills jrs
    JOIN skills s ON s.id = jrs.skill_id
    WHERE jrs.job_id = ?
    ORDER BY jrs.is_core DESC, s.name ASC
  `);

  return jobs.map((j) => {
    const reqs = reqStmt.all(j.id) as Array<{
      name: string;
      market_demand_score: number;
      learning_url: string;
      learning_source_label: string;
      importance_weight: number;
      is_core: number;
    }>;

    return {
      id: j.id,
      title: j.title,
      companyName: j.company_name,
      location: j.location,
      state: j.state,
      experienceMin: j.experience_min,
      experienceMax: j.experience_max,
      salaryMin: j.salary_min,
      salaryMax: j.salary_max,
      employmentType: j.employment_type,
      description: j.description,
      applicationUrl: j.application_url,
      isDemoListing: j.is_demo_listing === 1,
      requiredSkills: reqs.map((r) => ({
        name: r.name,
        importanceWeight: r.importance_weight,
        isCore: r.is_core === 1,
        demandScore: r.market_demand_score,
        learningUrl: r.learning_url,
        learningSource: r.learning_source_label,
      })),
    };
  });
}
