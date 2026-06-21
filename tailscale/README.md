# Remote herdr over Tailscale

Reach a persistent **herdr** session from another machine — without exposing
SSH to the public internet. Tailscale (WireGuard mesh VPN) carries the traffic;
herdr's native `--remote` drives the session.

```
 client machine                         herdr host
 ┌────────────┐   encrypted WireGuard   ┌────────────────────────┐
 │ herdr CLI  │ ───── tailnet ───────►  │ tailscaled (--ssh)      │
 │ --remote   │     (no open ports)     │ herdr --session work    │
 └────────────┘                         └────────────────────────┘
```

Why this and not port-forwarding sshd:
- No inbound ports open on the host or router — nothing public to scan/brute-force.
- Encrypted device-to-device, identity-based auth (your tailnet login / SSO).
- Works behind NAT/CGNAT, no static IP.

---

## One-time setup

### 1. Both machines: install + start the daemon

```bash
just install-tailscale     # macOS, Homebrew
```

This installs the CLI **and** starts the `tailscaled` system daemon
(`tailscaled install-system-daemon`). Homebrew installs the binaries but does
**not** start the daemon — skipping this is why `tailscale up` fails with
`failed to connect to local tailscaled`.

> **serve vs funnel — you need neither for SSH.**
> - `tailscale funnel` exposes a service to the **public internet** — do not use it here.
> - `tailscale serve` exposes a service to your **tailnet only** (private) — only for an HTTP/TCP app, not SSH.
> - SSH is handled by **Tailscale SSH** (`--ssh`), enabled in step 2.

Log in with the **same** Tailscale account on both machines.

### 2. herdr host: enable Tailscale SSH

On the machine that will **run** the herdr session:

```bash
just tailscale-host
```

Runs `tailscale up --ssh`. **No tags, no ACL editing, no web UI.** A new
tailnet's default policy already allows you to SSH into your **own** devices,
and both machines are logged in as you. Tailscale brokers SSH itself, so no
`sshd` port is exposed.

### 3. client: join

On the machine you connect **from**:

```bash
just tailscale-client
```

Note the host's tailnet name:

```bash
tailscale status        # e.g. skudasov@herdr-host or herdr-host.tail-xxxx.ts.net
```

---

## Daily use

**On the host** — start (or reattach) a persistent session:

```bash
just herdr-host-session            # session "work"
just herdr-host-session name=dev   # session "dev"
```

It survives disconnects: detach and the session keeps running.

**On the client** — attach over the tailnet:

```bash
just herdr-connect target=skudasov@herdr-host
just herdr-connect target=skudasov@herdr-host name=dev
```

`target` is `<user>@<tailnet-name>`. Done — you're driving the same session
the host started.

---

## Verify / troubleshoot

```bash
tailscale status                 # both machines listed + online?
tailscale ping herdr-host        # WireGuard path works?
herdr session list               # on host: confirm session exists
```

- **`failed to connect to local tailscaled`**: daemon not running. Run
  `sudo tailscaled install-system-daemon` (or re-run `just install-tailscale`).
- **SSH connection refused / not permitted**: your tailnet policy was
  customized and lost the default self-SSH rule. Restore it hands-free:
  `TS_API_KEY=tskey-api-... just tailscale-acl-push` (see Advanced below).
- **Can't connect**: confirm both machines show in `tailscale status` and both
  are logged in under the **same** account.
- **Lost the session**: it's persistent — `just herdr-host-session` reattaches.

## Advanced: push the ACL by API (no web UI)

You only need this if you customized your tailnet policy. Create an API key at
<https://login.tailscale.com/admin/settings/keys>, then:

```bash
TS_API_KEY=tskey-api-... just tailscale-acl-push
```

This uploads [`acl.json`](./acl.json) (members → SSH to own devices, port 22).

## Hardening (optional)

- `acl.json` uses `"action": "check"` → forces periodic re-auth on SSH.
- Disable key expiry only for trusted always-on hosts; keep it on for laptops.
- Enable tailnet lock if you want to require signing for new devices.
