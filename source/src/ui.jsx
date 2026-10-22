import { Component } from "react";

/** The guild crest: the same pixels as crest.png, 39% fewer bytes.
 *
 * The PNG is 78.6KB for something the nav draws 34px tall and the footer
 * 26px, on every page of the site. crest.webp is 47.6KB and encoded
 * LOSSLESS, so this is a smaller file and not a re-render of the artwork —
 * verified identical after compositing over both themes' backgrounds, at
 * full resolution and at every size the site draws it.
 *
 * A plain <img>, not a <picture> with a <source>, deliberately. .brand and
 * .footer are flex rows, so a <picture> wrapper would become the flex item
 * in place of the <img> and would need display:contents to lay out the way
 * it does today — and a browser old enough to need the PNG at all is also
 * old enough to lack display:contents, which is exactly the browser that
 * would then get the broken row. This keeps the DOM identical to the bare
 * <img> it replaces for every browser, and falls back on error instead:
 * anything that cannot decode the WebP swaps to the PNG, at the cost of one
 * failed request on a long-obsolete browser.
 */
export function Crest({ className, alt = "", height }) {
  return (
    <img
      className={className} src="/crest.webp" alt={alt} height={height}
      onError={(e) => {
        // Guarded so a genuinely missing PNG can't loop: once swapped, a
        // second error has nowhere left to go.
        if (!e.currentTarget.dataset.fallback) {
          e.currentTarget.dataset.fallback = "1";
          e.currentTarget.src = "/crest.png";
        }
      }}
    />
  );
}


export function Spinner() {
  return <div className="spinner" />;
}

/** Catches a render crash in its subtree and shows a recoverable message
 * instead of letting React unmount the whole app to a blank screen (React
 * has no default UI for an uncaught render error). Class component because
 * error boundaries have no hook equivalent. Key this by route path from the
 * caller so navigating away from a crashed page clears the boundary. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="error">
          Something went wrong loading this page.{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>
            Reload
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

function ErrorBox({ error }) {
  return <div className="error">Couldn't load data: {error}</div>;
}

/** loading/error gate: renders children(data) only once loaded. A useFetch
 * with keepDataWhileLoading keeps `data` set through a reload, so `loading`
 * alone isn't reason enough to drop back to the spinner — only do that while
 * there's nothing to show yet (the plain first-load case, where data is
 * still null either way). */
export function Async({ state, children }) {
  if (state.loading && !state.data) return <Spinner />;
  if (state.error) return <ErrorBox error={state.error} />;
  return children(state.data);
}

/** Standard page header: serif small-caps title, subtitle, engraved rule.
 * `actions` is optional — page-level controls (a status pill, a short
 * label) that belong with the title rather than the content below it
 * render inline with the title on the same row, as direct siblings of the
 * title (not wrapped in their own group), so the caller has full control
 * over how they're laid out relative to the title and each other — e.g. a
 * `margin-left: auto` on one of them to pin it to the row's far edge.
 * `below` is a second optional row directly under that one (still above
 * `sub`/the rule) — for a control substantial enough (a toggle) that it
 * reads better on its own line than crowded next to the title. Omitting
 * either renders exactly as before, so every other page using PageHead is
 * unaffected. */
export function PageHead({ title, sub, actions, below }) {
  const heading = <h1 className="h1">{title}</h1>;
  return (
    <header className="page-head">
      {actions ? (
        <div className="page-head-row">
          {heading}
          {actions}
        </div>
      ) : heading}
      {below && <div className="page-head-below">{below}</div>}
      {sub && <p className="sub">{sub}</p>}
      <div className="rule" />
    </header>
  );
}
