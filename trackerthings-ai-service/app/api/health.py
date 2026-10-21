"""Health check routes for Koyeb uptime monitoring and Next.js backend checks."""
from fastapi import APIRouter
from app import __version__
from app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Uptime Health Check")
async def health_check():
    """
    Public health check endpoint utilized by Koyeb and Next.js SelfHostedServerProvider.isAvailable().
    """
    return {
        "status": "ok",
        "service": "trackerthings-ai-service",
        "version": __version__,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/", summary="Root Status")
async def root():
    return {
        "message": "TrackerThings AI Academic Intelligence Microservice",
        "version": __version__,
        "status": "healthy",
        "docs_url": "/docs",
    }

