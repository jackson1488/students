FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY backend/ ./

ENV PORT=8000
EXPOSE 8000

CMD ["/bin/sh", "-c", "gunicorn run:app --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 120"]
