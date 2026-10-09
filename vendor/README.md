# Vendored PDG MVC framework

`pdg-mvc-app/` is the complete, unmodified `src/js/mvc-app` directory from the
public [PDG](https://github.com/ezavada/pdg) `v1.1.1` tag, commit
`5f39134abea2dbc768387db0ca7f838d274dee38`.

`pdg-defs.js` is the matching `src/js/pdg-defs.js` file from that commit. It is
included because the upstream MVC `Button.js` and `Checkbox.js` modules load
it through `require('../pdg-defs')`.

The files are distributed under `PDG-LICENSE`. To update the dependency,
replace the whole MVC directory and `pdg-defs.js` from one public PDG tag,
update `tools/pdg-release.env`, and run `./skrybble tests/smoke.js` from a
fresh standalone clone.
