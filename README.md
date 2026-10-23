# mocharuuu.github.io

The **Kingdom of Foxes family tree**, served from GitHub Pages:
<https://mocharuuu.github.io/>

This started as a copy of the Members roster from
[kingdomfoxes.com](https://kingdomfoxes.com) and now replaces it entirely. The
page calls no API and needs no backend — the tree is static data compiled into
the bundle, so there is nothing to configure and nothing that can fail to load.

## Reading the diagram

| Mark | Meaning |
|---|---|
| Red bar between two names | marriage |
| Dashed red connector, struck through | dissolved marriage |
| Blue lines | descent, parents down to children |
| Dashed blue, labelled | godparent, or an adoption |
| Name colour | house (see the key above the tree) |
| Higher within a generation | older |

Only partners who share children sit side by side; a dissolved marriage is
routed as its own connector instead, so nobody with two partners reads as one
four-way union. Someone drawn in grey married or was adopted into the tree
without belonging to a house. Small grey labels are unnamed placeholder ancestors carried over
from the original drawings.

## Editing the tree

Everything lives in [`source/src/family/data.js`](source/src/family/data.js) —
`HOUSES`, `PEOPLE`, `FAMILIES` and `GODPARENTS`. To add a person, add one entry
to `PEOPLE` with a `col` (horizontal slot) and `row` (generation), then wire
them into a `FAMILIES` entry. Columns and rows are grid units rather than
pixels; `layout.js` turns them into coordinates, draws the bars and routes the
links. Spouses need adjacent `col` values so the marriage bar lands between
their names.

Rows carry birth order as well as generation, which is why the Auspects
children sit a little above Choco: they are older, and both are below Spase.

## Rebuilding

    cd source
    npm install
    node build.mjs       # writes dist/ — copy its contents to the repo root
    node preview.mjs     # optional: renders preview.svg to check geometry

`build.mjs` uses `@rollup/wasm-node` with Babel rather than Vite. Vite's
bundler, esbuild and esbuild-wasm all run their compiler as a spawned child
process, which hangs in some sandboxed build environments; the WASM Rollup
path is pure in-process JavaScript and produces an equivalent bundle.

## Layout

    index.html          built page
    assets/             hashed JS bundle and stylesheet
    source/             the sources it was built from
    .nojekyll           serve the directory verbatim
