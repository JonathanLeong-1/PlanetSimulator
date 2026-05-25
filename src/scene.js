import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { generatePlanet, BIOMES } from './planetGenerator.js';

export class PlanetScene {
  constructor(container) {
    this.container = container;
    this.planetData = null;
    this.visualizationMode = 'biome';
    this.isDisposed = false;
    this.showHoverInfo = true; // Enabled by default
    
    // Biome highlighting
    this.highlightedBiome = null;
    this.biomeTooltip = null;
    
    // Climate visualization flags
    this.showWindVectors = false;
    this.showOceanCurrents = false;
    this.showDayNight = false;
    this.showBiomeBoundaries = false;
    
    // Rotation animation
    this.rotationEnabled = true;
    this.rotationAngle = 0;
    this.rotationSpeed = 0.001; // radians per frame (doubled from 0.0005)
    
    // Store original colors for day/night shading
    this.originalColors = null;
    
    try {
      this.initScene();
      this.initLighting();
      this.initPlanet();
      this.initRivers();
      this.initAxis();
      this.initClimateVisualizations();
      
      this.setupEventListeners();
      this.initHoverInfo();
      this.animate();
    } catch (error) {
      console.error('Error initializing scene:', error);
      throw new Error('Failed to create 3D scene. WebGL may not be supported on this device.');
    }
  }

  initHoverInfo() {
    // Create info box element
    this.infoBox = document.createElement('div');
    this.infoBox.id = 'hover-info';
    this.infoBox.style.cssText = `
      position: absolute;
      display: none;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      max-width: 300px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    `;
    document.body.appendChild(this.infoBox);
    
    // Create biome tooltip element
    this.biomeTooltip = document.createElement('div');
    this.biomeTooltip.id = 'biome-tooltip';
    this.biomeTooltip.style.cssText = `
      position: absolute;
      display: none;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      pointer-events: none;
      z-index: 1001;
      border: 2px solid rgba(255, 255, 255, 0.4);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.7);
    `;
    document.body.appendChild(this.biomeTooltip);

    // Raycaster for mouse picking
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredVertex = null;
  }

