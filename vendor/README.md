# Vendored PDG MVC framework

`pdg-mvc-app/` is the complete `src/js/mvc-app` directory from the
public [PDG](https://github.com/ezavada/pdg) `v1.2.0` tag, commit
`9d93b4070bd9df44984ec79c5286d3d420234a7c`.

`pdg-defs.js` is the matching `src/js/pdg-defs.js` file from that commit. It is
included because the upstream MVC `Button.js` and `Checkbox.js` modules load
it through `require('../pdg-defs')`.

`EditText.js` includes local improvements mirrored in pdg-devel: PDG key events,
Unicode-safe caret movement/deletion, Shift selection, drag selection, and
frame-driven caret blinking. Preserve these changes when updating the dependency.

The files are distributed under `PDG-LICENSE`. To update the dependency,
replace the whole MVC directory and `pdg-defs.js` from one public PDG tag,
update `tools/pdg-release.env`, and run `./skrybble tests/smoke.js` from a
fresh standalone clone.
