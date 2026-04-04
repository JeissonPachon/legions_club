certs/README.md

Purpose
- Store the CA/intermediate bundle used to validate your DB server TLS certificate.
- The file should be named `certs/ca.pem` and must not be committed to git.

How to obtain the CA (recommended)
1. From your local machine or a trusted host run:
   ```bash
   ./scripts/extract-ca.sh db.your-host.supabase.co 5432 ./certs/ca.pem
   ```
2. Inspect `certs/ca.pem` to ensure it contains PEM-encoded certificate blocks (BEGIN/END CERTIFICATE).
3. Do NOT commit `certs/ca.pem`. Add it to your deployment secrets or copy it to the production server via secure channels.

Windows: If you don't have openssl, use WSL, Git-Bash, or ask your infra team for the CA bundle.

Using the CA in production
- Option A (system trust): install `ca.pem` into the OS trust store (Ubuntu/Debian/CentOS examples below).
- Option B (Node-only): set `NODE_EXTRA_CA_CERTS=/path/to/ca.pem` in the process environment or systemd service.

Examples
- systemd (service env):
  ```ini
  [Service]
  Environment=NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca.pem
  ```

- Dockerfile:
  ```dockerfile
  COPY certs/ca.pem /etc/ssl/certs/ca.pem
  ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca.pem
  ```

- Kubernetes: create a secret containing the PEM and mount at `/etc/ssl/certs/ca.pem`, then set the env var.

Security notes
- `NODE_EXTRA_CA_CERTS` extends Node's trusted CAs; protect this file tightly and do not commit it.
- Prefer installing the CA at OS level for system-wide trust if you control the host.
