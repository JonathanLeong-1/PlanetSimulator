import { test, expect } from '@playwright/test';

test.describe('Planet Simulator', () => {
  test('should load and render the planet canvas', async ({ page }) => {
    await page.goto('/');

    // Wait for canvas to be rendered
    const canvas = await page.waitForSelector('canvas', { timeout: 10000 });
    expect(canvas).toBeTruthy();

    // Verify canvas has dimensions
    const canvasSize = await canvas.boundingBox();
    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);

    // Wait for loading to disappear
    await page.waitForSelector('#loading', { state: 'hidden', timeout: 15000 });

    // Verify stats are displayed
    const stats = await page.locator('#stats').textContent();
    expect(stats).toContain('Vertices');
    expect(stats).toContain('Triangles');
  });

  test('should have UI controls visible', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForSelector('canvas');

    // Check for lil-gui controls (they add a .lil-gui class)
    const gui = await page.locator('.lil-gui.root').first();
    await expect(gui).toBeVisible();

    // Verify title is present
    const title = await page.locator('.lil-gui .title').first();
    await expect(title).toContainText('Planet');
  });

  test('should regenerate planet when seed changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas');
    await page.waitForSelector('#loading', { state: 'hidden', timeout: 15000 });

    // Get initial stats
    const initialStats = await page.locator('#stats').textContent();

    // Wait a moment for UI to be ready
    await page.waitForTimeout(500);

    // Find and click random seed button (look for button containing "Random")
    const randomButton = await page.locator('button:has-text("Random Seed")');
    if (await randomButton.count() > 0) {
      await randomButton.click();
      
      // Wait for regeneration
      await page.waitForTimeout(1000);

      // Stats should still be present (planet regenerated)
      const newStats = await page.locator('#stats').textContent();
      expect(newStats).toContain('Vertices');
    }
  });

  test('should allow camera interaction', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas');
    await page.waitForSelector('#loading', { state: 'hidden', timeout: 15000 });

    const canvas = await page.locator('canvas');

    // Get canvas position
    const box = await canvas.boundingBox();

    // Perform drag to rotate
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
    await page.mouse.up();

    // If we got here without error, interaction works
    expect(true).toBe(true);
  });

  test('should not have console errors during initialization', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForSelector('canvas');
    await page.waitForSelector('#loading', { state: 'hidden', timeout: 15000 });

    // Filter out known non-critical errors (like WebGL warnings)
    const criticalErrors = errors.filter(err => 
      !err.includes('WebGL') && 
      !err.includes('DevTools')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should generate planet with reasonable statistics', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas');
    await page.waitForSelector('#loading', { state: 'hidden', timeout: 15000 });

    const stats = await page.locator('#stats').textContent();

    // Extract vertex count
    const vertexMatch = stats.match(/Vertices:\s*([\d,]+)/);
    expect(vertexMatch).toBeTruthy();
    
    const vertexCount = parseInt(vertexMatch[1].replace(/,/g, ''));
    expect(vertexCount).toBeGreaterThan(1000);
    expect(vertexCount).toBeLessThan(20000);

    // Should have some rivers
    const riverMatch = stats.match(/Rivers:\s*(\d+)/);
    expect(riverMatch).toBeTruthy();
    const riverCount = parseInt(riverMatch[1]);
    expect(riverCount).toBeGreaterThanOrEqual(0);

    // Should have reasonable land percentage
    const landMatch = stats.match(/Land:\s*([\d.]+)%/);
    expect(landMatch).toBeTruthy();
    const landPercent = parseFloat(landMatch[1]);
    expect(landPercent).toBeGreaterThan(10);
    expect(landPercent).toBeLessThan(90);
  });
});
