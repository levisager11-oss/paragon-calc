import { useEffect, useRef, useState } from "react";

/**
 * A single AdSense slot.
 *
 * The container stays out of the layout until AdSense reports the slot filled.
 * An unfilled slot — no fill available, or the script blocked entirely, which is
 * how a large share of visitors see the page — would otherwise leave a gap the
 * width of the page and two flex gaps tall, with nothing in it.
 */
export default function AdUnit({ slot, format = "auto", responsive = true, style }) {
  const adRef = useRef(null);
  const pushed = useRef(false);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const ins = adRef.current;
    if (!ins || pushed.current) return;

    // AdSense stamps data-ad-status="filled" | "unfilled" once it has decided.
    const observer = new MutationObserver(() => {
      if (ins.getAttribute("data-ad-status") === "filled") setFilled(true);
    });
    observer.observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });

    try {
      if (ins.childElementCount === 0) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      }
    } catch {
      // adsbygoogle is unavailable (blocked, or not loaded yet). The slot simply
      // never fills, and the container stays collapsed.
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="ad-container" style={style} hidden={!filled} aria-hidden="true">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-9156198299199380"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
        ref={adRef}
      />
    </div>
  );
}
