/**
 * Shared Derived Selectors — Cross-Tab Data Layer
 *
 * Centralized computations for profit, client summaries, equipment alerts.
 * Import from any page to avoid duplicating logic.
 * All selectors read from the single Zustand store.
 */

import { useStore, type Client, type Session } from './store';
import { useShallow } from 'zustand/shallow';

// ── Helpers ──────────────────────────────────────

function getNetMowSeconds(session: Session): number {
    if (!session.endTime) return 0;
    const dur = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000;
    return Math.max(0, dur - (session.breakTimeTotal || 0) - (session.stuckTimeTotal || 0));
}

function isSameDay(d1: string, d2: string): boolean {
    return d1.slice(0, 10) === d2.slice(0, 10);
}

// ── Client Profit ────────────────────────────────

export interface ClientProfitData {
    revenue: number;
    allocatedGas: number;
    allocatedMaint: number;
    profit: number;
    profitMargin: number; // 0-100
    hourlyRate: number;   // $/hr after costs
}

export function computeClientProfit(clientId: string): ClientProfitData {
    const state = useStore.getState();
    const { clients, sessions, gasLogs, maintenanceLogs } = state;

    const client = clients.find((c) => c.id === clientId);
    if (!client) return { revenue: 0, allocatedGas: 0, allocatedMaint: 0, profit: 0, profitMargin: 0, hourlyRate: 0 };

    // Completed mow sessions for this client
    const clientMows = sessions.filter(
        (s) => s.type === 'address-mow' && s.clientId === clientId && s.status === 'completed' && s.endTime
    );
    const clientMowSec = clientMows.reduce((sum, s) => sum + getNetMowSeconds(s), 0);

    // Total mow seconds across all clients (for proportional allocation)
    const allMows = sessions.filter(
        (s) => s.type === 'address-mow' && s.status === 'completed' && s.endTime
    );
    const totalMowSec = allMows.reduce((sum, s) => sum + getNetMowSeconds(s), 0);

    // Revenue
    const revenue = client.billingType === 'Regular' ? client.amount : client.amount * clientMows.length;

    // Proportional cost allocation (by mowing time share)
    const share = totalMowSec > 0 ? clientMowSec / totalMowSec : 0;
    const totalGasCost = gasLogs.reduce((sum, g) => sum + g.total, 0);
    const totalMaintCost = maintenanceLogs.reduce((sum, m) => sum + m.totalCost, 0);

    const allocatedGas = totalGasCost * share;
    const allocatedMaint = totalMaintCost * share;
    const profit = revenue - allocatedGas - allocatedMaint;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const hourlyRate = clientMowSec > 0 ? profit / (clientMowSec / 3600) : 0;

    return { revenue, allocatedGas, allocatedMaint, profit, profitMargin, hourlyRate };
}

// ── Hook version for components ──────────────────

export function useClientProfit(clientId: string): ClientProfitData {
    return useStore(useShallow((state) => {
        const client = state.clients.find((c) => c.id === clientId);
        if (!client) return { revenue: 0, allocatedGas: 0, allocatedMaint: 0, profit: 0, profitMargin: 0, hourlyRate: 0 };

        const clientMows = state.sessions.filter(
            (s) => s.type === 'address-mow' && s.clientId === clientId && s.status === 'completed' && s.endTime
        );
        const clientMowSec = clientMows.reduce((sum, s) => sum + getNetMowSeconds(s), 0);

        const allMows = state.sessions.filter(
            (s) => s.type === 'address-mow' && s.status === 'completed' && s.endTime
        );
        const totalMowSec = allMows.reduce((sum, s) => sum + getNetMowSeconds(s), 0);

        const revenue = client.billingType === 'Regular' ? client.amount : client.amount * clientMows.length;
        const share = totalMowSec > 0 ? clientMowSec / totalMowSec : 0;
        const totalGasCost = state.gasLogs.reduce((sum, g) => sum + g.total, 0);
        const totalMaintCost = state.maintenanceLogs.reduce((sum, m) => sum + m.totalCost, 0);
        const allocatedGas = totalGasCost * share;
        const allocatedMaint = totalMaintCost * share;
        const profit = revenue - allocatedGas - allocatedMaint;
        const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
        const hourlyRate = clientMowSec > 0 ? profit / (clientMowSec / 3600) : 0;

        return { revenue, allocatedGas, allocatedMaint, profit, profitMargin, hourlyRate };
    }));
}

