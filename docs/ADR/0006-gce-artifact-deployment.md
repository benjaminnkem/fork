# ADR 0006 — GCE artifact deployment

- Status: accepted
- Date: 2026-08-27

Build the Next.js frontend on a GitHub-hosted Linux runner and copy only the
`.next` production artifact to the Compute Engine host. The `e2-micro` has
insufficient memory for a reliable Next.js production build, especially when
Anvil and the runtime workers are present.

The VM keeps MongoDB and Redis external, stores runtime secrets in
`/etc/fork/fork.env`, and runs API, simulator, indexer, and web as separate
systemd services. The deployment script updates the VM to the exact GitHub
commit, installs locked dependencies as the `fork` user, installs the Linux
web artifact, restarts services in dependency order, and checks local API/web
health before reporting success.

GitHub Actions uses SSH/SCP with host-key verification. Chain, database,
Redis, Groq, and session secrets remain on the VM; they are not copied into
GitHub Actions logs or artifacts.
