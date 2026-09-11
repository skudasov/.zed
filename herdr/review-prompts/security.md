Security review of pull request {{ref}} ("{{title}}").
Start by running: gh pr diff {{number}} -R {{repo}}.
Look for authn/authz gaps, injection (SQL, shell, template), secrets or tokens in code or logs,
unsafe deserialization, SSRF, path traversal, missing input validation, and risky dependency changes.
For each finding give file:line, impact, and a concrete fix. Do not edit any files.
