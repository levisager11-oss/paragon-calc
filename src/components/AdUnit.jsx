import { useEffect, useRef, useState } from "react";

export default function AdUnit({ slot, format = "auto", responsive = true, style }) {
  const adRef = useRef(null);
  const pushed = useRef(false);
  const [adState, setAdState] = useState("pending");

  useEffect(() => {
    if (pushed.current) return;
    try {
      if (adRef.current && adRef.current.childElementCount === 0) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      }
    } catch {
      // adsbygoogle not loaded yet
    }
  }, []);

  useEffect(() => {
    const ad = adRef.current;
    if (!ad) return undefined;

    const syncAdState = () => {
      const status = ad.getAttribute("data-ad-status");
      if (status === "filled" || status === "unfilled") {
        setAdState(status);
      }
    };

    syncAdState();
    if (typeof MutationObserver === "undefined") return undefined;

    const observer = new MutationObserver(syncAdState);
    observer.observe(ad, { attributes: true, attributeFilter: ["data-ad-status"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="ad-container" data-ad-state={adState} style={style}>
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
