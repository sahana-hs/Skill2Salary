import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { initDatabase } from '../server/db';
import { createApp } from '../server/app';
import {
  predictSalaryWithFactors,
  trainAndSaveSalaryModel,
} from '../server/ml/salaryPipeline';
import { analyzeSkillGap, generateSkillRecommendations, recommendJobs } from '../server/ml/recommender';
import { getAllJobsWithSkills, loadSkillsCatalog } from '../server/db';

async function startTestServer() {
  const db = initDatabase(':memory:');
  const app = createApp(db);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { server, baseUrl, db };
}

test('ML Pipeline: cleans CSV, trains 3 regressors, computes MAE/MSE/RMSE/R2, and predicts realistic INR CTC', () => {
  const artifact = trainAndSaveSalaryModel();
  assert.ok(artifact.datasetStats.duplicatesRemoved >= 1, 'Should remove duplicate CSV rows');
  assert.ok(artifact.datasetStats.missingValuesImputed >= 1, 'Should impute missing CSV values');
  assert.equal(artifact.metrics.length, 3, 'Should evaluate Linear Regression, Random Forest, and Gradient Boosting');

  const best = artifact.metrics.find((m) => m.isBest);
  assert.ok(best, 'Best model must be flagged');
  assert.ok(best.r2 > 0.6, `Expected R2 > 0.6, got ${best.r2}`);
  assert.ok(best.rmse > 0 && best.mae > 0 && best.mse > 0);

  const fresherPred = predictSalaryWithFactors({
    jobRole: 'Python Developer',
    city: 'Kochi',
    educationLevel: 'BCA',
    experienceYears: 0,
    employmentStatus: 'Fresher / Job Seeker',
    skills: ['Python', 'SQL'],
  });

  const seniorPred = predictSalaryWithFactors({
    jobRole: 'Python Developer',
    city: 'Bengaluru',
    educationLevel: 'M.Tech / M.E.',
    experienceYears: 5,
    employmentStatus: 'Employed',
    skills: ['Python', 'SQL', 'Django', 'FastAPI', 'Docker', 'AWS', 'Git'],
  });

  assert.ok(fresherPred.predictedSalary >= 280000);
  assert.ok(seniorPred.predictedSalary > fresherPred.predictedSalary, 'Senior Bengaluru engineer must predict higher CTC than fresher Kochi baseline');
  assert.equal(fresherPred.monthlySalary, Math.round(fresherPred.predictedSalary / 12));
  assert.ok(fresherPred.minSalary < fresherPred.predictedSalary && fresherPred.maxSalary > fresherPred.predictedSalary);
});

test('Skill Gap, Recommendations, and Job Matching Engine work accurately', () => {
  const db = initDatabase(':memory:');
  const jobs = getAllJobsWithSkills(db);
  const catalog = loadSkillsCatalog();

  const gap = analyzeSkillGap(['Python', 'SQL', 'Git'], 'Python Developer', jobs);
  assert.ok(gap.matchedSkills.includes('Python'));
  assert.ok(gap.matchedSkills.includes('SQL'));
  assert.ok(gap.missingSkills.length > 0);
  assert.ok(gap.compatibilityScore > 0 && gap.compatibilityScore < 100);

  const recs = generateSkillRecommendations(['Python', 'SQL', 'Excel'], 'Data Scientist', jobs, catalog);
  assert.ok(recs.length >= 4);
  assert.ok(recs.some((r) => r.skillName === 'Machine Learning' || r.skillName === 'Statistics'));
  assert.ok(recs.every((r) => r.learningUrl.startsWith('https://')));

  const ranked = recommendJobs(
    {
      skills: ['Python', 'SQL', 'Django', 'REST API', 'Git', 'Docker'],
      experienceYears: 1,
      preferredRole: 'Python Developer',
      preferredLocation: 'Bengaluru',
    },
    jobs
  );
  assert.equal(ranked[0].job.title, 'Python Developer');
  assert.ok(ranked[0].matchPercentage >= ranked[ranked.length - 1].matchPercentage);
  db.close();
});

