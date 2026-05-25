# Troubleshooting Guide

## Connection Issues

### "localhost refused to connect" or "ERR_CONNECTION_REFUSED"

This means the development server is not running. Here's how to fix it:

#### Solution 1: Use the Startup Script (Recommended)
```bash
./start.sh
```
This script automatically:
- Checks for dependencies
- Frees port 3000 if needed
- Starts the dev server
- Shows helpful tips

#### Solution 2: Manual Start
```bash
npm run dev
```

#### Solution 3: If Port is Already in Use
```bash
# Find what's using port 3000
lsof -ti:3000

# Kill the process
lsof -ti:3000 | xargs kill -9

# Then start the server
npm run dev
```

### Server Keeps Stopping

If the server stops unexpectedly:

1. **Check for errors in the terminal**
   - Look for red error messages
   - Note any file paths mentioned

2. **Restart the server**
   ```bash
   npm run dev
   ```

3. **Clear the build cache**
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

### WebGL Errors

If you see "WebGL not supported" or similar:

1. **Check browser compatibility**
   - Use Chrome, Firefox, Edge, or Safari (latest versions)
   - Enable hardware acceleration in browser settings

2. **Update graphics drivers**
   - Especially important for Windows users

3. **Try a different browser**
   - WebGL support varies by browser and system

### Performance Issues

If the planet is slow or laggy:

1. **Lower detail level** (for older hardware)
   - Edit `src/scene.js`
   - Change `detail: 7` to `detail: 6` or `5`
   - Restart server

2. **Close other tabs/applications**
   - Free up system resources

3. **Check browser console**
   - Press F12 to open developer tools
   - Look for warnings or errors

## Port Configuration

### Change Default Port (3000)

If you need to use a different port:

1. **Edit vite.config.js**
   ```javascript
   export default defineConfig({
     server: {
       port: 3001, // Change this number
       open: false
     },
     // ...
   });
   ```

2. **Update Playwright tests** (if running E2E tests)
   Edit `playwright.config.js` and change port to match

## Common Errors

### "Cannot find module"

**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### "JavaScript heap out of memory"

**Fix:**
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev
```

### Build Fails

**Fix:**
```bash
npm run build 2>&1 | tee build.log
# Check build.log for specific errors
```

## Getting Help

If problems persist:

1. **Check the console** (F12 in browser)
   - Look for errors in red
   - Note the file and line number

2. **Check terminal output**
   - Vite shows helpful error messages
   - Stack traces point to problem files

3. **Verify installation**
   ```bash
   node --version  # Should be 16+
   npm --version   # Should be 7+
   ```

4. **Clean restart**
   ```bash
   # Stop all servers (Ctrl+C)
   rm -rf node_modules/.vite
   npm run dev
   ```

## Prevention Tips

### Always Use the Startup Script
```bash
./start.sh
```
This prevents most common issues.

### Don't Force-Quit Terminal
- Use Ctrl+C to stop the server gracefully
- This prevents port conflicts

### Keep Dependencies Updated
```bash
npm update
```

### Use Latest Browser
- Modern browsers have better WebGL support
- Update regularly for best performance

## Quick Reference

| Issue | Command |
|-------|---------|
| Start server | `./start.sh` or `npm run dev` |
| Stop server | Press `Ctrl+C` in terminal |
| Check port | `lsof -ti:3000` |
| Free port | `lsof -ti:3000 \| xargs kill -9` |
| Rebuild | `npm run build` |
| Run tests | `npm test` |
| Clean install | `rm -rf node_modules && npm install` |

## Still Having Issues?

The server is currently running. You can access it at:
**http://localhost:3000**

Make sure:
- ✅ Terminal shows "VITE v5.x.x ready"
- ✅ No error messages in terminal
- ✅ Browser is up to date
- ✅ No browser extensions blocking WebGL
