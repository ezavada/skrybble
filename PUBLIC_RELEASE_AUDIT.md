# Public release audit

Audit date: 2026-08-22

## Current tree

- No credential-shaped filenames, private keys, GitHub tokens, AWS access
  keys, populated password/secret assignments, or `pdg-devel` references were
  found.
- The local `drawing-2026-08-19-15-08-54.skrbl` file is untracked and covered
  by the `drawing-*.skrbl` ignore rule. It is not part of the release.
- Runtime dependency URLs, version, public source commit, and release archive
  SHA-256 values are recorded in `tools/pdg-release.env`.
- The complete public PDG MVC directory is vendored under
  `vendor/pdg-mvc-app/`, together with its required `pdg-defs.js` support file
  and the PDG license. Skrybble loads the framework through its unmodified
  upstream `index.js`.

## Complete local Git history

All 31 reachable commits and all object names were scanned. `git fsck --full
--no-reflogs --unreachable` reported no dangling objects. No credential-like
files or secrets were found.

Every historical revision contains development-only references to
`../pdg-devel` in `.rules` and `index.js`. They disclose a private repository
name and local layout, but no private PDG source was copied into this history.
Those references remain visible if the existing Git history is published. A
history rewrite is optional for naming/privacy cleanliness, not required for
the application to run independently.

Commit metadata contains two author email identities. Confirm both are
acceptable for public attribution before changing visibility.

## GitHub Actions

The GitHub repository is currently private. GitHub reported no Actions runs
and no retained Actions artifacts, so there were no artifact archives to
download or inspect.

## Release gate

The source and asset licensing files are present, the current tree is detached
from `pdg-devel`, and the public-runtime smoke test passes. Remaining policy
choice: publish the existing history with its old private-repository path and
author metadata, or rewrite it before making the repository public.
