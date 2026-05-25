import { PlanetScene } from './scene.js';
import { PlanetUI } from './ui.js';

// Initialize the application
function init() {
  const container = document.getElementById('canvas-container');
  const loadingEl = document.getElementById('loading');

  // Error handling wrapper
  try {
    initializeApp(container, loadingEl);
  } catch (error) {
    console.error('Failed to initialize Planet Simulator:', error);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div style="color: #ff5555; max-width: 400px; text-align: center;">
          ❌ Error initializing application<br><br>
          <span style="font-size: 14px;">${error.message}</span><br><br>
          <span style="font-size: 12px;">Please refresh the page or check the console for details.</span>
        </div>
      `;
    }
  }
}

function initializeApp(container, loadingEl) {
  // Create scene
  const scene = new PlanetScene(container);

  // Create UI with regeneration callback
  const ui = new PlanetUI(scene, (seed, options) => {
    const stats = scene.generatePlanet(seed, options);
    return stats;
  });

  // Generate initial planet with a good default seed
  console.log('Generating initial planet...');
  const initialStats = scene.generatePlanet(12345, {
    seaLevel: 0.0,
    solarIntensity: 0.0,
    atmosphericThickness: 1.0,
    rotationPeriod: 1.0,
    tectonicActivity: 1.0,
    axialTilt: 23.5 * Math.PI / 180,
    plateCount: 15,
    riverThreshold: 60 / 5
  });

  ui.updateStats(initialStats);
  
  // Set initial visualization settings
  scene.setShowAxis(true);
  scene.setShowHoverInfo(true);

  // Hide loading screen
  setTimeout(() => {
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }, 500);

  // Hide hover hint after 5 seconds
  const hoverHint = document.getElementById('hover-hint');
  if (hoverHint) {
    setTimeout(() => {
      hoverHint.style.transition = 'opacity 0.5s';
      hoverHint.style.opacity = '0';
      setTimeout(() => hoverHint.style.display = 'none', 500);
    }, 5000);
  }

  console.log('Planet Simulator initialized successfully');
  console.log('Controls: Left-click to rotate, Right-click to pan, Scroll to zoom');
  console.log('Hover over the planet to see detailed point information');
  
  // Expose test function to console for rapid iteration
  window.testBiomes = function(count = 5) {
    console.log(`\n🧪 Testing ${count} random planets for biome distribution...`);
    const results = [];
    
    for (let i = 0; i < count; i++) {
      const seed = Math.floor(Math.random() * 1000000);
      console.log(`\n--- Test ${i + 1}/${count} (seed: ${seed}) ---`);
      scene.generatePlanet(seed, {
        seaLevel: 0.0,
        solarIntensity: 0.0,
        atmosphericThickness: 1.0,
        rotationPeriod: 1.0,
        tectonicActivity: 1.0,
        axialTilt: 23.5 * Math.PI / 180,
        plateCount: 15
      });
    }
    
    console.log('\n✅ Testing complete! Check distributions above.');
  };
  
  console.log('💡 Tip: Run testBiomes(5) in console to test multiple planets');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
