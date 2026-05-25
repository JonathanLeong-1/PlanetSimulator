import { BIOMES } from './planetGenerator.js';

/**
 * Biome information and statistics panel
 */
export class BiomePanel {
  constructor(scene) {
    this.scene = scene;
    this.isExpanded = false;
    this.createPanel();
  }

  createPanel() {
    // Create main panel container
    this.panel = document.createElement('div');
    this.panel.id = 'biome-panel';
    this.panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 380px;
      max-height: 70vh;
      background: rgba(0, 0, 0, 0.92);
      color: white;
      border-radius: 12px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 13px;
      z-index: 1000;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      overflow: hidden;
      transition: max-height 0.3s ease;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.05);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;
    
    const title = document.createElement('div');
    title.innerHTML = '🌍 <strong>Biome Information</strong>';
    title.style.cssText = 'font-size: 14px; font-weight: 600;';
    
    this.toggleIcon = document.createElement('div');
    this.toggleIcon.textContent = '▼';
    this.toggleIcon.style.cssText = `
      font-size: 12px;
      transition: transform 0.3s ease;
      color: rgba(255, 255, 255, 0.7);
    `;
    
    header.appendChild(title);
    header.appendChild(this.toggleIcon);
    header.addEventListener('click', () => this.toggle());

    // Create content container
    this.content = document.createElement('div');
    this.content.style.cssText = `
      max-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      transition: max-height 0.3s ease;
    `;

    // Custom scrollbar styling
    const style = document.createElement('style');
    style.textContent = `
      #biome-panel *::-webkit-scrollbar {
        width: 8px;
      }
      #biome-panel *::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      #biome-panel *::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      #biome-panel *::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;
    document.head.appendChild(style);

    this.panel.appendChild(header);
    this.panel.appendChild(this.content);
    document.body.appendChild(this.panel);

    // Start collapsed
    this.updateContent();
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
    
    if (this.isExpanded) {
      this.content.style.maxHeight = 'calc(70vh - 60px)';
      this.toggleIcon.style.transform = 'rotate(180deg)';
      this.updateContent();
    } else {
      this.content.style.maxHeight = '0';
      this.toggleIcon.style.transform = 'rotate(0deg)';
    }
  }

  updateContent() {
    if (!this.isExpanded) return;

    const biomeStats = this.scene.getBiomeStatistics();
    if (!biomeStats) {
      this.content.innerHTML = '<div style="padding: 16px; text-align: center; color: rgba(255,255,255,0.5);">Generate a planet to see biome data</div>';
      return;
    }

    // Build content HTML
    let html = '<div style="padding: 8px;">';
    
    biomeStats.forEach(({ biome, count, percentage }) => {
      if (biome.id === BIOMES.MOUNTAIN.id) return; // Mountain biome excluded
      const info = this.getBiomeInfo(biome);
      const isPresent = count > 0;
      const color = `rgb(${Math.floor(biome.color[0] * 255)}, ${Math.floor(biome.color[1] * 255)}, ${Math.floor(biome.color[2] * 255)})`;
      const grayColor = `rgba(${Math.floor(biome.color[0] * 255)}, ${Math.floor(biome.color[1] * 255)}, ${Math.floor(biome.color[2] * 255)}, 0.3)`;
      
      // Determine label text based on biome type
      const isOcean = biome.id === 'OCEAN';
      const percentageLabel = isOcean ? 'of planet' : 'of land';
      const uniqueId = `biome-${biome.id}`;
      
      html += `
        <div style="
          margin: 8px 0;
          padding: 12px;
          background: ${isPresent ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.01)'};
          border-radius: 8px;
          border-left: 4px solid ${isPresent ? color : grayColor};
          opacity: ${isPresent ? '1' : '0.5'};
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="
                width: 16px;
                height: 16px;
                background: ${isPresent ? color : grayColor};
                border-radius: 3px;
                border: 1px solid rgba(255, 255, 255, 0.2);
              "></div>
              <strong style="font-size: 14px; color: ${isPresent ? 'white' : 'rgba(255, 255, 255, 0.5)'};">${biome.name}</strong>
              <div 
                onclick="document.getElementById('${uniqueId}-details').style.display = document.getElementById('${uniqueId}-details').style.display === 'none' ? 'block' : 'none'; document.getElementById('${uniqueId}-icon').textContent = document.getElementById('${uniqueId}-details').style.display === 'none' ? 'ℹ️' : '✖️';"
                id="${uniqueId}-icon"
                style="
                  cursor: pointer;
                  font-size: 14px;
                  opacity: 0.7;
                  transition: opacity 0.2s;
                  user-select: none;
                "
                onmouseover="this.style.opacity='1'"
                onmouseout="this.style.opacity='0.7'"
                title="Click for detailed information"
              >ℹ️</div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
              <span style="
                background: ${isPresent ? 'rgba(79, 195, 247, 0.2)' : 'rgba(128, 128, 128, 0.2)'};
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                color: ${isPresent ? '#4fc3f7' : 'rgba(255, 255, 255, 0.4)'};
              ">${isPresent ? percentage + '%' : 'Not Present'}</span>
              ${isPresent ? `<span style="font-size: 9px; color: rgba(255, 255, 255, 0.4);">${percentageLabel}</span>` : ''}
            </div>
          </div>
          
