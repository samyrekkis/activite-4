FROM python:3.12-slim
WORKDIR /srv
ENV PYTHONUNBUFFERED=1 TZ=Africa/Algiers
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app app
COPY niches niches
COPY scripts scripts
# Les fichiers clients et la base sont montés en volume (voir docker-compose.yml).
EXPOSE 8000
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
