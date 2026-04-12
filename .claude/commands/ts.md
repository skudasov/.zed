---
description: Review TypeScript files for good practices, focused on Playwright API/UI test readability
allowed-tools: Read
argument-hint: @file1 @file2 ...
---

Review the following files for TypeScript and Playwright testing best practices: $ARGUMENTS

Focus only on what matters most for clear, readable, high-level tests. Be concise and direct.

## Review these areas:

**TypeScript essentials**
- Types: prefer explicit return types on test helpers/fixtures, avoid `any`, use `unknown` + narrowing if needed
- Naming: descriptive names that read like English (`getUserById`, not `getU`)
- Avoid over-engineering: no unnecessary abstractions, generics, or wrappers

**Playwright test structure**
- Test titles describe behavior, not implementation (`'user can log in'`, not `'clicks button'`)
- Arrange / Act / Assert — each test has one clear action and one clear assertion
- No logic in tests: no loops, conditionals, or try/catch inside `test()` blocks
- Fixtures over `beforeEach`: encapsulate setup in typed fixtures, not lifecycle hooks
- Page Objects for reuse: one class per page/component, methods return `this` or `void`, no assertions inside POM
- Locators: prefer user-facing (`getByRole`, `getByLabel`, `getByText`) over CSS/XPath
- Avoid hardcoded waits (`waitForTimeout`): use `waitFor`, auto-waiting locators instead

**API tests**
- Each test hits one endpoint, checks one behavior
- Use `request` fixture, not raw `fetch`/`axios`
- Assert status code + response shape, not full response body equality

## Output format:

For each file, list only actual issues found. Skip sections with no issues.
Group by: `TypeScript` | `Test Structure` | `Playwright` | `API`
One line per issue: `line N — problem — fix`
End with 2-3 highest-impact improvements if any.
