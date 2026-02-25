/**
 * Smart Mowing Route Planner — Core Algorithm (v2 - robust)
 * 
 * Generates optimal mowing paths for a given lawn polygon:
 * - Headland loops (perimeter passes) for clean edges
 * - Boustrophedon (serpentine) stripes with discharge awareness
 * - Obstacle avoidance
 * 
 * Uses Turf.js for all geospatial operations.
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
}

const DEFAULT_CONFIG: MowerConfig = {
    deckWidthMeters: 0.533,
    discharge: "right",
    overlapRatio: 0.93,
    headlandLaps: 2,
};

// ─── Clip Line to Polygon (robust method) ───────────
// Creates segments of the line that fall INSIDE the polygon
function clipLineToPolygon(
    line: Feature<LineString>,
    polygon: Feature<Polygon> | Feature<MultiPolygon>
): Feature<LineString>[] {
    const results: Feature<LineString>[] = [];

    try {
        // Convert polygon boundary to line(s), find intersections, then keep inside segments
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const polyBoundary = turf.polygonToLine(polygon as any);

        // Get intersection points between line and polygon boundary
        let intersectPts: Position[] = [];

        if (polyBoundary.type === "Feature") {
            const pts = turf.lineIntersect(line, polyBoundary);
            intersectPts = pts.features.map(f => f.geometry.coordinates);
        } else if (polyBoundary.type === "FeatureCollection") {
            for (const feat of polyBoundary.features) {
                const pts = turf.lineIntersect(line, feat);
                intersectPts.push(...pts.features.map(f => f.geometry.coordinates));
            }
        }

        if (intersectPts.length < 2) return results;

        // Sort intersection points along the line direction
        const lineStart = line.geometry.coordinates[0];
        intersectPts.sort((a, b) => {
            const distA = Math.hypot(a[0] - lineStart[0], a[1] - lineStart[1]);
            const distB = Math.hypot(b[0] - lineStart[0], b[1] - lineStart[1]);
            return distA - distB;
        });

        // Create segments between consecutive pairs and check if midpoint is inside polygon
        for (let i = 0; i < intersectPts.length - 1; i++) {
            const p1: Position = intersectPts[i];
            const p2: Position = intersectPts[i + 1];
            const midPoint = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inside = turf.booleanPointInPolygon(midPoint, polygon as any);
            if (inside) {
                const segment = turf.lineString([p1, p2]);
                const segLen = turf.length(segment, { units: "meters" });
                if (segLen >= 0.5) {
                    results.push(segment);
                }
            }
        }
    } catch (e) {
        console.warn("clipLineToPolygon error:", e);
    }

    return results;
}

// ─── Headland Generation ────────────────────────────
function generateHeadlands(
    lawn: Feature<Polygon>,
    config: MowerConfig
): { headlands: Feature<LineString>[]; innerPoly: Feature<Polygon> | null } {
    const headlands: Feature<LineString>[] = [];
    let currentPoly: Feature<Polygon> | Feature<MultiPolygon> = lawn;

    for (let i = 0; i < config.headlandLaps; i++) {
        try {
            const buffered = turf.buffer(currentPoly, -(config.deckWidthMeters * 0.8), { units: "meters" });

            if (!buffered) break;

            let coords: Position[];
            if (buffered.geometry.type === "Polygon") {
                coords = buffered.geometry.coordinates[0];
                currentPoly = buffered as Feature<Polygon>;
            } else if (buffered.geometry.type === "MultiPolygon") {
                // Take the largest polygon
                let largestIdx = 0;
                let largestArea = 0;
                buffered.geometry.coordinates.forEach((ring, idx) => {
                    const a = turf.area(turf.polygon(ring));
                    if (a > largestArea) { largestArea = a; largestIdx = idx; }
                });
                coords = buffered.geometry.coordinates[largestIdx][0];
                currentPoly = turf.polygon(buffered.geometry.coordinates[largestIdx]) as Feature<Polygon>;
            } else {
                break;
            }

            if (coords.length >= 4) {
                headlands.push(turf.lineString(coords, { lap: i + 1, type: "headland" }));
            }
        } catch (e) {
            console.warn("Headland generation error:", e);
            break;
        }
    }

    // Return inner polygon for stripe generation
    const inner = currentPoly.geometry.type === "Polygon"
        ? currentPoly as Feature<Polygon>
        : null;

    return { headlands, innerPoly: inner };
}

// ─── Stripe Generation ──────────────────────────────
function generateStripesAtAngle(
    innerPoly: Feature<Polygon>,
    angleDeg: number,
    config: MowerConfig
): Feature<LineString>[] {
    const bbox = turf.bbox(innerPoly);
    const center = turf.center(innerPoly);
    const centerCoord = center.geometry.coordinates;

    const spacing = config.deckWidthMeters * config.overlapRatio;
    const angleRad = (angleDeg * Math.PI) / 180;

    // Calculate diagonal of bounding box in meters
    const diagonal = turf.distance(
        [bbox[0], bbox[1]], [bbox[2], bbox[3]],
        { units: "meters" }
    );

    const numStripes = Math.ceil(diagonal / spacing) + 4;
    const lineHalfLen = diagonal / 2 + 20;

    // Conversion factors (meters to degrees)
    const latPerM = 1 / 111320;
    const lonPerM = 1 / (111320 * Math.cos((centerCoord[1] * Math.PI) / 180));

    // Direction vectors
    const perpDx = Math.cos(angleRad + Math.PI / 2);
    const perpDy = Math.sin(angleRad + Math.PI / 2);
    const stripeDx = Math.cos(angleRad);
    const stripeDy = Math.sin(angleRad);

    const allStripes: Feature<LineString>[] = [];

    for (let i = Math.floor(-numStripes / 2); i <= Math.ceil(numStripes / 2); i++) {
        const offsetM = i * spacing;

        const midLon = centerCoord[0] + offsetM * perpDx * lonPerM;
        const midLat = centerCoord[1] + offsetM * perpDy * latPerM;

        const startPt: Position = [
            midLon - lineHalfLen * stripeDx * lonPerM,
            midLat - lineHalfLen * stripeDy * latPerM,
        ];
        const endPt: Position = [
            midLon + lineHalfLen * stripeDx * lonPerM,
            midLat + lineHalfLen * stripeDy * latPerM,
        ];

        const scanLine = turf.lineString([startPt, endPt]);
        const clipped = clipLineToPolygon(scanLine, innerPoly);
        allStripes.push(...clipped);
    }

    // Apply boustrophedon (serpentine): reverse every other stripe
    return allStripes.map((stripe, idx) => {
        if (idx % 2 === 1) {
            const coords = stripe.geometry.coordinates.slice().reverse();
            return turf.lineString(coords, { type: "stripe", index: idx, direction: "reverse" });
        }
        return turf.lineString(stripe.geometry.coordinates, { type: "stripe", index: idx, direction: "forward" });
    });
}

// ─── Angle Scoring ──────────────────────────────────
function scoreAngle(
    innerPoly: Feature<Polygon>,
    angleDeg: number,
    config: MowerConfig,
    obstacles: Feature<Polygon>[]
): { score: number; stripes: Feature<LineString>[] } {
    const stripes = generateStripesAtAngle(innerPoly, angleDeg, config);

    if (stripes.length === 0) return { score: -9999, stripes };

    // Score: prefer longer average stripe length, fewer short fragments
    const lengths = stripes.map(s => turf.length(s, { units: "meters" }));
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const shortCount = lengths.filter(l => l < 2).length;

    let score = avgLen * 10 - shortCount * 5;

    // Discharge penalty for stripes near obstacles
    if (config.discharge !== "mulch" && obstacles.length > 0) {
        try {
            const obsUnion = turf.union(turf.featureCollection(obstacles));
            if (obsUnion) {
                const obsBuffer = turf.buffer(obsUnion, config.deckWidthMeters * 3, { units: "meters" });
                if (obsBuffer) {
                    let nearCount = 0;
                    stripes.forEach(s => {
                        try {
                            if (turf.booleanIntersects(s, obsBuffer)) nearCount++;
                        } catch { /* skip */ }
                    });
                    score -= nearCount * 3;
                }
            }
        } catch { /* skip */ }
    }

    return { score, stripes };
}

