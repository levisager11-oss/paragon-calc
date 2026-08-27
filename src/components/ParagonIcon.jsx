import { useState } from "react";
import { paragonArt, paragonSlug } from "../constants/paragons.js";

// Injected by vite.config.js from the contents of public/paragon-art/, so a
// Paragon with no artwork renders its emoji without ever making a request.
const HAS_ART = new Set(typeof __PARAGON_ART__ === "undefined" ? [] : __PARAGON_ART__);

/**
 * A paragon's artwork, with its emoji as the fallback.
 *
 * The art in public/paragon-art/ is optional — a missing file degrades to the
 * emoji rather than a broken image, so the roster renders whether the set is
 * complete, partial or empty.
 *
 * Decorative by default: every call site already names the paragon in adjacent
 * text, so the image is hidden from assistive tech. Pass a `label` only where
 * the icon is the sole identifier.
 */
export default function ParagonIcon({ paragon, size = 32, label }) {
  // Track which paragon failed, not a bare boolean, so switching paragons
  // re-attempts the new artwork instead of inheriting the previous failure.
  const [failedId, setFailedId] = useState(null);

  // No artwork for this Paragon, or it failed to decode: show the emoji.
  if (!HAS_ART.has(paragonSlug(paragon)) || failedId === paragon.id) {
    return (
      <span
        className="paragon-icon paragon-icon-emoji"
        style={{ fontSize: Math.round(size * 0.72) }}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : "true"}
      >
        {paragon.icon}
      </span>
    );
  }

  return (
    <img
      className="paragon-icon"
      src={paragonArt(paragon)}
      width={size}
      height={size}
      alt={label || ""}
      aria-hidden={label ? undefined : "true"}
      loading="lazy"
      decoding="async"
      onError={() => setFailedId(paragon.id)}
    />
  );
}
