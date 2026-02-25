/**
 * Smart Mowing Route Planner — v3 (Cell Decomposition)
 * 
 * Key improvement: Instead of striping the whole lawn as one piece,
 * we decompose the lawn (minus obstacles) into clean convex-ish cells,
 * then stripe each cell independently with its own optimal angle.
 * 
 * This produces clean, professional-looking stripes that stop/start
 * neatly at obstacles rather than getting fragmented.
 */
import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon, LineString, Position } from "geojson";

export type DischargeMode = "left" | "right" | "rear" | "mulch";

export interface MowerConfig {
    deckWidthMeters: number;
    discharge: DischargeMode;
    overlapRatio: number;
    headlandLaps: number;
}

export interface RoutePlan {
    headlands: Feature<LineString>[];
    stripes: Feature<LineString>[];
    bestAngleDeg: number;
    areaSqMeters: number;
    areaSqFeet: number;
    estimatedDistanceMeters: number;
    estimatedTimeMins: number;
    cellCount: number;
}

const DEFAULT_CONFIG: MowerConfig = {
    deckWidthMeters: 0.533,
    discharge: "right",
    overlapRatio: 0.93,
    headlandLaps: 1,
};

// ────────────────────────────────────────────────────
// CLIPPING: Get segments of a line that are INSIDE a polygon
// ────────────────────────────────────────────────────
function clipLineToPolygon(
    line: Feature<LineString>,
    polygon: Feature<Polygon>
): Feature<LineString>[] {
    const results: Feature<LineString>[] = [];
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const boundary = turf.polygonToLine(polygon as any);
        let intersectPts: Position[] = [];

        if (boundary.type === "Feature") {
            intersectPts = turf.lineIntersect(line, boundary).features.map(f => f.geometry.coordinates);
        } else if (boundary.type === "FeatureCollection") {
            for (const feat of boundary.features) {
                intersectPts.push(...turf.lineIntersect(line, feat).features.map(f => f.geometry.coordinates));
            }
        }

        if (intersectPts.length < 2) return results;

        // Sort along line direction
        const origin = line.geometry.coordinates[0];
        const dx = line.geometry.coordinates[1][0] - origin[0];
        const dy = line.geometry.coordinates[1][1] - origin[1];
        intersectPts.sort((a, b) => {
            const projA = (a[0] - origin[0]) * dx + (a[1] - origin[1]) * dy;
            const projB = (b[0] - origin[0]) * dx + (b[1] - origin[1]) * dy;
            return projA - projB;
        });

        // Keep segments whose midpoint is inside the polygon
        for (let i = 0; i < intersectPts.length - 1; i++) {
            const p1 = intersectPts[i];
            const p2 = intersectPts[i + 1];
            const mid: Position = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (turf.booleanPointInPolygon(mid, polygon as any)) {
                const seg = turf.lineString([p1, p2]);
                if (turf.length(seg, { units: "meters" }) >= 0.3) {
                    results.push(seg);
                }
            }
        }
    } catch (e) {
        console.warn("clipLineToPolygon:", e);
    }
    return results;
}

// ────────────────────────────────────────────────────
// HEADLANDS: Inward buffer loops around each cell
// ────────────────────────────────────────────────────
function generateHeadlands(
    poly: Feature<Polygon>,
    config: MowerConfig
): { headlands: Feature<LineString>[]; inner: Feature<Polygon> | null } {
    const headlands: Feature<LineString>[] = [];
    let current: Feature<Polygon> = poly;

    for (let i = 0; i < config.headlandLaps; i++) {
        try {
            const buffered = turf.buffer(current, -(config.deckWidthMeters * 0.8), { units: "meters" });
            if (!buffered) break;

            if (buffered.geometry.type === "Polygon") {
                const coords = buffered.geometry.coordinates[0];
                if (coords.length >= 4) {
                    headlands.push(turf.lineString(coords, { type: "headland", lap: i }));
                }
                current = buffered as Feature<Polygon>;
            } else if (buffered.geometry.type === "MultiPolygon") {
                // Take largest sub-polygon
                let best = 0, bestArea = 0;
                buffered.geometry.coordinates.forEach((ring, idx) => {
                    const a = turf.area(turf.polygon(ring));
                    if (a > bestArea) { bestArea = a; best = idx; }
                });
                const coords = buffered.geometry.coordinates[best][0];
                if (coords.length >= 4) {
                    headlands.push(turf.lineString(coords, { type: "headland", lap: i }));
                }
                current = turf.polygon(buffered.geometry.coordinates[best]) as Feature<Polygon>;
            } else break;
        } catch { break; }
    }

    return { headlands, inner: current };
}

