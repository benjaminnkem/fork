# Google Compute Engine deployment

## Topology

The supported low-cost topology is one Ubuntu Compute Engine VM running:

- Caddy on ports 80/443;
- Next.js web on localhost:3000;
- NestJS API on localhost:4000;
- the governance indexer;
- the BullMQ simulator worker;
- private Anvil processes spawned by the simulator.

MongoDB and Redis are hosted services. They are not started by Docker on the
VM. Only Caddy is publicly exposed; Anvil, API, and Next.js bind locally.

The e2-micro is a constrained demo host. Keep `MAX_PARALLEL_FORKS=1` and use
swap. Build the frontend in GitHub Actions, not on the VM.

## One-time VM prerequisites

The VM must already have:

1. Ubuntu 24.04, Node.js 24, pnpm 9, and Foundry/Anvil installed under the
   `fork` user.
2. The repository checked out at `/opt/fork`, owned by `fork`.
3. `/etc/fork/fork.env`, mode `0600`, readable by `fork`, containing the
   production MongoDB, Redis, Base RPC, Ethereum RPC, session, and public web
   configuration.
4. Four systemd units named `fork-api`, `fork-simulator`, `fork-indexer`, and
   `fork-web`.
5. Caddy configured for the public hostname and reverse proxying `/api/*` and
   `/health/*` to port 4000 and everything else to port 3000.
6. The deployment SSH user configured with a non-interactive `sudo` path:

   ```bash
   sudo -n true
   ```

   This must succeed without prompting for a password. A dedicated deploy
   user is preferable to a personal login. The deploy user needs to run the
   deployment script as root; application commands still run as `fork`.

## GitHub configuration

Create a GitHub `production` environment and add these required secrets:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | VM external IP or stable SSH hostname, e.g. `35.202.1.8` |
| `DEPLOY_USER` | SSH user with non-interactive sudo, preferably a dedicated deploy user |
| `DEPLOY_SSH_KEY` | Private OpenSSH key corresponding to the VM user’s authorized key |
| `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan -H DEPLOY_HOST` from a trusted machine |

Add this repository variable, not a secret:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://fork.oluwadunsin.dev/api/v1` |

Do not add `MONGODB_URI`, `REDIS_URL`, `BASE_RPC_URL`, `ETHEREUM_RPC_URL`,
`SESSION_SECRET`, or `GROQ_API_KEY` to this workflow. Keep them in the VM’s
`/etc/fork/fork.env` and rotate them there.

Generate a dedicated deploy key locally:

```bash
ssh-keygen -t ed25519 -C github-actions-fork-deploy -f ~/.ssh/fork_github_actions
```

Install the `.pub` key for the deployment SSH user on the VM. Generate the
known-hosts value after verifying the VM host key manually:

```bash
ssh-keyscan -H YOUR_VM_IP
```

Copy the complete output into `DEPLOY_KNOWN_HOSTS`. Do not use
`StrictHostKeyChecking=no` in the workflow.

## Pipeline behavior

On every pull request, the workflow runs lint, typecheck, tests, and a Linux
Next.js build. On pushes to `master` or `main`, it then:

1. packages the Linux `.next` output;
2. copies the artifact to `/tmp` on the VM;
3. checks out the exact pushed commit on the VM;
4. runs `pnpm install --frozen-lockfile` as `fork`;
5. installs the frontend artifact;
6. restarts API, simulator, indexer, and web as separate services;
7. waits for API readiness and frontend availability;
8. fails with systemd logs if any service is unhealthy.

The deployment script is `scripts/deploy-gce.sh`. `scripts/deploy.sh` is a
compatibility wrapper that requires the same artifact and commit arguments.
It no longer starts local MongoDB/Redis or builds Next.js on the VM.

## Manual smoke checks

After the first successful workflow run:

```bash
curl https://fork.oluwadunsin.dev/health/live
curl https://fork.oluwadunsin.dev/health/ready
```

Run the real acceptance checks on the VM as `fork`:

```bash
sudo -iu fork
cd /opt/fork
set -a
source /etc/fork/fork.env
set +a
pnpm verify:contracts
pnpm chain:smoke
pnpm replay:verify
```

Do not treat a green HTTP health check as proof that Anvil replay works. The
replay must use the real archive RPCs and the committed historical anchors.

## Rollback

The VM is checked out at the exact deployed commit. To roll back, rerun the
workflow for the desired commit or manually copy a matching Linux web artifact
and invoke:

```bash
sudo /bin/bash /opt/fork/scripts/deploy-gce.sh \
  /tmp/fork-web-next.tgz \
  DESIRED_FULL_COMMIT_SHA
```
