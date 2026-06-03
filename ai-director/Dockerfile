# AI Director - 多阶段构建
# 阶段1: 前端构建
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 阶段2: 后端 + 运行时
FROM python:3.11-slim

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python 依赖
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./

# 复制前端构建产物
COPY --from=frontend-builder /app/frontend/dist ./static

# 创建数据目录
RUN mkdir -p /app/data/uploads /app/data/projects /app/output /app/data/chroma

# 环境变量
ENV PYTHONUNBUFFERED=1
ENV AI_DIRECTOR_DATA_DIR=/app/data
ENV AI_DIRECTOR_UPLOAD_DIR=/app/data/uploads
ENV AI_DIRECTOR_OUTPUT_DIR=/app/output
ENV AI_DIRECTOR_CHROMA_DIR=/app/data/chroma

EXPOSE 8788

# 使用 uvicorn 运行
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8788"]
