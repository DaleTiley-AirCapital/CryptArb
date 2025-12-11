#!/bin/bash
cd frontend && npm run dev &
cd /home/runner/workspace && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
