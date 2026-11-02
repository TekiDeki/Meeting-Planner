#!/usr/bin/env python3
"""The committed page must be exactly reproducible from the sources."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    expected = (ROOT / 'index.html').read_bytes()
    with tempfile.TemporaryDirectory(prefix='meeting-planner-build-') as tmp:
        work = Path(tmp)
        shutil.copy2(ROOT / 'build.py', work / 'build.py')
        shutil.copy2(ROOT / 'VERSION', work / 'VERSION')
        shutil.copytree(ROOT / 'src', work / 'src')
        run = subprocess.run([sys.executable, 'build.py'], cwd=work,
                             capture_output=True, text=True)
        if run.returncode:
            print(run.stdout, end='')
            print(run.stderr, end='', file=sys.stderr)
            return run.returncode
        actual = (work / 'index.html').read_bytes()
    if actual != expected:
        first = next((i for i, (a, b) in enumerate(zip(actual, expected)) if a != b),
                     min(len(actual), len(expected)))
        raise AssertionError(
            f'build drift: generated {len(actual)} bytes, committed {len(expected)} bytes; '
            f'first difference at byte {first}')
    print(f'build: byte-identical index.html ({len(expected)} bytes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
