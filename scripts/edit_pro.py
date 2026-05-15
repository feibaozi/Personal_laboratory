"""
Professional portrait retouching (no mediapipe dependency):
- OpenCV face+eye detection
- Skin mask via HSV/YCrCb → natural whitening
- Bilateral skin smoothing with texture preservation
- Frequency-separation spot/acne removal
- Eye brightening & sharpening
- Gentle face contour slimming
"""

import cv2
import numpy as np
from PIL import Image
import sys


# ── Helpers ──────────────────────────────────────────────

def read_rgb(path):
    pil = Image.open(path).convert('RGB')
    return cv2.cvtColor(np.array(pil, dtype=np.uint8), cv2.COLOR_RGB2BGR)


def write_jpeg(img_bgr, path, quality=95):
    cv2.imwrite(path, img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])


# ── Spot / acne removal ─────────────────────────────────

def remove_spots(bgr, threshold=14):
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (0, 0), 3.0)
    highpass = cv2.subtract(gray, blur)
    _, mask = cv2.threshold(np.abs(highpass), threshold, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
    mask = cv2.dilate(mask, kernel, iterations=1)
    # don't inpaint near edges
    mask[:3, :] = 0; mask[-3:, :] = 0
    mask[:, :3] = 0; mask[:, -3:] = 0
    return cv2.inpaint(bgr, mask, 2, cv2.INPAINT_TELEA)


# ── Skin detection ───────────────────────────────────────

def detect_skin_mask(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    lower_hsv = np.array([0, 18, 40], dtype=np.uint8)
    upper_hsv = np.array([30, 180, 255], dtype=np.uint8)
    mask_hsv = cv2.inRange(hsv, lower_hsv, upper_hsv)
    lower_y = np.array([0, 130, 75], dtype=np.uint8)
    upper_y = np.array([255, 175, 130], dtype=np.uint8)
    mask_ycrcb = cv2.inRange(ycrcb, lower_y, upper_y)
    mask = cv2.bitwise_and(mask_hsv, mask_ycrcb)
    mask = cv2.erode(mask, None, iterations=2)
    mask = cv2.GaussianBlur(mask, (41, 41), 0)
    return mask


def whiten_skin_natural(bgr, mask, strength=0.10):
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b_ch = cv2.split(lab)
    l = l.astype(np.float32)
    alpha = (mask.astype(np.float32) / 255.0) * strength
    l_boost = l * (1.0 + alpha)
    l_boost = np.clip(l_boost, 0, 255).astype(np.uint8)
    return cv2.cvtColor(cv2.merge((l_boost, a, b_ch)), cv2.COLOR_LAB2BGR)


# ── Skin smoothing ───────────────────────────────────────

def smooth_skin(bgr, mask, face_rect=None):
    smoothed = cv2.bilateralFilter(bgr, d=0, sigmaColor=35, sigmaSpace=35)
    if face_rect is not None:
        x, y, w, h = face_rect
        face = bgr[y:y+h, x:x+w]
        face_smooth = cv2.bilateralFilter(face, d=0, sigmaColor=55, sigmaSpace=55)
        # High-pass detail layer on original face to preserve texture
        face_gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        detail = cv2.subtract(face_gray, cv2.GaussianBlur(face_gray, (0, 0), 2.0))
        detail = np.repeat(detail[:, :, None], 3, axis=2).astype(np.float32) * 0.15
        face_blend = cv2.addWeighted(face, 0.3, face_smooth, 0.7, 0)
        face_blend = np.clip(face_blend.astype(np.float32) + detail, 0, 255).astype(np.uint8)
        smoothed[y:y+h, x:x+w] = face_blend
    alpha = (mask.astype(np.float32) / 255.0)
    alpha = np.repeat(alpha[:, :, None], 3, axis=2)
    return (bgr * (1 - alpha) + smoothed * alpha).astype(np.uint8)


# ── Face slimming (simple contour squeeze) ───────────────

def slim_face_mild(bgr, face_rect, strength=0.97):
    x, y, w, h = face_rect
    face = bgr[y:y+h, x:x+w]
    new_w = max(2, int(w * strength))
    if new_w >= w - 2:
        return bgr
    resized = cv2.resize(face, (new_w, h), interpolation=cv2.INTER_LANCZOS4)
    canvas = face.copy()
    start = (w - new_w) // 2
    canvas[:, start:start+new_w] = resized
    # Smooth blend seams
    alpha = np.ones((h, w), dtype=np.float32)
    blend_width = min(20, start)
    for i in range(blend_width):
        v = i / blend_width
        alpha[:, start + i] = v
        alpha[:, start + new_w - 1 - i] = v
    alpha = cv2.GaussianBlur(alpha, (blend_width*2+1, blend_width*2+1), 0)
    alpha = np.repeat(alpha[:, :, None], 3, axis=2)
    merged = (canvas * alpha + face * (1 - alpha)).astype(np.uint8)
    bgr[y:y+h, x:x+w] = merged
    return bgr


# ── Eye detection & brightening ──────────────────────────

def detect_and_brighten_eyes(bgr, face_rect):
    x, y, w, h = face_rect
    face_roi = bgr[y:y+h, x:x+w]
    face_gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)

    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
    eyes = eye_cascade.detectMultiScale(face_gray, scaleFactor=1.05, minNeighbors=8,
                                         minSize=(20, 15), maxSize=(w//2, h//3))

    for (ex, ey, ew, eh) in eyes:
        ex2, ey2 = max(0, ex-4), max(0, ey-3)
        ex2_end = min(w, ex+ew+4)
        ey2_end = min(h, ey+eh+3)
        eye_roi = face_roi[ey2:ey2_end, ex2:ex2_end].astype(np.float32)
        eye_roi *= 1.06
        eye_roi = np.clip(eye_roi, 0, 255).astype(np.uint8)
        eye_roi = cv2.addWeighted(eye_roi, 1.25,
                                  cv2.GaussianBlur(eye_roi, (0, 0), 1.0), -0.25, 0)
        face_roi[ey2:ey2_end, ex2:ex2_end] = eye_roi

    bgr[y:y+h, x:x+w] = face_roi
    return bgr


# ── Main ─────────────────────────────────────────────────

def process(in_path, out_path):
    img = read_rgb(in_path)

    # 1. CLAHE contrast
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b_ch = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=1.3, tileGridSize=(8, 8)).apply(l)
    img = cv2.cvtColor(cv2.merge((l, a, b_ch)), cv2.COLOR_LAB2BGR)

    # 2. Spot removal
    img = remove_spots(img, threshold=15)

    # 3. Face detection
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6,
                                          minSize=(90, 90))
    face_rect = None
    if len(faces) > 0:
        faces = sorted(faces, key=lambda r: r[2]*r[3], reverse=True)
        x, y, w, h = faces[0]
        pad_w, pad_h = int(w * 0.18), int(h * 0.10)
        x, y = max(0, x-pad_w), max(0, y-pad_h)
        w, h = min(img.shape[1]-x-1, w+pad_w*2), min(img.shape[0]-y-1, h+pad_h*2)
        face_rect = (x, y, w, h)

    # 4. Skin whitening
    skin_mask = detect_skin_mask(img)
    img = whiten_skin_natural(img, skin_mask, strength=0.09)

    # 5. Skin smoothing
    img = smooth_skin(img, skin_mask, face_rect)

    # 6. Mild face slimming
    if face_rect is not None:
        img = slim_face_mild(img, face_rect, strength=0.975)

    # 7. Eye brightening
    if face_rect is not None:
        img = detect_and_brighten_eyes(img, face_rect)

    # 8. Final polish
    img = cv2.detailEnhance(img, sigma_s=8, sigma_r=0.12)

    write_jpeg(img, out_path)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python edit_pro.py <input> <output>')
        sys.exit(1)
    process(sys.argv[1], sys.argv[2])
