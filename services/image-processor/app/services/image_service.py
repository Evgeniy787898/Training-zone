"""Image Processor Service - Core business logic."""

import base64
import io
import logging
import re
import time
from typing import Optional

from fastapi import HTTPException
from PIL import Image, ImageFilter, ImageOps

from app.config import config
from app.models import (
    AdjustmentOptions,
    AppliedOptions,
    ImageProcessRequest,
    ImageProcessResponse,
    ImageUploadParams,
    ResizeOptions,
)


def _normalize_hex_color(value: Optional[str]) -> Optional[str]:
    """Normalize and validate hex color."""
    if not value:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if not normalized.startswith("#"):
        normalized = f"#{normalized}"
    match = re.fullmatch(r"#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})", normalized)
    if not match:
        return None
    hex_value = match.group(1)
    if len(hex_value) in {3, 4}:
        hex_value = "".join(ch * 2 for ch in hex_value)
    if len(hex_value) == 6:
        hex_value += "FF"
    return f"#{hex_value.upper()}"


def _canonical_format(value: Optional[str]) -> str:
    """Canonicalize image format name."""
    if not value:
        return ""
    normalized = value.strip().upper()
    if normalized == "JPG":
        return "JPEG"
    return normalized


class ImageProcessor:
    """Handles image processing operations."""

    def __init__(self, logger: logging.Logger, metrics_recorder) -> None:
        self._logger = logger
        self._metrics = metrics_recorder

    async def process_base64(self, request: ImageProcessRequest) -> ImageProcessResponse:
        """Process base64 encoded image."""
        raw_bytes = self._decode_image(request.image)
        return self._process_bytes(
            raw_bytes,
            request.resize,
            quality=request.quality,
            output_format=request.format,
            adjustments=request.adjustments,
        )

    async def process_upload(self, content: bytes, params: ImageUploadParams) -> ImageProcessResponse:
        """Process uploaded file."""
        return self._process_bytes(
            content,
            params.resize_options(),
            quality=params.quality,
            output_format=params.outputFormat,
            adjustments=params.adjustment_options(),
        )

    def _decode_image(self, data: str) -> bytes:
        """Decode base64 image data."""
        if data.startswith("data:"):
            try:
                _, encoded = data.split(",", 1)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid data URI") from exc
            data = encoded
        try:
            return base64.b64decode(data, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Image is not valid base64") from exc

    def _open_image(self, raw_bytes: bytes) -> Image.Image:
        """Open and orient image from bytes."""
        try:
            image = Image.open(io.BytesIO(raw_bytes))
            image = ImageOps.exif_transpose(image)
            return image
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Unsupported or corrupt image") from exc

    def _resolve_output_format(self, candidate: Optional[str]) -> str:
        """Resolve and validate output format."""
        normalized = _canonical_format(candidate) or config.default_format
        if normalized not in config.allowed_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Requested format '{normalized}' is not supported",
            )
        return normalized

    def _resize_image(self, image: Image.Image, options: ResizeOptions | None) -> tuple[Image.Image, AppliedOptions]:
        """Resize image according to options."""
        width = config.clamp_dimension(options.maxWidth if options else None, config.default_max_width)
        height = config.clamp_dimension(options.maxHeight if options else None, config.default_max_height)
        
        if width is None and height is None:
            return image, AppliedOptions(
                mode=config.default_mode,
                quality=config.default_quality,
                background=config.default_background,
                format=f"image/{config.default_format.lower()}",
                adjustments=AdjustmentOptions(stripMetadata=config.default_strip_metadata),
            )

        target_width = width or image.width
        target_height = height or image.height
        mode = (options.mode if options and options.mode else config.default_mode).strip().lower()
        background = _normalize_hex_color(options.background if options else None) or config.default_background

        if mode == "contain":
            resized = ImageOps.contain(image, (target_width, target_height), Image.Resampling.LANCZOS)
        elif mode == "cover":
            resized = ImageOps.fit(image, (target_width, target_height), Image.Resampling.LANCZOS)
        elif mode == "fill":
            resized = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
        elif mode == "stretch":
            resized = image.resize((target_width, target_height), Image.Resampling.BICUBIC)
        else:  # pad
            resized = ImageOps.contain(image, (target_width, target_height), Image.Resampling.LANCZOS)

        return resized, AppliedOptions(
            mode=mode,
            quality=config.default_quality,
            background=background,
            format=f"image/{config.default_format.lower()}",
            adjustments=AdjustmentOptions(stripMetadata=config.default_strip_metadata),
        )

    def _apply_adjustments(
        self, image: Image.Image, adjustments: AdjustmentOptions | None, applied: AppliedOptions
    ) -> tuple[Image.Image, AppliedOptions]:
        """Apply image adjustments."""
        if not adjustments:
            return image, applied
        updated = image
        if adjustments.stripMetadata:
            updated.info.clear()
        if adjustments.grayscale:
            updated = ImageOps.grayscale(updated).convert("RGB")
        if adjustments.sharpen:
            updated = updated.filter(ImageFilter.UnsharpMask(radius=1.2, percent=150, threshold=3))
        applied.adjustments = adjustments
        return updated, applied

    def _encode_image(self, image: Image.Image, *, quality: Optional[int], output_format: str) -> tuple[str, int]:
        """Encode image to base64."""
        normalized_quality = config.clamp_quality(quality)
        buffer = io.BytesIO()
        params: dict[str, object] = {"format": output_format}
        if output_format in {"JPEG", "WEBP"}:
            params["quality"] = normalized_quality
        if output_format == "JPEG":
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            params["optimize"] = True
            params["progressive"] = True
        elif output_format == "WEBP":
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            params["method"] = 6
        elif output_format == "PNG":
            if image.mode == "P":
                image = image.convert("RGBA")
            params["optimize"] = True
            params["compress_level"] = 9
        image.save(buffer, **params)
        payload = base64.b64encode(buffer.getvalue()).decode("ascii")
        return payload, buffer.tell()

    def _process_bytes(
        self,
        raw_bytes: bytes,
        resize: ResizeOptions | None,
        *,
        quality: Optional[int],
        output_format: Optional[str],
        adjustments: AdjustmentOptions | None,
    ) -> ImageProcessResponse:
        """Core image processing logic."""
        started_at = time.perf_counter()
        inbound_size = len(raw_bytes)
        try:
            source_image = self._open_image(raw_bytes)
            requested_format = self._resolve_output_format(output_format)
            resized, applied = self._resize_image(source_image, resize)
            adjusted, applied = self._apply_adjustments(resized, adjustments, applied)
            normalized_quality = config.clamp_quality(quality)
            encoded, size = self._encode_image(
                adjusted,
                quality=normalized_quality,
                output_format=requested_format,
            )
            source_format = _canonical_format(source_image.format) or "UNKNOWN"
            applied.quality = normalized_quality
            applied.format = f"image/{requested_format.lower()}"
            
            self._logger.info(
                "processed image",
                extra={
                    "width": adjusted.width,
                    "height": adjusted.height,
                    "format": requested_format,
                    "source_format": source_format,
                    "size": size,
                    "quality": normalized_quality,
                    "mode": applied.mode,
                },
            )
            if self._metrics:
                self._metrics.increment_counter("image_processor.bytes_in", inbound_size)
                self._metrics.increment_counter("image_processor.bytes_out", size)
                self._metrics.observe_operation(
                    "optimize",
                    duration_ms=(time.perf_counter() - started_at) * 1000,
                    success=True,
                    metadata={
                        "format": requested_format,
                        "mode": applied.mode,
                        "width": adjusted.width,
                        "height": adjusted.height,
                    },
                )
            return ImageProcessResponse(
                processedImage=encoded,
                width=adjusted.width,
                height=adjusted.height,
                format=f"image/{requested_format.lower()}",
                size=size,
                optimized=True,
                options=applied,
            )
        except Exception as exc:
            if self._metrics:
                self._metrics.observe_operation(
                    "optimize",
                    duration_ms=(time.perf_counter() - started_at) * 1000,
                    success=False,
                    error=str(exc),
                    metadata={"bytes_in": inbound_size},
                )
            raise
