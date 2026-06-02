import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Share2, Code2, Save, FolderOpen, ImageDown, Copy, Check, Trash2, X,
} from "lucide-react";
import { PARAGONS } from "../constants/paragons.js";
import {
  buildShareUrl, buildEmbedSnippet, buildEmbedPreviewUrl,
} from "../utils/shareState.js";
import { listBuilds, saveBuild, deleteBuild } from "../utils/savedBuilds.js";
import { exportResultImage } from "../utils/shareImage.js";
import "./BuildToolbar.css";

const fmtDate = (ts) => {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return "";
  }
};

/**
 * Top-of-page actions for the current build: share a link, save/load builds
 * (localStorage), grab an embed snippet, and export a result image. All of these
 * describe the build with the same share-state shape (see utils/shareState.js).
 */
export default function BuildToolbar({ state, results, paragon, onLoadState }) {
  const [dialog, setDialog] = useState(null); // "share" | "embed" | "save" | "load"
  const [copied, setCopied] = useState("");
  const [saveName, setSaveName] = useState("");
  const [builds, setBuilds] = useState([]);
  const [exporting, setExporting] = useState(false);

  const shareUrl = useMemo(() => buildShareUrl(state), [state]);
  const embedSnippet = useMemo(() => buildEmbedSnippet(state), [state]);
  const embedPreview = useMemo(() => buildEmbedPreviewUrl(state), [state]);

  const close = useCallback(() => setDialog(null), []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog, close]);

  const copy = useCallback(async (text, tag) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (e.g. insecure context). The value is left
      // selected in its field so it can still be copied by hand.
    }
    setCopied(tag);
    window.setTimeout(() => setCopied(""), 1600);
  }, []);

  const openShare = useCallback(() => { setCopied(""); setDialog("share"); }, []);
  const openEmbed = useCallback(() => { setCopied(""); setDialog("embed"); }, []);
  const openSave = useCallback(() => {
    setSaveName(`${paragon.name} build`);
    setDialog("save");
  }, [paragon]);
  const openLoad = useCallback(() => { setBuilds(listBuilds()); setDialog("load"); }, []);

  const doSave = useCallback(() => {
    saveBuild(saveName, state);
    setDialog(null);
  }, [saveName, state]);

  const doLoad = useCallback((b) => {
    onLoadState(b.state);
    setDialog(null);
  }, [onLoadState]);

  const doDelete = useCallback((id) => {
    deleteBuild(id);
    setBuilds(listBuilds());
  }, []);

  const doExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportResultImage({
        paragon,
        difficulty: state.difficulty,
        gameMode: state.gameMode,
        results,
      });
    } catch (err) {
      console.error("Failed to export result image", err);
    } finally {
      setExporting(false);
    }
  }, [exporting, paragon, state, results]);

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;
  const nativeShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: "BTD6 Paragon Calculator", url: shareUrl }).catch(() => {});
    }
  }, [shareUrl]);

  return (
    <div className="build-toolbar">
      <span className="bt-label">Degree {results.degree} build</span>
      <div className="bt-actions">
        <button className="bt-btn bt-primary" onClick={openShare}><Share2 size={16} /> Share</button>
        <button className="bt-btn" onClick={openSave}><Save size={16} /> Save</button>
        <button className="bt-btn" onClick={openLoad}><FolderOpen size={16} /> Saved</button>
        <button className="bt-btn" onClick={openEmbed}><Code2 size={16} /> Embed</button>
        <button className="bt-btn" onClick={doExport} disabled={exporting}>
          <ImageDown size={16} /> {exporting ? "Rendering…" : "Image"}
        </button>
      </div>

      {dialog && (
        <div className="bt-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="bt-modal" role="dialog" aria-modal="true">
            <div className="bt-modal-head">
              <h3>
                {dialog === "share" && "Share this build"}
                {dialog === "embed" && "Embed this calculator"}
                {dialog === "save" && "Save build"}
                {dialog === "load" && "Saved builds"}
              </h3>
              <button className="bt-close" onClick={close} aria-label="Close"><X size={16} /></button>
            </div>

            {dialog === "share" && (
              <div className="bt-body">
                <p className="bt-hint">Anyone who opens this link gets your exact paragon, difficulty, sacrifices and totems pre-loaded.</p>
                <div className="bt-copyrow">
                  <input className="bt-field" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                  <button className="bt-btn bt-primary" onClick={() => copy(shareUrl, "share")}>
                    {copied === "share" ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
                  </button>
                </div>
                {canNativeShare && (
                  <button className="bt-btn bt-wide" onClick={nativeShare}><Share2 size={16} /> Share via…</button>
                )}
              </div>
            )}

            {dialog === "embed" && (
              <div className="bt-body">
                <p className="bt-hint">Paste this on any site or wiki. The widget is ad-free, interactive, and links back here.</p>
                <textarea className="bt-field bt-textarea" readOnly rows={4} value={embedSnippet} onFocus={(e) => e.target.select()} />
                <div className="bt-copyrow bt-copyrow-end">
                  <a className="bt-btn" href={embedPreview} target="_blank" rel="noopener noreferrer">Open preview ↗</a>
                  <button className="bt-btn bt-primary" onClick={() => copy(embedSnippet, "embed")}>
                    {copied === "embed" ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
                  </button>
                </div>
              </div>
            )}

            {dialog === "save" && (
              <div className="bt-body">
                <p className="bt-hint">Saved in this browser — reopen it any time from “Saved”.</p>
                <input
                  className="bt-field"
                  autoFocus
                  maxLength={60}
                  value={saveName}
                  placeholder="Build name"
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") doSave(); }}
                />
                <div className="bt-copyrow bt-copyrow-end">
                  <button className="bt-btn" onClick={close}>Cancel</button>
                  <button className="bt-btn bt-primary" onClick={doSave}><Save size={16} /> Save build</button>
                </div>
              </div>
            )}

            {dialog === "load" && (
              <div className="bt-body">
                {builds.length === 0 ? (
                  <p className="bt-empty">No saved builds yet. Set up a build and hit <strong>Save</strong>.</p>
                ) : (
                  <ul className="bt-list">
                    {builds.map((b) => {
                      const para = PARAGONS[b.state?.paragon];
                      return (
                        <li key={b.id} className="bt-list-item">
                          <button className="bt-list-load" onClick={() => doLoad(b)}>
                            <span className="bt-list-name">{para ? para.icon : "🎯"} {b.name}</span>
                            <span className="bt-list-sub">{para ? para.name : "Unknown paragon"} · {fmtDate(b.savedAt)}</span>
                          </button>
                          <button className="bt-list-del" onClick={() => doDelete(b.id)} aria-label={`Delete ${b.name}`}>
                            <Trash2 size={15} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
