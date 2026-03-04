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

const MIN_STRIPE_LENGTH_M = 0.5; // Minimum stripe length — filters boundary artifacts

// ────────────────────────────────────────────────────
// CLIPPING: Get segments of a line that are INSIDE a polygon
// Uses turf.lineSplit for robust boundary intersection
// ────────────────────────────────────────────────────
function clipLineToPolygon(
    line: Feature<LineString>,
    polygon: Feature<Polygon>
): Feature<LineString>[] {
    const results: Feature<LineString>[] = [];
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const boundary = turf.polygonToLine(polygon as any);

        // Split the scan line at every boundary intersection
        let segments: Feature<LineString>[] = [];
        if (boundary.type === "Feature") {
            const split = turf.lineSplit(line, boundary);
            segments = split.features as Feature<LineString>[];
        } else if (boundary.type === "FeatureCollection") {
            // Multi-ring polygon — split against each ring and collect
            let working: Feature<LineString>[] = [line];
            for (const ring of boundary.features) {
                const next: Feature<LineString>[] = [];
                for (const seg of working) {
                    const split = turf.lineSplit(seg, ring as Feature<LineString>);
                    if (split.features.length > 0) {
                        next.push(...(split.features as Feature<LineString>[]));
                    } else {
                        next.push(seg);
                    }
                }
                working = next;
            }
            segments = working;
        }

        // If no splits occurred, test if the entire line is inside
        if (segments.length === 0) {
            const mid = turf.midpoint(
                turf.point(line.geometry.coordinates[0]),
                turf.point(line.geometry.coordinates[line.geometry.coordinates.length - 1])
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (turf.booleanPointInPolygon(mid, polygon as any)) {
                segments = [line];
            } else {
                return results;
            }
        }

        // Keep only segments whose centroid lies inside the polygon
        for (const seg of segments) {
            const coords = seg.geometry.coordinates;
            if (coords.length < 2) continue;

            const mid: Position = [
                (coords[0][0] + coords[coords.length - 1][0]) / 2,
                (coords[0][1] + coords[coords.length - 1][1]) / 2,
            ];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (turf.booleanPointInPolygon(mid, polygon as any)) {
                const len = turf.length(seg, { units: "meters" });
                if (len >= MIN_STRIPE_LENGTH_M) {
                    results.push(turf.lineString(coords, seg.properties));
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

    const rawStripes: Feature<LineString>[] = [];

    for (let i = Math.floor(-numLines / 2); i <= Math.ceil(numLines / 2); i++) {
        const off = i * spacing;
        const mLon = center[0] + off * perpDx * lonPerM;
        const mLat = center[1] + off * perpDy * latPerM;

        const p1: Position = [mLon - halfLen * sDx * lonPerM, mLat - halfLen * sDy * latPerM];
        const p2: Position = [mLon + halfLen * sDx * lonPerM, mLat + halfLen * sDy * latPerM];

        const scanLine = turf.lineString([p1, p2]);
        const clipped = clipLineToPolygon(scanLine, cell);
        rawStripes.push(...clipped);
    }

    // ── Smart fragment filtering ──
    // Remove tiny artifacts near zone boundaries while preserving
    // legitimate short stripes at tapered lawn edges
    const stripes = filterFragments(rawStripes);

    // Boustrophedon: reverse every other stripe
    return stripes.map((s, idx) => {
        const coords = idx % 2 === 1
            ? s.geometry.coordinates.slice().reverse()
            : s.geometry.coordinates;
        return turf.lineString(coords, { type: "stripe", index: idx });
    });
}

// ────────────────────────────────────────────────────
// FRAGMENT FILTER: Remove tiny stripe artifacts while
// preserving legitimate short stripes at lawn edges
// ────────────────────────────────────────────────────
function filterFragments(
    stripes: Feature<LineString>[]
): Feature<LineString>[] {
    if (stripes.length <= 2) return stripes;

    const lengths = stripes.map(s => turf.length(s, { units: "meters" }));
    const sorted = [...lengths].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Keep stripes that are at least 10% of the median length,
    // OR at least 1 meter (to preserve legitimate short edge stripes)
    const threshold = Math.min(median * 0.1, 1.0);

    return stripes.filter((_, i) => lengths[i] >= threshold);
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
    // Build full mowable polygon for final stripe clipping
    const mowablePoly = buildMowablePolygon(lawnPolygon, obstacles);

    for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        const cellArea = turf.area(cell);

        if (cellArea < 3) continue; // Skip tiny slivers

        // Headlands per cell
        const { headlands, inner } = generateHeadlands(cell, cfg);
        allHeadlands.push(...headlands);

        if (!inner) continue;

        // Expand cell boundary slightly for inter-cell overlap
        // This ensures no unmowed strips at zone boundaries
        const overlapBuffer = cfg.deckWidthMeters * 0.6;
        let stripeRegion: Feature<Polygon> = inner;
        try {
            const expanded = turf.buffer(inner, overlapBuffer, { units: "meters" });
            if (expanded && expanded.geometry.type === "Polygon") {
                // Clip expanded region to the lawn boundary (don't spill outside)
                const clipped = turf.intersect(turf.featureCollection([expanded as Feature<Polygon>, lawnPolygon]));
                if (clipped && clipped.geometry.type === "Polygon") {
                    stripeRegion = clipped as Feature<Polygon>;
                }
            }
        } catch { /* fall back to original inner */ }

        // Find best angle for THIS cell (using expanded region)
        const { angle, stripes: rawStripes } = findBestAngle(stripeRegion, cfg);

        // Clip stripes to mowable area (prevent overlap into obstacles)
        const stripes: Feature<LineString>[] = [];
        for (const stripe of rawStripes) {
            if (mowablePoly) {
                const clipped = clipLineToPolygon(stripe, mowablePoly);
                stripes.push(...clipped);
            } else {
                stripes.push(stripe);
            }
        }

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

// ────────────────────────────────────────────────────
// Build the full mowable polygon (lawn minus obstacles)
// Used to clip expanded stripes so they don't enter obstacles
// ────────────────────────────────────────────────────
function buildMowablePolygon(
    lawn: Feature<Polygon>,
    obstacles: Feature<Polygon>[]
): Feature<Polygon> | null {
    if (obstacles.length === 0) return lawn;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = lawn;
    for (const obs of obstacles) {
        try {
            const diff = turf.difference(turf.featureCollection([result as Feature<Polygon>, obs]));
            if (diff) result = diff;
        } catch { /* skip */ }
    }

    if (result.geometry.type === "Polygon") return result as Feature<Polygon>;
    if (result.geometry.type === "MultiPolygon") {
        // Return largest polygon
        let best = 0, bestArea = 0;
        result.geometry.coordinates.forEach((ring: Position[][], idx: number) => {
            const a = turf.area(turf.polygon(ring));
            if (a > bestArea) { bestArea = a; best = idx; }
        });
        return turf.polygon(result.geometry.coordinates[best]) as Feature<Polygon>;
    }
    return lawn;
}