// ────────────────────────────────────────────────────
// STRIPES: Generate parallel stripes inside a single convex-ish cell
// ────────────────────────────────────────────────────
function stripeSingleCell(
    cell: Feature<Polygon>,
    angleDeg: number,
    config: MowerConfig
): Feature<LineString>[] {
    const bbox = turf.bbox(cell);
    const center = turf.center(cell).geometry.coordinates;
    const spacing = config.deckWidthMeters * config.overlapRatio;
    const diagonal = turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[3]], { units: "meters" });
    const numLines = Math.ceil(diagonal / spacing) + 4;
    const halfLen = diagonal / 2 + 15;

    const angleRad = (angleDeg * Math.PI) / 180;
    const latPerM = 1 / 111320;
    const lonPerM = 1 / (111320 * Math.cos((center[1] * Math.PI) / 180));

    const perpDx = Math.cos(angleRad + Math.PI / 2);
    const perpDy = Math.sin(angleRad + Math.PI / 2);
    const sDx = Math.cos(angleRad);
    const sDy = Math.sin(angleRad);

    const stripes: Feature<LineString>[] = [];

    for (let i = Math.floor(-numLines / 2); i <= Math.ceil(numLines / 2); i++) {
        const off = i * spacing;
        const mLon = center[0] + off * perpDx * lonPerM;
        const mLat = center[1] + off * perpDy * latPerM;

        const p1: Position = [mLon - halfLen * sDx * lonPerM, mLat - halfLen * sDy * latPerM];
        const p2: Position = [mLon + halfLen * sDx * lonPerM, mLat + halfLen * sDy * latPerM];

        const scanLine = turf.lineString([p1, p2]);
        const clipped = clipLineToPolygon(scanLine, cell);
        stripes.push(...clipped);
    }

    // Boustrophedon: reverse every other stripe
    return stripes.map((s, idx) => {
        const coords = idx % 2 === 1
            ? s.geometry.coordinates.slice().reverse()
            : s.geometry.coordinates;
        return turf.lineString(coords, { type: "stripe", index: idx });
    });
}

// ────────────────────────────────────────────────────
// ANGLE OPTIMIZATION: Find the best angle for a cell
// ────────────────────────────────────────────────────
function findBestAngle(
    cell: Feature<Polygon>,
    config: MowerConfig
): { angle: number; stripes: Feature<LineString>[] } {
    // Test angles aligned to the cell's edges + standard angles
    const candidates = new Set<number>();

    // Add standard angles
    [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165].forEach(a => candidates.add(a));

    // Add angles aligned to cell edges (these often produce the cleanest stripes)
    const coords = cell.geometry.coordinates[0];
    for (let i = 0; i < coords.length - 1; i++) {
        const bearing = turf.bearing(coords[i], coords[i + 1]);
        const normalized = ((bearing % 180) + 180) % 180; // 0-180 range
        candidates.add(Math.round(normalized));
    }

    let bestScore = -Infinity;
    let bestStripes: Feature<LineString>[] = [];
    let bestAngle = 0;

    for (const angle of candidates) {
        const stripes = stripeSingleCell(cell, angle, config);
        if (stripes.length === 0) continue;

        // Score: longest average stripe = cleanest pattern
        const lengths = stripes.map(s => turf.length(s, { units: "meters" }));
        const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const shortPenalty = lengths.filter(l => l < 1.5).length * 3;
        const score = avgLen * 10 + stripes.length * 0.5 - shortPenalty;

        if (score > bestScore) {
            bestScore = score;
            bestStripes = stripes;
            bestAngle = angle;
        }
    }

    return { angle: bestAngle, stripes: bestStripes };
}