test('REST API: Auth, Validation, Protected Routes, User Isolation, and End-to-End Workflows', async () => {
  const { server, baseUrl, db } = await startTestServer();
  try {
    // 1. Health & metrics
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.status, 'ok');

    // 2. Unauthenticated access rejected
    const unauthRes = await fetch(`${baseUrl}/api/profile`);
    assert.equal(unauthRes.status, 401);

    // 3. Validation failure on bad registration
    const badReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'A', email: 'not-an-email', password: '123', confirmPassword: '456' }),
    });
    assert.equal(badReg.status, 400);

    // 4. Register User A
    const regA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Rohan Kulkarni',
        email: 'rohan@test.in',
        password: 'Password@123',
        confirmPassword: 'Password@123',
      }),
    });
    assert.equal(regA.status, 201);
    const dataA = await regA.json();
    assert.ok(dataA.token);
    assert.equal(dataA.user.email, 'rohan@test.in');

    // 5. Register User B
    const regB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Sneha Verma',
        email: 'sneha@test.in',
        password: 'Password@123',
        confirmPassword: 'Password@123',
      }),
    });
    const dataB = await regB.json();

    // 6. User A updates profile with Data Scientist skills
    const profRes = await fetch(`${baseUrl}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataA.token}`,
      },
      body: JSON.stringify({
        fullName: 'Rohan Kulkarni',
        state: 'Maharashtra',
        city: 'Pune',
        educationLevel: 'B.Tech / B.E.',
        degree: 'B.Tech',
        branch: 'Information Technology',
        graduationYear: 2025,
        experienceYears: 2,
        employmentStatus: 'Employed',
        skills: ['Python', 'SQL', 'Machine Learning', 'Pandas', 'Statistics'],
        preferredRole: 'Data Scientist',
        preferredLocation: 'Pune',
        expectedSalary: 950000,
        employmentType: 'Full-Time',
      }),
    });
    assert.equal(profRes.status, 200);

    // 7. Verify User B's profile remains isolated from User A's updates
    const profB = await fetch(`${baseUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${dataB.token}` },
    });
    const profBJson = await profB.json();
    assert.equal(profBJson.profile.preferredRole, 'Python Developer');
    assert.equal(profBJson.profile.skills.length, 0);

    // 8. Salary Prediction & History
    const predRes = await fetch(`${baseUrl}/api/salary/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataA.token}`,
      },
      body: JSON.stringify({
        jobRole: 'Data Scientist',
        city: 'Bengaluru',
        experienceYears: 2,
        skills: ['Python', 'SQL', 'Machine Learning', 'Pandas', 'Statistics'],
      }),
    });
    assert.equal(predRes.status, 200);
    const predJson = await predRes.json();
    assert.ok(predJson.predictedSalary > 500000);

    const histB = await fetch(`${baseUrl}/api/salary/history`, {
      headers: { Authorization: `Bearer ${dataB.token}` },
    });
    const histBJson = await histB.json();
    assert.equal(histBJson.history.length, 0, 'User B must not see User A salary history');

    // 9. Save job & verify saved jobs list
    const saveRes = await fetch(`${baseUrl}/api/jobs/job-003/save`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dataA.token}` },
    });
    assert.equal(saveRes.status, 200);
    const saveJson = await saveRes.json();
    assert.equal(saveJson.saved, true);

    const savedListA = await fetch(`${baseUrl}/api/jobs/saved`, {
      headers: { Authorization: `Bearer ${dataA.token}` },
    });
    const savedListAJson = await savedListA.json();
    assert.equal(savedListAJson.savedJobs.length, 1);

    // 10. Forgot Password + Reset Password flow
    const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rohan@test.in' }),
    });
    const forgotJson = await forgotRes.json();
    assert.ok(forgotJson.demoResetCode);

    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rohan@test.in',
        resetCode: forgotJson.demoResetCode,
        newPassword: 'NewPassword@456',
        confirmPassword: 'NewPassword@456',
      }),
    });
    assert.equal(resetRes.status, 200);

    // Login with new password succeeds
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rohan@test.in', password: 'NewPassword@456' }),
    });
    assert.equal(loginRes.status, 200);
  } finally {
    server.close();
    db.close();
  }
});
