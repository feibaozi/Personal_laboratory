import os
import tempfile
import logging

from fastapi import APIRouter, UploadFile, File, Depends, Query, HTTPException

from app.routers.auth import get_current_user
from app.models.user import User
from app.services.ocr_service import ocr_service
from app.schemas.ocr import OCRExtractResponse, OCRHealthResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/extract", response_model=OCRExtractResponse)
async def extract_prices(
    file: UploadFile = File(..., description="外卖截图文件"),
    platform: str = Query(
        default="unknown",
        description="平台标识: meituan / eleme / jd_waimai / douyin_waimai",
    ),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {ext}，仅支持 {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"文件大小超过限制（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）",
        )

    if len(content) < 100:
        raise HTTPException(status_code=400, detail="文件内容过小，可能不是有效截图")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = ocr_service.extract_from_image(tmp_path, platform)
        result["filename"] = file.filename
        result["user_id"] = current_user.id
        return result
    except Exception as e:
        logger.error("OCR extract failed for user %d: %s", current_user.id, e)
        raise HTTPException(status_code=500, detail=f"OCR 处理失败: {str(e)}")
    finally:
        os.unlink(tmp_path)


@router.post("/extract/batch", response_model=list[OCRExtractResponse])
async def extract_prices_batch(
    files: list[UploadFile] = File(..., description="多个外卖截图文件"),
    platform: str = Query(default="unknown"),
    current_user: User = Depends(get_current_user),
):
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="最多同时上传5张截图")

    results = []
    for file in files:
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            results.append(OCRExtractResponse(
                success=False,
                platform=platform,
                message=f"不支持的文件格式: {ext}",
                filename=file.filename,
                ocr_enabled=ocr_service.available,
            ))
            continue

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            results.append(OCRExtractResponse(
                success=False,
                platform=platform,
                message="文件大小超过限制",
                filename=file.filename,
                ocr_enabled=ocr_service.available,
            ))
            continue

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            result = ocr_service.extract_from_image(tmp_path, platform)
            result["filename"] = file.filename
            results.append(result)
        except Exception as e:
            results.append(OCRExtractResponse(
                success=False,
                platform=platform,
                message=f"处理失败: {str(e)}",
                filename=file.filename,
                ocr_enabled=ocr_service.available,
            ))
        finally:
            os.unlink(tmp_path)

    return results


@router.get("/health", response_model=OCRHealthResponse)
async def ocr_health():
    return ocr_service.check_health()