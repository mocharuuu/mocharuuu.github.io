import { useEffect, useState } from "react";
import { loadAvatar } from "../lib/avatars.js";

/** A player's Minecraft head, by UUID.
 *
 * Rendered by our own backend from Mojang's skin texture rather than linked
 * from a third-party head host. The site used to point these at mc-heads.net,
 * which is a six-hour CDN cache over someone else's copy of the skin and
 * drifts badly — a sample of 14 Fox members found 6 being shown the default
 * Steve head while Mojang had a perfectly good skin for every one of them.
 *
 * The image arrives through lib/avatars.js, which collects every avatar on
 * screen into a single request. Fetching them one-by-one is what made the
 * Members page fail to load at all: ~106 simultaneous requests exceeded the
 * site's own /api/ rate limit and the page's data call was refused along with
 * them. The component's own API is unchanged either way.
 *
 * Pass one of 22 / 32 / 64 / 128 for an exact render; the backend snaps to
 * the nearest of those. `pixelated` keeps the skin's blocky edges crisp. */
export default function PlayerAvatar({ uuid, size = 22, radius = 4, className, style }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!uuid) return undefined;
    let live = true;
    loadAvatar(uuid, size).then((uri) => { if (live) setSrc(uri); });
    return () => { live = false; };
  }, [uuid, size]);

  if (!uuid) return null;

  // Hold the space before the image lands so a table doesn't reflow row by
  // row as a hundred heads resolve.
  const box = {
    width: size, height: size, borderRadius: radius,
    verticalAlign: "middle", display: "block", ...style,
  };
  if (!src) {
    return <span className={className} aria-hidden="true"
      style={{ ...box, background: "var(--border)" }} />;
  }
  return (
    <img
      className={className} src={src} alt="" width={size} height={size}
      decoding="async"
      style={{ ...box, imageRendering: "pixelated" }}
    />
  );
}
