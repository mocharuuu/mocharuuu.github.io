import { createPortal } from "react-dom";

export function Modal({ title, onClose, children, maxWidth, className = "" }) {
  // Portaled straight to <body>: every caller nests this somewhere inside a
  // staff-only trigger (a member card's ⋯ menu, a roster row) and .member-
  // card lifts on :hover via `transform`, which — per spec — turns it into
  // the containing block for any position:fixed descendant. Left un-portaled,
  // opening a modal while the triggering card happened to be hovered shrank
  // this "full-screen" overlay down to that card's own small box instead of
  // covering the viewport, which is what made the cards view's staff actions
  // (View Application chief among them) read as broken/inconsistent.
  //
  // No backdrop-click or Escape auto-close: these are staff actions with real
  // consequences (Offboard, Warn, …), so the only way out is the explicit
  // Close/Cancel button — an accidental outside click or Escape press should
  // never silently discard an in-progress action.
  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex",
               alignItems: "center", justifyContent: "center",
               background: "rgba(0,0,0,0.6)",
               // The padding keeps the modal clear of the notch and the home
               // indicator. Its height cap moved to .modal-card in theme.css,
               // where it can carry the vh fallback that dvh needs.
               padding: "max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))" }}>
      <div className={`card modal-card${className ? ` ${className}` : ""}`}
        style={{ ...(title ? null : { position: "relative" }), ...(maxWidth ? { maxWidth } : null) }}>
        {title ? (
          <div className="section-head">
            <h3>{title}</h3>
            <button className="btn" style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={onClose}>Close</button>
          </div>
        ) : (
          // No title: skip the header row entirely so content starts right at
          // the top padding, and float the button over the corner instead —
          // an empty reserved row still reads as blank space even when its
          // one child is right-aligned.
          <button className="btn" style={{ position: "absolute", top: 10, right: 10,
            padding: "3px 10px", fontSize: 12, zIndex: 1 }}
            onClick={onClose}>Close</button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