// ────────────────────────────────────────────────────
// CELL DECOMPOSITION: Split lawn (with holes) into stripe-friendly cells
// Uses vertical slicing at obstacle edges
// ────────────────────────────────────────────────────
function decomposeIntoCells(
    lawnWithHoles: Feature<Polygon>,
    obstacles: Feature<Polygon>[]
): Feature<Polygon>[] {
    // First: subtract all obstacles from the lawn
    let mowable: Feature<Polygon> | Feature<MultiPolygon> = lawnWithHoles;

    for (const obs of obstacles) {
        try {
            const diff = turf.difference(turf.featureCollection([mowable as Feature<Polygon>, obs]));
            if (diff) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                mowable = diff as any;
            }
        } catch (e) {
            console.warn("Obstacle subtraction failed:", e);
        }
    }

    // Extract individual polygons (if MultiPolygon from obstacle cuts)
    const cells: Feature<Polygon>[] = [];

    if (mowable.geometry.type === "Polygon") {
        cells.push(mowable as Feature<Polygon>);
    } else if (mowable.geometry.type === "MultiPolygon") {
        for (const ring of mowable.geometry.coordinates) {
            try {
                const poly = turf.polygon(ring);
                const a = turf.area(poly);
                if (a > 1) { // Skip tiny slivers (< 1 m²)
                    cells.push(poly as Feature<Polygon>);
                }
            } catch { /* skip invalid */ }
        }
    }

    // If we only have one cell but it's concave, try to split it
    // using vertical slices at obstacle-derived x-coordinates
    if (cells.length === 1 && obstacles.length > 0) {
        const splitCells = splitCellVertically(cells[0], obstacles);
        if (splitCells.length > 1) return splitCells;
    }

    return cells;
}

// Split a cell vertically at obstacle edge x-coordinates
function splitCellVertically(
    cell: Feature<Polygon>,
    obstacles: Feature<Polygon>[]
): Feature<Polygon>[] {
    const bbox = turf.bbox(cell);
    const splitXCoords: number[] = [];

    // Collect x-coordinates from obstacle edges
    for (const obs of obstacles) {
        const obsBbox = turf.bbox(obs);
        splitXCoords.push(obsBbox[0]); // left edge
        splitXCoords.push(obsBbox[2]); // right edge
    }

    // Filter to x-coords within cell bounds, sorted
    const validXs = [...new Set(splitXCoords)]
        .filter(x => x > bbox[0] + 0.00001 && x < bbox[2] - 0.00001)
        .sort((a, b) => a - b);

    if (validXs.length === 0) return [cell];

    // Create vertical slice lines and split the cell
    const cells: Feature<Polygon>[] = [];
    let remaining = cell;

    for (const x of validXs) {
        try {
            // Create a vertical cutting line through the entire height
            const cutLine: Position[] = [
                [x, bbox[1] - 0.001],
                [x, bbox[3] + 0.001],
            ];

            // Split using a thin rectangle as a cutting blade
            const epsilon = 0.0000001;
            const blade = turf.polygon([[
                [x - epsilon, bbox[1] - 0.01],
                [x + epsilon, bbox[1] - 0.01],
                [x + epsilon, bbox[3] + 0.01],
                [x - epsilon, bbox[3] + 0.01],
                [x - epsilon, bbox[1] - 0.01],
            ]]);

            const left = turf.intersect(turf.featureCollection([
                remaining,
                turf.bboxPolygon([bbox[0], bbox[1], x, bbox[3]])
            ]));
            const right = turf.intersect(turf.featureCollection([
                remaining,
                turf.bboxPolygon([x, bbox[1], bbox[2], bbox[3]])
            ]));

            if (left && right) {
                if (left.geometry.type === "Polygon") {
                    const a = turf.area(left);
                    if (a > 2) cells.push(left as Feature<Polygon>);
                } else if (left.geometry.type === "MultiPolygon") {
                    for (const ring of left.geometry.coordinates) {
                        const p = turf.polygon(ring);
                        if (turf.area(p) > 2) cells.push(p as Feature<Polygon>);
                    }
                }
                // Continue splitting with the right portion
                if (right.geometry.type === "Polygon") {
                    remaining = right as Feature<Polygon>;
                } else if (right.geometry.type === "MultiPolygon") {
                    // Take the largest piece as remaining
                    let best = 0, bestA = 0;
                    right.geometry.coordinates.forEach((r, i) => {
                        const a = turf.area(turf.polygon(r));
                        if (a > bestA) { bestA = a; best = i; }
                    });
                    remaining = turf.polygon(right.geometry.coordinates[best]) as Feature<Polygon>;
                    // Add other pieces as separate cells
                    right.geometry.coordinates.forEach((r, i) => {
                        if (i !== best) {
                            const p = turf.polygon(r);
                            if (turf.area(p) > 2) cells.push(p as Feature<Polygon>);
                        }
                    });
                }
            }
        } catch { /* skip failed splits */ }
    }

    // Add whatever remains
    if (turf.area(remaining) > 2) cells.push(remaining);

    return cells.length > 0 ? cells : [cell];
}

