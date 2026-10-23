/* Loads the built bundle in a DOM and drives the card interactions, which is
   the only way to prove a tap reaches a person card without a real browser. */
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`,
  { pretendToBeVisual: true, url: "https://mocharuuu.github.io/" });
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
// Node's own performance stays: jsdom's delegates to the global one.
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));

const opened = [];
window.open = (url) => { opened.push(url); return null; };

const bundleDir = "dist/assets";
const jsFile = fs.readdirSync(bundleDir).find((f) => f.endsWith(".js"));
await import("file://" + path.resolve(bundleDir, jsFile).replace(/\\/g, "/"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(150);

const svg = document.querySelector("svg.family-svg");
if (!svg) { console.log("FAIL: no svg rendered"); process.exit(1); }
const vb0 = svg.getAttribute("viewBox");

const cards = [...document.querySelectorAll('g[role="button"]')];
console.log("cards rendered:", cards.length);

// the card whose <title> names ToolyTom
const target = cards.find((c) => (c.querySelector("title")?.textContent || "").includes("ToolyTom"));
if (!target) { console.log("FAIL: ToolyTom card not found"); process.exit(1); }

const tap = (el) => el.dispatchEvent(new window.Event("pointerup", { bubbles: true }));

// --- single tap should reframe -------------------------------------
tap(target);
await sleep(1500);                      // let the tween settle
const vb1 = svg.getAttribute("viewBox");
console.log("viewBox before:", vb0);
console.log("viewBox settled after single tap:", vb1);
// Tom's circle per checkfocus.mjs: Neon, Spase, Borky, Astral, Quack, Hboom
const expected = "2402.0 203.0 1996.0 689.0";
const near = vb1.split(" ").map(Number)
  .every((n, i) => Math.abs(n - Number(expected.split(" ")[i])) < 2);
console.log("single tap framed Tom's circle:", near ? "PASS" : `FAIL (expected ${expected})`);

// --- tapping again should return to the full view -------------------
tap(target);
await sleep(1500);
const vb2 = svg.getAttribute("viewBox");
console.log("second single tap restored:", vb2 === vb0 ? "PASS" : `FAIL (${vb2})`);

// --- two quick taps should open the stats page ----------------------
tap(target);
await sleep(60);
tap(target);
await sleep(200);
console.log("double tap opened:", opened.length === 1 ? `PASS ${opened[0]}` : `FAIL (${opened.length} opens)`);
console.log("double tap did not also reframe:",
  svg.getAttribute("viewBox") === vb0 ? "PASS" : "FAIL");
process.exit(0);
