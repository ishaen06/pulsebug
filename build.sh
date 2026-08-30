#!/usr/bin/env bash
set -e

echo "=== PulseBug Backend Build ==="
if command -v pip3 &> /dev/null; then
    pip3 install -r requirements.txt
elif command -v pip &> /dev/null; then
    pip install -r requirements.txt
else
    echo "ERROR: pip is not found."
    exit 127
fi
