Pull request {{ref}} ("{{title}}") has failing CI checks: {{failedChecks}}.
Run: gh pr checks {{number}} -R {{repo}}, then for each failed run: gh run view <run-id> -R {{repo}} --log-failed.
Explain the root cause of each failure (code bug, flaky test, or infra) and point to the change
in gh pr diff {{number}} -R {{repo}} that caused it. Do not edit any files.
