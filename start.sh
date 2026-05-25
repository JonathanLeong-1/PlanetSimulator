#!/bin/bash

# Planet Simulator - Startup Script
# This ensures the development server starts correctly

echo "🌍 Starting Planet Simulator..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 3000 is already in use!"
    echo "🔧 Attempting to free the port..."
    
    # Kill the process using port 3000
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    
    # Wait a moment for the port to be freed
    sleep 2
    
    # Check again
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ Failed to free port 3000. Please manually stop the process using:"
        echo "   lsof -ti:3000 | xargs kill -9"
        exit 1
    else
        echo "✅ Port 3000 is now available"
    fi
fi

echo "🚀 Starting development server..."
echo "📍 Server will be available at: http://localhost:3000"
echo ""
echo "💡 Tips:"
echo "   • Hover over the planet to see detailed information"
echo "   • Left-click and drag to rotate"
echo "   • Right-click and drag to pan"
echo "   • Scroll to zoom"
echo "   • Use the UI panel to adjust parameters"
echo ""
echo "⏸️  Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the dev server
npm run dev
