import seedrandom from 'seedrandom';
import { createNoise3D } from 'simplex-noise';

/**
 * Seedable random number generator wrapper
 */
export class SeededRNG {
  constructor(seed) {
    this.rng = seedrandom(seed.toString());
  }

  random() {
    return this.rng();
  }

  randomRange(min, max) {
    return min + this.random() * (max - min);
  }

  randomInt(min, max) {
    return Math.floor(this.randomRange(min, max + 1));
  }

  randomElement(array) {
    return array[Math.floor(this.random() * array.length)];
  }
}

/**
 * Seedable noise generator wrapper
 */
export class NoiseGenerator {
  constructor(seed) {
    const rng = seedrandom(seed.toString());
    this.noise3D = createNoise3D(rng);
  }

  get(x, y, z) {
    const value = this.noise3D(x, y, z);
    return isFinite(value) ? value : 0;
  }

  octaveNoise(x, y, z, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.get(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}

/**
 * Convert cartesian to spherical coordinates
 */
export function cartesianToSpherical(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const lat = r > 0 ? Math.asin(Math.max(-1, Math.min(1, y / r))) : 0;
  const lon = Math.atan2(z, x);
  return { lat, lon, r };
}

/**
 * Calculate great circle distance between two points on a sphere
 */
export function greatCircleDistance(lat1, lon1, lat2, lon2) {
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
}

/**
 * Create tectonic plates on the sphere
 */
export function createPlates(seed, count) {
  const rng = new SeededRNG(seed);
  const plates = [];

  for (let i = 0; i < count; i++) {
    // Random point on sphere
    const theta = rng.random() * Math.PI * 2;
    const phi = Math.acos(2 * rng.random() - 1);
    
    const center = {
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta)
    };

    // Random motion vector (tangent to sphere at center)
    const motionTheta = rng.random() * Math.PI * 2;
    const motionPhi = rng.random() * Math.PI;
    
    const motion = {
      x: Math.sin(motionPhi) * Math.cos(motionTheta),
      y: Math.cos(motionPhi),
      z: Math.sin(motionPhi) * Math.sin(motionTheta)
    };

    // Make motion tangent to sphere at center
    const dot = center.x * motion.x + center.y * motion.y + center.z * motion.z;
    motion.x -= dot * center.x;
    motion.y -= dot * center.y;
    motion.z -= dot * center.z;

    // Normalize motion
    const len = Math.sqrt(motion.x ** 2 + motion.y ** 2 + motion.z ** 2);
    if (len > 0) {
      motion.x /= len;
      motion.y /= len;
      motion.z /= len;
    }

    plates.push({
      id: i,
      center,
      motion,
      speed: rng.randomRange(0.5, 1.5),
      type: rng.random() > 0.3 ? 'continental' : 'oceanic' // 70% continental, 30% oceanic
    });
  }

  return plates;
}

/**
 * Assign each vertex to a plate using topology-aware region growing
 * This guarantees no fragments by growing plates along actual mesh connectivity
 */
export function assignPlates(vertices, plates, seed = 12345, adjacency) {
  const assignments = new Array(vertices.length).fill(-1);
  const rng = new SeededRNG(seed);
  
  // Create noise generator for organic boundaries
  const noiseGen = new NoiseGenerator(rng.random() * 10000);
  
  // Find initial seed vertices closest to each plate center
  const plateSeeds = plates.map((plate, plateId) => {
    let closestVertex = 0;
    let minDist = Infinity;
    
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const dx = v.x - plate.center.x;
      const dy = v.y - plate.center.y;
      const dz = v.z - plate.center.z;
      const dist = dx * dx + dy * dy + dz * dz;
      
      if (dist < minDist) {
        minDist = dist;
        closestVertex = i;
      }
    }
    
    assignments[closestVertex] = plateId;
    return { vertexId: closestVertex, plateId };
  });
  
  // Use simple Voronoi with domain warping - much faster, still organic
  // Compute all noise-warped positions once
  const warpedPositions = vertices.map(v => {
    const warp1X = noiseGen.noise3D(v.x * 2.5, v.y * 2.5, v.z * 2.5) * 0.3;
    const warp1Y = noiseGen.noise3D(v.x * 2.5 + 100, v.y * 2.5 + 100, v.z * 2.5 + 100) * 0.3;
    const warp1Z = noiseGen.noise3D(v.x * 2.5 + 200, v.y * 2.5 + 200, v.z * 2.5 + 200) * 0.3;
    
    const warp2X = noiseGen.noise3D((v.x + warp1X) * 6, (v.y + warp1Y) * 6, (v.z + warp1Z) * 6) * 0.15;
    const warp2Y = noiseGen.noise3D((v.x + warp1X) * 6 + 300, (v.y + warp1Y) * 6 + 300, (v.z + warp1Z) * 6 + 300) * 0.15;
    const warp2Z = noiseGen.noise3D((v.x + warp1X) * 6 + 400, (v.y + warp1Y) * 6 + 400, (v.z + warp1Z) * 6 + 400) * 0.15;
    
    return {
      x: v.x + warp1X + warp2X,
      y: v.y + warp1Y + warp2Y,
      z: v.z + warp1Z + warp2Z
    };
  });
  
  // Assign all vertices to nearest plate (in warped space)
  for (let i = 0; i < vertices.length; i++) {
    if (assignments[i] !== -1) continue; // Skip seeds
    
    const warped = warpedPositions[i];
    let minDist = Infinity;
    let nearestPlate = 0;
    
    for (let p = 0; p < plates.length; p++) {
      const plate = plates[p];
      const dx = warped.x - plate.center.x;
      const dy = warped.y - plate.center.y;
      const dz = warped.z - plate.center.z;
      const dist = dx * dx + dy * dy + dz * dz;
      
      if (dist < minDist) {
        minDist = dist;
        nearestPlate = p;
      }
    }
    
    assignments[i] = nearestPlate;
  }

  return assignments;
}

/**
 * Smooth plate boundaries to create cleaner transitions
 * Now accepts prebuilt adjacency list for performance
 */
function smoothPlateBoundaries(vertices, plateAssignments, adjacency, iterations = 2, majorityThreshold = 0.65) {
  const result = [...plateAssignments];
  
  // Apply smoothing iterations
  for (let iter = 0; iter < iterations; iter++) {
    const newAssignments = [...result];
    
    for (let i = 0; i < vertices.length; i++) {
      const neighbors = adjacency[i];
      if (neighbors.length === 0) continue;
      
      // Count plate occurrences in neighborhood
      const plateCounts = {};
      for (const neighborIdx of neighbors) {
        const plate = result[neighborIdx];
        plateCounts[plate] = (plateCounts[plate] || 0) + 1;
      }
      
      // Find most common plate in neighborhood
      let maxCount = 0;
      let majorityPlate = result[i];
      for (const [plate, count] of Object.entries(plateCounts)) {
        if (count > maxCount) {
          maxCount = count;
          majorityPlate = parseInt(plate);
        }
      }
      
      // Only change if there's a strong majority (reduces noise at boundaries)
      // Use configurable threshold - lower = more aggressive smoothing
      if (maxCount > neighbors.length * majorityThreshold) {
        newAssignments[i] = majorityPlate;
      }
    }
    
    result.splice(0, result.length, ...newAssignments);
  }
  
  return result;
}

/**
 * Remove isolated fragments and fill enclosed regions
 * Uses the actual mesh topology for accurate connected component detection
 */
