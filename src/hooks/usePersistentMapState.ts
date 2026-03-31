"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'mowlog_map_state';
const STATE_VERSION = '1.0';

interface MapState {
    lat: number;
    lng: number;
    zoom: number;
    selectedId: string | null;
}

const DEFAULTS: MapState = {
    lat: 45.4215,
    lng: -75.6972,
    zoom: 13,
    selectedId: null
};

/**
 * usePersistentMapState Hook
 * Manages map view (center/zoom) and client selection persistence.
 * Syncs to URL (shareable) and localStorage (private recovery).
 */
export function usePersistentMapState() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isHydrating = useRef(true);
    const [state, setState] = useState<MapState>(DEFAULTS);

    // Rounding helper to avoid URL churn
    const round = (num: number, decimals = 5) => {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    };

    // ─── HYDRATION (URL -> LocalStorage -> Defaults) ──────────────────────
    useEffect(() => {
        if (typeof window === 'undefined' || !searchParams) return;

        const urlLat = searchParams.get('lat');
        const urlLng = searchParams.get('lng');
        const urlZoom = searchParams.get('z');
        const urlId = searchParams.get('client');

        let hydratedState = { ...DEFAULTS };

        // 1. Try local storage recovery
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.version === STATE_VERSION) {
                    hydratedState = { ...hydratedState, ...parsed.data };
                }
            }
        } catch (e) {
            console.warn("Failed to load map state from localStorage", e);
        }

        // 2. URL params take precedence (shareable state)
        if (urlLat) hydratedState.lat = round(parseFloat(urlLat));
        if (urlLng) hydratedState.lng = round(parseFloat(urlLng));
        if (urlZoom) hydratedState.zoom = parseInt(urlZoom);
        if (urlId) hydratedState.selectedId = urlId;

        // Optimization: only update if changed significantly from current state
        // to prevent loops or unnecessary re-renders during transitions
        setState(prev => {
            if (
                prev.lat === hydratedState.lat &&
                prev.lng === hydratedState.lng &&
                prev.zoom === hydratedState.zoom &&
                prev.selectedId === hydratedState.selectedId
            ) {
                return prev;
            }
            return hydratedState;
        });
        
        // 3. Set hydration guard period to ignore immediate moveend events
        // This period should be longer than our typical flyTo duration (1.2s)
        const timer = setTimeout(() => {
            isHydrating.current = false;
        }, 1500);

        return () => clearTimeout(timer);
    }, [searchParams]);

    // ─── PERSISTENCE WRITERS ──────────────────────────────────────────────

    const updateView = useCallback((lat: number, lng: number, zoom: number) => {
        if (isHydrating.current || !searchParams) return;

        const roundedLat = round(lat);
        const roundedLng = round(lng);

        // Optimization: only update if changed significantly
        if (roundedLat === state.lat && roundedLng === state.lng && zoom === state.zoom) return;

        setState(prev => ({
            ...prev,
            lat: roundedLat,
            lng: roundedLng,
            zoom
        }));

        // Write to URL (replaceState avoids history clutter)
        const params = new URLSearchParams(searchParams.toString());
        // REMOVED: Synchronization of coordinates to URL to prevent "running in circles" jitter
        // params.set('lat', roundedLat.toString());
        // params.set('lng', roundedLng.toString());
        // params.set('z', zoom.toString());
        
        // Safety: Always include the current selection from STATE, not from (latencies) URL
        if (state.selectedId) {
            params.set('client', state.selectedId);
        } else {
            params.delete('client');
        }
        
        router.replace(`?${params.toString()}`, { scroll: false });

        // Mirror to localStorage (This remains the source of truth for view recovery)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: STATE_VERSION,
            data: { lat: roundedLat, lng: roundedLng, zoom, selectedId: state.selectedId }
        }));
    }, [router, searchParams, state.lat, state.lng, state.zoom, state.selectedId]);

    const updateSelection = useCallback((id: string | null) => {
        if (!searchParams) return;

        // Force hydration guard if we are switching selection, to let flyTo finish
        isHydrating.current = true;
        
        setState(prev => ({ ...prev, selectedId: id }));

        const params = new URLSearchParams(searchParams.toString());
        
        // REMOVED: Synchronization of coordinates to URL
        // params.set('lat', state.lat.toString());
        // params.set('lng', state.lng.toString());
        // params.set('z', state.zoom.toString());

        if (id) {
            params.set('client', id);
        } else {
            params.delete('client');
        }
        
        router.replace(`?${params.toString()}`, { scroll: false });

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: STATE_VERSION,
            data: { ...state, selectedId: id }
        }));

        // Reset hydration guard after a short delay
        setTimeout(() => {
            isHydrating.current = false;
        }, 1500);
    }, [router, searchParams, state]);

    return {
        ...state,
        updateView,
        updateSelection,
        isHydrating: isHydrating.current
    };
}
