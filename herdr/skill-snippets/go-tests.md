# Go: tests

- Prefer table-driven tests for more than 2-3 cases with identical setup; name each case so a failure identifies its input.
- Use sub-tests (t.Run) when setup differs slightly but shares a common part; otherwise write separate test functions.
- Use github.com/stretchr/testify for assertions; require to stop the test, assert to continue.
- Run tests with -race whenever the code under test uses concurrency.
- Test one behavior per function and keep them short; read like a sentence: TestParseConfigMissingFile.
- Clean up resources with t.Cleanup or defer; never leak files, servers, or goroutines.