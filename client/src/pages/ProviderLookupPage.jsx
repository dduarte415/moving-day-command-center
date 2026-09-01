import { useState } from 'react';
import { api, ApiError } from '../lib/apiClient';
import { Loading, ErrorState, EmptyState } from '../components/StatusStates';
import { titleCaseAddress } from '../lib/formatDate';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';

const TECH_BADGE = {
  Fiber: 'bg-emerald-100 text-emerald-800',
  Cable: 'bg-blue-100 text-blue-800',
  DSL: 'bg-amber-100 text-amber-800',
  'Fixed Wireless': 'bg-purple-100 text-purple-800',
};

export default function ProviderLookupPage() {
  const [mode, setMode] = useState('address'); // 'address' | 'zip'
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!query.trim() || status === 'loading') return;
    setStatus('loading');
    setError(null);
    try {
      const params = new URLSearchParams(mode === 'address' ? { address: query } : { zip: query });
      const data = await api.get(`/api/provider-lookup?${params}`);
      setResult(data);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unexpected error');
      setResult(null);
      setStatus('error');
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-800">Find internet providers at an address</h2>
        <p className="mt-1 text-sm text-slate-500">
          Looks up availability from FCC broadband data. If a full address doesn't match, try a ZIP code.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Search by</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="address">Address</option>
              <option value="zip">ZIP code</option>
            </select>
          </label>
          <label className="flex flex-1 min-w-56 flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{mode === 'address' ? 'Address' : 'ZIP code'}</span>
            {mode === 'address' ? (
              <AddressAutocompleteInput
                required
                value={query}
                onChange={setQuery}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="456 New Ave, Austin, TX 73301"
              />
            ) : (
              <input
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="73301"
              />
            )}
          </label>
          <button
            type="submit"
            disabled={status === 'loading'}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              status === 'loading'
                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}
          >
            {status === 'loading' ? 'Searching…' : 'Search'}
          </button>
        </form>
      </section>

      {status === 'loading' && <Loading label="Looking up providers…" />}
      {status === 'error' && (
        <ErrorState
          message={`${error} — couldn't retrieve live data right now.`}
          onRetry={handleSubmit}
        />
      )}

      {status === 'ready' && result && (
        <section className="space-y-3">
          {result.source === 'mock' && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Showing sample data — live FCC lookup requires an API token (see README). This isn't live
              availability data.
            </div>
          )}
          {result.stale && (
            <div className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              Live data was unavailable — showing the last successful result from{' '}
              {new Date(result.fetchedAt).toLocaleString()}.
            </div>
          )}
          {result.matchedAddress && (
            <p className="text-sm text-slate-500">Matched: {titleCaseAddress(result.matchedAddress)}</p>
          )}

          {result.providers.length === 0 ? (
            <EmptyState
              title="No providers found"
              description="FCC data didn't return any providers for this location."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Provider</th>
                    <th className="px-4 py-2 font-medium">Technology</th>
                    <th className="px-4 py-2 font-medium">Max download</th>
                    <th className="px-4 py-2 font-medium">Max upload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.providers.map((p, i) => (
                    <tr key={`${p.providerName}-${i}`}>
                      <td className="px-4 py-2 font-medium text-slate-800">{p.providerName}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TECH_BADGE[p.technology] ?? 'bg-slate-100 text-slate-700'}`}>
                          {p.technology}
                        </span>
                      </td>
                      <td className="px-4 py-2">{p.maxDownloadMbps} Mbps</td>
                      <td className="px-4 py-2">{p.maxUploadMbps} Mbps</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {status === 'idle' && (
        <EmptyState title="Search for an address" description="Results will appear here." />
      )}
    </div>
  );
}
