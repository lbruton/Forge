FROM python:3.12-alpine

ARG TARGETARCH
ARG NUCLEI_VERSION=3.3.7

# Install Nuclei binary (supports amd64 and arm64)
RUN apk add --no-cache curl unzip ca-certificates \
    && ARCH=$(case "${TARGETARCH}" in arm64) echo "arm64" ;; *) echo "amd64" ;; esac) \
    && curl -sSL "https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_${ARCH}.zip" \
       -o /tmp/nuclei.zip \
    && unzip /tmp/nuclei.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/nuclei \
    && rm /tmp/nuclei.zip \
    && apk del curl unzip

# Pre-cache Nuclei templates to a shared location (not /root which is mode 0700)
ENV NUCLEI_TEMPLATES_DIR=/opt/nuclei-templates
RUN mkdir -p "$NUCLEI_TEMPLATES_DIR" \
    && HOME=/tmp nuclei -update-templates -ud "$NUCLEI_TEMPLATES_DIR"

WORKDIR /app

# Install Python dependencies (no pip cache in final image)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Create non-root user and data directory with correct ownership
RUN adduser -D -u 1000 forge \
    && mkdir -p /data \
    && chown forge:forge /data \
    && chown -R forge:forge "$NUCLEI_TEMPLATES_DIR"

USER forge

EXPOSE 8400

ENTRYPOINT ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8400"]
