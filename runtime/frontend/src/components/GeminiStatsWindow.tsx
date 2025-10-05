/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { requestJson } from '../lib/api';
import './GeminiStatsWindow.css';

interface ModelSummary {
  name: string;
  requests: number;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
}

interface UsageSummary {
  totalRequests: number;
  totalPromptTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCachedTokens: number;
  models: ModelSummary[];
}

interface LatestUsageRecord {
  recordedAt: string;
  summary: UsageSummary;
}

interface AggregateUsageRecord extends LatestUsageRecord {
  sessions: number;
  since: string;
  updatedAt: string;
}

interface UsageSummaryResponse {
  success: boolean;
  message?: string;
  summary?: {
    latest?: LatestUsageRecord;
    aggregate?: AggregateUsageRecord;
  };
}

interface FetchState {
  loading: boolean;
  error?: string | null;
  latest?: LatestUsageRecord | null;
  aggregate?: AggregateUsageRecord | null;
}

const formatNumber = (value: number | undefined) =>
  (value ?? 0).toLocaleString();

const formatDate = (value: string | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const GeminiStatsWindow = () => {
  const [state, setState] = useState<FetchState>({
    loading: true,
    error: null,
    latest: null,
    aggregate: null,
  });

  const fetchStats = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await requestJson<UsageSummaryResponse>('/api/gemini-stats');
      if (!data.success || !data.summary) {
        setState({
          loading: false,
          error: data.message ?? 'Gemini usage is not available yet.',
          latest: null,
          aggregate: null,
        });
        return;
      }
      setState({
        loading: false,
        error: null,
        latest: data.summary.latest ?? null,
        aggregate: data.summary.aggregate ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({
        loading: false,
        error: message,
        latest: null,
        aggregate: null,
      });
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const totals = useMemo(() => {
    const aggregateSummary = state.aggregate?.summary;
    if (!aggregateSummary) return null;
    return {
      totalRequests: formatNumber(aggregateSummary.totalRequests),
      totalPromptTokens: formatNumber(aggregateSummary.totalPromptTokens),
      totalOutputTokens: formatNumber(aggregateSummary.totalOutputTokens),
      totalTokens: formatNumber(aggregateSummary.totalTokens),
      totalCachedTokens: formatNumber(aggregateSummary.totalCachedTokens),
    };
  }, [state.aggregate]);

  const modelRows = state.aggregate?.summary?.models ?? [];

  return (
    <div className="gemini-stats">
      <div className="gemini-stats__header">
        <div>
          <h2>Gemini Usage</h2>
          <p>
            Track how many requests the shared API key has handled. Data resets
            when the backend restarts.
          </p>
        </div>
        <button
          type="button"
          className="gemini-stats__refresh"
          onClick={() => void fetchStats()}
          disabled={state.loading}
        >
          {state.loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {state.error && (
        <div className="gemini-stats__alert">
          <strong>Heads up:</strong> {state.error}
        </div>
      )}

      {!state.error && state.loading && (
        <div className="gemini-stats__status">Loading usage…</div>
      )}

      {!state.loading && !state.error && !state.latest && (
        <div className="gemini-stats__status">
          No Gemini API calls have been recorded yet.
        </div>
      )}

      {!state.loading && state.latest && (
        <div className="gemini-stats__grid">
          <section className="gemini-stats__card">
            <h3>Latest call</h3>
            <dl>
              <div className="gemini-stats__stat">
                <dt>Recorded</dt>
                <dd>{formatDate(state.latest.recordedAt)}</dd>
              </div>
              <div className="gemini-stats__stat">
                <dt>Total tokens</dt>
                <dd>{formatNumber(state.latest.summary.totalTokens)}</dd>
              </div>
              <div className="gemini-stats__stat">
                <dt>Prompt tokens</dt>
                <dd>{formatNumber(state.latest.summary.totalPromptTokens)}</dd>
              </div>
              <div className="gemini-stats__stat">
                <dt>Output tokens</dt>
                <dd>{formatNumber(state.latest.summary.totalOutputTokens)}</dd>
              </div>
              <div className="gemini-stats__stat">
                <dt>Cached tokens</dt>
                <dd>{formatNumber(state.latest.summary.totalCachedTokens)}</dd>
              </div>
            </dl>
          </section>

          <section className="gemini-stats__card">
            <h3>Session totals</h3>
            {state.aggregate ? (
              <dl>
                <div className="gemini-stats__stat">
                  <dt>Sessions</dt>
                  <dd>{state.aggregate.sessions.toLocaleString()}</dd>
                </div>
                <div className="gemini-stats__stat">
                  <dt>Tracking since</dt>
                  <dd>{formatDate(state.aggregate.since)}</dd>
                </div>
                <div className="gemini-stats__stat">
                  <dt>Last updated</dt>
                  <dd>{formatDate(state.aggregate.updatedAt)}</dd>
                </div>
                {totals && (
                  <>
                    <div className="gemini-stats__stat">
                      <dt>Total requests</dt>
                      <dd>{totals.totalRequests}</dd>
                    </div>
                    <div className="gemini-stats__stat">
                      <dt>Total tokens</dt>
                      <dd>{totals.totalTokens}</dd>
                    </div>
                    <div className="gemini-stats__stat">
                      <dt>Prompt tokens</dt>
                      <dd>{totals.totalPromptTokens}</dd>
                    </div>
                    <div className="gemini-stats__stat">
                      <dt>Output tokens</dt>
                      <dd>{totals.totalOutputTokens}</dd>
                    </div>
                    <div className="gemini-stats__stat">
                      <dt>Cached tokens</dt>
                      <dd>{totals.totalCachedTokens}</dd>
                    </div>
                  </>
                )}
              </dl>
            ) : (
              <p>Aggregate totals will appear after the next command.</p>
            )}
          </section>
        </div>
      )}

      {!state.loading && modelRows.length ? (
        <section className="gemini-stats__card">
          <h3>Model breakdown</h3>
          <table className="gemini-stats__table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Requests</th>
                <th>Prompt</th>
                <th>Output</th>
                <th>Total</th>
                <th>Cached</th>
              </tr>
            </thead>
            <tbody>
              {modelRows.map((model) => (
                <tr key={model.name}>
                  <td>{model.name}</td>
                  <td>{formatNumber(model.requests)}</td>
                  <td>{formatNumber(model.promptTokens)}</td>
                  <td>{formatNumber(model.outputTokens)}</td>
                  <td>{formatNumber(model.totalTokens)}</td>
                  <td>{formatNumber(model.cachedTokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
};

export default GeminiStatsWindow;
