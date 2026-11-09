# syntax=docker/dockerfile:1
FROM node:22-alpine AS interface
WORKDIR /build
COPY frontend/package*.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.lock /app/backend/requirements.lock
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export PIP_CERT=/run/secrets/proxy_ca; fi; \
    pip install --no-cache-dir -r backend/requirements.lock \
    && useradd --uid 10001 --create-home banyra \
    && mkdir /data && chown banyra:banyra /data
COPY --chown=banyra:banyra backend/ /app/backend/
COPY --from=interface --chown=banyra:banyra /build/dist /app/frontend/dist
USER banyra
ENV BANYRA_DATA_DIR=/data
EXPOSE 8010
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/api/health', timeout=4)"
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8010", "--proxy-headers", "--forwarded-allow-ips", "*"]
