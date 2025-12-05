"""Image processing routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from app.models import ImageProcessRequest, ImageProcessResponse, ImageUploadParams

# Global instances (will be set in main.py)
image_processor = None  # type: ignore

router = APIRouter()


@router.post("/api/process-image", response_model=ImageProcessResponse)
async def process_image(request: ImageProcessRequest) -> ImageProcessResponse:
    """Optimize a base64 encoded image."""
    return await image_processor.process_base64(request)


@router.post("/api/process-image/upload", response_model=ImageProcessResponse)
async def process_uploaded_image(
    file: Annotated[UploadFile, File(...)],
    params: Annotated[ImageUploadParams, Depends()],
) -> ImageProcessResponse:
    """Optimize an uploaded file."""
    content = await file.read()
    return await image_processor.process_upload(content, params)
