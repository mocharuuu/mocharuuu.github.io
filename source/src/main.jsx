import React from "react";
import { createRoot } from "react-dom/client";
import { Crest, ErrorBoundary } from "./ui.jsx";
import { DISCORD_INVITE_URL } from "./lib.js";
import Members from "./pages/Members.jsx";
import "./theme.css";

/* Standalone single-page build of the Kingdom of Foxes Members page.
   The full site is a multi-route SPA served by FastAPI + nginx; this build
   ships only the Members route, so there is no router, no auth chrome and no
   nav targets other than the live site. Data comes from the live public API
   (see BASE in lib.js) — cross-origin, so no session cookie travels with it
   and the payload is always the logged-out public one. */
const SITE = "https://kingdomfoxes.com";

function App() {
  return (
    <>
      <nav className="nav">
        <a href={SITE} className="brand">
          <Crest height="34" />
          <span className="wordmark">Kingdom <em className="of-connector">of</em> Foxes</span>
        </a>
        <div className="nav-links">
          <div className="nav-links-scroll-wrap">
            <div className="nav-links-scroll">
              <a href={SITE} >Home</a>
              <a href="#" className="active" aria-current="page">Members</a>
            </div>
          </div>
        </div>
      </nav>
      <main className="container">
        <ErrorBoundary>
          <Members />
        </ErrorBoundary>
      </main>
      <footer className="footer">
        <Crest height="26" />
        <span>Kingdom of Foxes · est 2014</span>
        <span aria-hidden="true">·</span>
        <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">Fox Discord</a>
        <span aria-hidden="true">·</span>
        <a href={`${SITE}/privacy`}>Privacy &amp; Terms</a>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
