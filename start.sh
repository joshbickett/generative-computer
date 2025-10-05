#!/bin/bash

set -e

AUTH_FILES=(
    "$HOME/.gemini/oauth_creds.json"
    "$HOME/.gemini/google_accounts.json"
    "$HOME/.gemini/api_keys.json"
    "$HOME/.config/gemini/oauth_creds.json"
    "$HOME/.config/gemini/google_accounts.json"
    "$HOME/.config/gemini/api_keys.json"
)

if [[ "${1:-}" == "logout" ]]; then
    echo "🔐 Clearing Gemini CLI authentication..."
    LOGOUT_REMOVED=false
    for path in "${AUTH_FILES[@]}"; do
        if [ -f "$path" ]; then
            rm -f "$path"
            LOGOUT_REMOVED=true
            echo "   Removed $path"
        fi
    done

    if [ "$LOGOUT_REMOVED" = "true" ]; then
        echo ""
        echo "✅ Gemini CLI credentials removed. Run ./computer to re-authenticate."
    else
        echo "ℹ️  No Gemini CLI credentials found to remove."
    fi
    exit 0
fi

echo "🚀 Starting Generative Computer..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the generative-computer root directory"
    exit 1
fi

# Warn if Node.js is too old for headless Gemini usage
NODE_VERSION=$(node -v 2>/dev/null)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
if [ -n "$NODE_MAJOR" ] && [ "$NODE_MAJOR" -lt 20 ]; then
    echo "⚠️  Detected Node.js $NODE_VERSION. Gemini CLI headless mode requires Node.js 20+."
    echo "    Run 'nvm use 20' (or similar) before starting if you encounter issues."
    echo ""
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down Generative Computer..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

free_port() {
    local port=$1
    local pids=$(lsof -ti tcp:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "⚠️  Port $port is in use. Attempting to stop conflicting process..."
        echo "$pids" | xargs -r kill >/dev/null 2>&1 || true
        sleep 1
        # If still busy, force kill
        local still=$(lsof -ti tcp:$port 2>/dev/null || true)
        if [ -n "$still" ]; then
            echo "⚠️  Force killing processes on port $port: $still"
            echo "$still" | xargs -r kill -9 >/dev/null 2>&1 || true
            sleep 1
        fi
        still=$(lsof -ti tcp:$port 2>/dev/null || true)
        if [ -n "$still" ]; then
            echo "❌ Unable to free port $port. Running processes: $still"
            echo "   Please stop these processes manually and re-run ./start.sh"
            exit 1
        fi
    fi
}

ensure_cli_ready() {
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing root dependencies needed for authentication..."
        npm install
    fi

    if [ ! -f "packages/cli/dist/index.js" ]; then
        echo "🔨 Building Gemini CLI core for authentication flow..."
        npm run build
    fi
}

# Check Gemini authentication by looking for known credential files
echo "🔐 Checking Gemini CLI authentication..."

AUTHENTICATED=false
for path in "${AUTH_FILES[@]}"; do
    if [ -f "$path" ]; then
        AUTHENTICATED=true
        break
    fi
done

if [ "$AUTHENTICATED" != "true" ]; then
    echo ""
    echo "❌ Gemini CLI is not authenticated!"
    echo ""
    echo "Let's authenticate now:"
    echo "  1. Gemini CLI will open"
    echo "  2. Choose 'Login with Google'"
    echo "  3. Complete authentication in your browser"
    echo "  4. Then type '/exit' to continue"
    echo ""
    read -p "Press ENTER to start authentication..."
    ensure_cli_ready

    # Run Gemini CLI for authentication
    npm start

    echo ""
    echo "✅ Authentication complete!"
    echo ""
else
    echo "✅ Already authenticated!"
    echo ""
fi

echo "📦 Installing dependencies if needed..."
if [ ! -d "node_modules" ]; then
    npm install
fi

if [ ! -d "generative-computer/frontend/node_modules" ]; then
    cd generative-computer/frontend && npm install && cd ../..
fi

if [ ! -d "generative-computer/backend/node_modules" ]; then
    cd generative-computer/backend && npm install && cd ../..
fi

# Build Gemini CLI if needed
if [ ! -d "bundle" ] || [ ! -f "bundle/gemini.js" ]; then
    echo "🔨 Building Gemini CLI..."
    npm run build
fi

echo ""
echo "✅ Dependencies ready!"
echo ""
echo "🚀 Starting Generative Computer with REAL Gemini agent..."
echo ""

# Ensure ports are available
free_port 3001
free_port 5173

echo "   🎨 Frontend: http://localhost:5173"
echo "   🔧 Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start backend with real agent mode
cd generative-computer/backend && USE_REAL_AGENT=true npm start &

# Give backend time to start
sleep 3

# Start frontend
cd generative-computer/frontend && npm run dev &

# Show success message
sleep 2
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Generative Computer is running!"
echo ""
echo "   👉 Open your browser to: http://localhost:5173"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Wait for all background jobs
wait
