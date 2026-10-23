/* Build the standalone Members page.
 *
 * Rollup + Babel, not Vite. Vite's bundler (rolldown in v8, esbuild in v6)
 * and esbuild-wasm all run their compiler as a spawned child process talking
 * over stdio pipes; child-process spawning hangs in this build sandbox, so
 * every one of them stalls indefinitely. Rollup and Babel are pure JS and run
 * in-process, producing an equivalent bundle.
 */
/* @rollup/wasm-node, not rollup: rollup's native binding hangs on import
   in this sandbox. The WASM build is the same bundler, pure JS + WASM. */
import { rollup } from "@rollup/wasm-node";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import { minify } from "terser";
import * as babel from "@babel/core";
import fs from "node:fs";
import path from "node:path";

const OUT = "dist";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });

/* theme.css is a cascade of @import'd partials. Inline them in order so the
 * whole stylesheet ships as one file, exactly as the cascade expects. */
function inlineCss(file, seen = new Set()) {
  const abs = path.resolve(file);
  if (seen.has(abs)) return "";
  seen.add(abs);
  const dir = path.dirname(abs);
  return fs.readFileSync(abs, "utf8").replace(
    /@import\s+["']([^"']+)["']\s*;/g,
    (_, spec) => inlineCss(path.resolve(dir, spec), seen)
  );
}

let cssText = "";
const cssPlugin = {
  name: "css",
  transform(_code, id) {
    if (!id.endsWith(".css")) return null;
    cssText += inlineCss(id) + "\n";
    return { code: "export default undefined;", map: { mappings: "" } };
  },
};

const jsxPlugin = {
  name: "babel-jsx",
  async transform(code, id) {
    if (id.includes("node_modules")) return null;
    if (!/\.jsx?$/.test(id)) return null;
    const res = await babel.transformAsync(code, {
      filename: id,
      babelrc: false,
      configFile: false,
      sourceMaps: false,
      presets: [["@babel/preset-react", { runtime: "automatic" }]],
    });
    return { code: res.code, map: null };
  },
};

const bundle = await rollup({
  input: "src/main.jsx",
  plugins: [
    cssPlugin,
    jsxPlugin,
    replace({
      preventAssignment: true,
      values: { "process.env.NODE_ENV": JSON.stringify("production") },
    }),
    nodeResolve({ browser: true, extensions: [".js", ".jsx"] }),
    commonjs(),
    /* terser called directly, not via @rollup/plugin-terser: that plugin
       minifies in a worker thread, and this sandbox cannot spawn one. */
    {
      name: "terser-inline",
      async renderChunk(code) {
        const res = await minify(code, { module: true, compress: true, mangle: true });
        return { code: res.code, map: null };
      },
    },
  ],
  onwarn(w, warn) {
    if (w.code === "MODULE_LEVEL_DIRECTIVE" || w.code === "CIRCULAR_DEPENDENCY") return;
    warn(w);
  },
});

const { output } = await bundle.write({
  dir: path.join(OUT, "assets"),
  format: "es",
  entryFileNames: "tree-[hash].js",
  chunkFileNames: "chunk-[hash].js",
});
await bundle.close();

const entry = output.find((o) => o.type === "chunk" && o.isEntry);
if (!entry) throw new Error("rollup produced no entry chunk");

// Hash the stylesheet the same way so it can be cached just as hard.
const { createHash } = await import("node:crypto");
const cssHash = createHash("sha256").update(cssText).digest("hex").slice(0, 8);
const cssName = `tree-${cssHash}.css`;
fs.writeFileSync(path.join(OUT, "assets", cssName), cssText);

// public/ ships at the site root: ui.jsx loads /crest.webp and the favicon
// is referenced absolutely.
for (const f of fs.readdirSync("public")) {
  fs.copyFileSync(path.join("public", f), path.join(OUT, f));
}

fs.writeFileSync(path.join(OUT, "index.html"), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0d14" />
    <meta name="description" content="Kingdom of Foxes \u2014 family tree of the houses." />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="preconnect" href="https://kingdomfoxes.com" />
    <link rel="preconnect" href="https://mc-heads.net" />
    <link rel="stylesheet" href="/assets/${cssName}" />
    <title>Family Tree \u00b7 Kingdom of Foxes</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${entry.fileName}"></script>
  </body>
</html>
`);
// GitHub Pages runs Jekyll by default and skips files it does not recognise.
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

console.log("BUILD OK " + JSON.stringify({
  js: entry.fileName,
  jsKB: +(fs.statSync(path.join(OUT, "assets", entry.fileName)).size / 1024).toFixed(1),
  css: cssName,
  cssKB: +(cssText.length / 1024).toFixed(1),
  chunks: output.filter((o) => o.type === "chunk").length,
}));
process.exit(0);
