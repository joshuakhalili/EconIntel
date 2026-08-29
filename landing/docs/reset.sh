#!/usr/bin/env bash
# Restore the pristine mirror so the build script can run again.
#
# WHY THIS EXISTS: `git checkout -- .` stops working the moment the built site
# has been committed. It restores the BUILD, and a one-way build refuses to run
# over itself. So the index is pointed at the pristine-mirror commit, the tree is
# written out from it, and anything the content pass added (renamed slug folders,
# the README) is cleaned away.
#
# docs/ and README.md are carried across untouched: both are newer than that
# commit, and a rebuild that deletes your own notes is a rebuild nobody trusts.
# The original version of this script cost two fixes by reverting docs/ silently.
#
#   bash docs/reset.sh
#
# Expects a `pristine-mirror` tag on the untouched-mirror commit. Falls back to
# the second commit in history (mirror, then assets) if the tag is missing.
set -euo pipefail
cd "$(dirname "$0")/.."

if git rev-parse -q --verify refs/tags/pristine-mirror >/dev/null; then
  BASE=$(git rev-parse refs/tags/pristine-mirror)
else
  BASE=$(git log --format=%H --reverse | sed -n 2p)
  echo "no pristine-mirror tag, falling back to $(git log -1 --format=%s "$BASE")"
fi

KEEP=$(mktemp -d)
cp -R docs "$KEEP/"
cp README.md "$KEEP/" 2>/dev/null || true
cp clone.json "$KEEP/" 2>/dev/null || true
git read-tree "$BASE"
git checkout-index -a -f
git clean -fdq
rm -rf docs
cp -R "$KEEP/docs" docs
cp "$KEEP/README.md" . 2>/dev/null || true
cp "$KEEP/clone.json" . 2>/dev/null || true
rm -rf "$KEEP"
git read-tree HEAD                                   # index back where it was
echo "reset to $(git log -1 --format=%s "$BASE")"
