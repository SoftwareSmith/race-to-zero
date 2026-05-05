# Merge driver: prefer main for daily metrics.json

This repository includes a `.gitattributes` entry that marks `public/data/metrics.json` to use a custom merge driver named `theirs`:

- `.gitattributes` (committed):

```
public/data/metrics.json merge=theirs
```

To make this work locally, each contributor needs to register the `theirs` merge driver in their local repository config. Run the following command from the repository root:

```bash
git config merge.theirs.name "Keep theirs for metrics.json"
git config merge.theirs.driver "bash -c 'cat %B > %A'"
```

What this does:
- When Git invokes the merge driver for `public/data/metrics.json`, the driver writes the *other* side of the merge (the incoming branch, typically `main`) into the working copy (`%A`). This results in keeping the main branch's `metrics.json` when resolving conflicts.

Notes & caveats:
- This requires contributors to run the `git config` commands locally at least once. The config is stored in `.git/config` (not committed).
- GitHub's server-side merge does not use contributors' local config; if a PR has merge conflicts on `metrics.json`, GitHub will still require manual resolution in the web UI or a maintainer merge. You can add a CI workflow to automatically rebase and prefer `main`'s file — see the optional step in the repo plan.
- Use this only for files that are intentionally environment-generated and where the main branch's snapshot is authoritative.
