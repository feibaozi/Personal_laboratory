import cv2
import numpy as np
from PIL import Image
import sys


def remove_spots_bgr(bgr):
    # detect small high-frequency spots and inpaint
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (9,9), 0)
    detail = cv2.absdiff(gray, blur)
    _, mask = cv2.threshold(detail, 18, 255, cv2.THRESH_BINARY)
    # remove large areas
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3,3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.dilate(mask, kernel, iterations=1)
    inpainted = cv2.inpaint(bgr, mask, 3, cv2.INPAINT_TELEA)
    return inpainted


def smooth_face(bgr, face_rect):
    x, y, w, h = face_rect
    face = bgr[y:y+h, x:x+w]
    # bilateral filter preserves edges
    smooth = cv2.bilateralFilter(face, d=9, sigmaColor=75, sigmaSpace=75)
    # blend original and smooth to retain texture
    blended = cv2.addWeighted(face, 0.4, smooth, 0.6, 0)
    bgr[y:y+h, x:x+w] = blended
    return bgr


def slim_face_simple(bgr, face_rect, strength=0.94):
    x, y, w, h = face_rect
    face = bgr[y:y+h, x:x+w]
    # horizontal squeeze
    new_w = max(2, int(w * strength))
    resized = cv2.resize(face, (new_w, h), interpolation=cv2.INTER_LINEAR)
    # create canvas and paste centered
    canvas = face.copy()
    start = (w - new_w) // 2
    canvas[:, start:start+new_w] = resized
    # smooth seam
    alpha = np.zeros((h, w), dtype=np.float32)
    ramp = np.linspace(0,1,10)
    for i in range(10):
        alpha[:, start+i] = ramp[i]
        alpha[:, start+new_w-1-i] = ramp[i]
    alpha = cv2.GaussianBlur(alpha, (31,31), 0)
    alpha = np.repeat(alpha[:, :, None], 3, axis=2)
    merged = (canvas * alpha + face * (1-alpha)).astype(np.uint8)
    bgr[y:y+h, x:x+w] = merged
    return bgr


def process(in_path, out_path):
    img = cv2.imread(in_path)
    if img is None:
        # fallback: use PIL to handle unicode paths then convert to BGR ndarray
        from PIL import Image
        pil = Image.open(in_path).convert('RGB')
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

    # detect face using Haar cascade
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(cascade_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80,80))

    # global mild adjustments: contrast/brightness
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.equalizeHist(l)
    lab = cv2.merge((l,a,b))
    img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # acne/spot removal across image
    img = remove_spots_bgr(img)

    if len(faces) > 0:
        # take largest face
        faces = sorted(faces, key=lambda r: r[2]*r[3], reverse=True)
        face = faces[0]
        # expand face rect a bit
        x,y,w,h = face
        pad_w = int(w*0.12)
        pad_h = int(h*0.06)
        x = max(0, x-pad_w); y = max(0, y-pad_h)
        w = min(img.shape[1]-x, w+pad_w*2); h = min(img.shape[0]-y, h+pad_h*2)
        face_rect = (x,y,w,h)

        # smooth face
        img = smooth_face(img, face_rect)

        # slim face slightly
        img = slim_face_simple(img, face_rect, strength=0.96)

    # final mild sharpen
    img = cv2.detailEnhance(img, sigma_s=10, sigma_r=0.15)

    # convert to JPEG high quality
    cv2.imwrite(out_path, img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python edit_advanced.py <input> <output>')
        sys.exit(1)
    process(sys.argv[1], sys.argv[2])
