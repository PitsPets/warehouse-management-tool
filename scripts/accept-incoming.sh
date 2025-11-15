#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "This script must be run inside a git repository." >&2
    exit 1
fi

mapfile -t conflicted_files < <(git diff --name-only --diff-filter=U)

if [[ ${#conflicted_files[@]} -eq 0 ]]; then
    echo "No conflicted files detected. You're already up to date!"
    exit 0
fi

echo "Accepting the incoming version for the following files:" >&2
for file in "${conflicted_files[@]}"; do
    echo "  $file" >&2
    git checkout --theirs -- "$file"
    git add "$file"
done

echo "Conflicts cleared. Review the changes with 'git status' and commit when ready." >&2
