// Test script to run biome generation and see distributions
import * as THREE from 'three';
import { generatePlanet } from './src/planetGenerator.js';

// Create a test icosphere geometry
function createIcosphere(radius, detail) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  return geometry;
}

// Run tests
console.log('🧪 Testing biome distributions with EXACT UI defaults...\n');

const results = [];
const numTests = 10; // Test 10 random planets
for (let i = 0; i < numTests; i++) {
  const seed = Math.floor(Math.random() * 100000);
  console.log(`\n--- Test ${i + 1}/${numTests} (seed: ${seed}) ---`);
  
  // Use detail level 30 to match the actual app (not 5!)
  const geometry = createIcosphere(1, 30);
  
  // Use EXACT same defaults as UI (from ui.js params)
  const planetData = generatePlanet(geometry, seed, {
    planetSize: 1.0,
    seaLevel: 0.0,
    solarIntensity: 0.0,
    atmosphericThickness: 1.0,
    rotationPeriod: 1.0,
    tectonicActivity: 1.0,
    axialTilt: 23.5 * Math.PI / 180,
    plateCount: 15,
    riverThreshold: 100
  });
  
  // Collect biome counts
  const biomeCount = {};
  planetData.biomes.forEach(biome => {
    biomeCount[biome.name] = (biomeCount[biome.name] || 0) + 1;
  });
  
  // Calculate land percentages
  const totalVertices = planetData.biomes.length;
  const landVertices = planetData.biomes.filter(b => b.id !== 0).length;
  
  const landPercentages = {};
  Object.entries(biomeCount).forEach(([name, count]) => {
    if (name !== 'Ocean') {
      landPercentages[name] = (count / landVertices * 100);
    }
  });
  
  console.log('Land biome percentages:');
  Object.entries(landPercentages).sort((a, b) => b[1] - a[1]).forEach(([biome, pct]) => {
    console.log(`  ${biome}: ${pct.toFixed(1)}%`);
  });
  
  results.push(landPercentages);
}

// Calculate averages
console.log('\n\n=== AVERAGE ACROSS ALL TESTS ===');
const allBiomes = new Set();
results.forEach(r => Object.keys(r).forEach(b => allBiomes.add(b)));

const averages = {};
const mins = {};
const maxs = {};
allBiomes.forEach(biome => {
  const values = results.map(r => parseFloat(r[biome] || 0));
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  averages[biome] = avg;
  mins[biome] = Math.min(...values);
  maxs[biome] = Math.max(...values);
});

console.log('Average percentages (of land):');
Object.entries(averages).sort((a, b) => b[1] - a[1]).forEach(([biome, pct]) => {
  console.log(`  ${biome}: ${pct.toFixed(1)}% (range: ${mins[biome].toFixed(1)}-${maxs[biome].toFixed(1)}%)`);
});

console.log('\n🎯 Earth targets:');
console.log('  Desert: 15% | Temperate Forest: 10% | Savanna: 13%');
console.log('  Grassland: 8% | Taiga: 10% | Tropical Rainforest: 7%');
console.log('  Tundra: 5% | Chaparral: 2-3% | Polar Ice: 3-5%');

// Check for problem planets
console.log('\n⚠️  Problem planets (Desert >25%):');
results.forEach((r, i) => {
  if (r['Desert'] > 25) {
    console.log(`  Test ${i + 1}: Desert ${r['Desert'].toFixed(1)}%`);
  }
});

