#!/usr/bin/env bash
set -e

echo "=== PulseBug Backend Startup ==="
if command -v python3 &> /dev/null; then
    exec python3 run_server.py
elif command -v python &> /dev/null; then
    exec python run_server.py
else
    echo "ERROR: Python is not installed in this container. Please set Runtime to Python 3 in Render Settings."
    exit 127
fi
