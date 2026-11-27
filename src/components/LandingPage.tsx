import React, { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, CheckCircle2, Compass, Layers, Target } from 'lucide-react';
import { api } from '../services/api';
import { ModelMetricsResponse } from '../types';

interface LandingPageProps {
  onNavigateAuth: (mode: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateAuth }) => {
  const [metricsData, setMetricsData] = useState<ModelMetricsResponse | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [teamImgFailed, setTeamImgFailed] = useState(false);

  useEffect(() => {
    api.getModelMetrics().then(setMetricsData).catch(() => {});
  }, []);

  const bestMetric = metricsData?.metrics.find((m) => m.isBest);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top Navigation Bar (Strict 3-zone contract) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#home"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
          >
            Skill to Salary
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#home" className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0">
              Home
            </a>
            <a href="#features" className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#about" className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0">
              About
            </a>
            <button
              type="button"
              onClick={() => onNavigateAuth('login')}
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Login
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateAuth('login')}
              className="md:hidden px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onNavigateAuth('register')}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-semibold text-cyan-700 mb-3">
                Turn Your Skills Into Your Future Salary.
              </p>
              <h1
                className="font-display font-bold tracking-tight text-slate-900 leading-[1.1] mb-6"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                Know Your Worth. Discover Your Career Potential.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                An AI-powered platform that estimates your salary, identifies skill gaps and
                recommends suitable job opportunities based on your professional profile.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onNavigateAuth('register')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Analyze My Profile
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#features"
                  className="inline-flex items-center px-6 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Explore Features
                </a>
              </div>
              <p className="mt-6 text-xs text-slate-500">
                Built for the Indian tech job market · Annual CTC in INR (₹) · Live ML Regression &amp; TF-IDF Matching
              </p>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[300px] lg:min-h-[420px] rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_career_analytics_1795676855800.jpg"
                    alt="Software engineer reviewing salary trajectory analytics on dual monitors in Bengaluru"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
                    <BarChart3 className="w-12 h-12 text-cyan-400 mb-4" />
                    <p className="font-display text-lg font-semibold">
                      Indian Tech Salary &amp; Skill Intelligence
                    </p>
                    <p className="text-sm text-slate-300 mt-1 max-w-sm">
                      Real-time ML regression, skill-gap scoring, and job matching.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-Column Quantitative Proof Strip */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">ML Training Corpus</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {metricsData ? `${metricsData.datasetStats.cleanedRows} Records` : '215+ Records'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Indian tech roles &amp; cities (demo dataset)
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Active Best Regressor</p>
              <p className="mt-1 text-xl font-bold text-slate-900 truncate">
                {metricsData ? metricsData.bestModelName : 'Gradient Boosting'}
              </p>
              <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {bestMetric ? `Test R² ${bestMetric.r2.toFixed(3)}` : 'Linear · RF · GBR evaluated'}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Skills &amp; Roles Indexed</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                42 Skills
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Across 10 engineering &amp; data tracks
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Matching Algorithm</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                TF-IDF + Overlap
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Cosine similarity &amp; weighted role fit
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
              Core Career Intelligence Modules
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Every recommendation and salary estimate is computed on the backend from trained
              regression models, TF-IDF skill vectors, and SQLite-backed job requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-7 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-blue-700 font-mono tabular-nums">
                  01. Salary Regression
                </span>
                <BarChart3 className="w-5 h-5 text-blue-700" />
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-900">
                AI Salary Prediction
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Predicts annual CTC in INR (₹) alongside min–max range and monthly equivalent using
                Linear Regression, Random Forest, and Gradient Boosting trained on cleaned CSV data.
              </p>
            </div>

            <div className="p-7 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-cyan-700 font-mono tabular-nums">
                  02. Requirement Matching
                </span>
                <Target className="w-5 h-5 text-cyan-700" />
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-900">
                Skill Gap Analysis
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Compares your technical skills against live requirements for your chosen role,
                highlighting matched strengths, missing prerequisites, and a compatibility percentage.
              </p>
            </div>

            <div className="p-7 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-blue-700 font-mono tabular-nums">
                  03. Ranked Discovery
                </span>
                <Compass className="w-5 h-5 text-blue-700" />
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-900">
                Smart Job Matching
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Ranks demonstration Indian tech openings by combining weighted skill overlap,
                TF-IDF cosine similarity, experience suitability, and preferred city alignment.
              </p>
            </div>

            <div className="p-7 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-cyan-700 font-mono tabular-nums">
                  04. Upskilling Roadmap
                </span>
                <Layers className="w-5 h-5 text-cyan-700" />
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-900">
                Skill Recommendations
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Prioritizes missing skills by job-market demand and target role frequency, paired
                with verified official documentation and learning tutorials.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 mb-3">
                How It Works
              </h2>
              <p className="text-base text-slate-600 mb-8">
                A transparent five-stage workflow connecting your academic and technical background
                to actionable career decisions.
              </p>

              <ol className="space-y-5">
                {[
                  {
                    step: 'Step 1',
                    title: 'Enter your professional profile',
                    desc: 'Add your education, graduation year, experience, preferred Indian tech city, target role, and technical skills.',
                  },
                  {
                    step: 'Step 2',
                    title: 'AI analyzes your skills',
                    desc: 'The backend normalizes skills, constructs TF-IDF vectors, and encodes categorical attributes.',
                  },
                  {
                    step: 'Step 3',
                    title: 'Get salary predictions',
                    desc: 'The selected ML regressor estimates your annual INR CTC, range, monthly breakdown, and key drivers.',
                  },
                  {
                    step: 'Step 4',
                    title: 'Discover matching jobs',
                    desc: 'Jobs are scored and ranked by skill overlap, cosine similarity, experience fit, and location.',
                  },
                  {
                    step: 'Step 5',
                    title: 'Improve your skills',
                    desc: 'Review missing skills prioritized by market demand and start learning via curated documentation.',
                  },
                ].map((item) => (
                  <li key={item.step} className="flex items-start gap-4">
                    <span className="mt-0.5 text-xs font-semibold text-blue-700 font-mono tabular-nums whitespace-nowrap shrink-0">
                      {item.step}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                      <p className="text-sm text-slate-600 mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                {!teamImgFailed ? (
                  <img
                    src="/src/assets/images/feature_career_planning_1795676856123.jpg"
                    alt="Software graduates reviewing skill trees and career progression paths"
                    referrerPolicy="no-referrer"
                    onError={() => setTeamImgFailed(true)}
                    className="w-full h-auto object-cover"
                  />
                ) : (
                  <div className="p-12 text-center bg-slate-100">
                    <CheckCircle2 className="w-10 h-10 text-blue-700 mx-auto mb-3" />
                    <p className="font-semibold text-slate-800">Structured Career Roadmap</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
                About Skill to Salary
              </h2>
              <p className="mt-3 text-base text-slate-600 leading-relaxed">
                Designed as an end-to-end academic and practical career intelligence platform for
                students, fresh graduates, and early-career engineers across India.
              </p>
            </div>
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl border border-slate-200">
                <h3 className="font-semibold text-slate-900">Indian Market Calibration</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Models compensation in annual INR (₹) and Lakhs Per Annum (LPA) across major Indian
                  tech hubs including Bengaluru, Hyderabad, Pune, Chennai, Mumbai, Delhi NCR, Kochi,
                  and Ahmedabad.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-slate-200">
                <h3 className="font-semibold text-slate-900">Dataset Transparency</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Salary predictions and job listings use clearly labeled demonstration datasets so
                  project evaluators can inspect training metrics (MAE, MSE, RMSE, R²) and feature
                  attribution without fabricated claims.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="py-10 bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-display font-semibold text-white">Skill to Salary</p>
            <p className="text-xs text-slate-400 mt-1">
              AI-Based Skill, Salary and Job Recommendation System · Indian Tech Career Guidance
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <button
              type="button"
              onClick={() => onNavigateAuth('login')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
