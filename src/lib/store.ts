import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MowingEvent, WateringEvent, FertilizingEvent } from './schemas';
import type { RouteStop, OptimizedRoute } from './route-optimizer';
import type { Feature, Polygon } from 'geojson';
import type { MowerProfile } from './lawn-intelligence';

export type BillingType = 'Regular' | 'PerCut';

export interface Client {
    id: string;
    name: string;
    address: string;
    phone: string;
    email?: string;
    contractLength?: string;
    sqft: string;
    billingType: BillingType;
    amount: number;
    notes: string;
    createdAt: string;
    lat?: number;
    lng?: number;
    routeScreenshot?: string; // base64 data URL of route overlay on satellite
    lawnBoundary?: Feature<Polygon>; // GeoJSON polygon of the outer lawn
    obstacles?: Feature<Polygon>[]; // Array of GeoJSON obstacle polygons
    mowerSize?: string;
    mowerDischarge?: string;
    mowerType?: 'standard' | 'zero-turn';
}

export interface Quote {
    id: string;
    type: 'quote';
    clientId?: string;
    clientName: string;
    clientAddress: string;
    lawnSqft?: number;
    serviceType: string;
    visits?: number;
    ratePerVisit?: number;
    seasonTotal?: number;
    additionalServices: { name: string; price: number }[];
    notes?: string;
    validUntil: string;
    createdAt: string;
    status: 'open' | 'expired';
    hstApplied: boolean;
    hstAmount: number;
    zones?: { id: string; sqft: number }[];
}

export interface Invoice {
    id: string;
    type: 'invoice';
    clientId?: string;
    clientName: string;
    clientAddress: string;
    lawnSqft?: number;
    serviceType: string;
    servicePeriod: { start: string; end: string };
    visits: number;
    ratePerVisit: number;
    grandTotal: number;
    additionalServices: { name: string; price: number }[];
    paymentMethod: string;
    paymentInstructions?: string;
    notes?: string;
    invoiceDate: string;
    dueDate: string;
    paidAt?: string;
    status: 'unpaid' | 'paid';
    hstApplied: boolean;
    hstAmount: number;
    convertedFromQuoteId?: string;
}

export interface Session {
    id: string;
    type?: 'workday' | 'address-mow';
    clientId: string | null;
    startTime: string;
    endTime: string | null;
    breakTimeTotal: number; // in seconds
    stuckTimeTotal?: number; // in seconds
    currentBreakOrStuckStartTime?: string | null;
    status: 'active' | 'break' | 'stuck' | 'completed';
    /** Recommended cut height (inches) at time of mow start, e.g. 2.5 */
    cutHeightIn?: number;
}

export interface GasLog {
    id: string;
    date: string;
    liters: number;
    pricePerLiter: number;
    total: number;
    isAiScanned: boolean;
}

export interface MaintenancePart {
    id: string;
    name: string;
    cost: number;
}

export interface MaintenanceLog {
    id: string;
    date: string;
    description: string;
    parts: MaintenancePart[];
    totalCost: number;
}

export interface ServiceInterval {
    id: string;
    name: string;            // "Blade Sharpening"
    intervalHours: number;   // Every 25 hours
    lastServiceHours: number;
    lastServiceDate: string;
}

export interface Equipment {
    id: string;
    name: string;            // "Toro TimeCutter 75750"
    type: 'mower' | 'trimmer' | 'blower' | 'other';
    currentHours: number;
    serviceIntervals: ServiceInterval[];
    /** Fuel/speed profile for operational cost calculations (mowers only) */
    mowerProfile?: MowerProfile;
}

/** Default profile for the Toro TimeCutter 75750 (50", 23 HP Kawasaki) */
const DEFAULT_TORO_75750: Equipment = {
    id: 'toro-timecutter-75750',
    name: 'Toro TimeCutter 75750',
    type: 'mower',
    currentHours: 0,
    serviceIntervals: [
        {
            id: 'blade-sharpening-01',
            name: 'Blade Sharpening',
            intervalHours: 25,
            lastServiceHours: 0,
            lastServiceDate: new Date().toISOString(),
        },
    ],
    mowerProfile: {
        fuelConsumptionRateLh: 4.5,           // 1.2 GPH @ normal load
        transitFuelConsumptionRateLh: 2.0,    // ~0.53 GPH @ light load / transit
        transitSpeedMph: 7.0,                 // Mow-speed transit between properties
        bladeSharpenIntervalHours: 25,
    },
};