          <div id="${uniqueId}-details" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="font-size: 12px; color: ${isPresent ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)'}; margin-bottom: 8px; font-style: italic;">
              ${info.description}
            </div>
            
            <div style="font-size: 11px; color: ${isPresent ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)'}; margin-top: 6px;">
              <div style="margin: 3px 0;"><strong>Temperature:</strong> ${info.temperature}</div>
              <div style="margin: 3px 0;"><strong>Precipitation:</strong> ${info.precipitation}</div>
              <div style="margin: 3px 0;"><strong>Humidity:</strong> ${info.humidity}</div>
              <div style="margin: 3px 0;"><strong>Elevation:</strong> ${info.elevation}</div>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    this.content.innerHTML = html;
  }

  getBiomeInfo(biome) {
    const info = {
      [BIOMES.OCEAN.id]: {
        description: 'Vast bodies of water covering the planet\'s surface. Oceans regulate climate and support diverse marine ecosystems.',
        temperature: 'Variable (0°C to 30°C)',
        precipitation: 'N/A (water body)',
        humidity: 'Very High',
        elevation: 'Below sea level'
      },
      [BIOMES.POLAR_ICE.id]: {
        description: 'Permanent ice sheets and glaciers found in the coldest regions. These vast frozen expanses reflect sunlight and play a crucial role in global climate regulation.',
        temperature: 'Extremely Cold (< -15°C)',
        precipitation: '< 250 mm/year',
        humidity: 'Low',
        elevation: 'Variable'
      },
      [BIOMES.TUNDRA.id]: {
        description: 'Cold, treeless plains with permafrost beneath the surface. Short growing seasons and harsh conditions limit vegetation to low shrubs, grasses, mosses, and lichens.',
        temperature: 'Cold (-15°C to 0°C)',
        precipitation: '150-250 mm/year',
        humidity: 'Low to Medium',
        elevation: 'Variable'
      },
      [BIOMES.TAIGA.id]: {
        description: 'Boreal forests dominated by coniferous trees like spruce, pine, and fir. Long, cold winters and short, mild summers characterize this vast biome.',
        temperature: 'Cold to Cool (0°C to 10°C)',
        precipitation: '400-600 mm/year',
        humidity: 'Medium to High',
        elevation: 'Low to Medium'
      },
      [BIOMES.TEMPERATE_FOREST.id]: {
        description: 'Deciduous and mixed forests with four distinct seasons. Trees shed leaves in autumn, creating rich soil from decomposing organic matter that supports diverse understory plants.',
        temperature: 'Moderate (10°C to 20°C)',
        precipitation: '750-1500 mm/year',
        humidity: 'High (> 50%)',
        elevation: 'Low to Medium'
      },
      [BIOMES.GRASSLAND.id]: {
        description: 'Open plains and prairies dominated by grasses and herbaceous plants. Moderate rainfall supports grasslands but prevents significant tree growth, though scattered trees may occur.',
        temperature: 'Moderate (10°C to 20°C)',
        precipitation: '250-750 mm/year',
        humidity: 'Low to Medium (25-50%)',
        elevation: 'Low to Medium'
      },
      [BIOMES.CHAPARRAL.id]: {
        description: 'Mediterranean shrubland characterized by dense, drought-resistant evergreen shrubs and small trees. Hot, dry summers and mild, wet winters define this biome.',
        temperature: 'Moderate to Warm (10°C to 28°C)',
        precipitation: '300-900 mm/year',
        humidity: 'Low (15-35%)',
        elevation: 'Low to Medium'
      },
      [BIOMES.DESERT.id]: {
        description: 'Arid regions receiving less than 25cm of annual precipitation. Extreme temperature variations between day and night. Flora and fauna show remarkable adaptations to water scarcity.',
        temperature: 'Variable (< 10°C to > 40°C)',
        precipitation: '< 250 mm/year',
        humidity: 'Very Low (< 25%)',
        elevation: 'Variable'
      },
      [BIOMES.SAVANNA.id]: {
        description: 'Tropical and subtropical grasslands with scattered trees and shrubs. Distinct wet and dry seasons create a landscape that supports large herds of grazing animals and their predators.',
        temperature: 'Warm to Hot (20°C to 30°C)',
        precipitation: '500-1500 mm/year',
        humidity: 'Medium (25-60%)',
        elevation: 'Low to Medium'
      },
      [BIOMES.TROPICAL_FOREST.id]: {
        description: 'Dense rainforests near the equator with extraordinary biodiversity. Multiple canopy layers create distinct microclimates. Warm and wet year-round with no dry season.',
        temperature: 'Hot (> 20°C)',
        precipitation: '> 2000 mm/year',
        humidity: 'Very High (> 60%)',
        elevation: 'Low to Medium'
      }
    };

    return info[biome.id] || {
      description: 'Unknown biome type.',
      temperature: 'N/A',
      precipitation: 'N/A',
      humidity: 'N/A',
      elevation: 'N/A'
    };
  }

  update() {
    if (this.isExpanded) {
      this.updateContent();
    }
  }

  dispose() {
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
  }
}
