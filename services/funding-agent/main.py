#!/usr/bin/env python3
"""
Thriveward Funding Intelligence — Funding Agent Python Service
Microservice responsible for funding opportunity analysis, eligibility extraction,
and provenance verification.
"""

import sys
import os
import json
from datetime import datetime

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn

    app = FastAPI(
        title="Thriveward Funding Intelligence Funding Agent Service",
        description="Microservice for grant eligibility extraction and fit scoring",
        version="0.1.0-phase0"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def root():
        return {
            "service": "Thriveward Funding Intelligence Funding Agent",
            "status": "UP",
            "version": "0.1.0-phase0",
            "docs": "/docs"
        }

    @app.get("/health")
    def health_check():
        return {
            "status": "UP",
            "service": "Thriveward Funding Intelligence Funding Agent",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "capabilities": [
                "Eligibility Requirement Extraction",
                "Participant Support Allowability Matrix",
                "Provenance Citation Binding",
                "Bridge Fit Scoring Model (0-100)"
            ],
            "governance": {
                "humanInTheLoopEnforced": True,
                "autonomousSubmissionsAllowed": False
            }
        }

    def start_server():
        port = int(os.environ.get("PORT", 8000))
        print(f"🤖 Thriveward Funding Intelligence Funding Agent active on http://0.0.0.0:{port}")
        uvicorn.run(app, host="0.0.0.0", port=port)

except ImportError:
    # Standard library fallback if dependencies are not yet installed in local python environment
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path in ["/health", "/"]:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                response = {
                    "status": "UP",
                    "service": "Thriveward Funding Intelligence Funding Agent (Standard Fallback Mode)",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "capabilities": [
                        "Eligibility Requirement Extraction",
                        "Participant Support Allowability Matrix",
                        "Provenance Citation Binding",
                        "Bridge Fit Scoring Model (0-100)"
                    ],
                    "governance": {
                        "humanInTheLoopEnforced": True,
                        "autonomousSubmissionsAllowed": False
                    }
                }
                self.wfile.write(json.dumps(response).encode("utf-8"))
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, format, *args):
            pass

    def start_server():
        port = int(os.environ.get("PORT", 8000))
        print(f"🤖 Thriveward Funding Intelligence Funding Agent (Fallback Mode) active on http://0.0.0.0:{port}")
        server = HTTPServer(("0.0.0.0", port), HealthHandler)
        server.serve_forever()

if __name__ == "__main__":
    start_server()