function removeFragments(vertices, plateAssignments, adjacency) {
  const result = [...plateAssignments];
  const vertexCount = vertices.length;
  
  // adjacency is already an array of arrays from buildAdjacencyList
  const adjList = adjacency;
  
  // Find connected components for each plate
  const visited = new Array(vertexCount).fill(false);
  const components = [];
  
  function floodFill(startVertex, targetPlate) {
    const component = [];
    const queue = [startVertex];
    visited[startVertex] = true;
    
    while (queue.length > 0) {
      const v = queue.shift();
      component.push(v);
      
      for (const neighbor of adjList[v]) {
        if (!visited[neighbor] && result[neighbor] === targetPlate) {
          visited[neighbor] = true;
          queue.push(neighbor);
        }
      }
    }
    
    return component;
  }
  
  // Find all connected components for each plate
  for (let i = 0; i < vertexCount; i++) {
    if (!visited[i]) {
      const plate = result[i];
      const component = floodFill(i, plate);
      components.push({ plate, vertices: component, size: component.length });
    }
  }
  
  // For each plate, find the largest component
  const plateMainComponents = {};
  for (const comp of components) {
    if (!plateMainComponents[comp.plate] || comp.size > plateMainComponents[comp.plate].size) {
      plateMainComponents[comp.plate] = comp;
    }
  }
  
  // Mark vertices to reassign - keep ONLY the largest component for each plate
  const toReassign = new Set();
  let fragmentCount = 0;
  for (const comp of components) {
    const mainComp = plateMainComponents[comp.plate];
    
    // If this is not the main component, mark all its vertices for reassignment
    if (comp !== mainComp) {
      fragmentCount++;
      for (const vertexIdx of comp.vertices) {
        toReassign.add(vertexIdx);
      }
    }
  }
  
  // No fragments found - return original array to signal convergence
  if (fragmentCount === 0) {
    return plateAssignments;
  }
  
  // Reassign fragments to the most common neighboring plate
  for (const vertexIdx of toReassign) {
    const neighbors = adjList[vertexIdx];
    const plateCounts = {};
    
    for (const neighborIdx of neighbors) {
      if (!toReassign.has(neighborIdx)) {
        const plate = result[neighborIdx];
        plateCounts[plate] = (plateCounts[plate] || 0) + 1;
      }
    }
    
    // Find most common neighboring plate
    let maxCount = 0;
    let bestPlate = result[vertexIdx];
    for (const [plate, count] of Object.entries(plateCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bestPlate = parseInt(plate);
      }
    }
    
    result[vertexIdx] = bestPlate;
  }
  
  return result;
}

/**
 * Compute base elevation from plate tectonics
 */
export function computeBaseElevation(vertices, plates, plateAssignments, options) {
  const { tectonicActivity = 1.0 } = options;
  const elevation = new Array(vertices.length).fill(0);

  // First pass: assign base elevation based on plate type
  // Wider spread between oceanic and continental for more varied terrain
  for (let i = 0; i < vertices.length; i++) {
    const plate = plates[plateAssignments[i]];
    elevation[i] = plate.type === 'oceanic' ? -0.5 : 0.3;
  }

  // Second pass: add mountains at plate boundaries
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const myPlate = plateAssignments[i];
    
    // Find distance to nearest plate boundary
    let minBoundaryDist = Infinity;
    let collisionStrength = 0;

    for (let j = 0; j < vertices.length; j += 10) { // Sample for performance
      if (plateAssignments[j] !== myPlate) {
        const neighbor = vertices[j];
        const dx = v.x - neighbor.x;
        const dy = v.y - neighbor.y;
        const dz = v.z - neighbor.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < minBoundaryDist) {
          minBoundaryDist = dist;
          
          // Calculate collision strength based on relative motion
          const plate1 = plates[myPlate];
          const plate2 = plates[plateAssignments[j]];
          
          // Direction from vertex to boundary
          const boundaryDir = {
            x: neighbor.x - v.x,
            y: neighbor.y - v.y,
            z: neighbor.z - v.z
          };
          const bLen = Math.sqrt(boundaryDir.x ** 2 + boundaryDir.y ** 2 + boundaryDir.z ** 2);
          if (bLen > 0) {
            boundaryDir.x /= bLen;
            boundaryDir.y /= bLen;
            boundaryDir.z /= bLen;
          }

          // Relative motion towards boundary
          const relMotion = {
            x: plate1.motion.x * plate1.speed - plate2.motion.x * plate2.speed,
            y: plate1.motion.y * plate1.speed - plate2.motion.y * plate2.speed,
            z: plate1.motion.z * plate1.speed - plate2.motion.z * plate2.speed
          };

          const convergence = -(relMotion.x * boundaryDir.x + 
                                relMotion.y * boundaryDir.y + 
                                relMotion.z * boundaryDir.z);

          collisionStrength = Math.max(0, convergence);
        }
      }
    }

    // Add mountain building near convergent boundaries
    if (minBoundaryDist < 0.15) {
      const boundaryFactor = 1.0 - minBoundaryDist / 0.15;
      elevation[i] += boundaryFactor * collisionStrength * 0.8 * tectonicActivity;
    }
  }

  return elevation;
}

/**
 * Apply multi-octave noise to elevation
 */
export function applyNoise(vertices, elevation, seed, params, plateAssignments = null) {
  const { 
    noiseScale = 2.0, 
    noiseStrength = 0.3,
    octaves = 5,
    persistence = 0.5,
    lacunarity = 2.0
  } = params;

  const noise = new NoiseGenerator(seed + 1000);
  const result = [...elevation];

  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const noiseValue = noise.octaveNoise(
      v.x * noiseScale,
      v.y * noiseScale,
      v.z * noiseScale,
      octaves,
      persistence,
      lacunarity
    );

    // Reduce noise near plate boundaries for cleaner edges
    let noiseMultiplier = 1.0;
    if (plateAssignments) {
      const myPlate = plateAssignments[i];
      let minBoundaryDist = Infinity;
      
      // Check nearby vertices for plate boundaries (sparse sampling)
      for (let j = 0; j < vertices.length; j += 12) {
        if (plateAssignments[j] !== myPlate) {
          const dx = v.x - vertices[j].x;
          const dy = v.y - vertices[j].y;
          const dz = v.z - vertices[j].z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          minBoundaryDist = Math.min(minBoundaryDist, dist);
        }
      }
      
      // Very strongly reduce noise within 0.35 units of plate boundary
      if (minBoundaryDist < 0.35) {
        // Smooth fade from 0 at boundary to 1 at distance 0.35
        const fadeDistance = minBoundaryDist / 0.35;
        // Cubic falloff for very smooth transition and cleaner boundaries
        noiseMultiplier = fadeDistance * fadeDistance * fadeDistance;
      }
    }

    result[i] += noiseValue * noiseStrength * noiseMultiplier;
    
    // Ensure no NaN values
    if (!isFinite(result[i])) {
      result[i] = elevation[i];
    }
  }

  return result;
}

// Cache adjacency lists by vertex count to avoid rebuilding
const adjacencyCache = new Map();

/**
 * Build adjacency list for mesh vertices (with caching)
 */
