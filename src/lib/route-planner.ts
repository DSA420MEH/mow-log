/**
 * Smart Mowing Route Planner — Core Algorithm
 * 
 * Generates optimal mowing paths for a given lawn polygon:
 * - Headland loops (perimeter passes) for clean edges
 * - Boustrophedon (serpentine) stripes with discharge awareness
 * - Obstacle avoidance to prevent blowing clippings onto driveways/houses
 * 
 * Uses Turf.js for all geospatial operations.
 */
import * as turf from "@turf/turf";
import type { Feature, Polygon, LineString, Position, GeoJsonProperties } from "geojson";

export type DischargeMode = "left" | "right" | "rear" | "mulch";

export interface MowerConfig {
    deckWidthMeters: number;    // e.g., 0.533 for 21", 0.914 for 36"
    discharge: DischargeMode;
    overlapRatio: number;       // 0.90 = 10% overlap
    headlandLaps: number;       // 1-2 recommended
}

export interface RoutePlan {
    headlands: Feature<LineString>[];
    stripes: Feature<LineString>[];
    bestAngleDeg: number;
    areaSqMeters: number;
    areaSqFeet: number;
    estimatedDistanceMeters: number;
    estimatedTimeMins: number;  // at ~5 km/h walking pace
}

const DEFAULT_CONFIG: MowerConfig = {
    deckWidthMeters: 0.533,  // 21" residential mower
    discharge: "right",
    overlapRatio: 0.93,
    headlandLaps: 2,
};

// ─── Headland Generation ────────────────────────────
function generateHeadlands(
    lawn: Feature<Polygon>,
    config: MowerConfig
): { headlands: Feature<LineString>[]; innerPoly: Feature<Polygon> | null } {
    const headlands: Feature<LineString>[] = [];
    let current = lawn;

    for (let i = 0; i < config.headlandLaps; i++) {
        const offset = -(config.deckWidthMeters * config.overlapRatio * 0.001); // rough degrees offset
        // Use buffer with negative value to shrink polygon
        const buffered = turf.buffer(current, -(config.deckWidthMeters / 2), { units: "meters" });

        if (!buffered || (buffered.geometry.type !== "Polygon" && buffered.geometry.type !== "MultiPolygon")) break;

        // Convert polygon boundary to linestring for the headland pass
        const coords = buffered.geometry.type === "Polygon"
            ? buffered.geometry.coordinates[0]
            : buffered.geometry.coordinates[0][0]; // Take first polygon of MultiPolygon

        const loop = turf.lineString(coords as Position[], { lap: i + 1, type: "headland" });
        headlands.push(loop);

        // The inner polygon becomes the area for stripes
        current = buffered.geometry.type === "Polygon"
            ? buffered as Feature<Polygon>
            : turf.polygon(buffered.geometry.coordinates[0]) as Feature<Polygon>;
    }

    return {
        headlands,
        innerPoly: current as Feature<Polygon>,
    };
}

// ─── Stripe Angle Scoring ───────────────────────────
function scoreAngle(
    innerPoly: Feature<Polygon>,
    angleDeg: number,
    config: MowerConfig,
    obstacles: Feature<Polygon>[]
): { score: number; stripes: Feature<LineString>[] } {
    const stripes = generateStripesAtAngle(innerPoly, angleDeg, config);

    // Score 1: prefer angles that produce fewer, longer stripes
    const totalLength = stripes.reduce((sum, s) => sum + turf.length(s, { units: "meters" }), 0);
    const avgLength = stripes.length > 0 ? totalLength / stripes.length : 0;
    const lengthScore = avgLength; // higher = better

    // Score 2: penalize short fragments
    const shortFragments = stripes.filter(s => turf.length(s, { units: "meters" }) < 2).length;
    const fragmentPenalty = shortFragments * 10;

    // Score 3: penalize angles that blow discharge toward obstacles
    let dischargePenalty = 0;
    if (config.discharge !== "mulch" && obstacles.length > 0) {
        const dischargeAngleOffset = config.discharge === "left" ? -90 : config.discharge === "right" ? 90 : 0;
        const dischargeDir = (angleDeg + dischargeAngleOffset) % 360;

        // Buffer obstacles and check proximity
        const obstacleUnion = obstacles.length > 0 ? turf.union(turf.featureCollection(obstacles)) : null;
        if (obstacleUnion) {
            const bufferedObstacles = turf.buffer(obstacleUnion, config.deckWidthMeters * 2, { units: "meters" });
            if (bufferedObstacles) {
                stripes.forEach(stripe => {
                    try {
                        const intersects = turf.booleanIntersects(stripe, bufferedObstacles);
                        if (intersects) dischargePenalty += 5;
                    } catch {
                        // Ignore intersection errors
                    }
                });
            }
        }
    }

    return {
        score: lengthScore - fragmentPenalty - dischargePenalty,
        stripes,
    };
}

