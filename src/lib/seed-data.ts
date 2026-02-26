/**
 * Mock/Seed Data for Testing
 *
 * Populates the app with realistic lawn care data:
 * - 10 clients (mix of Regular & PerCut billing)
 * - ~30 completed mow sessions across the past 14 days
 * - 4 gas logs
 * - 2 maintenance events
 * - 1 mower with service intervals partly used
 * - Home address set
 */

import type { Client, Session, GasLog, MaintenanceLog, Equipment } from './store';

// Deterministic UUIDs for reproducibility
const cid = (n: number) => `mock-client-${n.toString().padStart(3, '0')}`;
const sid = (n: number) => `mock-session-${n.toString().padStart(3, '0')}`;

function daysAgo(d: number, hour = 9, min = 0): string {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    dt.setHours(hour, min, 0, 0);
    return dt.toISOString();
}

function addMinutes(iso: string, mins: number): string {
    return new Date(new Date(iso).getTime() + mins * 60000).toISOString();
}

// ── Clients ──────────────────────────────────────

const mockClients: Client[] = [
    {
        id: cid(1), name: 'Garcia Family', address: '142 Palm Ave, Orlando, FL',
        phone: '407-555-0101', sqft: '4500', billingType: 'Regular', amount: 180,
        notes: 'Large backyard with pool area', createdAt: daysAgo(60),
        lat: 28.5383, lng: -81.3792,
    },
    {
        id: cid(2), name: 'Johnson Residence', address: '88 Magnolia Dr, Orlando, FL',
        phone: '407-555-0102', sqft: '3200', billingType: 'PerCut', amount: 45,
        notes: 'Weekly service preferred', createdAt: daysAgo(55),
        lat: 28.5421, lng: -81.3756,
    },
    {
        id: cid(3), name: 'The Patels', address: '210 Lake Shore Blvd, Orlando, FL',
        phone: '407-555-0103', sqft: '5800', billingType: 'Regular', amount: 250,
        notes: 'Corner lot, extra edging needed', createdAt: daysAgo(50),
        lat: 28.5350, lng: -81.3830,
    },
    {
        id: cid(4), name: 'Williams Estate', address: '77 Oak Trail, Winter Park, FL',
        phone: '407-555-0104', sqft: '7200', billingType: 'Regular', amount: 320,
        notes: 'High-end property. Be careful with flower beds.', createdAt: daysAgo(45),
        lat: 28.5990, lng: -81.3393,
    },
    {
        id: cid(5), name: 'Chen House', address: '305 Cypress Ct, Orlando, FL',
        phone: '407-555-0105', sqft: '2800', billingType: 'PerCut', amount: 35,
        notes: 'Small front yard only', createdAt: daysAgo(42),
        lat: 28.5310, lng: -81.3880,
    },
    {
        id: cid(6), name: 'Martinez Property', address: '19 Sunset Ridge, Kissimmee, FL',
        phone: '407-555-0106', sqft: '4000', billingType: 'PerCut', amount: 50,
        notes: 'Bi-weekly schedule', createdAt: daysAgo(38),
        lat: 28.2920, lng: -81.4076,
    },
    {
        id: cid(7), name: 'Thompson Duplex', address: '456 Pine Hill Rd, Orlando, FL',
        phone: '407-555-0107', sqft: '3600', billingType: 'Regular', amount: 200,
        notes: 'Both units, front and back', createdAt: daysAgo(35),
        lat: 28.5455, lng: -81.3680,
    },
    {
        id: cid(8), name: 'Rivera Bungalow', address: '823 Hibiscus Ln, Orlando, FL',
        phone: '407-555-0108', sqft: '2400', billingType: 'PerCut', amount: 30,
        notes: 'Watch for garden gnomes', createdAt: daysAgo(30),
        lat: 28.5290, lng: -81.3920,
    },
    {
        id: cid(9), name: 'Baker Ranch', address: '1100 Country Club Dr, Windermere, FL',
        phone: '407-555-0109', sqft: '9000', billingType: 'Regular', amount: 400,
        notes: 'Largest property — budget 90 min', createdAt: daysAgo(28),
        lat: 28.4945, lng: -81.5338,
    },
    {
        id: cid(10), name: 'Nguyen Townhome', address: '62 Jasmine Way, Orlando, FL',
        phone: '407-555-0110', sqft: '1800', billingType: 'PerCut', amount: 28,
        notes: 'Quick job, mostly front', createdAt: daysAgo(25),
        lat: 28.5405, lng: -81.3715,
    },
];

