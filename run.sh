#!/bin/bash

echo "Starting Ollama Chat Web Server..."
echo
echo "Server will be available at: http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo

# Open browser
if command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open http://localhost:8000 &
elif command -v open &> /dev/null; then
    # macOS
    open http://localhost:8000 &
elif command -v start &> /dev/null; then
    # Windows (if running in WSL)
    start http://localhost:8000 &
else
    echo "Browser will not open automatically. Please open http://localhost:8000 manually"
fi

# Check if Python is available
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m http.server 8000
else
    echo "Error: Python is not installed or not in PATH"
    echo "Please install Python 3.x and try again"
    exit 1
fi