// ─── Main Entry Point ───────────────────────────────
export function planMowingRoute(
    lawnPolygon: Feature<Polygon>,
    obstacles: Feature<Polygon>[] = [],
    config: Partial<MowerConfig> = {}
): RoutePlan {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    console.log("[RoutePlanner] Starting with", obstacles.length, "obstacles");

    const area = turf.area(lawnPolygon);

    // Subtract obstacles from lawn
    let effectiveLawn: Feature<Polygon> = lawnPolygon;
    for (const obs of obstacles) {
        try {
            const diff = turf.difference(turf.featureCollection([effectiveLawn, obs]));
            if (diff) {
                if (diff.geometry.type === "Polygon") {
                    effectiveLawn = diff as Feature<Polygon>;
                } else if (diff.geometry.type === "MultiPolygon") {
                    // Take the largest polygon from the result
                    let largestIdx = 0;
                    let largestArea = 0;
                    diff.geometry.coordinates.forEach((ring, idx) => {
                        const a = turf.area(turf.polygon(ring));
                        if (a > largestArea) { largestArea = a; largestIdx = idx; }
                    });
                    effectiveLawn = turf.polygon(diff.geometry.coordinates[largestIdx]) as Feature<Polygon>;
                }
            }
        } catch (e) {
            console.warn("[RoutePlanner] Obstacle subtraction error:", e);
        }
    }

    // Generate headlands
    const { headlands, innerPoly } = generateHeadlands(effectiveLawn, cfg);

    console.log("[RoutePlanner] Headlands:", headlands.length, "InnerPoly:", !!innerPoly);

    if (!innerPoly) {
        return {
            headlands,
            stripes: [],
            bestAngleDeg: 0,
            areaSqMeters: area,
            areaSqFeet: area * 10.7639,
            estimatedDistanceMeters: headlands.reduce((s, h) => s + turf.length(h, { units: "meters" }), 0),
            estimatedTimeMins: 0,
        };
    }

    // Test angles and pick the best
    const angles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165];
    let bestScore = -Infinity;
    let bestStripes: Feature<LineString>[] = [];
    let bestAngle = 0;

    for (const angle of angles) {
        try {
            const { score, stripes } = scoreAngle(innerPoly, angle, cfg, obstacles);
            console.log(`[RoutePlanner] Angle ${angle}° → ${stripes.length} stripes, score ${score.toFixed(1)}`);
            if (score > bestScore) {
                bestScore = score;
                bestStripes = stripes;
                bestAngle = angle;
            }
        } catch (e) {
            console.warn(`[RoutePlanner] Angle ${angle}° failed:`, e);
        }
    }

    console.log(`[RoutePlanner] Best angle: ${bestAngle}° with ${bestStripes.length} stripes`);

    // Calculate totals
    const headlandDist = headlands.reduce((s, h) => s + turf.length(h, { units: "meters" }), 0);
    const stripeDist = bestStripes.reduce((s, st) => s + turf.length(st, { units: "meters" }), 0);
    const totalDist = headlandDist + stripeDist;

    return {
        headlands,
        stripes: bestStripes,
        bestAngleDeg: bestAngle,
        areaSqMeters: area,
        areaSqFeet: area * 10.7639,
        estimatedDistanceMeters: totalDist,
        estimatedTimeMins: totalDist / 83,
    };
}

// ─── Helpers ────────────────────────────────────────
export function deckWidthFromInches(inches: number): number {
    return inches * 0.0254;
}
