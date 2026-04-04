DB TLS / CA deployment notes

This document provides example snippets to deploy `ca.pem` and configure your runtime so Node/Prisma trust your DB certificate.

1) Install CA in system trust (Debian/Ubuntu)

```bash
# copy CA to system dir
sudo cp ca.pem /usr/local/share/ca-certificates/my-db-ca.crt
sudo update-ca-certificates
# Restart services that rely on system CAs
sudo systemctl restart your-app.service
```

2) Install CA in system trust (CentOS/RHEL)

```bash
sudo cp ca.pem /etc/pki/ca-trust/source/anchors/my-db-ca.crt
sudo update-ca-trust
```

3) Using `NODE_EXTRA_CA_CERTS` (recommended when you cannot modify system store)

- systemd service example:

```ini
[Unit]
Description=Legions Club app
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/srv/legions-club
Environment=NODE_ENV=production
Environment=NODE_EXTRA_CA_CERTS=/etc/legions/certs/ca.pem
Environment=DATABASE_URL=postgresql://...
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

- Dockerfile snippet:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
COPY certs/ca.pem /etc/ssl/certs/ca.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca.pem
CMD ["npm","start"]
```

- Kubernetes (secret + deployment env):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-ca
type: Opaque
stringData:
  ca.pem: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: legions-club
spec:
  template:
    spec:
      containers:
      - name: app
        image: your-image:latest
        env:
        - name: NODE_EXTRA_CA_CERTS
          value: /etc/ca/ca.pem
        volumeMounts:
        - name: ca
          mountPath: /etc/ca
      volumes:
      - name: ca
        secret:
          secretName: db-ca
```

4) CI (GitHub Actions) example: ensure CA is present when running migrations

```yaml
- name: Prepare CA
  run: echo "${{ secrets.DB_CA_PEM }}" > /tmp/ca.pem
- name: Run migrations
  env:
    NODE_EXTRA_CA_CERTS: /tmp/ca.pem
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: npx prisma migrate deploy
```

Testing
- After installing the CA, verify:
  - `NODE_EXTRA_CA_CERTS=/path/to/ca.pem node -e "console.log('ok')"` runs, and
  - `psql "postgresql://...?...&sslmode=verify-full" -c '\conninfo'` connects without TLS errors.

If you want, I can also generate a sample `systemd` unit file pre-filled with your `DATABASE_URL` (masked) ready for deployment.