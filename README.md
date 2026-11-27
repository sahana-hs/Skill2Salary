# Skill to Salary — AI-Based Skill, Salary & Job Recommendation System

**"Turn Your Skills Into Your Future Salary."**

Skill to Salary is a full-stack career intelligence web application designed for students, fresh graduates, and early-career software professionals in the Indian tech market. It estimates annual CTC in INR (₹), runs dynamic skill-gap analysis, prioritizes upskilling paths with official documentation links, and ranks matching jobs using TF-IDF similarity and weighted skill overlap.

---

## 1. System Architecture

```
USER BROWSER (React + TypeScript + Tailwind CSS + Recharts)
        │
        ▼ REST APIs (Authorization: Bearer <token>)
EXPRESS BACKEND SERVER (server.ts / server/app.ts + Zod Validation)
        │
        ├──► SQLite Database (server/db.ts via better-sqlite3)
        │       Tables: users, sessions, password_resets, candidate_profiles,
        │               skills, user_skills, jobs, job_required_skills,
        │               salary_predictions, skill_gap_results,
        │               skill_recommendations, saved_jobs
        │
        └──► AI / ML & NLP Engine (server/ml/)
                ├── salaryPipeline.ts
                │     ├── CSV cleaning (deduplication + missing-value imputation)
                │     ├── TF-IDF skill vectorization + categorical encoding
                │     ├── 80/20 deterministic train/test split
                │     ├── Linear Regression, Random Forest, Gradient Boosting
                │     └── Evaluation (MAE, MSE, RMSE, R²) & Best Model Selection
                └── recommender.ts
                      ├── Skill normalization & alias mapping
                      ├── Role-aggregated Skill-Gap Analysis
                      ├── Market-demand Skill Recommendations
                      └── TF-IDF Cosine Similarity + Multi-factor Job Ranking
```

---

## 2. Sample Evaluator Credentials

Two realistic candidate accounts are automatically seeded on first startup:

| Candidate | Email | Password | Target Profile |
| :--- | :--- | :--- | :--- |
| Aarav Sharma | `aarav.sharma@demo.in` | `DemoPass@123` | Python Developer · Bengaluru · 1 yr exp |
| Priya Nair | `priya.nair@demo.in` | `DemoPass@123` | Data Scientist · Hyderabad · 2 yrs exp |

You can also register a brand-new user account or test the demonstration Forgot Password reset code flow on the Login screen.

---

## 3. Dataset Transparency

- **Salary Training Dataset (`datasets/indian_tech_salaries.csv`)**: A curated 218-row demonstration dataset calibrated to Indian tech CTC ranges across 10 roles, 8 cities, and 6 education levels. Deliberate duplicates and missing cells are included so the preprocessing pipeline cleans and imputes them transparently on startup.
- **Job Listings (`datasets/indian_tech_jobs.json`)**: 24 curated demonstration listings across major Indian tech hubs and remote roles, clearly labeled in the UI as demonstration listings.

---

## 4. API Endpoints

- **System & ML**
  - `GET /api/health` — Server, SQLite, and active ML model status
  - `GET /api/model/metrics` — MAE, MSE, RMSE, R² comparison & dataset cleaning stats
  - `GET /api/skills/catalog` — Searchable catalog of 42 technical & professional skills
- **Authentication**
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
- **Candidate Profile**
  - `GET /api/profile`
  - `POST /api/profile` & `PUT /api/profile`
- **Salary, Skill Gap & Recommendations**
  - `POST /api/salary/predict` & `GET /api/salary/history`
  - `POST /api/skills/analyze` & `GET /api/skills/gaps`
  - `POST /api/skills/recommend` & `GET /api/skills/recommendations`
- **Jobs & Dashboard**
  - `GET /api/jobs`
  - `GET /api/jobs/recommended`
  - `GET /api/jobs/saved`
  - `GET /api/jobs/:id`
  - `POST /api/jobs/:id/save`
  - `GET /api/dashboard/summary`

---

## 5. Local Installation & Startup (Windows / macOS / Linux)

### Prerequisites
- **Node.js 20+** (includes `npm`)

### Setup Commands

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment (optional)**
   Copy `.env.example` to `.env` if you wish to customize `PORT` or `DATABASE_PATH`.

3. **Run the full-stack application (Frontend + Backend + ML + SQLite)**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Run Automated Tests (ML Pipeline, Recommender, Database, Auth & REST API)**
   ```bash
   npm test
   ```

5. **Production Build & Start**
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
   *(On Windows PowerShell: `$env:NODE_ENV="production"; npm start`)*