interface AppState {
    clients: Client[];
    sessions: Session[];
    gasLogs: GasLog[];
    maintenanceLogs: MaintenanceLog[];
    equipment: Equipment[];
    quotes: Quote[];
    invoices: Invoice[];

    // Lawn Care Events
    mowingEvents: MowingEvent[];
    wateringEvents: WateringEvent[];
    fertilizingEvents: FertilizingEvent[];

    activeWorkdaySessionId: string | null;
    activeMowSessionId: string | null;

    // Home address for daily route optimization
    homeAddress: string;
    homeLat?: number;
    homeLng?: number;

    // Business config
    laborRate: number;       // $/hr — for profit calculations
    fuelCostPerKm: number;   // $/km — for route fuel estimates

    // Active Drive Mode
    activeRouteStops: RouteStop[] | null;
    currentRouteStopIndex: number;

    // Route Planner State
    plannerSelectedClientIds: string[];
    plannerOptimizedRoute: OptimizedRoute | null;
    hydrated: boolean;

    // Actions
    addClient: (client: Omit<Client, 'id' | 'createdAt'>) => void;
    updateClient: (id: string, client: Partial<Client>) => void;
    deleteClient: (id: string) => void;

    startWorkdaySession: () => void;
    endWorkdaySession: () => void;
    toggleWorkdayBreak: () => void;

    startMowSession: (clientId: string, cutHeightIn?: number) => void;
    endMowSession: () => void;
    toggleMowBreak: () => void;
    toggleMowStuck: () => void;

    startDriveMode: (stops: RouteStop[]) => void;
    advanceRouteStop: () => void;
    cancelDriveMode: () => void;

    addGasLog: (log: Omit<GasLog, 'id' | 'date'>) => void;
    addMaintenanceLog: (log: Omit<MaintenanceLog, 'id' | 'date' | 'totalCost'>) => void;
    addQuote: (quote: Quote) => void;
    deleteQuote: (id: string) => void;
    addInvoice: (invoice: Invoice) => void;
    updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
    deleteInvoice: (id: string) => void;

    // Event Logging Actions
    addMowingEvent: (event: Omit<MowingEvent, 'id' | 'date'>) => void;
    addWateringEvent: (event: Omit<WateringEvent, 'id' | 'date'>) => void;
    addFertilizingEvent: (event: Omit<FertilizingEvent, 'id' | 'date'>) => void;

    // Route and Profile features
    saveClientRoute: (clientId: string, screenshot: string, lat: number, lng: number, lawnBoundary?: Feature<Polygon>, obstacles?: Feature<Polygon>[]) => void;

    // Profile
    userName: string;
    homeLawnBoundary?: Feature<Polygon>;
    homeObstacles?: Feature<Polygon>[];
    setHomeAddress: (address: string, lat: number, lng: number) => void;
    updateProfile: (name: string, address: string, lat?: number, lng?: number) => void;
    saveHomeBoundary: (lawnBoundary?: Feature<Polygon>, obstacles?: Feature<Polygon>[]) => void;

    // Business config
    setLaborRate: (rate: number) => void;
    setFuelCostPerKm: (rate: number) => void;

    // Equipment tracking
    /** ID of the Equipment record currently used for fuel/transit estimates */
    activeMowerProfileId: string | null;
    setActiveMowerProfile: (equipmentId: string | null) => void;
    addEquipment: (eq: Omit<Equipment, 'id' | 'currentHours'>) => void;
    markServiceDone: (equipmentId: string, serviceId: string) => void;
    deleteEquipment: (id: string) => void;

