"""
Wardrobe Stylist — 图片去背景脚本 (OpenCV grabCut, 无需下载模型)
用法: python process_image.py <input_path> <output_dir>
输出: {"stickerPath": "...", "colors": [...], "hasPerson": false}
"""
import sys, json, os
import cv2
import numpy as np

def remove_background(img_bgr: np.ndarray) -> np.ndarray:
    """用 OpenCV grabCut 去背景，返回 BGRA"""
    h, w = img_bgr.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)

    # 自动检测主体区域（中心60%作为前景候选）
    margin_x = int(w * 0.15)
    margin_y = int(h * 0.05)
    rect = (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)

    cv2.grabCut(img_bgr, mask, rect, bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)

    # mask: 0=背景, 1=前景, 2=可能背景, 3=可能前景
    fg_mask = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)

    # 形态学后处理：去噪 + 平滑边缘
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)

    # 构建 RGBA
    result = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2BGRA)
    result[:, :, 3] = fg_mask
    return result

def detect_face(img_bgr: np.ndarray):
    """检测是否有人脸"""
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(30, 30))
    return faces

def apply_body_warp(rgba: np.ndarray, category: str) -> np.ndarray:
    """透视变形模拟立体感：上衣上窄下宽，裤子反之"""
    h, w = rgba.shape[:2]
    if w < 20 or h < 20:
        return rgba

    # 分离 RGB 和 Alpha
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]

    warp_amount = 0.06
    if category == 'top':
        src = np.float32([[0, 0], [w, 0], [0, h], [w, h]])
        dst = np.float32([
            [w * warp_amount, 0],
            [w * (1 - warp_amount), 0],
            [0, h],
            [w, h]
        ])
    elif category == 'bottom':
        src = np.float32([[0, 0], [w, 0], [0, h], [w, h]])
        dst = np.float32([
            [-w * 0.02, 0],
            [w * 1.02, 0],
            [w * warp_amount, h],
            [w * (1 - warp_amount), h]
        ])
    else:
        return rgba

    matrix = cv2.getPerspectiveTransform(src, dst)
    warped_rgb = cv2.warpPerspective(rgb, matrix, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    warped_alpha = cv2.warpPerspective(alpha, matrix, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    result = np.dstack([warped_rgb, warped_alpha])
    return result.astype(np.uint8)

def extract_colors(rgba: np.ndarray, n=3):
    """K-Means 提取主色调"""
    alpha = rgba[:, :, 3]
    opaque = rgba[alpha > 128][:, :3]
    if len(opaque) < 100:
        return ["#808080"]

    pixels = opaque.reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(pixels, min(n, len(opaque) // 10),
                                     None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
    counts = np.bincount(labels.flatten())
    sorted_idx = np.argsort(-counts)

    colors = []
    for i in sorted_idx[:n]:
        b, g, r = centers[i]
        colors.append(f"#{int(r):02x}{int(g):02x}{int(b):02x}")
    return colors

def hex_to_name(hex_color: str) -> str:
    r, g, b = int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)
    brightness = (r + g + b) / 3

    if brightness > 230: return 'white'
    if brightness < 30:  return 'black'
    if abs(r - g) < 20 and abs(g - b) < 20 and abs(r - b) < 20:
        if brightness < 100: return 'gray'
        if brightness < 180: return 'gray'
        return 'beige'

    if r > 200 and g < 100 and b < 100: return 'red'
    if r > 200 and g > 150 and b < 80:  return 'orange'
    if r > 200 and g > 180 and b < 80:  return 'yellow'
    if r > 200 and g < 120 and b > 150: return 'pink'
    if r < 100 and g > 150 and b < 100: return 'green'
    if r < 80 and g < 100 and b > 180:  return 'blue'
    if r < 60 and g < 40 and b > 120:   return 'navy'
    if r > 100 and g < 80 and b > 150:  return 'purple'
    if r > 120 and g > 60 and b < 50:   return 'brown'
    if 170 > r > 120 and 150 > g > 110 and 110 > b > 70: return 'khaki'
    if 120 > r > 60 and 150 > g > 100 and 200 > b > 130:  return 'denim'

    return 'gray'

def process(input_path: str, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    img = cv2.imread(input_path)
    if img is None:
        return {"error": f"Failed to read: {input_path}"}

    basename = os.path.splitext(os.path.basename(input_path))[0]

    # 人脸检测
    faces = detect_face(img)
    has_person = len(faces) > 0

    # 如果是模特图，裁剪人脸上方30%到图片底部
    if has_person:
        fx, fy, fw, fh = faces[0]
        h_img, w_img = img.shape[:2]
        y1 = max(0, fy - int(fh * 0.3))
        y2 = h_img - int(h_img * 0.05)
        x1 = max(0, int(w_img * 0.05))
        x2 = min(w_img, int(w_img * 0.95))
        img = img[y1:y2, x1:x2]

    # 去背景
    rgba = remove_background(img)

    # 根据类别做透视变形（模拟立体感）
    category = "top"  # default
    rgba = apply_body_warp(rgba, category)

    # 保存
    sticker_path = os.path.join(output_dir, f"{basename}_sticker.png")
    cv2.imwrite(sticker_path, rgba)

    # 提取颜色
    colors_hex = extract_colors(rgba, 3)
    colors_name = [hex_to_name(c) for c in colors_hex]

    return {
        "stickerPath": sticker_path.replace('\\', '/'),
        "colors": colors_name,
        "colorsHex": colors_hex,
        "hasPerson": has_person,
        "success": True
    }

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: process_image.py <input> <output_dir>"}))
        sys.exit(1)
    print(json.dumps(process(sys.argv[1], sys.argv[2])))
