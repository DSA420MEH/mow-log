/**
 * Daily Route Optimizer — Nearest-Neighbor TSP
 *
 * Solves the Traveling Salesman Problem using the nearest-neighbor heuristic:
 * Start at home → visit nearest unvisited client → repeat → return home.
 *
 * Uses Haversine formula for accurate geographic distance.
 * Pure client-side, no API needed.
 */

export interface RouteStop {
    clientId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    distanceFromPrevKm: number;
}

export interface OptimizedRoute {
    stops: RouteStop[];
    totalDistanceKm: number;
    estimatedFuelCost: number;   // totalDistanceKm × fuelCostPerKm
    estimatedFuelLiters: number; // based on ~8L/100km avg truck consumption
    googleMapsUrl: string;
}

// Haversine distance between two lat/lng points in kilometers
function haversineKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Average fuel consumption: 8L per 100km (reasonable truck/van estimate)
const FUEL_CONSUMPTION_L_PER_KM = 0.08;

export function optimizeRoute(
    homeLat: number,
    homeLng: number,
    clients: { clientId: string; name: string; address: string; lat: number; lng: number }[],
    fuelCostPerKm: number = 0.15
): OptimizedRoute {
    if (clients.length === 0) {
        return { stops: [], totalDistanceKm: 0, estimatedFuelCost: 0, estimatedFuelLiters: 0, googleMapsUrl: "" };
    }

    // Nearest-neighbor TSP
    const visited = new Set<number>();
    const stops: RouteStop[] = [];
    let currentLat = homeLat;
    let currentLng = homeLng;
    let totalDist = 0;

    while (visited.size < clients.length) {
        let nearestIdx = -1;
        let nearestDist = Infinity;

        for (let i = 0; i < clients.length; i++) {
            if (visited.has(i)) continue;
            const d = haversineKm(currentLat, currentLng, clients[i].lat, clients[i].lng);
            if (d < nearestDist) {
                nearestDist = d;
                nearestIdx = i;
            }
        }

        if (nearestIdx < 0) break;

        visited.add(nearestIdx);
        const c = clients[nearestIdx];
        stops.push({
            clientId: c.clientId,
            name: c.name,
            address: c.address,
            lat: c.lat,
            lng: c.lng,
            distanceFromPrevKm: nearestDist,
        });

        totalDist += nearestDist;
        currentLat = c.lat;
        currentLng = c.lng;
    }

    // Add return-home distance
    if (stops.length > 0) {
        const last = stops[stops.length - 1];
        totalDist += haversineKm(last.lat, last.lng, homeLat, homeLng);
    }

    // Build Google Maps URL (home → stops → home)
    const waypoints = stops.map(s => `${s.lat},${s.lng}`).join("/");
    const googleMapsUrl = `https://www.google.com/maps/dir/${homeLat},${homeLng}/${waypoints}/${homeLat},${homeLng}`;

    // Fuel estimates
    const estimatedFuelCost = totalDist * fuelCostPerKm;
    const estimatedFuelLiters = totalDist * FUEL_CONSUMPTION_L_PER_KM;

    return { stops, totalDistanceKm: totalDist, estimatedFuelCost, estimatedFuelLiters, googleMapsUrl };
}
