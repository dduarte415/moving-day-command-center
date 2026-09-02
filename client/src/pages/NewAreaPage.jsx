import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/apiClient';
import { useMoveContext } from '../context/MoveContext';
import { Loading, ErrorState, EmptyState } from '../components/StatusStates';
import { titleCaseAddress } from '../lib/formatDate';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';

const TECH_BADGE = {
  Fiber: 'bg-emerald-100 text-emerald-800',
  Cable: 'bg-blue-100 text-blue-800',
  DSL: 'bg-amber-100 text-amber-800',
  'Fixed Wireless': 'bg-purple-100 text-purple-800',
};

function PlaceGroup({ group }) {
  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-800">{group.label}</h3>
        <span className="text-xs text-slate-400">{group.places.length} nearby</span>
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {group.places.map((place) => (
          <li key={place.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {place.website ? (
                  <a
                    href={place.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand-700 hover:underline"
                  >
                    {place.name}
                  </a>
                ) : (
                  place.name
                )}
              </p>
              {place.detail && (
                <p className="truncate text-xs capitalize text-slate-400">{place.detail}</p>
              )}
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-500">{place.distanceMi} mi</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function NewAreaPage() {
  const { activeMove } = useMoveContext();
  const [address, setAddress] = useState('');
  const [places, setPlaces] = useState(null);
  const [placesStatus, setPlacesStatus] = useState('idle');
  const [placesError, setPlacesError] = useState(null);
  const [providers, setProviders] = useState(null);
  const [providersStatus, setProvidersStatus] = useState('idle');

  // Seed the field from the move's destination — the whole point of the page
  // is "what's around where I'm going", so make that the zero-effort default.
  useEffect(() => {
    if (activeMove?.newAddress) setAddress(activeMove.newAddress);
  }, [activeMove?.newAddress]);

  const search = useCallback(async (query) => {
    if (!query?.trim()) return;

    // Two independent lookups so a slow or failing one never blocks the other.
    setPlacesStatus('loading');
    setPlacesError(null);
    api
      .get(`/api/local-places?address=${encodeURIComponent(query)}`)
      .then((data) => {
        setPlaces(data);
        setPlacesStatus('ready');
      })
      .catch((err) => {
        setPlacesError(err instanceof ApiError ? err.message : 'Unexpected error');
        setPlaces(null);
        setPlacesStatus('error');
      });

    setProvidersStatus('loading');
    api
      .get(`/api/provider-lookup?address=${encodeURIComponent(query)}`)
      .then((data) => {
        setProviders(data);
        setProvidersStatus('ready');
      })
      .catch(() => {
        // A provider-lookup failure is silent by design: the section only
        // renders with real FCC data anyway, so there is nothing to report.
        setProviders(null);
        setProvidersStatus('error');
      });
  }, []);

  // Auto-run once the destination address is known, so the page has content
  // on arrival instead of an empty form.
  useEffect(() => {
    if (activeMove?.newAddress) search(activeMove.newAddress);
  }, [activeMove?.newAddress, search]);

  function handleSubmit(e) {
    e.preventDefault();
    search(address);
  }

  const busy = placesStatus === 'loading';

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-800">Get to know your new area</h2>
        <p className="mt-1 text-sm text-slate-500">
          Gyms and studios, places to eat, groceries, health and pharmacies, everyday errands,
          transit, and parks — everything worth knowing about before you land.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Address</span>
            <AddressAutocompleteInput
              required
              value={address}
              onChange={setAddress}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="456 Oakland Ave, Novato, CA 94945"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              busy
                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}
          >
            {busy ? 'Searching…' : 'Search'}
          </button>
        </form>
      </section>

      {/* --- Nearby places --- */}
      {placesStatus === 'loading' && <Loading label="Finding places nearby…" />}
      {placesStatus === 'error' && (
        <ErrorState message={placesError} onRetry={() => search(address)} />
      )}
      {placesStatus === 'ready' && places && (
        <>
          {places.precision === 'area' && (
            <p className="text-xs text-slate-500">
              Couldn't pin that exact address, so these are places around{' '}
              {titleCaseAddress(places.matchedAddress?.split(',').slice(0, 2).join(', ') ?? 'the area')}.
            </p>
          )}
          {places.stale && (
            <p className="text-xs text-slate-500">
              Live data was unavailable — showing saved results from{' '}
              {new Date(places.fetchedAt).toLocaleDateString()}.
            </p>
          )}
          {places.groups.length === 0 ? (
            <EmptyState
              title="Nothing mapped nearby"
              description="OpenStreetMap doesn't have many places listed around this address yet."
            />
          ) : (
            <div className="space-y-5">
              {places.groups.map((group) => (
                <PlaceGroup key={group.key} group={group} />
              ))}
            </div>
          )}
        </>
      )}

      {/* --- Internet providers ---
          Only rendered against real FCC data. Without BDC credentials the
          data source serves clearly-labelled sample data, which is useful
          for local development but is noise in a live demo — a table of
          invented ISPs under a disclaimer is worse than no table. The
          integration stays wired up and lights up on its own the moment
          real credentials are configured. */}
      {providers?.source === 'fcc' && providersStatus === 'ready' && (
        <section>
          <h3 className="mb-1 font-semibold text-slate-800">Internet Providers</h3>
          <div className="space-y-2">
            {providers.stale && (
              <div className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-xs text-slate-600">
                Live data was unavailable — showing the last successful result from{' '}
                {new Date(providers.fetchedAt).toLocaleString()}.
              </div>
            )}
            {providers.providers.length === 0 ? (
              <EmptyState
                title="No providers found"
                description="FCC data didn't return any providers for this location."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                    {providers.providers.map((p, i) => (
                      <tr key={`${p.providerName}-${i}`}>
                        <td className="px-4 py-2 font-medium text-slate-800">{p.providerName}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              TECH_BADGE[p.technology] ?? 'bg-slate-100 text-slate-700'
                            }`}
                          >
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
          </div>
        </section>
      )}

      {placesStatus === 'idle' && (
        <EmptyState
          title="Search an address"
          description="Set a move with a destination address, or search one above."
        />
      )}
    </div>
  );
}
