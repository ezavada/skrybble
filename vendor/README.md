# Vendored PDG MVC framework

`pdg-mvc-app/` is the complete `src/js/mvc-app` directory from the local
`pdg-devel` v1.3 candidate at commit
`800271d8171af9bafb102c34421bde44c163ce99`.
`pdg-defs.js` is the matching `src/js/pdg-defs.js` file. These source paths had
no uncommitted changes when copied. No local framework patches are applied.

This snapshot includes Scene-clock-based MVC animation and the Unicode editing
improvements previously carried by Skrybble. It requires a PDG v1.3 runtime;
use `PDG_SOURCE=devel ./skrybble` with a built sibling `pdg-devel` checkout.

The files are distributed under `PDG-LICENSE`. To update the dependency,
replace the whole MVC directory and `pdg-defs.js` from one PDG revision and
record its provenance here. Once v1.3 is published, update
`tools/pdg-release.env` with the final release commit, assets and hashes together.
Run the smoke, unit and drawing suites against the matching runtime.