// ─── Stripe Generation at a Given Angle ─────────────
function generateStripesAtAngle(
    innerPoly: Feature<Polygon>,
    angleDeg: number,
    config: MowerConfig
): Feature<LineString>[] {
    const bbox = turf.bbox(innerPoly);
    const center = turf.center(innerPoly);
    const centerCoord = center.geometry.coordinates;

    // Calculate stripe spacing in meters
    const spacing = config.deckWidthMeters * config.overlapRatio;

    // Determine how many stripes we need based on the bbox diagonal
    const diagonal = turf.distance(
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
        { units: "meters" }
    );
    const numStripes = Math.ceil(diagonal / spacing) + 4;

    const stripes: Feature<LineString>[] = [];
    const angleRad = (angleDeg * Math.PI) / 180;

    // Direction perpendicular to stripe angle (for offsetting)
    const perpDx = Math.cos(angleRad + Math.PI / 2);
    const perpDy = Math.sin(angleRad + Math.PI / 2);

    // Direction along stripe
    const stripeDx = Math.cos(angleRad);
    const stripeDy = Math.sin(angleRad);

    // Length of each stripe line (extend well beyond bbox)
    const lineHalfLen = diagonal / 2 + 50; // meters extra

    for (let i = -numStripes / 2; i <= numStripes / 2; i++) {
        // Offset from center perpendicular to stripe direction
        const offsetM = i * spacing;

        // Convert meter offsets to approximate degree offsets
        const latPerM = 1 / 111320;
        const lonPerM = 1 / (111320 * Math.cos((centerCoord[1] * Math.PI) / 180));

        const offsetLon = offsetM * perpDx * lonPerM;
        const offsetLat = offsetM * perpDy * latPerM;

        const midPoint: Position = [
            centerCoord[0] + offsetLon,
            centerCoord[1] + offsetLat,
        ];

        // Create line extending in both directions from midpoint
        const startPoint: Position = [
            midPoint[0] - lineHalfLen * stripeDx * lonPerM,
            midPoint[1] - lineHalfLen * stripeDy * latPerM,
        ];
        const endPoint: Position = [
            midPoint[0] + lineHalfLen * stripeDx * lonPerM,
            midPoint[1] + lineHalfLen * stripeDy * latPerM,
        ];

        const line = turf.lineString([startPoint, endPoint]);

        // Clip line to inner polygon
        try {
            const clipped = turf.lineIntersect(line, innerPoly);
            if (clipped.features.length >= 2) {
                // Sort intersection points along the line
                const points = clipped.features.map(f => f.geometry.coordinates);
                // Create line segments from pairs of intersection points
                for (let j = 0; j < points.length - 1; j += 2) {
                    const segment = turf.lineString([points[j], points[j + 1]], {
                        type: "stripe",
                        index: stripes.length,
                        direction: stripes.length % 2 === 0 ? "forward" : "reverse",
                    });
                    const segLen = turf.length(segment, { units: "meters" });
                    if (segLen >= 1) { // Skip tiny fragments
                        stripes.push(segment);
                    }
                }
            }
        } catch {
            // Skip lines that don't intersect
        }
    }

    // Reverse every other stripe for boustrophedon (serpentine) pattern
    return stripes.map((stripe, idx) => {
        if (idx % 2 === 1) {
            const coords = stripe.geometry.coordinates.slice().reverse();
            return turf.lineString(coords, stripe.properties);
        }
        return stripe;
    });
}

// ─── Main Route Planning Function ───────────────────
export function planMowingRoute(
    lawnPolygon: Feature<Polygon>,
    obstacles: Feature<Polygon>[] = [],
    config: Partial<MowerConfig> = {}
): RoutePlan {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const area = turf.area(lawnPolygon);

    // Cut obstacles out of lawn
    let effectiveLawn = lawnPolygon;
    for (const obs of obstacles) {
        try {
            const diff = turf.difference(turf.featureCollection([effectiveLawn, obs]));
            if (diff && diff.geometry.type === "Polygon") {
                effectiveLawn = diff as Feature<Polygon>;
            }
        } catch {
            // Skip if obstacle subtraction fails
        }
    }

    // Generate headlands
    const { headlands, innerPoly } = generateHeadlands(effectiveLawn, cfg);

    if (!innerPoly) {
        return {
            headlands,
            stripes: [],
            bestAngleDeg: 0,
            areaSqMeters: area,
            areaSqFeet: area * 10.7639,
            estimatedDistanceMeters: 0,
            estimatedTimeMins: 0,
        };
    }

    // Test multiple angles and pick the best one
    const candidateAngles = [0, 30, 45, 60, 90, 120, 135, 150];
    let bestScore = -Infinity;
    let bestStripes: Feature<LineString>[] = [];
    let bestAngle = 0;

    for (const angle of candidateAngles) {
        const { score, stripes } = scoreAngle(innerPoly, angle, cfg, obstacles);
        if (score > bestScore) {
            bestScore = score;
            bestStripes = stripes;
            bestAngle = angle;
        }
    }

    // Calculate total distance
    const headlandDist = headlands.reduce((sum, h) => sum + turf.length(h, { units: "meters" }), 0);
    const stripeDist = bestStripes.reduce((sum, s) => sum + turf.length(s, { units: "meters" }), 0);
    const totalDist = headlandDist + stripeDist;

    // Estimate time at ~5 km/h (83 m/min) walking pace
    const estimatedMins = totalDist / 83;

    return {
        headlands,
        stripes: bestStripes,
        bestAngleDeg: bestAngle,
        areaSqMeters: area,
        areaSqFeet: area * 10.7639,
        estimatedDistanceMeters: totalDist,
        estimatedTimeMins: estimatedMins,
    };
}

// ─── Helpers ────────────────────────────────────────
export function deckWidthFromInches(inches: number): number {
    return inches * 0.0254; // inches to meters
}
