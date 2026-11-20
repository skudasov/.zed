# K8s NOP Management Agents analysis

Use Kubernetes contexts "kind-nextops-agent-cell-*" (can be many) to debug namespaces:
- nextops-agent
- nextops-workloads

The crucial piece is the agent in nextops-agents namespace, pod has a name like "nop-dashboard-k8s-*".
Read the logs, understand if all the steps of SAP/SSP protocols have passed and analyze FluxCD objects in
these agent clusters, figure out why deployment wasn't delivered or if we have any other issues.

The deployments we run are in /Users/fahrenheit/GolandProjects/nop-management/fleet
THe service that processes the deployments initially is in /Users/fahrenheit/GolandProjects/nop-management/services/control-plane/fleet-controller

## How to debug an agent (fast path)

1. Find the agent and its state:
   - `kubectl --context <ctx> -n nextops-agent get pods`
   - `kubectl --context <ctx> -n nextops-workloads get all`
   - Port-forward the dashboard (container port 8080) and query its API:
     `kubectl --context <ctx> -n nextops-agent port-forward svc/nop-dashboard-k8s 18080:8080`
     `curl -s localhost:18080/api/summary`
     `curl -s localhost:18080/api/approvals`
     `curl -s localhost:18080/api/specifications`
     `curl -s localhost:18080/api/desired-states`
     `curl -s localhost:18080/api/deployments`
     `curl -s localhost:18080/api/inventory`
   - `summary` shows counts: no desired state + no deployments = the control plane never delivered;
     a failed deployment + failed inventory = Flux rejected the bundle.

2. Read the dashboard log for protocol milestones:
   `kubectl --context <ctx> -n nextops-agent logs deploy/nop-dashboard-k8s | grep -E 'SAP|SSP|built and pushed OCI bundle|patched OCIRepository|flux monitor: failing|mirror poll failed'`
   - SAP done when the approval is `approved` and the bundle digest was built/pushed.
   - SSP done when you see `State divergence detected`, `planned action`, `patched OCIRepository to signed bundle`.
   - A cell with only `no desired state published yet` never received an SSP desired state; do not blame its agent.

3. Check Flux delivery:
   - `kubectl --context <ctx> -n flux-system get kustomizations,ocirepositories,helmreleases -o wide`
   - `OCIRepository Ready=True` and `SourceVerified=True` means the bundle was delivered and the
     agent's signature verified.
   - `Kustomization Ready=False` + `BuildFailed` is a build/decrypt error; nothing was applied, so
     `nextops-workloads` is empty. Read the full condition message.
   - `kubectl --context <ctx> -n flux-system logs deploy/kustomize-controller | grep -i error`
   - `kubectl --context <ctx> -n nextops-workloads get all`

4. SOPS key mismatch is the most common failure:
   - Compare each fleet Secret's recipient with the agent's age public key:
     `grep -h recipient fleet/<fleet>/*.yml`
     `kubectl --context <ctx> -n flux-system get secret sops-age -o jsonpath='{.data.age\.agekey}' | base64 -d | grep 'public key'`
   - A mismatch means the Secret was encrypted for an old cell key (usually after changing `cell_id`
     or re-onboarding the agent). Re-encrypt for the current recipient.
   - `cli encrypt-fleet` skips Secrets that already have a `sops` block; changing `cell_id` does not
     re-encrypt them. Remove the `sops` block, rewrite the plaintext, then run `cli encrypt-fleet`.

5. Check the fleet strategy before blaming the control plane:
   - `cat fleet/<fleet>/fleet.yml` and look at `strategy`.
   - `rolling`: only the first instance file (alphabetical order) gets a desired state. If it fails,
     later cells stay approved with `desired_states: 0` and no Flux objects. That is expected.
   - `fan-out`: every cell gets a desired state immediately.

6. Recovery gotchas:
   - The agent's Flux monitor only evaluates `pending` deployments. A `failed` deployment stays failed
     even if Flux later heals; a new desired state/new pipeline is required.
   - The fleet-controller does not retry a failed fleet; publish a new manifests image or restart it.
   - Pod logs are UTC; `stat`/`git` timestamps on this machine are local (CET).

7. Chart verification test (only if the HelmRelease cannot fetch its chart):
   - Apply the chart's exact `OCIRepository` spec as a temporary object and check its conditions,
     then delete it.
   - Keyless Cosign verify must NOT set `verify.secretRef`; adding `nop-cosign-pub` makes Flux use
     key-based verification and reports `no matching signatures`.
   - The agent's `CheckChart` accepts both the legacy `sha256-<digest>.sig` tag and OCI referrers;
     Flux may accept only one of them. Test the exact spec, don't assume.