"""Entry point for TrackerThings AI Microservice (FastAPI + Uvicorn)."""
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import __version__
from app.api.health import router as health_router
from app.api.routes import router as extraction_router
from app.config import settings

app = FastAPI(
    title="TrackerThings AI Microservice",
    description="Specialized Self-Hosted Server Provider for academic document extraction in TrackerThings V2.",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware (internal server-to-server or web access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(health_router)
app.include_router(extraction_router)

if __name__ == "__main__":
    port = int(os.getenv("PORT", settings.PORT))
    host = os.getenv("HOST", settings.HOST)
    uvicorn.run("main:app", host=host, port=port, reload=False)

