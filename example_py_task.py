#!/usr/bin/env python3

import subprocess
import sys


def main():
    marker = input(
        "Enter pytest marker (e.g., slow, api, ui) or press Enter for all tests: "
    ).strip()
    cmd = ["poetry", "run", "pytest", "-s", "-v", "-n", "auto"]

    if marker:
        cmd.extend(["-m", marker])
        print(f"Running tests with marker: {marker}")
    else:
        print("Running all tests...")

    try:
        subprocess.run(cmd, cwd="./tests-py/", check=True)  # pyright: ignore[reportUnusedCallResult]
    except subprocess.CalledProcessError as e:
        print(f"Test execution failed with exit code: {e.returncode}")
        sys.exit(e.returncode)
    except KeyboardInterrupt:
        print("\nTest execution interrupted by user")
        sys.exit(1)


if __name__ == "__main__":
    main()