// ── Client Summary (for addresses page) ──────────

export interface ClientSummary {
    visits: number;
    totalMowSec: number;
    avgMowSec: number;
    lastMowDate: string | null;
    daysSinceLastMow: number | null;
    profit: ClientProfitData;
}

export function useClientSummary(clientId: string): ClientSummary {
    return useStore(useShallow((state) => {
        const mows = state.sessions.filter(
            (s) => s.type === 'address-mow' && s.clientId === clientId && s.status === 'completed' && s.endTime
        );
        const totalMowSec = mows.reduce((sum, s) => sum + getNetMowSeconds(s), 0);
        const avgMowSec = mows.length > 0 ? totalMowSec / mows.length : 0;

        // Last mow date
        const sorted = [...mows].sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());
        const lastMowDate = sorted[0]?.endTime ?? null;
        const daysSinceLastMow = lastMowDate
            ? Math.floor((Date.now() - new Date(lastMowDate).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        // Inline profit computation to avoid calling another hook
        const profit = computeClientProfit(clientId);

        return { visits: mows.length, totalMowSec, avgMowSec, lastMowDate, daysSinceLastMow, profit };
    }));
}

// ── Daily Profit (for logs page) ─────────────────

export interface DailyProfit {
    date: string;
    revenue: number;
    gasCost: number;
    maintCost: number;
    profit: number;
    sessionsCount: number;
}

export function useDailyProfit(dateStr: string): DailyProfit {
    return useStore(useShallow((state) => {
        const { clients, sessions, gasLogs, maintenanceLogs } = state;

        const dayMows = sessions.filter(
            (s) => s.type === 'address-mow' && s.status === 'completed' && s.endTime && isSameDay(s.startTime, dateStr)
        );

        let revenue = 0;
        dayMows.forEach((s) => {
            const client = clients.find((c) => c.id === s.clientId);
            if (client) {
                revenue += client.billingType === 'PerCut' ? client.amount : 0;
            }
        });
        // For regular billing, prorate by sessions this day / total sessions
        const totalMowCount = sessions.filter(
            (s) => s.type === 'address-mow' && s.status === 'completed'
        ).length;
        clients.filter((c) => c.billingType === 'Regular').forEach((c) => {
            if (totalMowCount > 0) {
                const dayClientMows = dayMows.filter((s) => s.clientId === c.id).length;
                revenue += (c.amount / totalMowCount) * dayClientMows;
            }
        });

        // Day's gas logs
        const gasCost = gasLogs
            .filter((g) => isSameDay(g.date, dateStr))
            .reduce((sum, g) => sum + g.total, 0);

        // Maintenance proportional to day (by count)
        const totalMaint = maintenanceLogs.reduce((sum, m) => sum + m.totalCost, 0);
        const totalDays = new Set(sessions.filter((s) => s.type === 'address-mow' && s.status === 'completed').map((s) => s.startTime.slice(0, 10))).size;
        const maintCost = totalDays > 0 ? totalMaint / totalDays : 0;

        const profit = revenue - gasCost - maintCost;

        return { date: dateStr, revenue, gasCost, maintCost, profit, sessionsCount: dayMows.length };
    }));
}

// ── Equipment Alerts ─────────────────────────────

export interface EquipmentAlert {
    equipmentId: string;
    equipmentName: string;
    serviceName: string;
    serviceId: string;
    hoursSinceService: number;
    intervalHours: number;
    isOverdue: boolean;
    urgencyPercent: number; // 0-100+, over 100 means overdue
}

export function useEquipmentAlerts(): EquipmentAlert[] {
    return useStore(useShallow((state) => {
        const alerts: EquipmentAlert[] = [];
        state.equipment.forEach((eq) => {
            eq.serviceIntervals.forEach((si) => {
                const hoursSince = eq.currentHours - si.lastServiceHours;
                const urgency = si.intervalHours > 0 ? (hoursSince / si.intervalHours) * 100 : 0;
                if (urgency >= 75) { // Alert when at 75%+ of interval
                    alerts.push({
                        equipmentId: eq.id,
                        equipmentName: eq.name,
                        serviceName: si.name,
                        serviceId: si.id,
                        hoursSinceService: hoursSince,
                        intervalHours: si.intervalHours,
                        isOverdue: hoursSince >= si.intervalHours,
                        urgencyPercent: urgency,
                    });
                }
            });
        });
        return alerts.sort((a, b) => b.urgencyPercent - a.urgencyPercent);
    }));
}
