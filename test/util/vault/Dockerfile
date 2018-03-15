FROM vault:latest
RUN mkdir -p /var/log/vault && \
    touch /var/log/vault/audit-log.json && \
    chown -R vault:vault /var/log/vault && \
    chmod 777 /var/log/vault/audit-log.json