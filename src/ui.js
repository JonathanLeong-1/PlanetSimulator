import GUI from 'lil-gui';

export class PlanetUI {
  constructor(scene, onRegenerate) {
    this.scene = scene;
    this.onRegenerate = onRegenerate;
    
    this.params = {
      seed: 12345,
      planetSize: 1.0,
      seaLevel: 0.0,
      solarIntensity: 0.0,
      atmosphericThickness: 1.0,
      rotationPeriod: 1.0,
      tectonicActivity: 1.0,
      axialTilt: 23.5,
      plateCount: 15,
      riverThreshold: 60,
      
      // Visualization
      visualizationMode: 'biome',
      showRivers: true,
      showWireframe: true,
      showAxis: true,
      showHoverInfo: true,
      rotateEnabled: true,
      
      // Climate visualization layers
      showWindVectors: false,
      showOceanCurrents: false,
      showPrecipitation: false,
      showDayNight: false,
      showBiomeBoundaries: false,
      
      // Actions
      regenerate: () => this.regenerate(),
      randomSeed: () => this.randomizeSeed()
    };

    this.createGUI();
    this.updateStats();
  }

  createGUI() {
    this.gui = new GUI({ title: 'Planet Controls', width: 300 });

    // Planet Parameters folder
    const planetFolder = this.gui.addFolder('Planet Parameters');
    
    planetFolder.add(this.params, 'seed', 0, 99999, 1)
      .name('Seed');
    
    planetFolder.add(this.params, 'randomSeed')
      .name('Random Seed');
    
    planetFolder.add(this.params, 'planetSize', 0.5, 2.0, 0.1)
      .name('Planet Size');
    
    planetFolder.add(this.params, 'seaLevel', -1.0, 1.0, 0.05)
      .name('Sea Level');
    
    planetFolder.add(this.params, 'solarIntensity', -1.0, 1.0, 0.05)
      .name('Solar Intensity')
      .listen();
    
    planetFolder.add(this.params, 'atmosphericThickness', 0.0, 2.0, 0.1)
      .name('Atmosphere Thickness')
      .listen();
    
    planetFolder.add(this.params, 'rotationPeriod', 0.1, 5.0, 0.1)
      .name('Rotation Period (days)')
      .listen();
    
    planetFolder.add(this.params, 'tectonicActivity', 0.0, 2.0, 0.1)
      .name('Tectonic Activity');
    
    planetFolder.add(this.params, 'axialTilt', 0, 90, 1)
      .name('Axial Tilt (°)');
    
    planetFolder.add(this.params, 'plateCount', 5, 25, 1)
      .name('Plate Count');
    
    planetFolder.add(this.params, 'riverThreshold', 0, 100, 1)
      .name('River Threshold');
    
    // Add Generate Planet button at the top
    planetFolder.add(this.params, 'regenerate')
      .name('🌍 Generate Planet');

    planetFolder.open();

    // Visualization folder
    const vizFolder = this.gui.addFolder('Visualization');
    
    vizFolder.add(this.params, 'visualizationMode', [
      'biome',
      'elevation',
      'temperature',
      'humidity',
      'precipitation',
      'flow',
      'plates'
    ])
      .name('Display Mode')
      .onChange((value) => {
        this.scene.setVisualizationMode(value);
      });
    
    vizFolder.add(this.params, 'showRivers')
      .name('Show Rivers')
      .onChange((value) => {
        this.scene.setShowRivers(value);
      });
    
    vizFolder.add(this.params, 'showWireframe')
      .name('Show Wireframe')
      .onChange((value) => {
        this.scene.setShowWireframe(value);
      });
    
    vizFolder.add(this.params, 'showAxis')
      .name('Show Rotation Axis')
      .onChange((value) => {
        this.scene.setShowAxis(value);
      });
    
    vizFolder.add(this.params, 'showHoverInfo')
      .name('Show Hover Details')
      .onChange((value) => {
        this.scene.setShowHoverInfo(value);
      });
    
    vizFolder.add(this.params, 'rotateEnabled')
      .name('🔄 Rotation Animation')
      .onChange((value) => {
        this.scene.setRotationEnabled(value);
      });
    
    vizFolder.add(this.params, 'showDayNight')
      .name('Show Day/Night Line')
      .onChange((value) => {
        this.scene.setShowDayNight(value);
      });
    
    vizFolder.add(this.params, 'showBiomeBoundaries')
      .name('Show Biome Boundaries')
      .onChange((value) => {
        this.scene.setShowBiomeBoundaries(value);
      });

    vizFolder.open();
    
    // Climate Layers folder
    const climateFolder = this.gui.addFolder('Climate Layers');
    
    climateFolder.add(this.params, 'showWindVectors')
      .name('Show Wind Patterns')
      .onChange((value) => {
        this.scene.setShowWindVectors(value);
      });
    
    climateFolder.add(this.params, 'showOceanCurrents')
      .name('Show Ocean Currents')
      .onChange((value) => {
        this.scene.setShowOceanCurrents(value);
      });
    
    // Initially closed
    climateFolder.close();

    // Stats display
    this.statsFolder = this.gui.addFolder('Statistics');
    this.statsControllers = {
      vertices: this.statsFolder.add({ value: 0 }, 'value').name('Vertices').disable(),
      triangles: this.statsFolder.add({ value: 0 }, 'value').name('Triangles').disable(),
      plates: this.statsFolder.add({ value: 0 }, 'value').name('Plates').disable(),
      rivers: this.statsFolder.add({ value: 0 }, 'value').name('Rivers').disable(),
      landPercentage: this.statsFolder.add({ value: 0 }, 'value').name('Land %').disable(),
      elevationRange: this.statsFolder.add({ value: '' }, 'value').name('Elevation').disable(),
      tempRange: this.statsFolder.add({ value: '' }, 'value').name('Temperature').disable()
    };
    
    // Add Biome Distribution section
    const biomeFolder = this.statsFolder.addFolder('Biome Distribution');
    this.biomeControllers = {};
    
    // Pre-create controllers for all biomes
    const biomeOrder = [
      'Ocean', 'Polar Ice', 'Tundra', 'Taiga', 'Temperate Forest',
      'Grassland', 'Chaparral', 'Desert', 'Savanna', 'Tropical Rainforest'
    ];

    const biomeEmojis = {
      'Ocean': '🌊',
      'Polar Ice': '❄️',
      'Tundra': '🧊',
      'Taiga': '🌲',
      'Temperate Forest': '🌳',
      'Grassland': '🌾',
      'Chaparral': '🌿',
      'Desert': '🌵',
      'Savanna': '🦁',
      'Tropical Rainforest': '🌴'
    };
    
    biomeOrder.forEach(biomeName => {
      const emoji = biomeEmojis[biomeName] || '🌍';
      const controller = biomeFolder.add({ value: '0.0%' }, 'value')
        .name(`${emoji} ${biomeName}`)
        .disable();
        
      this.biomeControllers[biomeName] = controller;
      
      // Custom DOM manipulation to add info icon and fix colors
      setTimeout(() => {
        const domElement = controller.domElement;
        const nameElement = domElement.querySelector('.name');
        const widgetElement = domElement.querySelector('.widget');
        
        // Fix colors
        if (nameElement) nameElement.style.color = '#ffffff';
        if (widgetElement) {
          const input = widgetElement.querySelector('input');
          if (input) {
            input.style.color = '#1f8b4c';
            input.style.opacity = '1';
          }
        }
        
        // Add info icon
        if (nameElement) {
          const infoSpan = document.createElement('span');
          infoSpan.textContent = ' ℹ️';
          infoSpan.style.cursor = 'pointer';
          infoSpan.style.marginLeft = '8px';
          infoSpan.style.opacity = '0.8';
          infoSpan.title = 'View Biome Details';
          
          infoSpan.onmouseover = () => infoSpan.style.opacity = '1';
          infoSpan.onmouseout = () => infoSpan.style.opacity = '0.8';
          
          infoSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showBiomeInfo(biomeName);
          });
          
          nameElement.appendChild(infoSpan);
          nameElement.style.pointerEvents = 'auto'; // Ensure clicks work even if disabled
        }
        
        // Ensure the row itself doesn't look disabled
        domElement.classList.remove('disabled');
        domElement.style.opacity = '1';
      }, 0);
    });
    
    // Fix colors for main stats as well
    setTimeout(() => {
      Object.values(this.statsControllers).forEach(controller => {
        const domElement = controller.domElement;
        const nameElement = domElement.querySelector('.name');
        const widgetElement = domElement.querySelector('.widget');
        
        if (nameElement) nameElement.style.color = '#ffffff';
        if (widgetElement) {
          const input = widgetElement.querySelector('input');
          if (input) {
            input.style.color = '#1f8b4c';
            input.style.opacity = '1';
          }
        }
        domElement.classList.remove('disabled');
        domElement.style.opacity = '1';
      });
    }, 0);
    
    biomeFolder.close();
    this.statsFolder.close();
    
    // Create biome info modal
    this.createBiomeInfoModal();
  }

  regenerate() {
    // Show loading message
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = 'block';
    }

    // Defer generation to next frame to allow UI update
    setTimeout(() => {
      const options = {
        planetSize: this.params.planetSize,
        seaLevel: this.params.seaLevel,
        solarIntensity: this.params.solarIntensity,
        atmosphericThickness: this.params.atmosphericThickness,
        rotationPeriod: this.params.rotationPeriod,
        tectonicActivity: this.params.tectonicActivity,
        axialTilt: this.params.axialTilt * Math.PI / 180,
        plateCount: this.params.plateCount,
        riverThreshold: this.params.riverThreshold / 5
      };

      const stats = this.onRegenerate(this.params.seed, options);
      this.updateStats(stats);

      // Update visualization settings
      this.scene.setVisualizationMode(this.params.visualizationMode);
      this.scene.setShowRivers(this.params.showRivers);
      this.scene.setShowWireframe(this.params.showWireframe);

      // Hide loading message
      if (loadingEl) {
        loadingEl.style.display = 'none';
      }
    }, 50);
  }

  randomizeSeed() {
    this.params.seed = Math.floor(Math.random() * 100000);
    this.gui.controllersRecursive().forEach(controller => {
      if (controller.property === 'seed') {
        controller.updateDisplay();
      }
    });
    this.regenerate();
  }

  updateStats(stats) {
    if (!stats) return;

    const landPercentage = stats.landVertices && stats.vertexCount 
      ? ((stats.landVertices / stats.vertexCount) * 100).toFixed(1)
      : '0';

    this.statsControllers.vertices.object.value = stats.vertexCount || 0;
    this.statsControllers.triangles.object.value = stats.triangleCount || 0;
    this.statsControllers.plates.object.value = stats.plateCount || 0;
    this.statsControllers.rivers.object.value = stats.riverCount || 0;
    this.statsControllers.landPercentage.object.value = landPercentage;
    this.statsControllers.elevationRange.object.value = stats.elevationMin !== undefined 
      ? `${stats.elevationMin.toFixed(2)} to ${stats.elevationMax.toFixed(2)}`
      : 'N/A';
    this.statsControllers.tempRange.object.value = stats.temperatureMin !== undefined
      ? `${stats.temperatureMin.toFixed(1)}°C to ${stats.temperatureMax.toFixed(1)}°C`
      : 'N/A';

    // Update all controllers
    Object.values(this.statsControllers).forEach(controller => {
      controller.updateDisplay();
    });
    
    // Update biome distribution
    const biomeStats = this.scene.getBiomeStatistics();
    if (biomeStats) {
      biomeStats.forEach(({ biome, percentage }) => {
        if (this.biomeControllers[biome.name]) {
          this.biomeControllers[biome.name].object.value = `${percentage}%`;
          this.biomeControllers[biome.name].updateDisplay();
        }
      });
    }

    // Update info panel
    this.updateInfoPanel(stats);
  }

  updateInfoPanel(stats) {
    const statsDiv = document.getElementById('stats');
    if (statsDiv && stats) {
      statsDiv.innerHTML = `
        <strong>Vertices:</strong> ${stats.vertexCount?.toLocaleString()}<br>
        <strong>Triangles:</strong> ${stats.triangleCount?.toLocaleString()}<br>
        <strong>Rivers:</strong> ${stats.riverCount}<br>
        <strong>Land:</strong> ${((stats.landVertices / stats.vertexCount) * 100).toFixed(1)}%
      `;
    }
  }

  createBiomeInfoModal() {
    // Create modal backdrop
    this.biomeModal = document.createElement('div');
    this.biomeModal.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 10000;
      justify-content: center;
      align-items: center;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: rgba(20, 20, 20, 0.98);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      color: white;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.9);
    `;
    
    this.biomeModalContent = modalContent;
    this.biomeModal.appendChild(modalContent);
    document.body.appendChild(this.biomeModal);
    
    // Close on backdrop click
    this.biomeModal.addEventListener('click', (e) => {
      if (e.target === this.biomeModal) {
        this.biomeModal.style.display = 'none';
      }
    });
  }

  addBiomeInfoClickHandlers(biomeFolder) {
    // Get all the controller elements
    const controllers = biomeFolder.controllersRecursive();
    
    controllers.forEach(controller => {
      const biomeName = controller._name.replace(' ℹ️', '');
      const element = controller.domElement;
      
      // Make the entire row clickable
      const nameElement = element.querySelector('.name');
      if (nameElement) {
        nameElement.style.cursor = 'pointer';
        nameElement.addEventListener('click', () => {
          this.showBiomeInfo(biomeName);
        });
      }
    });
  }

  showBiomeInfo(biomeName) {
    const biomeInfoMap = {
      'Ocean': {
        description: 'Vast bodies of water covering the planet\'s surface. Oceans regulate climate and support diverse marine ecosystems.',
        temperature: 'Variable (0°C to 30°C)',
        precipitation: 'N/A (water body)',
        humidity: 'Very High',
        elevation: 'Below sea level'
      },
      'Polar Ice': {
        description: 'Permanent ice sheets and glaciers found in the coldest regions. These vast frozen expanses reflect sunlight and play a crucial role in global climate regulation.',
        temperature: 'Extremely Cold (< -15°C)',
        precipitation: '< 250 mm/year',
        humidity: 'Low',
        elevation: 'Variable'
      },
      'Tundra': {
        description: 'Cold, treeless plains with permafrost beneath the surface. Short growing seasons and harsh conditions limit vegetation to low shrubs, grasses, mosses, and lichens.',
        temperature: 'Cold (-15°C to 0°C)',
        precipitation: '150-250 mm/year',
        humidity: 'Low to Medium',
        elevation: 'Variable'
      },
      'Taiga': {
        description: 'Boreal forests dominated by coniferous trees like spruce, pine, and fir. Long, cold winters and short, mild summers characterize this vast biome.',
        temperature: 'Cold to Cool (0°C to 10°C)',
        precipitation: '400-600 mm/year',
        humidity: 'Medium to High',
        elevation: 'Low to Medium'
      },
      'Temperate Forest': {
        description: 'Deciduous and mixed forests with four distinct seasons. Trees shed leaves in autumn, creating rich soil from decomposing organic matter that supports diverse understory plants.',
        temperature: 'Moderate (10°C to 20°C)',
        precipitation: '750-1500 mm/year',
        humidity: 'High (> 50%)',
        elevation: 'Low to Medium'
      },
      'Grassland': {
        description: 'Open plains and prairies dominated by grasses and herbaceous plants. Moderate rainfall supports grasslands but prevents significant tree growth, though scattered trees may occur.',
        temperature: 'Moderate (10°C to 20°C)',
        precipitation: '250-750 mm/year',
        humidity: 'Low to Medium (25-50%)',
        elevation: 'Low to Medium'
      },
      'Chaparral': {
        description: 'Mediterranean shrubland characterized by dense, drought-resistant evergreen shrubs and small trees. Hot, dry summers and mild, wet winters define this biome.',
        temperature: 'Moderate to Warm (10°C to 28°C)',
        precipitation: '300-900 mm/year',
        humidity: 'Low (15-35%)',
        elevation: 'Low to Medium'
      },
      'Desert': {
        description: 'Arid regions receiving less than 25cm of annual precipitation. Extreme temperature variations between day and night. Flora and fauna show remarkable adaptations to water scarcity.',
        temperature: 'Variable (< 10°C to > 40°C)',
        precipitation: '< 250 mm/year',
        humidity: 'Very Low (< 25%)',
        elevation: 'Variable'
      },
      'Savanna': {
        description: 'Tropical and subtropical grasslands with scattered trees and shrubs. Distinct wet and dry seasons create a landscape that supports large herds of grazing animals and their predators.',
        temperature: 'Warm to Hot (20°C to 30°C)',
        precipitation: '500-1500 mm/year',
        humidity: 'Medium (25-60%)',
        elevation: 'Low to Medium'
      },
      'Tropical Rainforest': {
        description: 'Dense rainforests near the equator with extraordinary biodiversity. Multiple canopy layers create distinct microclimates. Warm and wet year-round with no dry season.',
        temperature: 'Hot (> 20°C)',
        precipitation: '> 2000 mm/year',
        humidity: 'Very High (> 60%)',
        elevation: 'Low to Medium'
      },
      'Mountain': {
        description: 'High-altitude regions with steep, rugged terrain. Climate and ecosystems vary dramatically with elevation, creating distinct vertical biome zones from base to peak.',
        temperature: 'Variable (decreases ~6°C per km)',
        precipitation: 'Variable (orographic effect)',
        humidity: 'Variable',
        elevation: 'High (> 50% above sea level)'
      }
    };

    const info = biomeInfoMap[biomeName];
    if (!info) return;

    // Build modal content
    this.biomeModalContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 24px; color: #4fc3f7;">${biomeName}</h2>
        <button onclick="this.closest('[style*=\\'z-index: 10000\\']').style.display='none'" 
                style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.3); 
                       color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 16px;">
          ✕ Close
        </button>
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; color: rgba(255, 255, 255, 0.9); margin-bottom: 20px; font-style: italic;">
        ${info.description}
      </p>
      
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 16px;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #4fc3f7;">Generation Criteria</h3>
        <div style="font-size: 14px; line-height: 1.8;">
          <div style="margin: 8px 0;"><strong style="color: rgba(255, 255, 255, 0.7);">Temperature:</strong> ${info.temperature}</div>
          <div style="margin: 8px 0;"><strong style="color: rgba(255, 255, 255, 0.7);">Precipitation:</strong> ${info.precipitation}</div>
          <div style="margin: 8px 0;"><strong style="color: rgba(255, 255, 255, 0.7);">Humidity:</strong> ${info.humidity}</div>
          <div style="margin: 8px 0;"><strong style="color: rgba(255, 255, 255, 0.7);">Elevation:</strong> ${info.elevation}</div>
        </div>
      </div>
    `;
    
    this.biomeModal.style.display = 'flex';
  }

  dispose() {
    this.gui.destroy();
    if (this.biomeModal && this.biomeModal.parentNode) {
      this.biomeModal.parentNode.removeChild(this.biomeModal);
    }
  }
}
