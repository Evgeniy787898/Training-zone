"""Image Processor Service Data Models."""

from typing import Dict, List, Literal, Optional, Any

from pydantic import BaseModel, Field, field_validator


class ResizeOptions(BaseModel):
    """Image resize options."""
    maxWidth: Optional[int] = Field(default=None, description="Target width in pixels")
    maxHeight: Optional[int] = Field(default=None, description="Target height in pixels")
    mode: Optional[Literal["contain", "cover", "fill", "stretch", "pad"]] = None
    position: Optional[
        Literal[
            "center",
            "top",
            "bottom",
            "left",
            "right",
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
        ]
    ] = Field(default=None, description="Anchor used for cover mode")
    background: Optional[str] = Field(default=None, description="Hex color (RGB or RGBA)")


class AdjustmentOptions(BaseModel):
    """Image adjustment options."""
    grayscale: bool = False
    sharpen: bool = False
    stripMetadata: bool = True


class ImageProcessRequest(BaseModel):
    """Request for processing an image."""
    image: str
    resize: ResizeOptions | None = None
    quality: Optional[int] = Field(default=None, description="JPEG/WebP quality (10-100)")
    format: Optional[str] = Field(default=None, description="Target format (e.g. webp)")
    adjustments: AdjustmentOptions | None = None

    @field_validator("image")
    @classmethod
    def _ensure_image_payload(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Image payload is required")
        return value


class AppliedOptions(BaseModel):
    """Options that were applied during processing."""
    mode: str
    quality: int
    background: Optional[str] = None
    format: str
    adjustments: AdjustmentOptions


class ImageProcessResponse(BaseModel):
    """Response with processed image."""
    processedImage: str
    width: int
    height: int
    format: str
    size: int
    optimized: bool
    options: AppliedOptions


class ImageUploadParams(BaseModel):
    """Parameters for file upload endpoint."""
    maxWidth: Optional[int] = None
    maxHeight: Optional[int] = None
    mode: Optional[str] = None
    position: Optional[str] = None
    background: Optional[str] = None
    quality: Optional[int] = None
    outputFormat: Optional[str] = None
    grayscale: Optional[bool] = None
    sharpen: Optional[bool] = None
    stripMetadata: Optional[bool] = None

    def resize_options(self) -> ResizeOptions | None:
        """Convert to ResizeOptions if any resize params are set."""
        if not any([
            self.maxWidth,
            self.maxHeight,
            self.mode,
            self.position,
            self.background,
        ]):
            return None
        return ResizeOptions(
            maxWidth=self.maxWidth,
            maxHeight=self.maxHeight,
            mode=self.mode,
            position=self.position,
            background=self.background,
        )

    def adjustment_options(self) -> AdjustmentOptions | None:
        """Convert to AdjustmentOptions if any adjustment params are set."""
        if self.grayscale is None and self.sharpen is None and self.stripMetadata is None:
            return None
        return AdjustmentOptions(
            grayscale=self.grayscale or False,
            sharpen=self.sharpen or False,
            stripMetadata=self.stripMetadata if self.stripMetadata is not None else True,
        )
