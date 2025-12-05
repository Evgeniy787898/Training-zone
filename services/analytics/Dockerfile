ARG IMAGE_VERSION=dev
FROM python:3.11-slim
LABEL org.opencontainers.image.version=${IMAGE_VERSION}

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

STOPSIGNAL SIGTERM

EXPOSE 3004

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3004"]
