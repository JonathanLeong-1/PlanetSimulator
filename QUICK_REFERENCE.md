# Quick Reference Card

## Starting the Application

### ✅ Best Way (Recommended)
```bash
./start.sh
```
**Why?** Automatically handles:
- Port conflicts
- Missing dependencies
- Helpful startup messages
- Clean server initialization

### Alternative Ways
```bash
npm run dev           # Manual start
npm run build         # Production build
npm run preview       # Test production
```

## If You See "Connection Refused"

This means the server isn't running. **Solution:**

```bash
./start.sh
```

That's it! The script handles everything.

## Common Commands

| Task | Command |
|------|---------|
| **Start server** | `./start.sh` |
| **Stop server** | Press `Ctrl+C` in terminal |
| **Run tests** | `npm test` |
| **Build** | `npm run build` |
| **Install** | `npm install` |

## Keyboard Shortcuts

### In Browser:
- `F12` - Open developer console
- `Ctrl+Shift+R` - Hard refresh (clear cache)

### In Terminal:
- `Ctrl+C` - Stop server (graceful)
- `Ctrl+Z` - Pause (don't use - causes issues)

## Server URLs

- **Development**: http://localhost:3000
- **Production Preview**: http://localhost:4173 (after `npm run build && npm run preview`)

## Health Check

Server is running correctly when you see:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:3000/
```

## Emergency Reset

If something is really broken:
```bash
# Stop server (Ctrl+C)
rm -rf node_modules/.vite
npm run dev
```

Or use the startup script (it's safer):
```bash
./start.sh
```

## Files to Never Modify

- `node_modules/` - Auto-generated
- `dist/` - Build output
- `package-lock.json` - Dependency lock file

## Files You Can Modify

- `src/*.js` - Application code
- `index.html` - Main HTML
- `README.md` - Documentation
- Parameters in UI - All safe to change!

## Getting Help

1. **Connection issues** → See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. **Server won't start** → Run `./start.sh`
3. **Errors on screen** → Press F12, check Console tab
4. **Performance issues** → See TROUBLESHOOTING.md

## Pro Tips

### ✅ DO:
- Use `./start.sh` to start server
- Stop server with `Ctrl+C`
- Keep terminal open while using app
- Update browser regularly

### ❌ DON'T:
- Force-quit terminal
- Close terminal while server running
- Run multiple servers on same port
- Ignore error messages

## Status Indicators

### Server Running ✅
```
  ➜  Local:   http://localhost:3000/
```

### Server Stopped ❌
```
(No output, terminal prompt visible)
```

### Server Error ⚠️
```
Error: ...
[vite] Internal server error: ...
```

**Fix:** Stop (Ctrl+C) and restart (`./start.sh`)

## Remember

**The #1 cause of "connection refused" is forgetting to start the server.**

**The #1 solution is:**
```bash
./start.sh
```

Keep this tab/window visible while using the app, and you'll always know if the server is running!

---

**Current Status:** Server is running at http://localhost:3000 ✅
