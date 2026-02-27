import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    name: string;            // "Honda HRX217"
    type: 'mower' | 'trimmer' | 'blower' | 'other';
    currentHours: number;
    serviceIntervals: ServiceInterval[];
}

interface AppState {
    clients: Client[];
    sessions: Session[];
    gasLogs: GasLog[];
    maintenanceLogs: MaintenanceLog[];
    equipment: Equipment[];

    activeWorkdaySessionId: string | null;
    activeMowSessionId: string | null;

    // Home address for daily route optimization
    homeAddress: string;
    homeLat?: number;
    homeLng?: number;

    // Business config
    laborRate: number;       // $/hr — for profit calculations
    fuelCostPerKm: number;   // $/km — for route fuel estimates

    // Actions
    addClient: (client: Omit<Client, 'id' | 'createdAt'>) => void;
    updateClient: (id: string, client: Partial<Client>) => void;
    deleteClient: (id: string) => void;

    startWorkdaySession: () => void;
    endWorkdaySession: () => void;
    toggleWorkdayBreak: () => void;

    startMowSession: (clientId: string) => void;
    endMowSession: () => void;
    toggleMowBreak: () => void;
    toggleMowStuck: () => void;

    addGasLog: (log: Omit<GasLog, 'id' | 'date'>) => void;
    addMaintenanceLog: (log: Omit<MaintenanceLog, 'id' | 'date' | 'totalCost'>) => void;

    // Route features
    saveClientRoute: (clientId: string, screenshot: string, lat: number, lng: number) => void;
    setHomeAddress: (address: string, lat: number, lng: number) => void;

    // Business config
    setLaborRate: (rate: number) => void;
    setFuelCostPerKm: (rate: number) => void;

    // Equipment tracking
    addEquipment: (eq: Omit<Equipment, 'id' | 'currentHours'>) => void;
    markServiceDone: (equipmentId: string, serviceId: string) => void;
    deleteEquipment: (id: string) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            clients: [],
            sessions: [],
            gasLogs: [],
            maintenanceLogs: [],
            equipment: [],
            activeWorkdaySessionId: null,
            activeMowSessionId: null,
            homeAddress: '',
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

            startMowSession: (clientId) =>
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

            saveClientRoute: (clientId, screenshot, lat, lng) =>
                set((state) => ({
                    clients: state.clients.map((c) =>
                        c.id === clientId ? { ...c, routeScreenshot: screenshot, lat, lng } : c
                    ),
                })),

            setHomeAddress: (address, lat, lng) =>
                set(() => ({ homeAddress: address, homeLat: lat, homeLng: lng })),

            // Business config
            setLaborRate: (rate) => set(() => ({ laborRate: rate })),
            setFuelCostPerKm: (rate) => set(() => ({ fuelCostPerKm: rate })),

            // Equipment tracking
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
        }),
        {
            name: 'mow-log-storage',
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
                return persistedState;
            }
        }
    )
);
