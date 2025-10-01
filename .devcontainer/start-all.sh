#!/usr/bin/env bash
set -euo pipefail

# Backend
( cd backend && . .venv/bin/activate && python dev_server.py ) &

# Frontend (u rootu je frontend)
npm run dev -- --host 0.0.0.0