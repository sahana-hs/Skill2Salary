import React, { useEffect, useState } from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { api, formatINR } from '../../services/api';
import { ModelMetricsResponse, User } from '../../types';

interface SettingsViewProps {
  user: User;
  onNavigateProfile: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ user, onNavigateProfile }) => {
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null);

  useEffect(() => {
    api.getModelMetrics().then(setMetrics).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Settings &amp; System Architecture
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Account configuration, data isolation safeguards, and live ML pipeline audit metrics.
        </p>
      </div>

      {/* Account Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">Account Details</h2>
          <p className="text-sm text-slate-600 mt-1">
            Signed in as <span className="font-semibold text-slate-900">{user.fullName}</span> (
            {user.email})
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Session authentication uses short-lived Bearer tokens in memory with salted bcrypt
            password hashing in SQLite.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateProfile}
          className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          Edit Candidate Profile
        </button>
      </div>

      {/* ML Pipeline & Dataset Preprocessing Details */}
      {metrics && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-700" />
                ML Pipeline &amp; Dataset Preprocessing Summary
              </h2>
              <p className="text-xs text-slate-500 mt-1">{metrics.datasetStats.datasetName}</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              Trained: {new Date(metrics.trainedAt).toLocaleDateString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2 border-t border-slate-200">
            <div>
              <p className="text-xs text-slate-500">Raw CSV Rows</p>
              <p className="font-mono tabular-nums font-bold text-slate-900 text-lg mt-0.5">
                {metrics.datasetStats.rawRows}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Duplicates Removed</p>
              <p className="font-mono tabular-nums font-bold text-slate-900 text-lg mt-0.5">
                {metrics.datasetStats.duplicatesRemoved}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Imputed Values</p>
              <p className="font-mono tabular-nums font-bold text-slate-900 text-lg mt-0.5">
                {metrics.datasetStats.missingValuesImputed}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Train / Test Split</p>
              <p className="font-mono tabular-nums font-bold text-slate-900 text-lg mt-0.5">
                {metrics.datasetStats.trainRows} / {metrics.datasetStats.testRows}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Encoded Features</p>
              <p className="font-mono tabular-nums font-bold text-slate-900 text-lg mt-0.5">
                {metrics.datasetStats.featureCount}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto pt-2 border-t border-slate-200">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 px-4 text-right">MAE</th>
                  <th className="py-2 px-4 text-right">RMSE</th>
                  <th className="py-2 pl-4 text-right">R² Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {metrics.metrics.map((m) => (
                  <tr key={m.modelName}>
                    <td className="py-2.5 pr-4 font-medium text-slate-900">
                      {m.modelName} {m.isBest ? '· Selected' : ''}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {formatINR(m.mae)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {formatINR(m.rmse)}
                    </td>
                    <td className="py-2.5 pl-4 text-right font-mono tabular-nums font-semibold">
                      {m.r2.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Privacy & Architecture Safeguards */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Data Privacy &amp; Validation Safeguards
        </h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>1. Passwords are salted and hashed with bcrypt before persistence in SQLite.</li>
          <li>2. All profile, prediction, skill-gap, and saved-job endpoints enforce user-level isolation.</li>
          <li>3. Request payloads are validated on the server using strict Zod schemas and parameterized SQL queries.</li>
        </ul>
      </div>
    </div>
  );
};