    // Route Planner Actions
    setPlannerSelectedClientIds: (ids: string[]) => void;
    setPlannerOptimizedRoute: (route: OptimizedRoute | null) => void;
    setHydrated: (state: boolean) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            clients: [],
            sessions: [],
            gasLogs: [],
            maintenanceLogs: [],
            equipment: [DEFAULT_TORO_75750],
            quotes: [],
            invoices: [],
            activeMowerProfileId: DEFAULT_TORO_75750.id,
            mowingEvents: [],
            wateringEvents: [],
            fertilizingEvents: [],
            activeWorkdaySessionId: null,
            activeMowSessionId: null,
            activeRouteStops: null,
            currentRouteStopIndex: 0,

            plannerSelectedClientIds: [],
            plannerOptimizedRoute: null,
            hydrated: false,
            setHydrated: (h) => set({ hydrated: h }),

            // Profile Defaults
            userName: '',
            homeAddress: '',
            homeLawnBoundary: undefined,
            homeObstacles: undefined,

            laborRate: 25,
            fuelCostPerKm: 0.15,

            addClient: (client) =>
                set((state) => ({
                    clients: [
                        ...state.clients,
                        { ...client, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
                    ],
                })),

            updateClient: (id, updatedFields) =>
                set((state) => ({
                    clients: state.clients.map((c) => (c.id === id ? { ...c, ...updatedFields } : c)),
                })),

            deleteClient: (id) =>
                set((state) => ({
                    clients: state.clients.filter((c) => c.id !== id),
                })),

            startWorkdaySession: () =>
                set((state) => {
                    if (state.activeWorkdaySessionId) return state; // Already active
                    const newSession: Session = {
                        id: crypto.randomUUID(),
                        type: 'workday',
                        clientId: null,
                        startTime: new Date().toISOString(),
                        endTime: null,
                        breakTimeTotal: 0,
                        stuckTimeTotal: 0,
                        currentBreakOrStuckStartTime: null,
                        status: 'active',
                    };
                    return {
                        sessions: [...state.sessions, newSession],
                        activeWorkdaySessionId: newSession.id,
                    };
                }),

            endWorkdaySession: () =>
                set((state) => {
                    if (!state.activeWorkdaySessionId) return state;
                    const now = new Date().toISOString();
                    return {
                        sessions: state.sessions.map((s) => {
                            if (s.id !== state.activeWorkdaySessionId) return s;
                            let additionalBreak = 0;
                            if (s.status === 'break' && s.currentBreakOrStuckStartTime) {
                                additionalBreak = Math.floor((new Date(now).getTime() - new Date(s.currentBreakOrStuckStartTime).getTime()) / 1000);
                            }
                            return {
                                ...s,
                                endTime: now,
                                status: 'completed',
                                breakTimeTotal: (s.breakTimeTotal || 0) + additionalBreak,
                                currentBreakOrStuckStartTime: null
                            };
                        }),
                        activeWorkdaySessionId: null,
                    };
                }),

            toggleWorkdayBreak: () =>
                set((state) => {
                    if (!state.activeWorkdaySessionId) return state;
                    const now = new Date().toISOString();
                    return {
                        sessions: state.sessions.map((s) => {
                            if (s.id !== state.activeWorkdaySessionId) return s;
                            if (s.status === 'active') {
                                return { ...s, status: 'break', currentBreakOrStuckStartTime: now };
                            } else if (s.status === 'break') {
                                const breakStart = s.currentBreakOrStuckStartTime ? new Date(s.currentBreakOrStuckStartTime).getTime() : new Date().getTime();
                                const durationSecs = Math.floor((new Date(now).getTime() - breakStart) / 1000);
                                return { ...s, status: 'active', breakTimeTotal: (s.breakTimeTotal || 0) + durationSecs, currentBreakOrStuckStartTime: null };
                            }
                            return s;
                        }),
                    };
                }),

            startMowSession: (clientId, cutHeightIn) =>
                set((state) => {
                    if (state.activeMowSessionId) return state; // Already active -> Single mow session at a time

                    const newSession: Session = {
                        id: crypto.randomUUID(),
                        type: 'address-mow',
                        clientId: clientId,
                        startTime: new Date().toISOString(),
                        endTime: null,
                        breakTimeTotal: 0,
                        stuckTimeTotal: 0,
                        currentBreakOrStuckStartTime: null,
                        status: 'active',
                        cutHeightIn,
                    };

                    const updates: Partial<AppState> = {
                        sessions: [...state.sessions, newSession],
                        activeMowSessionId: newSession.id,
                    };

                    // Auto-clock-in workday when starting a mow session (if not already active)
                    if (!state.activeWorkdaySessionId) {
                        const newWorkdaySession: Session = {
                            id: crypto.randomUUID(),
                            type: 'workday',
                            clientId: null,
                            startTime: new Date().toISOString(),
                            endTime: null,
                            breakTimeTotal: 0,
                            stuckTimeTotal: 0,
                            currentBreakOrStuckStartTime: null,
                            status: 'active',
                        };
                        updates.sessions = [...updates.sessions!, newWorkdaySession];
                        updates.activeWorkdaySessionId = newWorkdaySession.id;
                    }

                    return updates;
                }),

            endMowSession: () =>
                set((state) => {
                    if (!state.activeMowSessionId) return state;
                    const now = new Date().toISOString();
                    return {
                        sessions: state.sessions.map((s) => {
                            if (s.id !== state.activeMowSessionId) return s;
                            let additionalBreak = 0;
                            let additionalStuck = 0;
                            if (s.status === 'break' && s.currentBreakOrStuckStartTime) {
                                additionalBreak = Math.floor((new Date(now).getTime() - new Date(s.currentBreakOrStuckStartTime).getTime()) / 1000);
                            }
                            if (s.status === 'stuck' && s.currentBreakOrStuckStartTime) {
                                additionalStuck = Math.floor((new Date(now).getTime() - new Date(s.currentBreakOrStuckStartTime).getTime()) / 1000);
                            }
                            return {
                                ...s,
                                endTime: now,
                                status: 'completed',
                                breakTimeTotal: (s.breakTimeTotal || 0) + additionalBreak,
                                stuckTimeTotal: (s.stuckTimeTotal || 0) + additionalStuck,
                                currentBreakOrStuckStartTime: null
                            };
                        }),
                        activeMowSessionId: null,
                        // Auto-increment equipment hours for mowers
                        equipment: state.equipment.map((e) => {
                            if (e.type !== 'mower') return e;
                            const sess = state.sessions.find((s) => s.id === state.activeMowSessionId);
                            if (!sess) return e;
                            const durSec = (new Date(now).getTime() - new Date(sess.startTime).getTime()) / 1000;
                            const netSec = durSec - (sess.breakTimeTotal || 0) - (sess.stuckTimeTotal || 0);
                            return { ...e, currentHours: e.currentHours + Math.max(0, netSec / 3600) };
                        }),
                    };
                }),

            toggleMowBreak: () =>
                set((state) => {
                    if (!state.activeMowSessionId) return state;
                    const now = new Date().toISOString();
                    return {
                        sessions: state.sessions.map((s) => {
                            if (s.id !== state.activeMowSessionId) return s;
                            if (s.status === 'active') {
                                return { ...s, status: 'break', currentBreakOrStuckStartTime: now };
                            } else if (s.status === 'break') {
                                const breakStart = s.currentBreakOrStuckStartTime ? new Date(s.currentBreakOrStuckStartTime).getTime() : new Date().getTime();
                                const durationSecs = Math.floor((new Date(now).getTime() - breakStart) / 1000);
                                return { ...s, status: 'active', breakTimeTotal: (s.breakTimeTotal || 0) + durationSecs, currentBreakOrStuckStartTime: null };
                            }
                            // Ignore if stuck
                            return s;
                        }),
                    };
                }),

            toggleMowStuck: () =>
                set((state) => {
                    if (!state.activeMowSessionId) return state;
                    const now = new Date().toISOString();
                    return {
                        sessions: state.sessions.map((s) => {
                            if (s.id !== state.activeMowSessionId) return s;
                            if (s.status === 'active') {
                                return { ...s, status: 'stuck', currentBreakOrStuckStartTime: now };
                            } else if (s.status === 'stuck') {
                                const stuckStart = s.currentBreakOrStuckStartTime ? new Date(s.currentBreakOrStuckStartTime).getTime() : new Date().getTime();
                                const durationSecs = Math.floor((new Date(now).getTime() - stuckStart) / 1000);
                                return { ...s, status: 'active', stuckTimeTotal: (s.stuckTimeTotal || 0) + durationSecs, currentBreakOrStuckStartTime: null };
                            }
                            // Ignore if break
                            return s;
                        }),
                    };
                }),

            startDriveMode: (stops) =>
                set(() => ({ activeRouteStops: stops, currentRouteStopIndex: 0 })),

            advanceRouteStop: () =>
                set((state) => {
                    if (!state.activeRouteStops) return state;
                    const nextIndex = state.currentRouteStopIndex + 1;
                    if (nextIndex >= state.activeRouteStops.length) {
                        return { activeRouteStops: null, currentRouteStopIndex: 0 };
                    }
                    return { currentRouteStopIndex: nextIndex };
                }),

            cancelDriveMode: () =>
                set(() => ({ activeRouteStops: null, currentRouteStopIndex: 0 })),

            addGasLog: (log) =>
                set((state) => ({
                    gasLogs: [
                        ...state.gasLogs,
                        { ...log, id: crypto.randomUUID(), date: new Date().toISOString() },
                    ],
                })),

            addMaintenanceLog: (log) =>
                set((state) => {
                    const totalCost = log.parts.reduce((sum, p) => sum + p.cost, 0);
                    return {
                        maintenanceLogs: [
                            ...state.maintenanceLogs,
                            { ...log, totalCost, id: crypto.randomUUID(), date: new Date().toISOString() },
                        ],
                    };
                }),

            addQuote: (quote) =>
                set((state) => ({
                    quotes: [...state.quotes, quote],
                })),

            deleteQuote: (id) =>
                set((state) => ({
                    quotes: state.quotes.filter((quote) => quote.id !== id),
                })),

            addInvoice: (invoice) =>
                set((state) => ({
                    invoices: [...state.invoices, invoice],
                })),

            updateInvoice: (id, invoice) =>
                set((state) => ({
                    invoices: state.invoices.map((entry) =>
                        entry.id === id ? { ...entry, ...invoice } : entry
                    ),
                })),

            deleteInvoice: (id) =>
                set((state) => ({
                    invoices: state.invoices.filter((invoice) => invoice.id !== id),
                })),

            addMowingEvent: (event) =>
                set((state) => ({
                    mowingEvents: [
                        ...state.mowingEvents,
                        { ...event, type: "mow", id: crypto.randomUUID(), date: new Date() },
                    ],
                })),

            addWateringEvent: (event) =>
                set((state) => ({
                    wateringEvents: [
                        ...state.wateringEvents,
                        { ...event, type: "water", id: crypto.randomUUID(), date: new Date() },
                    ],
                })),

            addFertilizingEvent: (event) =>
                set((state) => ({
                    fertilizingEvents: [
                        ...state.fertilizingEvents,
                        { ...event, type: "fertilize", id: crypto.randomUUID(), date: new Date() },
                    ],
                })),

            saveClientRoute: (clientId, screenshot, lat, lng, lawnBoundary, obstacles) => {
                set((state) => ({
                    clients: state.clients.map((c) =>
                        c.id === clientId ? { ...c, routeScreenshot: screenshot, lat, lng, lawnBoundary, obstacles } : c
                    ),
                }));
            },

            setHomeAddress: (address, lat, lng) =>
                set(() => ({ homeAddress: address, homeLat: lat, homeLng: lng })),

            updateProfile: (name, address, lat, lng) =>
                set((state) => ({
                    userName: name,
                    homeAddress: address,
                    ...(lat !== undefined && lng !== undefined ? { homeLat: lat, homeLng: lng } : {})
                })),

            saveHomeBoundary: (lawnBoundary, obstacles) =>
                set(() => ({ homeLawnBoundary: lawnBoundary, homeObstacles: obstacles })),

            // Business config
            setLaborRate: (rate) => set(() => ({ laborRate: rate })),
            setFuelCostPerKm: (rate) => set(() => ({ fuelCostPerKm: rate })),

            // Equipment tracking
            setActiveMowerProfile: (equipmentId) =>
                set(() => ({ activeMowerProfileId: equipmentId })),

            addEquipment: (eq) =>
                set((state) => ({
                    equipment: [
                        ...state.equipment,
                        { ...eq, id: crypto.randomUUID(), currentHours: 0 },
                    ],
                })),

            markServiceDone: (equipmentId, serviceId) =>
                set((state) => ({
                    equipment: state.equipment.map((e) =>
                        e.id === equipmentId
                            ? {
                                ...e,
                                serviceIntervals: e.serviceIntervals.map((si) =>
                                    si.id === serviceId
                                        ? { ...si, lastServiceHours: e.currentHours, lastServiceDate: new Date().toISOString() }
                                        : si
                                ),
                            }
                            : e
                    ),
                })),

            deleteEquipment: (id) =>
                set((state) => ({
                    equipment: state.equipment.filter((e) => e.id !== id),
                })),

            setPlannerSelectedClientIds: (ids) =>
                set(() => ({ plannerSelectedClientIds: ids })),

            setPlannerOptimizedRoute: (route) =>
                set(() => ({ plannerOptimizedRoute: route })),
        }),
        {
            name: 'mow-log-storage',
            onRehydrateStorage: () => {
                return (state, error) => {
                    if (error) {
                        console.error('STORE: Rehydration failed', error);
                        return;
                    }
                    if (state) {
                        // Use state.setHydrated to avoid circular reference to 'useStore'
                        state.setHydrated(true);
                    }
                };
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            migrate: (persistedState: any) => {
                // Handle migration from old activeSessionId to activeWorkdaySessionId
                if (persistedState && persistedState.activeSessionId !== undefined) {
                    persistedState.activeWorkdaySessionId = persistedState.activeSessionId;
                    delete persistedState.activeSessionId;

                    if (persistedState.sessions) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        persistedState.sessions = persistedState.sessions.map((s: any) => ({
                            ...s,
                            type: s.type || 'workday'
                        }));
                    }
                }

                // Seed default Toro mower for existing users with no equipment
                if (persistedState && Array.isArray(persistedState.equipment) && persistedState.equipment.length === 0) {
                    persistedState.equipment = [DEFAULT_TORO_75750];
                    persistedState.activeMowerProfileId = DEFAULT_TORO_75750.id;
                }

                // Ensure activeMowerProfileId exists (field added in this migration)
                if (persistedState && persistedState.activeMowerProfileId === undefined) {
                    const firstMower = persistedState.equipment?.find((e: Equipment) => e.type === 'mower');
                    persistedState.activeMowerProfileId = firstMower?.id ?? null;
                }

                if (persistedState && !Array.isArray(persistedState.quotes)) {
                    persistedState.quotes = [];
                }
                if (persistedState && Array.isArray(persistedState.quotes)) {
                    persistedState.quotes = persistedState.quotes.map((quote: Quote) => ({
                        ...quote,
                        hstApplied: quote.hstApplied ?? false,
                        hstAmount: quote.hstAmount ?? 0,
                    }));
                }

                if (persistedState && !Array.isArray(persistedState.invoices)) {
                    persistedState.invoices = [];
                }
                if (persistedState && Array.isArray(persistedState.invoices)) {
                    persistedState.invoices = persistedState.invoices.map((invoice: Invoice) => ({
                        ...invoice,
                        hstApplied: invoice.hstApplied ?? false,
                        hstAmount: invoice.hstAmount ?? 0,
                    }));
                }

                return persistedState;
            }
        }
    )
);