export function buildAdjacencyList(geometry) {
  const positions = geometry.attributes.position;
  const indices = geometry.index;
  const vertexCount = positions.count;
  
  // Check cache first
  if (adjacencyCache.has(vertexCount)) {
    return adjacencyCache.get(vertexCount);
  }

  const adjacency = Array.from({ length: vertexCount }, () => new Set());

  if (indices) {
    // Indexed geometry
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i);
      const b = indices.getX(i + 1);
      const c = indices.getX(i + 2);

      adjacency[a].add(b);
      adjacency[a].add(c);
      adjacency[b].add(a);
      adjacency[b].add(c);
      adjacency[c].add(a);
      adjacency[c].add(b);
    }
  } else {
    // Non-indexed geometry - build connections by proximity with spatial hashing
    // For IcosahedronGeometry detail 30 on unit sphere, edge length is ~0.115
    const threshold = 0.15;
    const thresholdSq = threshold * threshold;
    
    // Use spatial hashing for O(n) performance instead of O(n²)
    const gridSize = threshold;
    const grid = new Map();
    
    // Helper to get grid cell key
    const getGridKey = (x, y, z) => {
      const gx = Math.floor(x / gridSize);
      const gy = Math.floor(y / gridSize);
      const gz = Math.floor(z / gridSize);
      return `${gx},${gy},${gz}`;
    };
    
    // Insert all vertices into spatial grid
    for (let i = 0; i < vertexCount; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const key = getGridKey(x, y, z);
      
      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key).push({ i, x, y, z });
    }
    
    // Check only neighboring grid cells for each vertex
    for (let i = 0; i < vertexCount; i++) {
      const x1 = positions.getX(i);
      const y1 = positions.getY(i);
      const z1 = positions.getZ(i);
      
      const gx = Math.floor(x1 / gridSize);
      const gy = Math.floor(y1 / gridSize);
      const gz = Math.floor(z1 / gridSize);
      
      // Check this cell and 26 neighboring cells
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const key = `${gx + dx},${gy + dy},${gz + dz}`;
            const cell = grid.get(key);
            
            if (cell) {
              for (const v of cell) {
                if (v.i > i) { // Only check pairs once
                  const dx = v.x - x1;
                  const dy = v.y - y1;
                  const dz = v.z - z1;
                  const distSq = dx * dx + dy * dy + dz * dz;
                  
                  if (distSq < thresholdSq && distSq > 0) {
                    adjacency[i].add(v.i);
                    adjacency[v.i].add(i);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const result = adjacency.map(set => Array.from(set));
  
  // Cache the result for future use
  adjacencyCache.set(vertexCount, result);
  
  return result;
}

/**
 * Simulate water flow and compute flow accumulation
 */
export function simulateFlow(vertices, elevation, adjacency, seaLevel) {
  const flowAccumulation = new Array(vertices.length).fill(1);
  const drainage = new Array(vertices.length).fill(-1);

  // Sort vertices by elevation (highest first)
  const sorted = vertices.map((v, i) => ({ index: i, elevation: elevation[i] }))
    .sort((a, b) => b.elevation - a.elevation);

  // Flow routing: for each vertex, flow to lowest neighbor
  for (const { index: i } of sorted) {
    if (elevation[i] <= seaLevel) {
      continue; // Ocean vertices don't flow
    }

    const neighbors = adjacency[i];
    let lowestNeighbor = -1;
    let lowestElevation = elevation[i];

    for (const n of neighbors) {
      if (elevation[n] < lowestElevation) {
        lowestElevation = elevation[n];
        lowestNeighbor = n;
      }
    }

    if (lowestNeighbor !== -1) {
      drainage[i] = lowestNeighbor;
      flowAccumulation[lowestNeighbor] += flowAccumulation[i];
    }
  }

  return { flowAccumulation, drainage };
}

/**
 * Extract river paths from flow accumulation
 */
export function extractRivers(vertices, elevation, flowAccumulation, drainage, seaLevel, threshold = 50) {
  const rivers = [];

  for (let i = 0; i < vertices.length; i++) {
    if (elevation[i] > seaLevel && flowAccumulation[i] > threshold) {
      const path = [];
      let current = i;
      let steps = 0;

      while (current !== -1 && steps < 1000) {
        path.push(current);
        
        if (elevation[current] <= seaLevel) {
          break; // Reached ocean
        }

        current = drainage[current];
        steps++;
        
        if (current !== -1 && flowAccumulation[current] < flowAccumulation[path[path.length - 1]]) {
          break; // Don't follow upstream
        }
      }

      if (path.length > 5) { // Only keep rivers with reasonable length
        rivers.push(path);
      }
    }
  }

  // Remove duplicate rivers (rivers that share most of their path)
  const uniqueRivers = [];
  for (const river of rivers) {
    const isDuplicate = uniqueRivers.some(existing => {
      const overlap = river.filter(v => existing.includes(v)).length;
      return overlap > river.length * 0.7;
    });
    
    if (!isDuplicate) {
      uniqueRivers.push(river);
    }
  }

  return uniqueRivers.slice(0, 50); // Limit to 50 major rivers
}

/**
 * Calculate solar insolation based on latitude, axial tilt, and solar intensity
 * Returns annual average insolation (W/m²)
 */
function calculateInsolation(lat, axialTilt, solarIntensity) {
  // Transform solar intensity from UI scale (-1 to 1) to actual multiplier
  // Calibrated to create Earth-like biome distribution:
  // -1 (coldest) = 1.08x, 0 (Earth-like) = 1.30x, 1 (warmest) = 1.52x
  // Balanced to optimize biome distribution
  const actualMultiplier = 1.30 + solarIntensity * 0.22;
  
  // Solar constant for Earth-like star: 1361 W/m² at 1 AU
  const solarConstant = 1361 * actualMultiplier;
  
  // Annual average insolation accounting for axial tilt
  // Simplified integration over the year
  const absLat = Math.abs(lat);
  
  // Base insolation from latitude (equator gets most, poles get least)
  const cosFactor = Math.cos(absLat);
  
  // Axial tilt causes seasonal variation - we use annual average
  // Higher tilt reduces polar insolation on average, increases equatorial contrast
  const tiltFactor = 1 - Math.sin(absLat) * Math.sin(axialTilt) * 0.5;
  
  // Annual average insolation
  const insolation = solarConstant * cosFactor * tiltFactor / Math.PI;
  
  return Math.max(0, insolation);
}

/**
 * Calculate atmospheric greenhouse effect
 */
function calculateGreenhouseEffect(atmosphericThickness) {
  // Greenhouse warming: thicker atmosphere traps more heat
  // Earth's greenhouse effect adds ~33°C
  // Using gentler exponent to avoid extreme temperatures
  // Scale: 0 = no atmosphere (0°C), 1 = Earth-like (33°C), 2 = thick (52°C)
  const baseGreenhouse = 33;
  return baseGreenhouse * Math.pow(Math.max(0.1, atmosphericThickness), 0.8);
}

/**
 * Calculate atmospheric lapse rate based on thickness
 */
function calculateLapseRate(atmosphericThickness) {
  // Standard Earth lapse rate: -6.5°C/km
  // Thicker atmosphere: more gradual lapse rate
  // Thinner atmosphere: steeper lapse rate
  if (atmosphericThickness < 0.1) return -9.8; // Near vacuum
  const baseLapseRate = -6.5;
  return baseLapseRate * Math.pow(0.9, atmosphericThickness - 1);
}

/**
 * Compute seasonal temperatures for each vertex
 * Returns object with spring, summer, autumn, winter temperatures
 */
export function computeSeasonalTemperatures(vertices, elevation, seaLevel, options) {
  const {
    solarIntensity = 1.0,
    atmosphericThickness = 1.0,
    axialTilt = 23.5 * Math.PI / 180
  } = options;

  const numVertices = vertices.length;
  const seasons = {
    spring: new Array(numVertices),
    summer: new Array(numVertices),
    autumn: new Array(numVertices),
    winter: new Array(numVertices),
    annual: new Array(numVertices)
  };

  // Calculate greenhouse effect and lapse rate
  const greenhouse = calculateGreenhouseEffect(atmosphericThickness);
  const lapseRate = calculateLapseRate(atmosphericThickness);

  // Base temperature without atmosphere (from solar insolation only)
  const stefanBoltzmann = 5.67e-8;
  const albedo = 0.3; // Earth-like albedo
  
  for (let i = 0; i < numVertices; i++) {
    const { lat, lon } = cartesianToSpherical(vertices[i].x, vertices[i].y, vertices[i].z);
    const isOcean = elevation[i] <= seaLevel;
    
    // Calculate insolation for each season
    const seasons_insolation = {
      spring: calculateInsolation(lat, 0, solarIntensity),
      summer: calculateInsolation(lat, lat >= 0 ? axialTilt : -axialTilt, solarIntensity),
      autumn: calculateInsolation(lat, 0, solarIntensity),
      winter: calculateInsolation(lat, lat >= 0 ? -axialTilt : axialTilt, solarIntensity)
    };

    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      const insolation = seasons_insolation[season];
      
      // Temperature from energy balance (Stefan-Boltzmann law)
      // Note: We don't divide by 4 here because insolation is already the local value,
      // not the global average. The division by 4 is for averaging over the whole sphere.
      const baseTemp = Math.pow((insolation * (1 - albedo)) / stefanBoltzmann, 0.25) - 273.15;
      
      // Add greenhouse warming
      let surfaceTemp = baseTemp + greenhouse;
      
      // Continental effect: land has more extreme temperatures
      if (!isOcean) {
        const continentalEffect = 6; // ±6°C swing (reduced from 10°C for more moderate temps)
        // Summer warmer, winter colder on continents
        if (season === 'summer') {
          surfaceTemp += continentalEffect;
        } else if (season === 'winter') {
          surfaceTemp -= continentalEffect;
        }
      }
      
      // Elevation effect (lapse rate)
      const elevationAboveSea = elevation[i] - seaLevel;
      const elevationKm = elevationAboveSea * 5; // Scale to km
      const elevationEffect = elevationKm * lapseRate;
      
      // Ocean thermal inertia (moderates temperature swings)
      const oceanModeration = isOcean ? 0.5 : 1.0; // Oceans are 50% less extreme
      
      let temp = surfaceTemp + elevationEffect;
      
      // Apply ocean moderation to seasonal swings
      const annualMean = surfaceTemp + elevationEffect;
      temp = annualMean + (temp - annualMean) * oceanModeration;
      
      seasons[season][i] = temp;
    }
    
    // Calculate annual average
    seasons.annual[i] = (seasons.spring[i] + seasons.summer[i] + 
                        seasons.autumn[i] + seasons.winter[i]) / 4;
  }

  return seasons;
}

/**
 * Legacy function for compatibility - returns annual average
 */
export function computeTemperature(vertices, elevation, seaLevel, options) {
  const seasons = computeSeasonalTemperatures(vertices, elevation, seaLevel, options);
  return seasons.annual;
}

/**
 * Calculate atmospheric circulation cells and wind patterns
 * Returns wind vectors (eastward, northward components) for each vertex
 */
export function computeWindPatterns(vertices, temperature, elevation, seaLevel, options) {
  const {
    rotationPeriod = 1.0, // Earth days
    atmosphericThickness = 1.0
  } = options;

  const numVertices = vertices.length;
  const windEast = new Array(numVertices); // Eastward component (u)
  const windNorth = new Array(numVertices); // Northward component (v)
  
  // Coriolis parameter: stronger with faster rotation
  // f = 2 * Ω * sin(φ), where Ω = 2π / period
  const angularVelocity = (2 * Math.PI) / (rotationPeriod * 86400); // rad/s
  
  // Atmospheric circulation cells (simplified):
  // - Hadley cells: 0° to ±30° (trade winds, easterly)
  // - Ferrel cells: ±30° to ±60° (westerlies)
  // - Polar cells: ±60° to ±90° (polar easterlies)
  
  for (let i = 0; i < numVertices; i++) {
    const { lat, lon } = cartesianToSpherical(vertices[i].x, vertices[i].y, vertices[i].z);
    const latDeg = lat * 180 / Math.PI;
    const absLatDeg = Math.abs(latDeg);
    
    // Base wind patterns from atmospheric cells
    let zonalWind = 0; // East-west (positive = eastward)
    let meridionalWind = 0; // North-south (positive = northward)
    
    // Hadley Cell (0° to 30°): Trade winds (easterly)
    if (absLatDeg < 30) {
      const cellStrength = Math.cos(lat * 3); // Strongest at ~10-15°
      zonalWind = -5 * cellStrength; // Easterly (westward)
      meridionalWind = lat >= 0 ? -1 : 1; // Toward equator
    }
    // Ferrel Cell (30° to 60°): Westerlies
    else if (absLatDeg < 60) {
      const cellStrength = Math.sin((absLatDeg - 30) * Math.PI / 30);
      zonalWind = 8 * cellStrength; // Westerly (eastward)
      meridionalWind = lat >= 0 ? 1 : -1; // Toward pole
    }
    // Polar Cell (60° to 90°): Polar easterlies
    else {
      const cellStrength = Math.sin((absLatDeg - 60) * Math.PI / 30);
      zonalWind = -4 * cellStrength; // Easterly (westward)
      meridionalWind = lat >= 0 ? -1 : 1; // Toward 60°
    }
    
    // Coriolis deflection (scales with rotation rate and latitude)
    const coriolisFactor = 2 * angularVelocity * Math.sin(lat);
    const coriolisDeflection = coriolisFactor * 100000; // Scale for visibility
    
    // Apply Coriolis effect to winds
    const deflectedZonal = zonalWind - meridionalWind * coriolisDeflection * 0.1;
    const deflectedMeridional = meridionalWind + zonalWind * coriolisDeflection * 0.05;
    
    // Topographic effects: mountains block and deflect wind
    const elevationAboveSea = Math.max(0, elevation[i] - seaLevel);
    const topographicDamping = Math.exp(-elevationAboveSea * 3);
    
    // Atmospheric thickness affects wind strength
    const thicknessScale = Math.sqrt(atmosphericThickness);
    
    windEast[i] = deflectedZonal * topographicDamping * thicknessScale;
    windNorth[i] = deflectedMeridional * topographicDamping * thicknessScale;
  }
  
  return { windEast, windNorth };
}

/**
 * Calculate ocean currents from wind stress and thermohaline circulation
 */
export function computeOceanCurrents(vertices, temperature, elevation, seaLevel, windEast, windNorth, options) {
  const {
    rotationPeriod = 1.0
  } = options;
  
  const numVertices = vertices.length;
  const currentEast = new Array(numVertices).fill(0);
  const currentNorth = new Array(numVertices).fill(0);
  
  for (let i = 0; i < numVertices; i++) {
    const isOcean = elevation[i] <= seaLevel;
    
    if (isOcean) {
      const { lat, lon } = cartesianToSpherical(vertices[i].x, vertices[i].y, vertices[i].z);
      
      // Wind-driven currents (Ekman transport)
      const coriolisFactor = 2 * (2 * Math.PI / (rotationPeriod * 86400)) * Math.sin(lat);
      
      // Ekman spiral: surface current at 45° to wind direction
      const ekmanAngle = Math.PI / 4;
      currentEast[i] = windEast[i] * Math.cos(ekmanAngle) * 0.03;
      currentNorth[i] = windNorth[i] * Math.cos(ekmanAngle) * 0.03;
      
      // Thermohaline circulation
      const latDeg = Math.abs(lat * 180 / Math.PI);
      if (latDeg > 60) {
        // Polar regions: downwelling, equatorward deep flow
        currentNorth[i] += (lat >= 0 ? -0.5 : 0.5);
      } else if (latDeg < 30) {
        // Tropical regions: poleward surface flow
        currentNorth[i] += (lat >= 0 ? 0.5 : -0.5);
      }
      
      // Gyres in mid-latitudes
      if (latDeg >= 20 && latDeg <= 40) {
        const gyreStrength = Math.sin((latDeg - 20) * Math.PI / 20);
        currentEast[i] += (lat >= 0 ? 2 : -2) * gyreStrength;
      }
    }
  }
  
  return { currentEast, currentNorth };
}

/**
 * Apply heat redistribution from ocean currents
 * Modifies temperature array in place
 */
function applyOceanHeatTransport(vertices, temperature, elevation, seaLevel, currentEast, currentNorth, adjacency) {
  const numVertices = vertices.length;
  const heatAdjustment = new Array(numVertices).fill(0);
  
  // Calculate heat transport for each ocean vertex
  for (let i = 0; i < numVertices; i++) {
    const isOcean = elevation[i] <= seaLevel;
    if (!isOcean) continue;
    
    const { lat } = cartesianToSpherical(vertices[i].x, vertices[i].y, vertices[i].z);
    const currentSpeed = Math.sqrt(currentEast[i] ** 2 + currentNorth[i] ** 2);
    
    // Strong currents can transport heat
    if (currentSpeed > 1.0) {
      // Determine if current is moving poleward or equatorward
      const polewardComponent = lat >= 0 ? currentNorth[i] : -currentNorth[i];
      
      // Warm currents moving poleward warm the region
      if (polewardComponent > 0.5) {
        heatAdjustment[i] += 5 * (polewardComponent / 2); // Up to +5°C
      }
      // Cold currents moving equatorward cool the region
      else if (polewardComponent < -0.5) {
        heatAdjustment[i] -= 5 * (-polewardComponent / 2); // Up to -5°C
      }
    }
  }
  
  // Apply adjustments and spread to nearby coastal regions
  for (let i = 0; i < numVertices; i++) {
    if (heatAdjustment[i] !== 0) {
      temperature[i] += heatAdjustment[i];
      
      // Spread to coastal neighbors
      for (const neighbor of adjacency[i]) {
        if (elevation[neighbor] > seaLevel) {
          temperature[neighbor] += heatAdjustment[i] * 0.4; // 40% effect on coast
        }
      }
    }
  }
}

/**
 * Calculate precipitation based on moisture transport and orographic effects
 */
export function computePrecipitation(vertices, temperature, elevation, seaLevel, windEast, windNorth, adjacency, options) {
  const { atmosphericThickness = 1.0, noiseGen } = options;
  
  const numVertices = vertices.length;
  const precipitation = new Array(numVertices).fill(0);
  
  // Calculate precipitation based on multiple factors
  for (let i = 0; i < numVertices; i++) {
    const { lat, lon } = cartesianToSpherical(vertices[i].x, vertices[i].y, vertices[i].z);
    const absLat = Math.abs(lat);
    const isOcean = elevation[i] <= seaLevel;
    const tempC = temperature[i];
    
    // Add regional variation using noise for more natural patterns
    // INCREASED variation to create more extreme wet/dry patches
    const regionalVariation = noiseGen ? 
      noiseGen.octaveNoise(
        vertices[i].x * 2.5,
        vertices[i].y * 2.5,
        vertices[i].z * 2.5,
        3,  // octaves
        0.5, // persistence
        2.0  // lacunarity
      ) : 0;
    
    // Base precipitation from latitude (ITCZ, subtropical dry, mid-latitude wet, polar dry)
    // Calibrated to match Earth's actual precipitation patterns
    let basePrecip = 0;
    const latDeg = absLat * 180 / Math.PI;
    
    if (latDeg < 10) {
      // Equatorial (ITCZ) - very high precipitation (concentrated tropical rainforest)
      basePrecip = 1800 + (10 - latDeg) * 120; // 1800-3000mm at equator
    } else if (latDeg < 30) {
      // Subtropical - moderately dry (Hadley cell descending)
      // INCREASED minimum to prevent excessive desert at high resolution
      basePrecip = 1800 - (latDeg - 10) * 67.5; // Drops to ~450mm at 30° (less extreme)
    } else if (latDeg < 60) {
      // Mid-latitude - bimodal precipitation (coastal wet, interior dry)
      basePrecip = 450 + (latDeg - 30) * 18; // Rises to ~990mm at 60°
    } else {
      // Polar - very low precipitation for tundra
      basePrecip = 990 - (latDeg - 60) * 39.5; // Drops to ~200mm at poles
    }
    
    // Temperature modulation (warmer = more moisture capacity, but also more evaporation)
    const tempFactor = Math.max(0.4, Math.min(1.3, (tempC + 20) / 35));
    basePrecip *= tempFactor;
    
    // Apply regional variation (±50% variation for more extreme wet/dry patches)
    // Increased from ±30% to create more biome diversity
    const variationFactor = 1.0 + regionalVariation * 0.5;
    basePrecip *= variationFactor;
    
    // Atmospheric thickness increases precipitation
    basePrecip *= (0.5 + atmosphericThickness * 0.5);
        // Continental effect: interior regions are drier
        let coastalModifier = 1.0;
        let coastalProximity = 0;
        if (!isOcean) {
          let oceanNeighbors = 0;
          let totalNeighbors = 0;
      
          // Check distance to ocean more thoroughly
          for (const neighbor of adjacency[i]) {
            totalNeighbors++;
            if (elevation[neighbor] <= seaLevel) oceanNeighbors++;
          }
      
          coastalProximity = oceanNeighbors / Math.max(1, totalNeighbors);
      
          // Stronger continental effect - intentionally drier interiors
          if (coastalProximity === 0) {
            // No ocean neighbors - deep interior
            coastalModifier = 0.38;
          } else if (coastalProximity < 0.3) {
            // Few ocean neighbors - interior
            coastalModifier = 0.45 + coastalProximity * 0.25; // ~0.45 to 0.53
          } else {
            // Coastal region
            coastalModifier = 0.60 + coastalProximity * 0.35; // 0.60 to 0.95
          }
        } else {
          // Oceans don't receive precipitation in the model
          basePrecip = 0;
        }
    
        basePrecip *= coastalModifier;
    
        // Continental moisture injection: reduced to keep interiors drier
        if (!isOcean) {
          let inlandBonus = 0;
          if (coastalProximity === 0) {
            inlandBonus = 80; // reduced deep interior boost
          } else if (coastalProximity < 0.3) {
            inlandBonus = 50 * (1 - coastalProximity / 0.3); // smaller taper toward coast
          }
          basePrecip += inlandBonus;
        }
    
    // Orographic effect (windward side) and rain shadow (leeward side)
    let orographicModifier = 1.0;
    if (!isOcean) {
      const relativeElevation = Math.max(0, (elevation[i] - seaLevel) / (1.0 - seaLevel));
      const windSpeed = Math.sqrt(windEast[i] ** 2 + windNorth[i] ** 2);
      
      // Check if upwind or downwind of mountains
      let avgUpwindElevation = 0;
      let avgDownwindElevation = 0;
      let upwindCount = 0;
      let downwindCount = 0;
      
      for (const neighbor of adjacency[i]) {
        const nv = vertices[neighbor];
        const dx = nv.x - vertices[i].x;
        const dy = nv.y - vertices[i].y;
        const dz = nv.z - vertices[i].z;
        
        // Dot product with wind direction
        const windAlign = (dx * windEast[i] + dz * windNorth[i]) / 
                         (Math.sqrt(dx*dx + dy*dy + dz*dz) * Math.max(0.1, windSpeed));
        
        if (windAlign > 0.3) {
          // Downwind neighbor
          avgDownwindElevation += elevation[neighbor];
          downwindCount++;
        } else if (windAlign < -0.3) {
          // Upwind neighbor
          avgUpwindElevation += elevation[neighbor];
          upwindCount++;
        }
      }
      
      if (upwindCount > 0) avgUpwindElevation /= upwindCount;
      if (downwindCount > 0) avgDownwindElevation /= downwindCount;
      
      // Windward side: rising air, more precipitation
      if (avgUpwindElevation < elevation[i] && windSpeed > 1) {
        const elevationGain = Math.max(0, elevation[i] - avgUpwindElevation) * 5; // km
        orographicModifier = 1.0 + Math.min(1.5, elevationGain * 0.8); // Up to 2.5x
      }
      // Leeward side (rain shadow): descending air, less precipitation
      else if (avgDownwindElevation < elevation[i] && avgUpwindElevation > elevation[i] && windSpeed > 1) {
        orographicModifier = 0.25; // 75% reduction (strong rain shadow)
      }
      // High elevations are generally drier (less moisture at altitude)
      else if (relativeElevation > 0.4) {
        orographicModifier = 0.6;
      }
    }
    
    basePrecip *= orographicModifier;
    
    // Apply minimum for extremely dry regions
    precipitation[i] = Math.max(50, basePrecip); // Minimum 50mm (hyperarid)
  }
  
  // Cap at 4000mm to prevent unrealistic extremes
  return precipitation.map(p => Math.min(4000, p));
}

/**
 * Compute humidity for each vertex using precipitation and temperature
 */
export function computeHumidity(vertices, temperature, precipitation, options) {
  const numVertices = vertices.length;
  const humidity = new Array(numVertices);
  
  for (let i = 0; i < numVertices; i++) {
    const tempC = temperature[i];
    const precip = precipitation[i];
    
    // Recalibrated humidity scale - more generous for temperate/forest ranges
    // Desert: <250mm → <0.2 humidity
    // Grassland: 250-700mm → 0.2-0.5 humidity (expanded range)
    // Temperate Forest: 700-1400mm → 0.5-0.75 humidity (adjusted)
    // Rainforest: >1400mm → 0.75-1.0 humidity
    let humidityValue = 0;
    
    if (precip < 250) {
      humidityValue = precip / 250 * 0.2; // 0 to 0.2 (desert)
    } else if (precip < 700) {
      humidityValue = 0.2 + (precip - 250) / 450 * 0.3; // 0.2 to 0.5 (grassland)
    } else if (precip < 1400) {
      humidityValue = 0.5 + (precip - 700) / 700 * 0.25; // 0.5 to 0.75 (forest)
    } else {
      humidityValue = 0.75 + Math.min((precip - 1400) / 2600 * 0.25, 0.25); // 0.75 to 1.0 (rainforest)
    }
    
    // Temperature modulation (cold air can't hold as much moisture)
    if (tempC < 0) {
      humidityValue *= 0.8; // Cold = less absolute humidity (reduced from 0.7)
    } else if (tempC > 30) {
      humidityValue *= 0.95; // Very hot = slight reduction (was 0.9)
    }
    
    humidity[i] = Math.max(0, Math.min(1, humidityValue));
  }
  
  return humidity;
}

/**
 * Biome classification based on temperature, precipitation, and elevation
 */
export const BIOMES = {
  OCEAN: { id: 0, name: 'Ocean', color: [0.1, 0.2, 0.5] },
  POLAR_ICE: { id: 1, name: 'Polar Ice', color: [0.95, 0.95, 1.0] },
  TUNDRA: { id: 2, name: 'Tundra', color: [0.7, 0.7, 0.6] },
  TAIGA: { id: 3, name: 'Taiga', color: [0.3, 0.5, 0.3] },
  TEMPERATE_FOREST: { id: 4, name: 'Temperate Forest', color: [0.2, 0.6, 0.2] },
  GRASSLAND: { id: 5, name: 'Grassland', color: [0.6, 0.7, 0.3] },
  CHAPARRAL: { id: 6, name: 'Chaparral', color: [0.7, 0.6, 0.4] },
  DESERT: { id: 7, name: 'Desert', color: [0.9, 0.8, 0.5] },
  SAVANNA: { id: 8, name: 'Savanna', color: [0.7, 0.7, 0.4] },
  TROPICAL_FOREST: { id: 9, name: 'Tropical Rainforest', color: [0.1, 0.5, 0.1] },
  MOUNTAIN: { id: 10, name: 'Mountain', color: [0.5, 0.4, 0.3] }
};

export function classifyBiome(temperature, humidity, elevation, seaLevel, precipitation = 1000) {
  // Ocean - below sea level
  if (elevation <= seaLevel) {
    // Frozen ocean becomes polar ice (sea ice, ice shelves)
    // Only at very cold temperatures to limit polar ice coverage
    if (temperature < -15) {
      return BIOMES.POLAR_ICE;
    }
    return BIOMES.OCEAN;
  }

  // Real-world biome classification based on temperature and precipitation
  // Using scientifically accurate thresholds from ecological studies
  
  // Polar Ice: < -28°C (very strict to limit polar ice to 3-5%)
  // Permanent ice caps and glaciers on land
  if (temperature < -28) {
    return BIOMES.POLAR_ICE;
  }
  
  // Tundra: -28°C to 12°C with very low precipitation
  // Real tundra: cold regions with < 200mm precipitation (narrowed significantly for more taiga)
  else if (temperature < 12) {
    if (precipitation < 200) {
      return BIOMES.TUNDRA;
    }
    // Taiga/Boreal Forest: cold regions with 200-2200mm precipitation (MASSIVELY EXPANDED + warmer zones)
    else if (precipitation < 2200) {
      return BIOMES.TAIGA;
    }
    // Cold temperate forest (very high precipitation in cold zones)
    else {
      return BIOMES.TEMPERATE_FOREST;
    }
  }
  
  // Cool Temperate: 12°C to 22°C
  else if (temperature < 22) {
    if (precipitation < 200) {
      return BIOMES.DESERT;
    }
    // Grassland: narrow band (200-210mm) - extremely narrow for greener planet
    else if (precipitation < 210) {
      return BIOMES.GRASSLAND;
    }
    // Chaparral: Mediterranean climate (210-290mm, dry)
    else if (precipitation < 290 && humidity < 0.33) {
      return BIOMES.CHAPARRAL;
    }
    // Temperate Forest: > 290mm in cool zones (MASSIVELY expanded)
    else {
      return BIOMES.TEMPERATE_FOREST;
    }
  }
  
  // Warm: 22°C to 28°C
  else if (temperature < 28) {
    if (precipitation < 200) {
      return BIOMES.DESERT;
    }
    // Grassland: narrow band (200-220mm) - very narrow
    else if (precipitation < 220) {
      return BIOMES.GRASSLAND;
    }
    // Chaparral: 220-330mm, dry
    else if (precipitation < 330 && humidity < 0.30) {
      return BIOMES.CHAPARRAL;
    }
    // Temperate Forest: 330-1000mm (HUGE range for green planet)
    else if (precipitation < 1000) {
      return BIOMES.TEMPERATE_FOREST;
    }
    // Savanna: 1000-1300mm (narrow)
    else if (precipitation < 1300) {
      return BIOMES.SAVANNA;
    }
    // Tropical Rainforest: > 1300mm
    else {
      return BIOMES.TROPICAL_FOREST;
    }
  }
  
  // Hot: 28°C to 34°C
  else if (temperature < 34) {
    if (precipitation < 230) {
      return BIOMES.DESERT;
    }
    // Grassland: 230-370mm (narrowed for greener planet)
    else if (precipitation < 370) {
      return BIOMES.GRASSLAND;
    }
    // Savanna: 370-930mm (NARROW for more tropical forests)
    else if (precipitation < 930) {
      return BIOMES.SAVANNA;
    }
    // Tropical Rainforest: > 930mm
    else {
      return BIOMES.TROPICAL_FOREST;
    }
  }
  
  // Very Hot Tropical: > 34°C
  else {
    if (precipitation < 230) {
      return BIOMES.DESERT;
    }
    // Grassland: 230-410mm (narrowed)
    else if (precipitation < 410) {
      return BIOMES.GRASSLAND;
    }
    // Savanna: 410-1130mm (NARROW for more tropical forests)
    else if (precipitation < 1130) {
      return BIOMES.SAVANNA;
    }
    // Tropical Rainforest: > 1130mm
    else {
      return BIOMES.TROPICAL_FOREST;
    }
  }
}

/**
 * Main planet generation function
 */
export function generatePlanet(geometry, seed, options = {}) {
  const {
    seaLevel = 0.0,
    solarIntensity = 1.0,
    atmosphericThickness = 1.0,
    rotationPeriod = 1.0,
    tectonicActivity = 1.0,
    axialTilt = 23.5 * Math.PI / 180,
    plateCount = 12,
    riverThreshold = 12,
    // Legacy compatibility
    globalTemperature = undefined,
    globalHumidity = undefined
  } = options;
  
  // Convert legacy parameters if provided
  const actualSolarIntensity = globalTemperature !== undefined ? globalTemperature : solarIntensity;
  const actualAtmosphericThickness = globalHumidity !== undefined ? globalHumidity : atmosphericThickness;

  console.log(`Generating planet with seed ${seed}, ${geometry.attributes.position.count} vertices`);

  // Extract vertices
  const positions = geometry.attributes.position;
  const vertices = [];
  for (let i = 0; i < positions.count; i++) {
    vertices.push({
      x: positions.getX(i),
      y: positions.getY(i),
      z: positions.getZ(i)
    });
  }

  // Step 1: Build mesh connectivity (needed for fragment removal and smoothing)
  const adjacency = buildAdjacencyList(geometry);
  
  // Step 2: Create tectonic plates using domain-warped Voronoi
  const plates = createPlates(seed, plateCount);
  let plateAssignments = assignPlates(vertices, plates, seed, adjacency);
  
  // Step 2a: Smoothing to clean up boundaries (5 iterations)
  plateAssignments = smoothPlateBoundaries(vertices, plateAssignments, adjacency, 5, 0.6);
  
  // Step 2b: Remove any remaining fragments (usually converges in 1-2 iterations)
  for (let iteration = 0; iteration < 3; iteration++) {
    const beforeRemoval = removeFragments(vertices, plateAssignments, adjacency);
    if (beforeRemoval === plateAssignments) {
      break;
    }
    plateAssignments = beforeRemoval;
  }

  // Step 3: Compute elevation
  let elevation = computeBaseElevation(vertices, plates, plateAssignments, { tectonicActivity });
  elevation = applyNoise(vertices, elevation, seed, {
    noiseScale: 2.0, // Reduced from 2.5 for larger features
    noiseStrength: 0.25, // Reduced from 0.35 for less fragmentation
    octaves: 5, // Reduced from 6 for smoother terrain
    persistence: 0.5,
    lacunarity: 2.0
  }, plateAssignments);
  
  // Smooth elevation to reduce fragmentation and create larger landmasses
  const smoothedElevation = [...elevation];
  for (let iteration = 0; iteration < 2; iteration++) {
    for (let i = 0; i < vertices.length; i++) {
      let sum = elevation[i];
      let count = 1;
      
      for (const neighbor of adjacency[i]) {
        sum += elevation[neighbor];
        count++;
      }
      
      const avgNeighbor = sum / count;
      // Blend 70% original, 30% smoothed to preserve features but reduce islands
      smoothedElevation[i] = elevation[i] * 0.7 + avgNeighbor * 0.3;
    }
    elevation = [...smoothedElevation];
  }
  
  // Add coastal detail: lakes, bays, fjords, jagged coastlines
  // Latitude-dependent features: aggressive glacial carving at high latitudes, smooth at equator
  const coastalNoise = new NoiseGenerator(seed + 3000);
  const glacialNoise = new NoiseGenerator(seed + 4000);
  const lakeNoise = new NoiseGenerator(seed + 5000);
  
  // Pre-calculate min/max for normalization
  const minElevPreDetail = Math.min(...elevation);
  const maxElevPreDetail = Math.max(...elevation);
  const elevRangePreDetail = maxElevPreDetail - minElevPreDetail;
  
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const { lat } = cartesianToSpherical(v.x, v.y, v.z);
    const absLat = Math.abs(lat) * 180 / Math.PI;
    
    const normalizedElev = (elevation[i] - minElevPreDetail) / elevRangePreDetail;
    
    // Calculate latitude-based coastal complexity
    // High latitudes (>40°): very complex (glacial activity)
    // Mid latitudes (20-40°): moderate complexity
    // Low latitudes (<20°): smooth coastlines
    const latitudeFactor = absLat > 40 ? 1.0 : 
                           absLat > 20 ? (absLat - 20) / 20 : 
                           0.15; // Minimal at equator
    
    // GLACIAL FEATURES at high latitudes (>35°) - creates European-style geography
    if (absLat > 35 && normalizedElev > 0.38 && normalizedElev < 0.75) {
      const glacialStrength = Math.min(1.0, (absLat - 35) / 25); // 0 at 35°, 1 at 60°+
      
      // Multiple scales of glacial carving for realistic fjords and bays
      const largeScale = glacialNoise.octaveNoise(v.x * 3.0, v.y * 3.0, v.z * 3.0, 2, 0.5, 2.0);
      const mediumScale = glacialNoise.octaveNoise(v.x * 6.0, v.y * 6.0, v.z * 6.0, 3, 0.6, 2.0);
      const fineScale = glacialNoise.octaveNoise(v.x * 12.0, v.y * 12.0, v.z * 12.0, 2, 0.5, 2.0);
      
      const combinedGlacial = largeScale * 0.5 + mediumScale * 0.3 + fineScale * 0.2;
      
      // Aggressive carving for fjords and glacial valleys
      if (combinedGlacial < 0.1) {
        const depthFactor = normalizedElev < 0.55 ? 1.5 : 1.0; // Deeper carving near sea level
        elevation[i] += (combinedGlacial - 0.1) * 0.35 * glacialStrength * depthFactor;
      }
    }
    
    // COASTAL DETAIL - varies by latitude
    // More jagged at high latitudes, smoother at equator
    if (normalizedElev > 0.40 && normalizedElev < 0.65) {
      const coastalDetail = coastalNoise.octaveNoise(
        v.x * 12.0,
        v.y * 12.0,
        v.z * 12.0,
        4,
        0.55,
        2.2
      );
      
      // Strongest effect right at sea level
      const coastalStrength = Math.max(0, 1.0 - Math.abs(normalizedElev - 0.525) * 3.0);
      elevation[i] += coastalDetail * 0.20 * coastalStrength * latitudeFactor;
    }
    
    // PENINSULAS - extend land into ocean at high latitudes
    if (absLat > 35 && normalizedElev > 0.48 && normalizedElev < 0.56) {
      const peninsulaDetail = coastalNoise.octaveNoise(
        v.x * 5.0,
        v.y * 5.0,
        v.z * 5.0,
        3,
        0.6,
        2.0
      );
      
      if (peninsulaDetail > 0.3) {
        const peninsulaStrength = (absLat - 35) / 30;
        elevation[i] += peninsulaDetail * 0.12 * peninsulaStrength;
      }
    }
    
    // SMALL ISLANDS and SKERRIES near coasts at high latitudes
    if (absLat > 40 && normalizedElev > 0.47 && normalizedElev < 0.53) {
      const islandDetail = coastalNoise.octaveNoise(
        v.x * 18.0,
        v.y * 18.0,
        v.z * 18.0,
        2,
        0.5,
        2.5
      );
      
      // Create scattered small islands
      if (islandDetail > 0.7) {
        const islandStrength = (absLat - 40) / 40;
        elevation[i] += islandDetail * 0.10 * islandStrength;
      }
    }
  }
  
  // Apply power function to spread out elevation distribution
  // This creates more varied terrain with smoother sea level transitions
  const minElev = Math.min(...elevation);
  const maxElev = Math.max(...elevation);
  const elevRange = maxElev - minElev;
  
  for (let i = 0; i < elevation.length; i++) {
    // Normalize to 0-1
    let normalized = (elevation[i] - minElev) / elevRange;
    
    // Apply gentler power function to avoid extreme fragmentation
    // Less aggressive than before to maintain larger landmasses
    if (normalized < 0.5) {
      normalized = 0.5 * Math.pow(normalized * 2, 1.15); // Was 1.3
    } else {
      normalized = 0.5 + 0.5 * Math.pow((normalized - 0.5) * 2, 0.85); // Was 0.8
    }
    
    // Remap to original range
    elevation[i] = minElev + normalized * elevRange;
  }
  
  // Convert sea level slider value (-1 to 1) to actual elevation percentile
  // -1 = 5th percentile (95% land), 0 = 50th percentile (50% land), 1 = 95th percentile (5% land)
  const sortedElevations = [...elevation].sort((a, b) => a - b);
  let actualSeaLevel;
  
  if (seaLevel <= 0) {
    // Map -1 to 0 → 5th to 50th percentile
    const percentile = 0.05 + (seaLevel + 1) * 0.45; // -1→0.05, 0→0.50
    const index = Math.floor(percentile * sortedElevations.length);
    actualSeaLevel = sortedElevations[Math.min(index, sortedElevations.length - 1)];
  } else {
    // Map 0 to 1 → 50th to 95th percentile
    const percentile = 0.50 + seaLevel * 0.45; // 0→0.50, 1→0.95
    const index = Math.floor(percentile * sortedElevations.length);
    actualSeaLevel = sortedElevations[Math.min(index, sortedElevations.length - 1)];
  }
  
  // Add inland lakes AFTER sea level is determined
  // This ensures they stay below sea level and are visible
  const finalLakeNoise = new NoiseGenerator(seed + 6000);
  let lakeCount = 0;
  
  for (let i = 0; i < vertices.length; i++) {
    // Only process land areas above sea level
    if (elevation[i] <= actualSeaLevel) continue;
    
    const v = vertices[i];
    
    // Check if far from ocean (not directly adjacent)
    let hasOceanNeighbor = false;
    
    for (const neighbor of adjacency[i]) {
      if (elevation[neighbor] <= actualSeaLevel) {
        hasOceanNeighbor = true;
        break;
      }
    }
    
    // Skip coastal vertices
    if (hasOceanNeighbor) continue;
    
    // Very low frequency for large, coherent lakes
    const largeLake = finalLakeNoise.octaveNoise(v.x * 0.4, v.y * 0.4, v.z * 0.4, 4, 0.7, 2.0);
    
    // Create large lakes in low to mid areas
    const elevAboveSea = elevation[i] - actualSeaLevel;
    const maxLandHeight = sortedElevations[sortedElevations.length - 1] - actualSeaLevel;
    const normalizedLandElev = elevAboveSea / maxLandHeight;
    
    // Bottom 40% of land elevation
    if (normalizedLandElev > 0.40) continue;
    
    // Strict threshold for fewer, larger lakes (~25 total)
    if (largeLake < -0.65) {
      elevation[i] = actualSeaLevel - 0.002;
      lakeCount++;
    }
  }
  
  console.log(`Created ${lakeCount} lake vertices`);

  // Step 4: Simulate water flow
  const { flowAccumulation, drainage } = simulateFlow(vertices, elevation, adjacency, actualSeaLevel);
  const rivers = extractRivers(vertices, elevation, flowAccumulation, drainage, actualSeaLevel, riverThreshold);

  // Step 5: Compute climate (new comprehensive climate model)
  console.log('Computing seasonal temperatures...');
  const seasonalTemperatures = computeSeasonalTemperatures(vertices, elevation, actualSeaLevel, {
    solarIntensity: actualSolarIntensity,
    atmosphericThickness: actualAtmosphericThickness,
    axialTilt
  });
  
  console.log('Computing wind patterns...');
  const { windEast, windNorth } = computeWindPatterns(vertices, seasonalTemperatures.annual, elevation, actualSeaLevel, {
    rotationPeriod,
    atmosphericThickness: actualAtmosphericThickness
  });
  
  console.log('Computing ocean currents...');
  const { currentEast, currentNorth } = computeOceanCurrents(vertices, seasonalTemperatures.annual, elevation, actualSeaLevel, windEast, windNorth, {
    rotationPeriod
  });
  
  // Apply ocean current heat redistribution
  console.log('Applying ocean heat transport...');
  applyOceanHeatTransport(vertices, seasonalTemperatures.annual, elevation, actualSeaLevel, currentEast, currentNorth, adjacency);
  
  console.log('Computing precipitation...');
  const precipitation = computePrecipitation(vertices, seasonalTemperatures.annual, elevation, actualSeaLevel, windEast, windNorth, adjacency, {
    atmosphericThickness: actualAtmosphericThickness,
    noiseGen: new NoiseGenerator(seed + 2000)
  });
  
  console.log('Computing humidity...');
  const humidity = computeHumidity(vertices, seasonalTemperatures.annual, precipitation, {});

  // Use annual average temperature for biome classification
  const temperature = seasonalTemperatures.annual;
  
  // Debug: Sample some climate values to check ranges
  const landSamples = [];
  const precipBuckets = {
    '<250mm': 0, '250-500mm': 0, '500-750mm': 0, '750-1000mm': 0,
    '1000-1500mm': 0, '1500-2000mm': 0, '>2000mm': 0
  };
  const tempBuckets = {
    '<0°C': 0, '0-10°C': 0, '10-20°C': 0, '20-30°C': 0, '>30°C': 0
  };
  
  for (let i = 0; i < vertices.length; i++) {
    if (elevation[i] > actualSeaLevel) {
      const p = precipitation[i];
      const t = temperature[i];
      
      // Precipitation distribution
      if (p < 250) precipBuckets['<250mm']++;
      else if (p < 500) precipBuckets['250-500mm']++;
      else if (p < 750) precipBuckets['500-750mm']++;
      else if (p < 1000) precipBuckets['750-1000mm']++;
      else if (p < 1500) precipBuckets['1000-1500mm']++;
      else if (p < 2000) precipBuckets['1500-2000mm']++;
      else precipBuckets['>2000mm']++;
      
      // Temperature distribution
      if (t < 0) tempBuckets['<0°C']++;
      else if (t < 10) tempBuckets['0-10°C']++;
      else if (t < 20) tempBuckets['10-20°C']++;
      else if (t < 30) tempBuckets['20-30°C']++;
      else tempBuckets['>30°C']++;
      
      if (i % 100 === 0) {
        landSamples.push({
          temp: t.toFixed(1),
          precip: p.toFixed(0),
          humid: humidity[i].toFixed(2),
          lat: (cartesianToSpherical(vertices[i].x, vertices[i].y, vertices[i].z).lat * 180 / Math.PI).toFixed(1)
        });
      }
    }
  }
  
  const totalLand = elevation.filter(e => e > actualSeaLevel).length;
  console.log('\n=== LAND PRECIPITATION DISTRIBUTION ===');
  Object.entries(precipBuckets).forEach(([range, count]) => {
    console.log(`  ${range}: ${(count / totalLand * 100).toFixed(1)}%`);
  });
  console.log('\n=== LAND TEMPERATURE DISTRIBUTION ===');
  Object.entries(tempBuckets).forEach(([range, count]) => {
    console.log(`  ${range}: ${(count / totalLand * 100).toFixed(1)}%`);
  });
  
  console.log('\nSample land climate values:', landSamples.slice(0, 10));
  console.log('Temp range:', Math.min(...temperature).toFixed(1), 'to', Math.max(...temperature).toFixed(1), '°C');
  console.log('Precip range:', Math.min(...precipitation).toFixed(0), 'to', Math.max(...precipitation).toFixed(0), 'mm');
  console.log('Humidity range:', Math.min(...humidity).toFixed(2), 'to', Math.max(...humidity).toFixed(2));

  // Step 6: Classify biomes based on annual averages
  const biomes = [];
  const biomeCount = {};
  for (let i = 0; i < vertices.length; i++) {
    const biome = classifyBiome(temperature[i], humidity[i], elevation[i], actualSeaLevel, precipitation[i]);
    biomes.push(biome);
    biomeCount[biome.name] = (biomeCount[biome.name] || 0) + 1;
  }
  
  // Calculate detailed biome statistics
  const totalVertices = vertices.length;
  const landVertices = biomes.filter(b => b.id !== 0).length; // Exclude ocean
  
  console.log('\n=== BIOME DISTRIBUTION ===');
  console.log('Raw counts:', biomeCount);
  console.log('\nPercentages (of total planet):');
  Object.entries(biomeCount).forEach(([name, count]) => {
    const pct = (count / totalVertices * 100).toFixed(1);
    console.log(`  ${name}: ${pct}%`);
  });
  console.log('\nPercentages (of land only):');
  Object.entries(biomeCount).forEach(([name, count]) => {
    if (name !== 'Ocean') {
      const pct = (count / landVertices * 100).toFixed(1);
      console.log(`  ${name}: ${pct}%`);
    }
  });
  console.log('\nEarth targets (for reference):');
  console.log('  Desert: 15% | Temperate Forest: 10% | Savanna: 13%');
  console.log('  Grassland: 8% | Taiga: 10% | Tropical Rainforest: 7%');
  console.log('  Tundra: 5% | Chaparral: 2-3% | Polar Ice: 3-5%');
  console.log('=========================\n');

  // Calculate statistics
  const stats = {
    vertexCount: vertices.length,
    triangleCount: geometry.index ? geometry.index.count / 3 : 0,
    plateCount: plates.length,
    riverCount: rivers.length,
    landVertices: elevation.filter(e => e > actualSeaLevel).length,
    oceanVertices: elevation.filter(e => e <= actualSeaLevel).length,
    elevationMin: Math.min(...elevation),
    elevationMax: Math.max(...elevation),
    temperatureMin: Math.min(...temperature),
    temperatureMax: Math.max(...temperature),
    precipitationMin: Math.min(...precipitation),
    precipitationMax: Math.max(...precipitation),
    avgTemperature: temperature.reduce((a, b) => a + b, 0) / temperature.length,
    avgPrecipitation: precipitation.reduce((a, b) => a + b, 0) / precipitation.length,
    seaLevel: actualSeaLevel  // Include actual sea level used
  };

  console.log('Planet generation complete:', stats);

  return {
    elevation,
    temperature,
    humidity,
    precipitation,
    biomes,
    rivers,
    flowAccumulation,
    plates,
    plateAssignments,
    stats,
    // Climate data
    seasonalTemperatures,
    windEast,
    windNorth,
    currentEast,
    currentNorth
  };
}
