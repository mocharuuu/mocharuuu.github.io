# mocharuuu.github.io

Standalone build of the **Members** page from the Kingdom of Foxes site
([kingdomfoxes.com](https://kingdomfoxes.com)).

The full site is a FastAPI + React application with many routes; this is only
the Members roster, rebuilt as a single static page so it can be served from
GitHub Pages.

## How it gets its data

GitHub Pages is static hosting, so there is no backend here. The page calls
the live API directly:

    https://kingdomfoxes.com/api/players
    https://kingdomfoxes.com/api/leaderboard
    https://kingdomfoxes.com/api/avatars

Those are cross-origin requests, so two things follow:

1. The backend must list `https://mocharuuu.github.io` in `CORS_ORIGINS`,
   otherwise the browser blocks every response and the page shows an error.
2. No session cookie travels cross-site, so the API always answers with the
   logged-out public payload. Staff-only columns and actions never appear,
   by construction rather than by being hidden in the UI.

## Layout

    index.html          built page
    assets/             hashed JS bundle and stylesheet
    source/             the sources it was built from
    .nojekyll           serve the directory verbatim

## Rebuilding

    cd source
    npm install
    node build.mjs      # writes dist/

`build.mjs` uses `@rollup/wasm-node` + Babel rather than Vite. Vite's
bundler runs its compiler as a spawned child process, which does not work in
every build environment; the WASM Rollup path is pure in-process JavaScript
and produces an equivalent bundle.
