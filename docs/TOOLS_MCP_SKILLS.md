# Fork — Codex Skills, MCP & Tooling Assessment

## 1. Do we need MCP to build Fork?

**No MCP server is required for Fork's runtime or for Codex to write the code.** Codex already has repository/shell capabilities. Add MCP only when it removes a real development loop.

OpenAI's current Codex guidance explicitly recommends using `AGENTS.md` for durable project guidance, MCP for external tools/context, and skills for repeatable workflows rather than connecting every possible tool.

This bundle already includes:

- root `AGENTS.md`;
- `PLANS.md`;
- `.agents/skills/fork-onchain-verification/SKILL.md`;
- `.agents/skills/fork-release-gate/SKILL.md`.

Those are more important than adding many MCP servers.

## 2. Recommended Codex configuration

### A. Context7 MCP — optional, useful

OpenAI's Codex MCP docs use Context7 as an example for current developer documentation.

Use it when Codex needs rapidly changing library docs for Next/Nest/viem/wagmi/BullMQ.

```bash
codex mcp add context7 -- npx -y @upstash/context7-mcp
```

Do **not** treat Context7 as authority for Moonwell contract semantics when official Moonwell repositories/onchain code are available.

### B. GitHub MCP — optional

GitHub's official MCP server is useful if Codex needs to inspect/manage issues/PRs or research upstream GitHub repositories beyond normal local `git`/`gh` usage.

For this build it is **nice to have, not required**.

Security:

- give the smallest GitHub permissions needed;
- prefer repo-scoped access;
- do not provide unrelated organization write access.

### C. MongoDB Codex Plugin / MCP — optional after schema exists

MongoDB now provides an official Codex integration/MCP server.

Useful for:

- inspecting development/staging collections/indexes;
- validating Atlas configuration;
- debugging query/index behavior.

Recommendation:

- do not give Codex destructive access to production Mongo during normal development;
- use a development/staging cluster and read-only tools where possible;
- application code/tests must still own schema/index definitions; do not make the MCP server an undocumented migration system.

### D. Playwright MCP — optional browser debugging only

Microsoft's official Playwright MCP can let Codex inspect/control a browser. It is useful for interactive UI debugging.

However, Fork is a wallet/financial app. Do not attach a browser MCP session to a browser profile containing valuable wallets, production cookies, or secrets. Prefer `@playwright/test` CLI for repeatable E2E tests. Use MCP only in a dedicated disposable browser profile.

### E. OpenAI Docs MCP — not needed for Fork runtime

Useful only when configuring Codex/OpenAI-specific behavior itself. Fork's production AI provider is Groq, so do not add OpenAI API dependencies merely because Codex is doing the development.

## 3. What we do NOT need

- a Moonwell MCP server;
- a Base MCP server;
- a Foundry MCP server;
- a generic filesystem MCP;
- a generic shell MCP;
- an arbitrary blockchain transaction MCP;
- a browser-search MCP in the production Fork agent.

For Moonwell/Base/Foundry, direct official docs/repos + viem/CLI tools are clearer and safer.

## 4. Project-specific skills included

### `fork-onchain-verification`

Use before/while touching:

- Moonwell addresses/ABIs;
- governance decoding;
- historical replay;
- Anvil fork simulations;
- strategy verification.

It enforces primary-source research and evidence receipts.

### `fork-release-gate`

Use before release/submission. It enforces the complete no-mock real-chain acceptance path.

## 5. Suggested Codex MCP security policy

Project-scoped `.codex/config.toml` is preferred for project-only tools. OpenAI Codex supports tool allowlists and approval modes.

Conceptual example (verify exact server setup before copying):

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
default_tools_approval_mode = "auto"

# Keep write-capable servers constrained.
# For GitHub/MongoDB, configure exact server per official docs and prefer
# default_tools_approval_mode = "writes" or "prompt".
```

Run:

```bash
codex mcp list
```

and keep the active tool set small.

## 6. Codex usage recommendations

- Start Prompt 0 in Plan mode if available.
- Keep one coherent Codex thread through sequential phases so decisions remain available.
- Use the root `AGENTS.md`; Codex reads it automatically.
- Use `PLANS.md` for multi-hour phases.
- Invoke the project skill explicitly when a protocol-critical phase begins if Codex does not pick it automatically.
- Use `/review`/Codex review before security-sensitive merges.
- Do not allow Codex to “solve” missing protocol facts by guessing.
