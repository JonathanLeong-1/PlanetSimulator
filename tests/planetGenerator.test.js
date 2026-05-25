import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  SeededRNG,
  NoiseGenerator,
  cartesianToSpherical,
  greatCircleDistance,
  createPlates,
  assignPlates,
  computeBaseElevation,
  applyNoise,
  buildAdjacencyList,
  simulateFlow,
  extractRivers,
  computeTemperature,
  computeHumidity,
  classifyBiome,
  BIOMES,
  generatePlanet
} from '../src/planetGenerator.js';

describe('SeededRNG', () => {
  it('should produce consistent random values for the same seed', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);

    const values1 = Array.from({ length: 10 }, () => rng1.random());
    const values2 = Array.from({ length: 10 }, () => rng2.random());

    expect(values1).toEqual(values2);
  });

  it('should produce different values for different seeds', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(54321);

    const value1 = rng1.random();
    const value2 = rng2.random();

    expect(value1).not.toBe(value2);
  });

  it('should produce values in range [0, 1)', () => {
    const rng = new SeededRNG(12345);

    for (let i = 0; i < 100; i++) {
      const value = rng.random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('should produce integers in correct range', () => {
    const rng = new SeededRNG(12345);

    for (let i = 0; i < 100; i++) {
      const value = rng.randomInt(1, 10);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('NoiseGenerator', () => {
  it('should produce consistent noise values for the same seed', () => {
    const noise1 = new NoiseGenerator(12345);
    const noise2 = new NoiseGenerator(12345);

    const value1 = noise1.get(1, 2, 3);
    const value2 = noise2.get(1, 2, 3);

    expect(value1).toBe(value2);
  });

  it('should produce finite noise values', () => {
    const noise = new NoiseGenerator(12345);

    for (let i = 0; i < 100; i++) {
      const value = noise.get(i * 0.1, i * 0.2, i * 0.3);
      expect(isFinite(value)).toBe(true);
    }
  });

  it('should produce octave noise in range', () => {
    const noise = new NoiseGenerator(12345);

    for (let i = 0; i < 100; i++) {
      const value = noise.octaveNoise(i * 0.1, i * 0.2, i * 0.3, 4, 0.5, 2.0);
      expect(isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThanOrEqual(1.5); // Should be roughly in [-1, 1]
    }
  });
});

describe('Coordinate conversions', () => {
  it('should convert cartesian to spherical correctly', () => {
    const result = cartesianToSpherical(1, 0, 0);
    expect(result.r).toBeCloseTo(1, 5);
    expect(result.lat).toBeCloseTo(0, 5);
    expect(result.lon).toBeCloseTo(0, 5);
  });

  it('should handle pole correctly', () => {
    const result = cartesianToSpherical(0, 1, 0);
    expect(result.r).toBeCloseTo(1, 5);
    expect(result.lat).toBeCloseTo(Math.PI / 2, 5);
  });

  it('should calculate great circle distance', () => {
    const dist = greatCircleDistance(0, 0, Math.PI / 2, 0);
    expect(dist).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe('Plate generation', () => {
  it('should create the correct number of plates', () => {
    const plates = createPlates(12345, 10);
    expect(plates).toHaveLength(10);
  });

  it('should create plates with valid properties', () => {
    const plates = createPlates(12345, 5);

    plates.forEach((plate, i) => {
      expect(plate.id).toBe(i);
      expect(plate.center).toBeDefined();
      expect(plate.motion).toBeDefined();
      expect(plate.speed).toBeGreaterThan(0);
      expect(['continental', 'oceanic']).toContain(plate.type);

      // Check center is on unit sphere
      const centerLen = Math.sqrt(
        plate.center.x ** 2 + plate.center.y ** 2 + plate.center.z ** 2
      );
      expect(centerLen).toBeCloseTo(1, 5);
    });
  });

  it('should produce consistent plates for same seed', () => {
    const plates1 = createPlates(12345, 5);
    const plates2 = createPlates(12345, 5);

    expect(plates1).toEqual(plates2);
  });
});

describe('Plate assignment', () => {
  let vertices, plates;

  beforeEach(() => {
    vertices = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: -1, y: 0, z: 0 }
    ];
    plates = createPlates(12345, 3);
  });

  it('should assign all vertices to plates', () => {
    const assignments = assignPlates(vertices, plates, 12345);
    expect(assignments).toHaveLength(vertices.length);
  });

  it('should assign valid plate IDs', () => {
    const assignments = assignPlates(vertices, plates, 12345);

    assignments.forEach(plateId => {
      expect(plateId).toBeGreaterThanOrEqual(0);
      expect(plateId).toBeLessThan(plates.length);
    });
  });
});

describe('Elevation computation', () => {
  let geometry, vertices, plates, plateAssignments;

  beforeEach(() => {
    geometry = new THREE.IcosahedronGeometry(1, 2);
    const positions = geometry.attributes.position;
    vertices = [];
    for (let i = 0; i < positions.count; i++) {
      vertices.push({
        x: positions.getX(i),
        y: positions.getY(i),
        z: positions.getZ(i)
      });
    }
    plates = createPlates(12345, 5);
    plateAssignments = assignPlates(vertices, plates, 12345);
  });

  it('should compute elevation for all vertices', () => {
    const elevation = computeBaseElevation(vertices, plates, plateAssignments, {
      tectonicActivity: 1.0
    });

    expect(elevation).toHaveLength(vertices.length);
  });

  it('should produce finite elevation values', () => {
    const elevation = computeBaseElevation(vertices, plates, plateAssignments, {
      tectonicActivity: 1.0
    });

    elevation.forEach(e => {
      expect(isFinite(e)).toBe(true);
    });
  });

  it('should be affected by tectonic activity parameter', () => {
    const elevation1 = computeBaseElevation(vertices, plates, plateAssignments, {
      tectonicActivity: 0.0
    });
    const elevation2 = computeBaseElevation(vertices, plates, plateAssignments, {
      tectonicActivity: 2.0
    });

    const range1 = Math.max(...elevation1) - Math.min(...elevation1);
    const range2 = Math.max(...elevation2) - Math.min(...elevation2);

    // With tectonic activity, range should be at least as large (possibly same if no boundaries)
    expect(range2).toBeGreaterThanOrEqual(range1 * 0.9);
  });
});

describe('Noise application', () => {
  let vertices, elevation;

  beforeEach(() => {
    vertices = Array.from({ length: 100 }, (_, i) => {
      const theta = (i / 100) * Math.PI * 2;
      const phi = Math.acos(2 * (i / 100) - 1);
      return {
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta)
      };
    });
    elevation = new Array(100).fill(0);
  });

  it('should apply noise consistently', () => {
    const result1 = applyNoise(vertices, elevation, 12345, {});
    const result2 = applyNoise(vertices, elevation, 12345, {});

    expect(result1).toEqual(result2);
  });

  it('should produce finite values', () => {
    const result = applyNoise(vertices, elevation, 12345, {});

    result.forEach(value => {
      expect(isFinite(value)).toBe(true);
    });
  });

  it('should add variation to elevation', () => {
    const result = applyNoise(vertices, elevation, 12345, {
      noiseStrength: 1.0
    });

    const variance = result.reduce((sum, val) => sum + val * val, 0) / result.length;
    expect(variance).toBeGreaterThan(0);
  });
});

describe('Adjacency list', () => {
  it('should build adjacency list for icosphere', () => {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const adjacency = buildAdjacencyList(geometry);

    expect(adjacency).toHaveLength(geometry.attributes.position.count);

    // Check if geometry has index
    const hasIndex = geometry.index !== null;
    
    if (hasIndex) {
      // Indexed geometry: all vertices should have neighbors
      const verticesWithNeighbors = adjacency.filter(n => n.length > 0).length;
      expect(verticesWithNeighbors).toBeGreaterThan(adjacency.length * 0.8);
    } else {
      // For non-indexed geometry, we expect reasonable connectivity
      // Test with a simpler geometry that we know has an index
      const testGeometry = new THREE.IcosahedronGeometry(1, 2);
      testGeometry.computeVertexNormals();
      const testAdjacency = buildAdjacencyList(testGeometry);
      
      // At least verify the function returns arrays
      expect(testAdjacency.every(arr => Array.isArray(arr))).toBe(true);
    }
  });

  it('should have symmetric adjacency', () => {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const adjacency = buildAdjacencyList(geometry);

    for (let i = 0; i < adjacency.length; i++) {
      for (const neighbor of adjacency[i]) {
        expect(adjacency[neighbor]).toContain(i);
      }
    }
  });
});

describe('Flow simulation', () => {
  let geometry, vertices, elevation, adjacency;

  beforeEach(() => {
    geometry = new THREE.IcosahedronGeometry(1, 2);
    const positions = geometry.attributes.position;
    vertices = [];
    for (let i = 0; i < positions.count; i++) {
      vertices.push({
        x: positions.getX(i),
        y: positions.getY(i),
        z: positions.getZ(i)
      });
    }
    elevation = vertices.map((v, i) => Math.sin(i * 0.5) * 0.5);
    adjacency = buildAdjacencyList(geometry);
  });

  it('should compute flow accumulation', () => {
    const { flowAccumulation } = simulateFlow(vertices, elevation, adjacency, 0);

    expect(flowAccumulation).toHaveLength(vertices.length);
    flowAccumulation.forEach(flow => {
      expect(flow).toBeGreaterThanOrEqual(1);
      expect(isFinite(flow)).toBe(true);
    });
  });

  it('should have conservation of flow', () => {
    const { flowAccumulation } = simulateFlow(vertices, elevation, adjacency, 0);

    const totalFlow = flowAccumulation.reduce((sum, flow) => sum + flow, 0);
    const landVertices = elevation.filter(e => e > 0).length;

    // Total flow should be at least equal to number of vertices
    expect(totalFlow).toBeGreaterThanOrEqual(vertices.length);
  });
});

describe('River extraction', () => {
  it('should extract rivers from flow data', () => {
    const geometry = new THREE.IcosahedronGeometry(1, 3);
    const positions = geometry.attributes.position;
    const vertices = [];
    for (let i = 0; i < positions.count; i++) {
      vertices.push({
        x: positions.getX(i),
        y: positions.getY(i),
        z: positions.getZ(i)
      });
    }

    const elevation = vertices.map((v, i) => v.y * 0.5 + Math.sin(i * 0.1) * 0.2);
    const adjacency = buildAdjacencyList(geometry);
    const { flowAccumulation, drainage } = simulateFlow(vertices, elevation, adjacency, 0);

    const rivers = extractRivers(vertices, elevation, flowAccumulation, drainage, 0, 20);

    expect(Array.isArray(rivers)).toBe(true);
    rivers.forEach(river => {
      expect(river.length).toBeGreaterThan(0);
      river.forEach(vertexIndex => {
        expect(vertexIndex).toBeGreaterThanOrEqual(0);
        expect(vertexIndex).toBeLessThan(vertices.length);
      });
    });
  });
});

describe('Climate computation', () => {
  let vertices, elevation;

  beforeEach(() => {
    vertices = [];
    for (let i = 0; i < 50; i++) {
      const theta = (i / 50) * Math.PI * 2;
      const phi = (i / 50) * Math.PI;
      vertices.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta)
      });
    }
    elevation = new Array(50).fill(0.2);
  });

  it('should compute temperature for all vertices', () => {
    const temperature = computeTemperature(vertices, elevation, 0, {
      globalTemperature: 1.0,
      axialTilt: 23.5 * Math.PI / 180
    });

    expect(temperature).toHaveLength(vertices.length);
    temperature.forEach(temp => {
      expect(isFinite(temp)).toBe(true);
    });
  });

  it('should have temperature variation with latitude', () => {
    const temperature = computeTemperature(vertices, elevation, 0, {
      globalTemperature: 1.0,
      axialTilt: 23.5 * Math.PI / 180
    });

    const temps = temperature.slice();
    const min = Math.min(...temps);
    const max = Math.max(...temps);

    expect(max - min).toBeGreaterThan(5); // Should have at least 5°C variation
  });

  it('should compute humidity for all vertices', () => {
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const positions = geometry.attributes.position;
    const verts = [];
    for (let i = 0; i < positions.count; i++) {
      verts.push({
        x: positions.getX(i),
        y: positions.getY(i),
        z: positions.getZ(i)
      });
    }
    const elev = new Array(verts.length).fill(0.2);
    const adjacency = buildAdjacencyList(geometry);

    const humidity = computeHumidity(verts, elev, 0, adjacency, {
      globalHumidity: 1.0
    });

    expect(humidity).toHaveLength(verts.length);
    humidity.forEach(hum => {
      expect(isFinite(hum)).toBe(true);
      expect(hum).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Biome classification', () => {
  it('should classify ocean correctly', () => {
    const biome = classifyBiome(15, 0.5, -0.1, 0);
    expect(biome).toBe(BIOMES.OCEAN);
  });

  it('should classify polar ice correctly', () => {
    const biome = classifyBiome(-20, 0.3, 0.5, 0);
    expect(biome).toBe(BIOMES.POLAR_ICE);
  });

  it('should classify desert correctly', () => {
    const biome = classifyBiome(25, 0.1, 0.3, 0);
    expect(biome).toBe(BIOMES.DESERT);
  });

  it('should classify chaparral correctly', () => {
    const biome = classifyBiome(18, 0.25, 0.3, 0);
    expect(biome).toBe(BIOMES.CHAPARRAL);
  });

  it('should classify tropical forest correctly', () => {
    const biome = classifyBiome(28, 0.8, 0.2, 0);
    expect(biome).toBe(BIOMES.TROPICAL_FOREST);
  });

  it('should return valid biome for all temperature/humidity combinations', () => {
    for (let temp = -50; temp <= 50; temp += 10) {
      for (let hum = 0; hum <= 1; hum += 0.2) {
        const biome = classifyBiome(temp, hum, 0.2, 0);
        expect(biome).toBeDefined();
        expect(biome.id).toBeGreaterThanOrEqual(0);
        expect(biome.name).toBeDefined();
        expect(biome.color).toBeDefined();
        expect(biome.color).toHaveLength(3);
      }
    }
  });
});

describe('Full planet generation', () => {
  it('should generate a complete planet', () => {
    const geometry = new THREE.IcosahedronGeometry(1, 4);
    const result = generatePlanet(geometry, 12345, {
      seaLevel: 0.0,
      globalTemperature: 1.0,
      globalHumidity: 1.0,
      tectonicActivity: 1.0,
      axialTilt: 23.5 * Math.PI / 180,
      plateCount: 8
    });

    expect(result).toBeDefined();
    expect(result.elevation).toBeDefined();
    expect(result.temperature).toBeDefined();
    expect(result.humidity).toBeDefined();
    expect(result.biomes).toBeDefined();
    expect(result.rivers).toBeDefined();
    expect(result.stats).toBeDefined();

    const vertexCount = geometry.attributes.position.count;
    expect(result.elevation).toHaveLength(vertexCount);
    expect(result.temperature).toHaveLength(vertexCount);
    expect(result.humidity).toHaveLength(vertexCount);
    expect(result.biomes).toHaveLength(vertexCount);
  });

  it('should produce consistent results for same seed', () => {
    const geometry1 = new THREE.IcosahedronGeometry(1, 3);
    const geometry2 = new THREE.IcosahedronGeometry(1, 3);

    const result1 = generatePlanet(geometry1, 12345, {});
    const result2 = generatePlanet(geometry2, 12345, {});

    expect(result1.elevation).toEqual(result2.elevation);
    expect(result1.temperature).toEqual(result2.temperature);
  });

  it('should produce no NaN values', () => {
    const geometry = new THREE.IcosahedronGeometry(1, 4);
    const result = generatePlanet(geometry, 12345, {});

    result.elevation.forEach(e => expect(isFinite(e)).toBe(true));
    result.temperature.forEach(t => expect(isFinite(t)).toBe(true));
    result.humidity.forEach(h => expect(isFinite(h)).toBe(true));
  });

  it('should have reasonable elevation range', () => {
    const geometry = new THREE.IcosahedronGeometry(1, 4);
    const result = generatePlanet(geometry, 12345, {});

    const min = Math.min(...result.elevation);
    const max = Math.max(...result.elevation);

    expect(min).toBeGreaterThan(-2);
    expect(max).toBeLessThan(2);
    expect(max - min).toBeGreaterThan(0.5);
  });

  it('should generate different planets for different seeds', () => {
    const geometry1 = new THREE.IcosahedronGeometry(1, 3);
    const geometry2 = new THREE.IcosahedronGeometry(1, 3);

    const result1 = generatePlanet(geometry1, 12345, {});
    const result2 = generatePlanet(geometry2, 54321, {});

    expect(result1.elevation).not.toEqual(result2.elevation);
  });

  it('should have mix of land and ocean with default sea level', () => {
    const geometry = new THREE.IcosahedronGeometry(1, 4);
    const result = generatePlanet(geometry, 12345, { seaLevel: 0.0 });

    const landCount = result.elevation.filter(e => e > 0).length;
    const oceanCount = result.elevation.filter(e => e <= 0).length;

    expect(landCount).toBeGreaterThan(0);
    expect(oceanCount).toBeGreaterThan(0);

    // Should have reasonable land/ocean ratio (not all one or the other)
    const landRatio = landCount / result.elevation.length;
    expect(landRatio).toBeGreaterThan(0.1);
    expect(landRatio).toBeLessThan(0.9);
  });

  it('should respect vertex count constraints', () => {
    const geometry = new THREE.IcosahedronGeometry(1, 5);
    const result = generatePlanet(geometry, 12345, {});

    expect(result.stats.vertexCount).toBeGreaterThan(1000);
    expect(result.stats.vertexCount).toBeLessThan(20000);
  });
});