// ── Sessions ─────────────────────────────────────
// Simulate ~2-4 client mows per day over the past 14 days

interface SessionSeed {
    day: number;  // days ago
    clientIdx: number; // 1-10
    startHour: number;
    durationMin: number;
    breakMin: number;
}

const sessionSeeds: SessionSeed[] = [
    // Day 1 (yesterday)
    { day: 1, clientIdx: 1, startHour: 8, durationMin: 55, breakMin: 5 },
    { day: 1, clientIdx: 2, startHour: 9.5, durationMin: 35, breakMin: 0 },
    { day: 1, clientIdx: 10, startHour: 10.5, durationMin: 22, breakMin: 0 },
    // Day 2
    { day: 2, clientIdx: 4, startHour: 8, durationMin: 80, breakMin: 10 },
    { day: 2, clientIdx: 7, startHour: 10, durationMin: 45, breakMin: 5 },
    { day: 2, clientIdx: 5, startHour: 11.5, durationMin: 25, breakMin: 0 },
    // Day 3
    { day: 3, clientIdx: 3, startHour: 8.5, durationMin: 65, breakMin: 5 },
    { day: 3, clientIdx: 6, startHour: 10.5, durationMin: 50, breakMin: 5 },
    // Day 4
    { day: 4, clientIdx: 9, startHour: 7.5, durationMin: 95, breakMin: 15 },
    { day: 4, clientIdx: 8, startHour: 10, durationMin: 28, breakMin: 0 },
    // Day 5
    { day: 5, clientIdx: 1, startHour: 8, durationMin: 50, breakMin: 5 },
    { day: 5, clientIdx: 2, startHour: 9.5, durationMin: 38, breakMin: 0 },
    { day: 5, clientIdx: 7, startHour: 10.5, durationMin: 42, breakMin: 5 },
    // Day 7
    { day: 7, clientIdx: 4, startHour: 8, durationMin: 78, breakMin: 10 },
    { day: 7, clientIdx: 3, startHour: 10, durationMin: 60, breakMin: 5 },
    { day: 7, clientIdx: 10, startHour: 11.5, durationMin: 20, breakMin: 0 },
    // Day 8
    { day: 8, clientIdx: 5, startHour: 8.5, durationMin: 30, breakMin: 0 },
    { day: 8, clientIdx: 6, startHour: 9.5, durationMin: 48, breakMin: 5 },
    { day: 8, clientIdx: 8, startHour: 11, durationMin: 26, breakMin: 0 },
    // Day 10
    { day: 10, clientIdx: 9, startHour: 7.5, durationMin: 92, breakMin: 12 },
    { day: 10, clientIdx: 1, startHour: 10, durationMin: 52, breakMin: 5 },
    // Day 11
    { day: 11, clientIdx: 2, startHour: 8, durationMin: 36, breakMin: 0 },
    { day: 11, clientIdx: 7, startHour: 9, durationMin: 44, breakMin: 5 },
    { day: 11, clientIdx: 4, startHour: 10.5, durationMin: 75, breakMin: 8 },
    // Day 13
    { day: 13, clientIdx: 3, startHour: 8, durationMin: 62, breakMin: 5 },
    { day: 13, clientIdx: 5, startHour: 9.5, durationMin: 28, breakMin: 0 },
    { day: 13, clientIdx: 10, startHour: 10.5, durationMin: 22, breakMin: 0 },
    { day: 13, clientIdx: 8, startHour: 11, durationMin: 25, breakMin: 0 },
    // Day 14
    { day: 14, clientIdx: 6, startHour: 8, durationMin: 52, breakMin: 5 },
    { day: 14, clientIdx: 9, startHour: 9.5, durationMin: 88, breakMin: 10 },
];

const mockSessions: Session[] = sessionSeeds.map((s, i) => {
    const start = daysAgo(s.day, Math.floor(s.startHour), (s.startHour % 1) * 60);
    return {
        id: sid(i + 1),
        type: 'address-mow' as const,
        clientId: cid(s.clientIdx),
        startTime: start,
        endTime: addMinutes(start, s.durationMin),
        breakTimeTotal: s.breakMin * 60,
        stuckTimeTotal: 0,
        status: 'completed' as const,
    };
});

