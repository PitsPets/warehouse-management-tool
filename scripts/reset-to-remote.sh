#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<USAGE
Usage: $(basename "$0") [remote] [branch]

Fetches the specified remote branch (defaults to origin main) and hard-resets the
current checkout to match it. Any uncommitted changes will be discarded, so make
sure everything you care about is committed elsewhere first.
USAGE
}

REMOTE=${1:-origin}
BRANCH=${2:-main}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
    usage
    exit 0
fi

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: this script must be run inside a Git repository." >&2
    exit 1
fi

echo "Fetching latest changes from ${REMOTE}/${BRANCH}..."
git fetch "$REMOTE" "$BRANCH"

if ! git show-ref --verify --quiet "refs/remotes/${REMOTE}/${BRANCH}"; then
    echo "Error: remote branch ${REMOTE}/${BRANCH} not found after fetch." >&2
    exit 1
fi

echo "Resetting current branch to ${REMOTE}/${BRANCH}..."
git reset --hard "${REMOTE}/${BRANCH}"

echo "Cleaning untracked files and directories..."
git clean -fd

echo "Repository now matches ${REMOTE}/${BRANCH}."