// ────────────────────────────────────────────────────
// MAIN: Plan the mowing route
// ────────────────────────────────────────────────────
export function planMowingRoute(
    lawnPolygon: Feature<Polygon>,
    obstacles: Feature<Polygon>[] = [],
    config: Partial<MowerConfig> = {}
): RoutePlan {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const area = turf.area(lawnPolygon);

    console.log("[Route v3] Starting — obstacles:", obstacles.length);

    // 1. Decompose into cells
    const cells = decomposeIntoCells(lawnPolygon, obstacles);
    console.log("[Route v3] Cells:", cells.length);

    const allHeadlands: Feature<LineString>[] = [];
    const allStripes: Feature<LineString>[] = [];
    let globalBestAngle = 0;

    // 2. Process each cell independently
    for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        const cellArea = turf.area(cell);

        if (cellArea < 3) continue; // Skip tiny slivers

        // Headlands per cell
        const { headlands, inner } = generateHeadlands(cell, cfg);
        allHeadlands.push(...headlands);

        if (!inner) continue;

        // Find best angle for THIS cell
        const { angle, stripes } = findBestAngle(inner, cfg);
        console.log(`[Route v3] Cell ${c}: area=${cellArea.toFixed(0)}m², angle=${angle}°, stripes=${stripes.length}`);

        allStripes.push(...stripes);
        if (c === 0) globalBestAngle = angle;
    }

    // 3. Calculate totals
    const headDist = allHeadlands.reduce((s, h) => s + turf.length(h, { units: "meters" }), 0);
    const stripeDist = allStripes.reduce((s, st) => s + turf.length(st, { units: "meters" }), 0);
    const totalDist = headDist + stripeDist;

    console.log(`[Route v3] Total: ${allHeadlands.length} headlands, ${allStripes.length} stripes, ${totalDist.toFixed(0)}m`);

    return {
        headlands: allHeadlands,
        stripes: allStripes,
        bestAngleDeg: globalBestAngle,
        areaSqMeters: area,
        areaSqFeet: area * 10.7639,
        estimatedDistanceMeters: totalDist,
        estimatedTimeMins: totalDist / 83,
        cellCount: cells.length,
    };
}

export function deckWidthFromInches(inches: number): number {
    return inches * 0.0254;
}