  initScene() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000511);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 3);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 10;
  }

  initLighting() {
    // Ambient light - reduced for more contrast
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambientLight);

    // Directional light (sun) - increased for more contrast
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.position.set(5, 3, 5);
    this.scene.add(this.sunLight);

    // Hemisphere light for atmosphere effect
    const hemisphereLight = new THREE.HemisphereLight(0x8888ff, 0x333333, 0.3);
    this.scene.add(hemisphereLight);

    // Add stars
    this.addStars();
  }

  addStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starVertices = [];

    for (let i = 0; i < 5000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 50 + Math.random() * 50;

      starVertices.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starsMaterial = new THREE.PointsMaterial({ 
      color: 0xffffff, 
      size: 0.1,
      transparent: true,
      opacity: 0.8
    });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(stars);
  }

  initPlanet() {
    // Create icosphere geometry with subdivision
    // In Three.js r159, detail levels scale as: 60 * detail^2 + 60
    // detail=30 gives ~54,060 vertices for ultra-high detail
    const detailLevel = 30;
    console.log('🔍 CREATING GEOMETRY with detail level:', detailLevel);
    this.geometry = new THREE.IcosahedronGeometry(1, detailLevel);
    console.log('🔍 INIT PLANET - Vertex count:', this.geometry.attributes.position.count);
    console.log('🔍 THREE.js version:', THREE.REVISION);
    
    // Material with vertex colors
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.8,
      metalness: 0.2
    });

    this.planet = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.planet);

    // Wireframe for debugging - will be child of planet to inherit transformations
    const wireframeGeometry = new THREE.WireframeGeometry(this.geometry);
    this.wireframe = new THREE.LineSegments(
      wireframeGeometry,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 })
    );
    // Don't add to scene yet - will be added as child of planet
  }

  initRivers() {
    this.riverGroup = new THREE.Group();
    this.scene.add(this.riverGroup);
  }
  
  initAxis() {
    // Create rotation axis line - will be updated per planet generation
    // Starting with unit size, will be scaled to match planet
    const axisLength = 1.2;
    const axisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -axisLength, 0),
      new THREE.Vector3(0, axisLength, 0)
    ]);
    
    const axisMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
      transparent: true,
      opacity: 0.9
    });
    
    this.axisLine = new THREE.Line(axisGeometry, axisMaterial);
    this.axisLine.visible = true;
    // Don't add to scene yet - will be added as child of planet
    
    // Add spheres at the poles
    const poleSphereGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const poleSphereMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: false,
      opacity: 1.0
    });
    
    this.northPoleSphere = new THREE.Mesh(poleSphereGeometry, poleSphereMaterial);
    this.northPoleSphere.visible = true;
    this.axisLine.add(this.northPoleSphere);
    
    this.southPoleSphere = new THREE.Mesh(poleSphereGeometry, poleSphereMaterial.clone());
    this.southPoleSphere.visible = true;
    this.axisLine.add(this.southPoleSphere);
  }

  initClimateVisualizations() {
    // Wind vectors group
    this.windVectorsGroup = new THREE.Group();
    this.windVectorsGroup.visible = false;
    this.scene.add(this.windVectorsGroup);
    
    // Ocean currents group
    this.oceanCurrentsGroup = new THREE.Group();
    this.oceanCurrentsGroup.visible = false;
    this.scene.add(this.oceanCurrentsGroup);
    
    // Biome boundaries group
    this.biomeBoundariesGroup = new THREE.Group();
    this.biomeBoundariesGroup.visible = false;
    this.scene.add(this.biomeBoundariesGroup);
    
    // Day/Night terminator
    this.dayNightLine = null; // Will be created when needed
    
    // Animation time for flowing effects
    this.flowAnimationTime = 0;
  }

  generatePlanet(seed, options = {}) {
    console.log('Generating planet with options:', options);
    
    // Reset geometry to base sphere with ultra-high detail
    // detail=30 gives ~54,060 vertices (scales as: 60 * detail^2 + 60)
    // Always create at size 1, then scale the planet mesh
    const detailLevel = 30;
    const planetSize = options.planetSize || 1;
    console.log('🔍 CREATING GEOMETRY - size:', planetSize, 'detail:', detailLevel);
    this.geometry = new THREE.IcosahedronGeometry(1, detailLevel);
    console.log('🔍 GENERATE PLANET - Vertex count:', this.geometry.attributes.position.count);
    this.planet.geometry = this.geometry;
    
    // Scale the planet mesh to the desired size
    this.planet.scale.set(planetSize, planetSize, planetSize);
    
    // Apply axial tilt rotation to the planet mesh
    // Tilt is applied around the X-axis to simulate a tilted rotation axis
    const axialTilt = options.axialTilt || 0;
    this.planet.rotation.set(0, 0, 0); // Reset rotation
    this.planet.rotateX(axialTilt); // Apply tilt
    
    if (this.axisLine) {
      // Remove axis from previous parent if exists
      if (this.axisLine.parent) {
        this.axisLine.parent.remove(this.axisLine);
      }
      
      // Add axis as child of planet so it inherits all transformations
      this.planet.add(this.axisLine);
      
      // Find the exact pole vertices (geometry is size 1)
      const positions = this.geometry.attributes.position;
      let northPoleY = 1.0;
      let southPoleY = -1.0;
      let minDistToNorth = Infinity;
      let minDistToSouth = Infinity;
      
      // Find vertices closest to theoretical poles (at ±1)
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        const distToNorth = x * x + (y - 1) * (y - 1) + z * z;
        if (distToNorth < minDistToNorth) {
          minDistToNorth = distToNorth;
          northPoleY = y;
        }
        
        const distToSouth = x * x + (y + 1) * (y + 1) + z * z;
        if (distToSouth < minDistToSouth) {
          minDistToSouth = distToSouth;
          southPoleY = y;
        }
      }
      
      // Position spheres at pole locations (in local coords, size 1)
      this.northPoleSphere.position.set(0, northPoleY, 0);
      this.southPoleSphere.position.set(0, southPoleY, 0);
      
      // Axis doesn't need rotation - it inherits from planet
      this.axisLine.rotation.set(0, 0, 0);
    }

    // Generate planet data
    this.planetData = generatePlanet(this.geometry, seed, options);

    // Apply elevation displacement
    this.applyElevation();

    // Update visualization
    this.updateVisualization();

    // Update rivers
    this.updateRivers();

    // Update climate visualizations
    if (this.showWindVectors) {
      this.updateWindVectors();
    }
    if (this.showOceanCurrents) {
      this.updateOceanCurrents();
    }
    if (this.showDayNight) {
      this.updateDayNightLine();
    }
    if (this.showBiomeBoundaries) {
      this.updateBiomeBoundaries();
    }

    // Recompute normals for proper lighting
    this.geometry.computeVertexNormals();

    return this.planetData.stats;
  }

  getBiomeStatistics() {
    if (!this.planetData) return null;

    // Count biomes
    const biomeCounts = {};
    Object.values(BIOMES).forEach(biome => {
      biomeCounts[biome.id] = { biome, count: 0 };
    });

    this.planetData.biomes.forEach(biome => {
      biomeCounts[biome.id].count++;
    });

    // Calculate total land vertices (exclude ocean)
    const totalLand = this.planetData.biomes.filter(biome => biome.id !== BIOMES.OCEAN.id).length;
    const totalVertices = this.planetData.biomes.length;

    // Calculate percentages and sort by count (descending)
    const biomeStats = Object.values(biomeCounts)
      .map(({ biome, count }) => {
        // For ocean, show as % of total planet; for land biomes, show as % of land
        const percentage = biome.id === BIOMES.OCEAN.id 
          ? (count / totalVertices * 100).toFixed(1)
          : (count / totalLand * 100).toFixed(1);
        
        return {
          biome,
          count,
          percentage
        };
      })
      .sort((a, b) => b.count - a.count);

    return biomeStats;
  }

  applyElevation() {
    const positions = this.geometry.attributes.position;
    const { elevation } = this.planetData;

    // Displace vertices along their normals
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);

      // Normalize to get direction
      const length = Math.sqrt(x * x + y * y + z * z);
      const nx = x / length;
      const ny = y / length;
      const nz = z / length;

      // Apply elevation displacement
      const scale = 1 + elevation[i] * 0.04; // Scale factor for displacement (reduced for more spherical appearance)
      positions.setXYZ(i, nx * scale, ny * scale, nz * scale);
    }

    positions.needsUpdate = true;
    
    // Update wireframe to match elevation changes
    if (this.wireframe) {
      // Remove from previous parent if exists
      if (this.wireframe.parent) {
        this.wireframe.parent.remove(this.wireframe);
      }
      
      // Recreate wireframe from updated geometry
      const wireframeGeometry = new THREE.WireframeGeometry(this.geometry);
      this.wireframe.geometry.dispose();
      this.wireframe.geometry = wireframeGeometry;
      
      // Add as child of planet to inherit scale and rotation
      this.planet.add(this.wireframe);
      this.wireframe.rotation.set(0, 0, 0); // Reset rotation since it inherits from planet
    }
  }

  updateVisualization() {
    const colors = [];
    const positions = this.geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      let color;

      switch (this.visualizationMode) {
        case 'biome':
          color = this.planetData.biomes[i].color;
          break;

        case 'elevation':
          const elev = this.planetData.elevation[i];
          const normalized = (elev + 1) / 2; // Normalize to 0-1
          color = [normalized, normalized, normalized];
          break;

        case 'temperature':
          const temp = this.planetData.temperature[i];
          const tempNorm = (temp + 50) / 100; // -50 to 50 -> 0 to 1
          color = [tempNorm, 0.2, 1 - tempNorm]; // Red=hot, Blue=cold
          break;

        case 'humidity':
          const hum = this.planetData.humidity[i];
          color = [1 - hum, 1 - hum, 1]; // Blue=wet, white=dry
          break;

        case 'precipitation':
          if (this.planetData.precipitation) {
            const precip = this.planetData.precipitation[i];
            const precipNorm = Math.min(1, precip / 3000); // Normalize to 0-1 (0-3000mm)
            // Brown=dry, Green=moderate, Blue=wet
            if (precipNorm < 0.33) {
              const t = precipNorm * 3;
              color = [0.8 - t * 0.4, 0.6 * t, 0.2 * t]; // Brown to yellow
            } else if (precipNorm < 0.67) {
              const t = (precipNorm - 0.33) * 3;
              color = [0.4 - t * 0.4, 0.6 + t * 0.2, 0.2 + t * 0.3]; // Yellow to green
            } else {
              const t = (precipNorm - 0.67) * 3;
              color = [0, 0.8 - t * 0.3, 0.5 + t * 0.5]; // Green to blue
            }
          } else {
            color = [0.5, 0.5, 0.5];
          }
          break;

        case 'flow':
          const flow = Math.log10(this.planetData.flowAccumulation[i] + 1) / 3;
          color = [0, flow, flow * 0.5];
          break;

        case 'plates':
          const plate = this.planetData.plateAssignments[i];
          const hue = (plate / this.planetData.plates.length) * 360;
          color = this.hslToRgb(hue, 70, 50);
          break;

        default:
          color = [0.5, 0.5, 0.5];
      }

      colors.push(color[0], color[1], color[2]);
    }

    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Store original colors for day/night shading
    this.originalColors = new Float32Array(colors);
  }

  updateRivers() {
    // Clear existing rivers
    while (this.riverGroup.children.length > 0) {
      const child = this.riverGroup.children[0];
      child.geometry.dispose();
      child.material.dispose();
      this.riverGroup.remove(child);
    }
    
    // Match river group rotation to planet rotation
    this.riverGroup.rotation.copy(this.planet.rotation);

    if (!this.showRivers || !this.planetData.rivers) {
      return;
    }

    // Draw rivers
    const positions = this.geometry.attributes.position;

    for (const river of this.planetData.rivers) {
      if (river.length < 2) continue;

      const riverPoints = [];
      for (const vertexIndex of river) {
        const x = positions.getX(vertexIndex);
        const y = positions.getY(vertexIndex);
        const z = positions.getZ(vertexIndex);

        // Slightly raise above surface to avoid z-fighting
        const length = Math.sqrt(x * x + y * y + z * z);
        const scale = 1.005;
        riverPoints.push(new THREE.Vector3(
          x / length * scale * length,
          y / length * scale * length,
          z / length * scale * length
        ));
      }

      const riverGeometry = new THREE.BufferGeometry().setFromPoints(riverPoints);
      const riverMaterial = new THREE.LineBasicMaterial({
        color: 0x4488ff,
        linewidth: 2,
        transparent: true,
        opacity: 0.8
      });

      const riverLine = new THREE.Line(riverGeometry, riverMaterial);
      this.riverGroup.add(riverLine);
    }
  }

  updateWindVectors() {
    // Clear existing wind vectors
    while (this.windVectorsGroup.children.length > 0) {
      const child = this.windVectorsGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.windVectorsGroup.remove(child);
    }

    if (!this.showWindVectors || !this.planetData || !this.planetData.windEast) {
      return;
    }

    const positions = this.geometry.attributes.position;
    const { windEast, windNorth, temperature } = this.planetData;
    
    // Sample every Nth vertex to avoid clutter
    const sampleRate = 50;
    
    for (let i = 0; i < positions.count; i += sampleRate) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Get wind vector
      const windE = windEast[i];
      const windN = windNorth[i];
      const windSpeed = Math.sqrt(windE * windE + windN * windN);
      
      if (windSpeed < 0.5) continue; // Skip very weak winds
      
      // Convert wind vector to 3D coordinates
      // This is simplified - would need proper spherical coordinate transformation
      const length = Math.sqrt(x * x + y * y + z * z);
      const startPoint = new THREE.Vector3(x, y, z).normalize().multiplyScalar(length * 1.01);
      
      // Approximate wind direction on sphere surface
      const windDir = new THREE.Vector3(windE * 0.05, 0, windN * 0.05);
      const endPoint = startPoint.clone().add(windDir);
      
      // Create animated line
      const points = [];
      const segments = 10;
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        points.push(new THREE.Vector3().lerpVectors(startPoint, endPoint, t));
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      // Color based on temperature (warm = red, cold = blue)
      const temp = temperature[i];
      const tempNorm = Math.max(0, Math.min(1, (temp + 30) / 60));
      const color = new THREE.Color().setHSL(0.6 - tempNorm * 0.6, 0.8, 0.5);
      
      const material = new THREE.LineBasicMaterial({
        color: color,
        linewidth: 2,
        transparent: true,
        opacity: 0.6
      });
      
      const line = new THREE.Line(geometry, material);
      line.userData.windSpeed = windSpeed;
      this.windVectorsGroup.add(line);
    }
  }

  updateOceanCurrents() {
    // Clear existing currents
    while (this.oceanCurrentsGroup.children.length > 0) {
      const child = this.oceanCurrentsGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.oceanCurrentsGroup.remove(child);
    }

    if (!this.showOceanCurrents || !this.planetData || !this.planetData.currentEast) {
      return;
    }

    const positions = this.geometry.attributes.position;
    const { currentEast, currentNorth, elevation, temperature, stats } = this.planetData;
    const seaLevel = stats && stats.seaLevel !== undefined ? stats.seaLevel : 0;
    
    // Sample every Nth vertex to avoid clutter
    const sampleRate = 40;
    
    for (let i = 0; i < positions.count; i += sampleRate) {
      // Only show currents in ocean
      if (elevation[i] > seaLevel) continue;
      
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Get current vector
      const currentE = currentEast[i];
      const currentN = currentNorth[i];
      const currentSpeed = Math.sqrt(currentE * currentE + currentN * currentN);
      
      if (currentSpeed < 0.1) continue; // Skip very weak currents
      
      // Convert current vector to 3D coordinates
      const length = Math.sqrt(x * x + y * y + z * z);
      const startPoint = new THREE.Vector3(x, y, z).normalize().multiplyScalar(length * 1.005);
      
      // Approximate current direction on sphere surface
      const currentDir = new THREE.Vector3(currentE * 0.08, 0, currentN * 0.08);
      const endPoint = startPoint.clone().add(currentDir);
      
      // Create flowing line with multiple segments for animation
      const points = [];
      const segments = 15;
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        points.push(new THREE.Vector3().lerpVectors(startPoint, endPoint, t));
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      // Color based on temperature (warm currents = red, cold = blue)
      const temp = temperature[i];
      const tempNorm = Math.max(0, Math.min(1, (temp + 10) / 40));
      const color = new THREE.Color().setHSL(0.55 - tempNorm * 0.55, 0.9, 0.4);
      
      const material = new THREE.LineBasicMaterial({
        color: color,
        linewidth: 2,
        transparent: true,
        opacity: 0.7
      });
      
      const line = new THREE.Line(geometry, material);
      line.userData.currentSpeed = currentSpeed;
      this.oceanCurrentsGroup.add(line);
    }
  }

  updateBiomeBoundaries() {
    // Clear existing boundaries
    while (this.biomeBoundariesGroup.children.length > 0) {
      const child = this.biomeBoundariesGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.biomeBoundariesGroup.remove(child);
    }
    
    // Match boundaries group rotation to planet rotation
    this.biomeBoundariesGroup.rotation.copy(this.planet.rotation);
    
    // Scale to match planet
    const planetScale = this.planet.scale.x;
    this.biomeBoundariesGroup.scale.set(planetScale, planetScale, planetScale);

    if (!this.showBiomeBoundaries || !this.planetData || !this.planetData.biomes) {
      return;
    }

    const positions = this.geometry.attributes.position;
    const { biomes } = this.planetData;

    console.log('Creating biome boundaries using midpoints...');

    // Build adjacency from geometry faces
    const adjacency = new Map();
    
    // For non-indexed geometry, iterate through position array by faces
    for (let i = 0; i < positions.count; i += 3) {
      const v0 = i;
      const v1 = i + 1;
      const v2 = i + 2;
      
      if (!adjacency.has(v0)) adjacency.set(v0, new Set());
      if (!adjacency.has(v1)) adjacency.set(v1, new Set());
      if (!adjacency.has(v2)) adjacency.set(v2, new Set());
      
      adjacency.get(v0).add(v1);
      adjacency.get(v0).add(v2);
      adjacency.get(v1).add(v0);
      adjacency.get(v1).add(v2);
      adjacency.get(v2).add(v0);
      adjacency.get(v2).add(v1);
    }

    // Find all boundary edges and calculate their midpoints
    const midpoints = [];
    const processedEdges = new Set();
    const heightScale = 1.002; // Minimal offset to avoid z-fighting while staying on surface
    
    const getEdgeKey = (v1, v2) => {
      const [a, b] = v1 < v2 ? [v1, v2] : [v2, v1];
      return `${a}-${b}`;
    };

    // Also detect triple-junction triangles (all 3 vertices different biomes)
    const tripleJunctions = [];
    for (let i = 0; i < positions.count; i += 3) {
      const v0 = i;
      const v1 = i + 1;
      const v2 = i + 2;
      
      const b0 = biomes[v0].id;
      const b1 = biomes[v1].id;
      const b2 = biomes[v2].id;
      
      // If all three biomes are different, this is a triple junction
      if (b0 !== b1 && b1 !== b2 && b0 !== b2) {
        // Calculate triangle centroid
        const x0 = positions.getX(v0);
        const y0 = positions.getY(v0);
        const z0 = positions.getZ(v0);
        
        const x1 = positions.getX(v1);
        const y1 = positions.getY(v1);
        const z1 = positions.getZ(v1);
        
        const x2 = positions.getX(v2);
        const y2 = positions.getY(v2);
        const z2 = positions.getZ(v2);
        
        const cx = (x0 + x1 + x2) / 3;
        const cy = (y0 + y1 + y2) / 3;
        const cz = (z0 + z1 + z2) / 3;
        
        const len = Math.sqrt(cx * cx + cy * cy + cz * cz);
        
        tripleJunctions.push({
          x: cx / len * len * heightScale,
          y: cy / len * len * heightScale,
          z: cz / len * len * heightScale,
          vertices: [v0, v1, v2]
        });
      }
    }

    for (const [vertex, neighbors] of adjacency) {
      const vertexBiome = biomes[vertex].id;
      
      for (const neighbor of neighbors) {
        const neighborBiome = biomes[neighbor].id;
        
        if (vertexBiome !== neighborBiome) {
          const edgeKey = getEdgeKey(vertex, neighbor);
          if (!processedEdges.has(edgeKey)) {
            processedEdges.add(edgeKey);
            
            // Get vertex positions
            const x1 = positions.getX(vertex);
            const y1 = positions.getY(vertex);
            const z1 = positions.getZ(vertex);
            
            const x2 = positions.getX(neighbor);
            const y2 = positions.getY(neighbor);
            const z2 = positions.getZ(neighbor);
            
            // Calculate midpoint
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const mz = (z1 + z2) / 2;
            
            // Normalize and push outward slightly
            const len = Math.sqrt(mx * mx + my * my + mz * mz);
            
            midpoints.push({
              x: mx / len * len * heightScale,
              y: my / len * len * heightScale,
              z: mz / len * len * heightScale,
              vertex1: vertex,
              vertex2: neighbor,
              biome1: vertexBiome,
              biome2: neighborBiome
            });
          }
        }
      }
    }
    
    console.log(`Found ${tripleJunctions.length} triple-junction triangles`);

    console.log(`Found ${midpoints.length} boundary edge midpoints`);

    if (midpoints.length === 0 && tripleJunctions.length === 0) {
      console.log('No biome boundaries to draw');
      return;
    }

    // Build a set of midpoint pairs that are on triple-junction triangles (to exclude)
    const tripleJunctionEdges = new Set();
    
    for (const tj of tripleJunctions) {
      // Find the 3 edge midpoints for this triangle
      const tjMidpoints = [];
      for (let i = 0; i < midpoints.length; i++) {
        const mp = midpoints[i];
        
        // Check if this midpoint is on one of the triangle's edges
        const isEdge = (
          (mp.vertex1 === tj.vertices[0] && mp.vertex2 === tj.vertices[1]) ||
          (mp.vertex1 === tj.vertices[1] && mp.vertex2 === tj.vertices[0]) ||
          (mp.vertex1 === tj.vertices[1] && mp.vertex2 === tj.vertices[2]) ||
          (mp.vertex1 === tj.vertices[2] && mp.vertex2 === tj.vertices[1]) ||
          (mp.vertex1 === tj.vertices[0] && mp.vertex2 === tj.vertices[2]) ||
          (mp.vertex1 === tj.vertices[2] && mp.vertex2 === tj.vertices[0])
        );
        
        if (isEdge) {
          tjMidpoints.push(i);
        }
      }
      
      // Mark all pairs of these midpoints as triple-junction edges (to skip)
      for (let i = 0; i < tjMidpoints.length; i++) {
        for (let j = i + 1; j < tjMidpoints.length; j++) {
          const a = tjMidpoints[i];
          const b = tjMidpoints[j];
          const key = a < b ? `${a}-${b}` : `${b}-${a}`;
          tripleJunctionEdges.add(key);
        }
      }
    }

    // Build adjacency between midpoints (they're adjacent if they share a vertex)
    const midpointAdjacency = new Map();
    for (let i = 0; i < midpoints.length; i++) {
      midpointAdjacency.set(i, []);
    }
    
    for (let i = 0; i < midpoints.length; i++) {
      const mp1 = midpoints[i];
      for (let j = i + 1; j < midpoints.length; j++) {
        const mp2 = midpoints[j];
        
        // Check if they share a vertex
        if (mp1.vertex1 === mp2.vertex1 || mp1.vertex1 === mp2.vertex2 ||
            mp1.vertex2 === mp2.vertex1 || mp1.vertex2 === mp2.vertex2) {
          midpointAdjacency.get(i).push(j);
          midpointAdjacency.get(j).push(i);
        }
      }
    }

    // Create lines connecting adjacent midpoints (excluding triple-junction triangle edges)
    const lineVertices = [];
    const processedPairs = new Set();
    
    for (let i = 0; i < midpoints.length; i++) {
      const mp1 = midpoints[i];
      const neighbors = midpointAdjacency.get(i);
      
      for (const j of neighbors) {
        const pairKey = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        
        // Skip if this is a triple-junction triangle edge
        if (tripleJunctionEdges.has(pairKey)) continue;
        
        const mp2 = midpoints[j];
        
        lineVertices.push(
          mp1.x, mp1.y, mp1.z,
          mp2.x, mp2.y, mp2.z
        );
      }
    }
    
    // Add connections from triple junction centers to their edge midpoints
    for (const tj of tripleJunctions) {
      // Find the 3 edge midpoints for this triangle
      for (let i = 0; i < midpoints.length; i++) {
        const mp = midpoints[i];
        
        // Check if this midpoint is on one of the triangle's edges
        const isEdge = (
          (mp.vertex1 === tj.vertices[0] && mp.vertex2 === tj.vertices[1]) ||
          (mp.vertex1 === tj.vertices[1] && mp.vertex2 === tj.vertices[0]) ||
          (mp.vertex1 === tj.vertices[1] && mp.vertex2 === tj.vertices[2]) ||
          (mp.vertex1 === tj.vertices[2] && mp.vertex2 === tj.vertices[1]) ||
          (mp.vertex1 === tj.vertices[0] && mp.vertex2 === tj.vertices[2]) ||
          (mp.vertex1 === tj.vertices[2] && mp.vertex2 === tj.vertices[0])
        );
        
        if (isEdge) {
          // Connect triple junction center to edge midpoint
          lineVertices.push(
            tj.x, tj.y, tj.z,
            mp.x, mp.y, mp.z
          );
        }
      }
    }
    
    // Add triple junction centers to midpoints array for rendering
    midpoints.push(...tripleJunctions);

    console.log(`Creating ${lineVertices.length / 6} boundary line segments`);

    // Create line geometry
    if (lineVertices.length > 0) {
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3));
      
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 1,
        transparent: true,
        opacity: 0.5,
        depthTest: true,
        depthWrite: true
      });
      
      const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
      this.biomeBoundariesGroup.add(lines);
    }

    // Create circular point sprites for midpoints
    const pointsGeometry = new THREE.BufferGeometry();
    const pointsArray = [];
    
    for (const mp of midpoints) {
      pointsArray.push(mp.x, mp.y, mp.z);
    }
    
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pointsArray, 3));
    
    // Use sprite-based material with circular texture for true circles
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const pointsMaterial = new THREE.PointsMaterial({
      map: texture,
      color: 0x000000,
      size: 0.003,
      sizeAttenuation: true,
      transparent: true,
      alphaTest: 0.5,
      depthTest: true
    });
    
    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    this.biomeBoundariesGroup.add(points);
    
    console.log(`✅ Created ${midpoints.length} boundary points and ${lineVertices.length / 6} connecting lines`);
  }

  updateDayNightLine() {
    // Remove existing line
    if (this.dayNightLine) {
      this.scene.remove(this.dayNightLine);
      this.dayNightLine.geometry.dispose();
      this.dayNightLine.material.dispose();
      this.dayNightLine = null;
    }

    if (!this.showDayNight) {
      return;
    }

    // Create a great circle representing the day/night terminator
    // Assuming sun is always from the left (negative X direction)
    const segments = 128;
    const points = [];
    const radius = 1.02; // Slightly above planet surface
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      // Terminator is perpendicular to sun direction (YZ plane)
      points.push(new THREE.Vector3(
        0,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius
      ));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xffff00,
      linewidth: 3,
      transparent: true,
      opacity: 0.8
    });
    
    this.dayNightLine = new THREE.Line(geometry, material);
    this.scene.add(this.dayNightLine);
  }

  setVisualizationMode(mode) {
    this.visualizationMode = mode;
    if (this.planetData) {
      this.updateVisualization();
    }
  }

  setShowRivers(show) {
    this.showRivers = show;
    if (this.planetData) {
      this.updateRivers();
    }
  }

  setShowWireframe(show) {
    this.wireframe.material.opacity = show ? 0.1 : 0;
  }
  
  setShowAxis(show) {
    if (this.axisLine) {
      this.axisLine.visible = show;
      this.northPoleSphere.visible = show;
      this.southPoleSphere.visible = show;
    }
  }
  
  setShowHoverInfo(show) {
    this.showHoverInfo = show;
    if (!show) {
      this.hideInfoBox();
    }
  }

  setShowWindVectors(show) {
    this.showWindVectors = show;
    this.windVectorsGroup.visible = show;
    if (show && this.planetData) {
      this.updateWindVectors();
    }
  }

  setShowOceanCurrents(show) {
    this.showOceanCurrents = show;
    this.oceanCurrentsGroup.visible = show;
    if (show && this.planetData) {
      this.updateOceanCurrents();
    }
  }

  setShowDayNight(show) {
    this.showDayNight = show;
    if (show) {
      this.updateDayNightLine();
      this.applyDayNightShading();
    } else {
      if (this.dayNightLine) {
        this.scene.remove(this.dayNightLine);
        this.dayNightLine.geometry.dispose();
        this.dayNightLine.material.dispose();
        this.dayNightLine = null;
      }
      this.restoreOriginalColors();
    }
  }

  setShowBiomeBoundaries(show) {
    this.showBiomeBoundaries = show;
    this.biomeBoundariesGroup.visible = show;
    if (show && this.planetData) {
      this.updateBiomeBoundaries();
    } else {
      // Reset highlighting when boundaries are disabled
      this.highlightedBiome = null;
      this.restoreBiomeColors();
      this.hideBiomeTooltip();
    }
  }

  applyDayNightShading() {
    if (!this.originalColors || !this.geometry) return;
    
    const colors = this.geometry.attributes.color;
    const positions = this.geometry.attributes.position;
    
    // Sun direction is from the left (negative X direction in world space)
    const sunDirection = new THREE.Vector3(-1, 0, 0);
    
    for (let i = 0; i < positions.count; i++) {
      // Get vertex position in world space
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      
      // Apply planet rotation to vertex
      vertex.applyMatrix4(this.planet.matrixWorld);
      vertex.normalize();
      
      // Calculate angle to sun (dot product)
      const sunDot = vertex.dot(sunDirection);
      
      // Get original color
      const origR = this.originalColors[i * 3];
      const origG = this.originalColors[i * 3 + 1];
      const origB = this.originalColors[i * 3 + 2];
      
      // Apply darkening on night side (smooth gradient)
      // sunDot ranges from -1 (away from sun) to 1 (toward sun)
      const lightFactor = Math.max(0.3, (sunDot + 1) / 2); // 0.3 minimum to prevent pure black
      
      colors.setXYZ(i, origR * lightFactor, origG * lightFactor, origB * lightFactor);
    }
    
    colors.needsUpdate = true;
  }

  restoreOriginalColors() {
    if (!this.originalColors || !this.geometry) return;
    
    const colors = this.geometry.attributes.color;
    
    for (let i = 0; i < this.originalColors.length; i++) {
      colors.array[i] = this.originalColors[i];
    }
    
    colors.needsUpdate = true;
  }

  setRotationEnabled(enabled) {
    this.rotationEnabled = enabled;
    if (!enabled) {
      // Reset rotation angle
      this.rotationAngle = 0;
      if (this.planet) {
        this.planet.rotation.y = 0;
      }
      // Sync boundary rotation when disabling animation
      if (this.riverGroup) {
        this.riverGroup.rotation.copy(this.planet.rotation);
      }
      if (this.biomeBoundariesGroup) {
        this.biomeBoundariesGroup.rotation.copy(this.planet.rotation);
      }
    }
  }
  
  calculatePoleRadius() {
    // Calculate actual pole positions by finding the exact vertices at the poles
    if (!this.geometry) return 1.0;
    
    const positions = this.geometry.attributes.position;
    let northPoleY = 0;
    let southPoleY = 0;
    let minDistanceToNorthPole = Infinity;
    let minDistanceToSouthPole = Infinity;
    
    // Find the vertices closest to the theoretical north and south poles
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Distance to north pole (0, 1, 0) before elevation
      const distToNorth = Math.sqrt(x * x + (y - 1) * (y - 1) + z * z);
      if (distToNorth < minDistanceToNorthPole) {
        minDistanceToNorthPole = distToNorth;
        northPoleY = y;
      }
      
      // Distance to south pole (0, -1, 0) before elevation
      const distToSouth = Math.sqrt(x * x + (y + 1) * (y + 1) + z * z);
      if (distToSouth < minDistanceToSouthPole) {
        minDistanceToSouthPole = distToSouth;
        southPoleY = y;
      }
    }
    
    // Return the average of north and south pole distances (accounting for elevation)
    return (Math.abs(northPoleY) + Math.abs(southPoleY)) / 2;
  }

  hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [r + m, g + m, b + m];
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('mousemove', (event) => this.onMouseMove(event));
  }

  onMouseMove(event) {
    if (!this.planetData || this.isDisposed) {
      return;
    }

    try {
      // Update mouse coordinates
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Raycast to find intersection
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObject(this.planet, true); // Include children

      if (intersects.length > 0) {
        // Filter to only the planet mesh, not children (axis, wireframe)
        const planetIntersect = intersects.find(i => i.object === this.planet);
        if (!planetIntersect) {
          this.hideInfoBox();
          this.hideBiomeTooltip();
          return;
        }
        const intersection = planetIntersect;
        const face = intersection.face;
        
        // Get the closest vertex from the face
        const positions = this.geometry.attributes.position;
        const vertices = [face.a, face.b, face.c];
        
        // Find closest vertex to intersection point
        // Need to transform local vertex positions to world space for comparison
        let closestVertex = vertices[0];
        let minDist = Infinity;
        
        for (const vertexIndex of vertices) {
          const vx = positions.getX(vertexIndex);
          const vy = positions.getY(vertexIndex);
          const vz = positions.getZ(vertexIndex);
          
          // Transform local position to world space (accounting for planet scale and rotation)
          const localPos = new THREE.Vector3(vx, vy, vz);
          const worldPos = localPos.applyMatrix4(this.planet.matrixWorld);
          
          const dist = intersection.point.distanceTo(worldPos);
          if (dist < minDist) {
            minDist = dist;
            closestVertex = vertexIndex;
          }
        }

        this.hoveredVertex = closestVertex;
        
        // If biome boundaries are enabled, highlight the biome
        if (this.showBiomeBoundaries) {
          const hoveredBiome = this.planetData.biomes[closestVertex];
          if (this.highlightedBiome !== hoveredBiome) {
            this.highlightedBiome = hoveredBiome;
            this.applyBiomeHighlight();
          }
          this.updateBiomeTooltip(event.clientX, event.clientY, hoveredBiome);
          this.hideInfoBox();
        } else if (this.showHoverInfo) {
          // Normal hover info
          this.updateInfoBox(event.clientX, event.clientY, closestVertex);
          this.hideBiomeTooltip();
        }
      } else {
        this.hideInfoBox();
        this.hideBiomeTooltip();
        if (this.showBiomeBoundaries && this.highlightedBiome) {
          this.highlightedBiome = null;
          this.restoreBiomeColors();
        }
      }
    } catch (error) {
      console.error('Error in mouse move handler:', error);
      this.hideInfoBox();
      this.hideBiomeTooltip();
    }
  }

  updateInfoBox(x, y, vertexIndex) {
    if (!this.planetData) return;

    const { elevation, temperature, humidity, biomes, flowAccumulation, plateAssignments } = this.planetData;
    
    // Get vertex data
    const elev = elevation[vertexIndex];
    const temp = temperature[vertexIndex];
    const hum = humidity[vertexIndex];
    const biome = biomes[vertexIndex];
    const flow = flowAccumulation[vertexIndex];
    const plate = plateAssignments[vertexIndex];

    // Get coordinates
    const positions = this.geometry.attributes.position;
    const vx = positions.getX(vertexIndex);
    const vy = positions.getY(vertexIndex);
    const vz = positions.getZ(vertexIndex);
    
    const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const lat = Math.asin(vy / len) * 180 / Math.PI;
    const lon = Math.atan2(vz, vx) * 180 / Math.PI;

    // Determine terrain type
    let terrainType = biome.name;
    if (flow > 100) {
      terrainType += ' (River)';
    }

    // Get precipitation if available
    const precip = this.planetData.precipitation ? this.planetData.precipitation[vertexIndex] : null;

    // Build info HTML
    let infoHTML = `
      <div style="margin-bottom: 8px; font-weight: bold; color: #4fc3f7;">
        📍 Point Information
      </div>
      <div style="line-height: 1.6;">
        <span style="color: #90caf9;">Location:</span> ${lat.toFixed(2)}°, ${lon.toFixed(2)}°<br>
        <span style="color: #90caf9;">Biome:</span> ${terrainType}<br>
        <span style="color: #90caf9;">Elevation:</span> ${elev.toFixed(3)} ${elev > 0 ? '⛰️' : '🌊'}<br>
        <span style="color: #90caf9;">Temperature:</span> ${temp.toFixed(1)}°C ${this.getTempEmoji(temp)}<br>
        <span style="color: #90caf9;">Humidity:</span> ${(hum * 100).toFixed(0)}% ${this.getHumidityEmoji(hum)}<br>`;
    
    if (precip !== null) {
      infoHTML += `<span style="color: #90caf9;">Precipitation:</span> ${Math.floor(precip)} mm/year ${precip > 2000 ? '🌧️' : precip > 500 ? '💧' : '☀️'}<br>`;
    }
    
    infoHTML += `<span style="color: #90caf9;">Water Flow:</span> ${Math.floor(flow)} ${flow > 50 ? '💧' : ''}<br>
        <span style="color: #90caf9;">Tectonic Plate:</span> #${plate + 1}
      </div>
    `;

    this.infoBox.innerHTML = infoHTML;
    this.infoBox.style.display = 'block';
    
    // Position with offset and boundary checking
    let boxX = x + 15;
    let boxY = y + 15;
    
    // Keep box on screen
    if (boxX + 300 > window.innerWidth) {
      boxX = x - 315;
    }
    if (boxY + 200 > window.innerHeight) {
      boxY = y - 215;
    }
    
    this.infoBox.style.left = boxX + 'px';
    this.infoBox.style.top = boxY + 'px';
  }

  getTempEmoji(temp) {
    if (temp < -10) return '🥶';
    if (temp < 0) return '❄️';
    if (temp < 15) return '🌡️';
    if (temp < 25) return '☀️';
    return '🔥';
  }

  getHumidityEmoji(humidity) {
    if (humidity < 0.2) return '🏜️';
    if (humidity < 0.5) return '🌾';
    if (humidity < 0.7) return '🌳';
    return '🌧️';
  }

  hideInfoBox() {
    if (this.infoBox) {
      this.infoBox.style.display = 'none';
    }
    this.hoveredVertex = null;
  }

  applyBiomeHighlight() {
    if (!this.highlightedBiome || !this.geometry || !this.planetData) return;
    
    const colors = this.geometry.attributes.color;
    const { biomes } = this.planetData;
    
    for (let i = 0; i < biomes.length; i++) {
      const biome = biomes[i];
      const isHighlighted = biome.id === this.highlightedBiome.id;
      const isWater = biome.id === BIOMES.OCEAN.id;
      
      if (isHighlighted) {
        // Keep original color or brighten slightly
        const origR = this.originalColors[i * 3];
        const origG = this.originalColors[i * 3 + 1];
        const origB = this.originalColors[i * 3 + 2];
        colors.setXYZ(i, origR * 1.1, origG * 1.1, origB * 1.1);
      } else if (isWater) {
        // Keep water at original color
        const origR = this.originalColors[i * 3];
        const origG = this.originalColors[i * 3 + 1];
        const origB = this.originalColors[i * 3 + 2];
        colors.setXYZ(i, origR, origG, origB);
      } else {
        // Grey out other biomes (darker - 40% original color + 60% grey)
        const origR = this.originalColors[i * 3];
        const origG = this.originalColors[i * 3 + 1];
        const origB = this.originalColors[i * 3 + 2];
        const grey = (origR + origG + origB) / 3 * 0.5;
        colors.setXYZ(i, origR * 0.4 + grey * 0.6, origG * 0.4 + grey * 0.6, origB * 0.4 + grey * 0.6);
      }
    }
    
    colors.needsUpdate = true;
  }

  restoreBiomeColors() {
    if (!this.originalColors || !this.geometry) return;
    
    const colors = this.geometry.attributes.color;
    
    for (let i = 0; i < this.originalColors.length; i++) {
      colors.array[i] = this.originalColors[i];
    }
    
    colors.needsUpdate = true;
  }

  updateBiomeTooltip(x, y, biome) {
    if (!this.biomeTooltip || !this.planetData) return;
    
    // Calculate statistics for this biome
    const { biomes, elevation, temperature, humidity, precipitation } = this.planetData;
    const stats = this.planetData.stats;
    const seaLevel = stats && stats.seaLevel !== undefined ? stats.seaLevel : 0;
    
    const biomeCount = biomes.filter(b => b.id === biome.id).length;
    
    // Calculate total land vertices (exclude ocean)
    const totalLand = biomes.filter(b => b.id !== BIOMES.OCEAN.id).length;
    const totalVertices = biomes.length;
    
    // Calculate percentage
    const percentage = biome.id === BIOMES.OCEAN.id 
      ? (biomeCount / totalVertices * 100).toFixed(1)
      : (biomeCount / totalLand * 100).toFixed(1);
    
    const colorHex = `#${biome.color.map(c => Math.floor(c * 255).toString(16).padStart(2, '0')).join('')}`;
    
    // Calculate actual ranges for this biome from planet data
    const biomeIndices = [];
    for (let i = 0; i < biomes.length; i++) {
      if (biomes[i].id === biome.id) {
        biomeIndices.push(i);
      }
    }
    
    let tempMin = Infinity, tempMax = -Infinity;
    let precipMin = Infinity, precipMax = -Infinity;
    let humidMin = Infinity, humidMax = -Infinity;
    let elevMin = Infinity, elevMax = -Infinity;
    
    for (const idx of biomeIndices) {
      tempMin = Math.min(tempMin, temperature[idx]);
      tempMax = Math.max(tempMax, temperature[idx]);
      if (precipitation) {
        precipMin = Math.min(precipMin, precipitation[idx]);
        precipMax = Math.max(precipMax, precipitation[idx]);
      }
      humidMin = Math.min(humidMin, humidity[idx]);
      humidMax = Math.max(humidMax, humidity[idx]);
      elevMin = Math.min(elevMin, elevation[idx]);
      elevMax = Math.max(elevMax, elevation[idx]);
    }
    
    // Format ranges
    const tempRange = `${tempMin.toFixed(1)}°C to ${tempMax.toFixed(1)}°C`;
    const precipRange = precipitation ? `${Math.floor(precipMin)} - ${Math.floor(precipMax)} mm/year` : 'N/A';
    const humidityRange = `${(humidMin * 100).toFixed(0)}% to ${(humidMax * 100).toFixed(0)}%`;
    const elevRange = biome.id === BIOMES.OCEAN.id 
      ? `Below sea level (${elevMin.toFixed(2)} to ${elevMax.toFixed(2)})` 
      : `${elevMin.toFixed(2)} to ${elevMax.toFixed(2)}`;
    
    // Get biome descriptions
    const descriptions = {
      'Ocean': 'Vast bodies of water covering the planetary surface. Home to diverse marine ecosystems and critical for regulating global climate.',
      'Polar Ice': 'Frozen regions with permanent ice coverage. Extreme cold with minimal precipitation. Life is sparse but specialized.',
      'Tundra': 'Cold, treeless plains with permafrost. Short growing seasons with hardy vegetation adapted to extreme conditions.',
      'Taiga': 'Boreal forests dominated by coniferous trees. Long, harsh winters and short summers. Important carbon sink.',
      'Temperate Forest': 'Deciduous and mixed forests with distinct seasons. Rich biodiversity and moderate climate conditions.',
      'Grassland': 'Open plains dominated by grasses. Moderate rainfall supports grazing animals but insufficient for forests.',
      'Chaparral': 'Mediterranean climate with hot, dry summers and mild, wet winters. Dense shrubland vegetation.',
      'Desert': 'Arid regions receiving less than 25cm of annual precipitation. Extreme temperature variations between day and night. Flora and fauna show remarkable adaptations to water scarcity.',
      'Savanna': 'Tropical grasslands with scattered trees. Distinct wet and dry seasons support diverse megafauna.',
      'Tropical Rainforest': 'Dense, lush forests with high rainfall and temperatures. Highest biodiversity on the planet.',
      'Mountain': 'High-elevation terrain with varying climates by altitude. Steep slopes and dramatic weather patterns.'
    };
    
    const description = descriptions[biome.name] || '';
    
    const infoHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; font-size: 18px; color: #4fc3f7;">
        ${biome.name}
      </div>
      <div style="line-height: 1.8;">
        <div style="margin-bottom: 10px;">
          <span style="display: inline-block; width: 18px; height: 18px; background: ${colorHex}; border: 1px solid white; margin-right: 8px; vertical-align: middle;"></span>
          <span style="font-weight: bold; font-size: 16px;">${percentage}%</span> <span style="color: #90caf9;">of ${biome.id === BIOMES.OCEAN.id ? 'planet' : 'land'}</span>
        </div>
        <div style="margin-bottom: 12px; color: #b0bec5; font-style: italic; font-size: 12px; line-height: 1.6;">
          ${description}
        </div>
        <div style="padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 12px;">
          <div style="margin-bottom: 6px;"><span style="color: #81c784; font-weight: bold;">Temperature:</span> ${tempRange}</div>
          ${precipitation ? `<div style="margin-bottom: 6px;"><span style="color: #64b5f6; font-weight: bold;">Precipitation:</span> ${precipRange}</div>` : ''}
          <div style="margin-bottom: 6px;"><span style="color: #4fc3f7; font-weight: bold;">Humidity:</span> ${humidityRange}</div>
          <div><span style="color: #a1887f; font-weight: bold;">Elevation:</span> ${elevRange}</div>
        </div>
      </div>
    `;
    
    this.biomeTooltip.innerHTML = infoHTML;
    this.biomeTooltip.style.display = 'block';
    
    // Position with offset and boundary checking
    let boxX = x + 20;
    let boxY = y + 20;
    
    // Keep box on screen
    if (boxX + 250 > window.innerWidth) {
      boxX = x - 270;
    }
    if (boxY + 150 > window.innerHeight) {
      boxY = y - 170;
    }
    
    this.biomeTooltip.style.left = boxX + 'px';
    this.biomeTooltip.style.top = boxY + 'px';
  }

  hideBiomeTooltip() {
    if (this.biomeTooltip) {
      this.biomeTooltip.style.display = 'none';
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    if (this.isDisposed) return;
    
    requestAnimationFrame(() => this.animate());
    
    // Update light position to always come from the left in camera space
    const leftOffset = new THREE.Vector3(-5, 0, 0);
    leftOffset.applyQuaternion(this.camera.quaternion);
    this.sunLight.position.copy(this.camera.position).add(leftOffset);
    
    // Handle rotation animation
    if (this.rotationEnabled && this.planet) {
      this.rotationAngle += this.rotationSpeed;
      this.planet.rotation.y = this.rotationAngle;
      
      // Update day/night shading if enabled
      if (this.showDayNight && this.originalColors) {
        this.applyDayNightShading();
      }
    }
    
    // Always keep overlays in sync with planet rotation (even when not animating)
    if (this.planet) {
      this.riverGroup.rotation.copy(this.planet.rotation);
      this.biomeBoundariesGroup.rotation.copy(this.planet.rotation);
    }
    
    // Animate flowing lines (wind and currents)
    this.flowAnimationTime += 0.02;
    
    // Animate wind vectors
    if (this.showWindVectors && this.windVectorsGroup.children.length > 0) {
      this.windVectorsGroup.children.forEach((line, index) => {
        const phase = (this.flowAnimationTime + index * 0.1) % 1;
        line.material.opacity = 0.3 + Math.sin(phase * Math.PI * 2) * 0.3;
      });
    }
    
    // Animate ocean currents
    if (this.showOceanCurrents && this.oceanCurrentsGroup.children.length > 0) {
      this.oceanCurrentsGroup.children.forEach((line, index) => {
        const phase = (this.flowAnimationTime + index * 0.15) % 1;
        line.material.opacity = 0.4 + Math.sin(phase * Math.PI * 2) * 0.3;
      });
    }
    
    try {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error('Render error:', error);
      this.isDisposed = true;
    }
  }

  dispose() {
    this.isDisposed = true;
    
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
    if (this.wireframe) {
      if (this.wireframe.geometry) this.wireframe.geometry.dispose();
      if (this.wireframe.material) this.wireframe.material.dispose();
    }
    if (this.renderer) this.renderer.dispose();
    if (this.controls) this.controls.dispose();
    
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    
    if (this.infoBox && this.infoBox.parentNode) {
      this.infoBox.parentNode.removeChild(this.infoBox);
    }
    if (this.biomeTooltip && this.biomeTooltip.parentNode) {
      this.biomeTooltip.parentNode.removeChild(this.biomeTooltip);
    }
  }
}
