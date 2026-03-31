import * as turf from '@turf/turf';
import { generateMowingPath } from './lawn-intelligence';

function runTests() {
    console.log('--- RUNNING DETERMINISTIC MOWING PATTERN TESTS ---');

    // 1. Simple Rectangle Test
    // 10m x 10m rectangle around [0,0]
    // 1 degree lat is ~111km, so 0.0001 degrees is ~11m
    const rectCoords = [
        [0, 0],
        [0.0001, 0],
        [0.0001, 0.0001],
        [0, 0.0001],
        [0, 0]
    ];
    const rectangle = turf.polygon([rectCoords]);
    
    console.log('Test 1: Simple 10m x 10m Rectangle');
    const mowerWidthInches = 54; // ~1.37m
    const pattern1 = generateMowingPath(rectangle, [], mowerWidthInches);
    
    console.log(`- Generated ${pattern1.features.length} line segments`);
    if (pattern1.features.length > 5 && pattern1.features.length < 10) {
        console.log('✅ Line count looks plausible for ~1.37m spacing in 10m width');
    } else {
        console.log('❌ Unexpected line count:', pattern1.features.length);
    }

    // 2. Obstacle Test
    // Add a 2m x 2m obstacle in the middle
    const obsCoords = [
        [0.00004, 0.00004],
        [0.00006, 0.00004],
        [0.00006, 0.00006],
        [0.00004, 0.00006],
        [0.00004, 0.00004]
    ];
    const obstacle = turf.polygon([obsCoords]);
    
    console.log('\nTest 2: Rectangle with Center Obstacle');
    const pattern2 = generateMowingPath(rectangle, [obstacle], mowerWidthInches);
    
    // Some lines should now be split into two segments
    console.log(`- Generated ${pattern2.features.length} line segments`);
    if (pattern2.features.length > pattern1.features.length) {
        console.log('✅ Obstacle correctly split some segments');
    } else {
        console.log('❌ Obstacle did not split segments (or pattern generation failed)');
    }

    // 3. Dominant Orientation Test
    // Slanted rectangle
    const slantedCoords = [
        [0, 0],
        [0.0002, 0.0001],
        [0.0001, 0.0003],
        [-0.0001, 0.0002],
        [0, 0]
    ];
    const slanted = turf.polygon([slantedCoords]);
    console.log('\nTest 3: Slanted Rectangle Orientation');
    const pattern3 = generateMowingPath(slanted, [], mowerWidthInches);
    
    const bearing = turf.rhumbBearing(turf.point([0,0]), turf.point([0.0002, 0.0001]));
    console.log(`- Dominant bearing should be approx ${bearing.toFixed(1)}°`);
    // Visual check in logs would show segments follow this angle
    console.log(`- Generated ${pattern3.features.length} segments`);
    if (pattern3.features.length > 0) {
        console.log('✅ Generated pattern for slanted shape');
    }

    console.log('\n--- TESTS COMPLETE ---');
}

runTests();
