#!/bin/bash

echo "🚀 Starting Open Imagine..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the open-imagine root directory"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down Open Imagine..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

echo "📦 Installing dependencies if needed..."
if [ ! -d "frontend/node_modules" ]; then
    cd frontend && npm install && cd ..
fi

if [ ! -d "backend/node_modules" ]; then
    cd backend && npm install && cd ..
fi

echo ""
echo "✅ Dependencies ready!"
echo ""
echo "🎨 Starting frontend on http://localhost:5173"
echo "🔧 Starting backend on http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start backend
cd backend && npm start &

# Give backend time to start
sleep 2

# Start frontend
cd frontend && npm run dev &

# Wait for all background jobs
wait