// Also add a couple workday sessions
mockSessions.push(
    {
        id: 'mock-workday-001', type: 'workday', clientId: null,
        startTime: daysAgo(1, 7, 45), endTime: daysAgo(1, 15, 30),
        breakTimeTotal: 1800, status: 'completed',
    },
    {
        id: 'mock-workday-002', type: 'workday', clientId: null,
        startTime: daysAgo(2, 7, 30), endTime: daysAgo(2, 14, 45),
        breakTimeTotal: 2400, status: 'completed',
    },
);

// ── Gas Logs ─────────────────────────────────────

const mockGasLogs: GasLog[] = [
    { id: 'mock-gas-001', date: daysAgo(1), liters: 18.5, pricePerLiter: 1.42, total: 26.27, isAiScanned: false },
    { id: 'mock-gas-002', date: daysAgo(5), liters: 22.0, pricePerLiter: 1.38, total: 30.36, isAiScanned: false },
    { id: 'mock-gas-003', date: daysAgo(9), liters: 15.8, pricePerLiter: 1.45, total: 22.91, isAiScanned: true },
    { id: 'mock-gas-004', date: daysAgo(13), liters: 20.2, pricePerLiter: 1.40, total: 28.28, isAiScanned: false },
];

// ── Maintenance Logs ─────────────────────────────

const mockMaintenanceLogs: MaintenanceLog[] = [
    {
        id: 'mock-maint-001', date: daysAgo(6),
        description: 'Replaced mower blades — they were getting dull',
        parts: [
            { id: 'mp-001', name: 'Blade Set (Honda)', cost: 32.99 },
            { id: 'mp-002', name: 'Blade Bolt Kit', cost: 8.50 },
        ],
        totalCost: 41.49,
    },
    {
        id: 'mock-maint-002', date: daysAgo(12),
        description: 'Oil change & air filter replacement',
        parts: [
            { id: 'mp-003', name: 'SAE 10W-30 Oil', cost: 12.99 },
            { id: 'mp-004', name: 'Air Filter', cost: 9.99 },
        ],
        totalCost: 22.98,
    },
];

// ── Equipment ────────────────────────────────────

// Total mow time from sessions ≈ 1420 min ≈ 23.7 hours
const totalMowHours = sessionSeeds.reduce((acc, s) => acc + (s.durationMin - s.breakMin), 0) / 60;

const mockEquipment: Equipment[] = [
    {
        id: 'mock-eq-001',
        name: 'Honda HRX217',
        type: 'mower',
        currentHours: Math.round(totalMowHours * 10) / 10,
        serviceIntervals: [
            {
                id: 'mock-si-001', name: 'Blade Sharpening',
                intervalHours: 25, lastServiceHours: 0,
                lastServiceDate: daysAgo(6),
            },
            {
                id: 'mock-si-002', name: 'Oil Change',
                intervalHours: 50, lastServiceHours: 0,
                lastServiceDate: daysAgo(12),
            },
            {
                id: 'mock-si-003', name: 'Air Filter',
                intervalHours: 100, lastServiceHours: 0,
                lastServiceDate: daysAgo(12),
            },
        ],
    },
    {
        id: 'mock-eq-002',
        name: 'STIHL FS 91 R',
        type: 'trimmer',
        currentHours: 8.4,
        serviceIntervals: [
            {
                id: 'mock-si-004', name: 'Spark Plug',
                intervalHours: 75, lastServiceHours: 0,
                lastServiceDate: daysAgo(30),
            },
            {
                id: 'mock-si-005', name: 'Line Head Replace',
                intervalHours: 20, lastServiceHours: 0,
                lastServiceDate: daysAgo(15),
            },
        ],
    },
];

// ── Export seed function ─────────────────────────

export function getSeedData() {
    return {
        clients: mockClients,
        sessions: mockSessions,
        gasLogs: mockGasLogs,
        maintenanceLogs: mockMaintenanceLogs,
        equipment: mockEquipment,
        homeAddress: '500 S Orange Ave, Orlando, FL',
        homeLat: 28.5355,
        homeLng: -81.3790,
        laborRate: 25,
        fuelCostPerKm: 0.15,
    };
}
