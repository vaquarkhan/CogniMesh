import { useEffect, useRef, useState } from "react";

const DOCK_LABELS = {
  ops: "Operations",
  approvals: "Approvals",
  history: "Run History",
  lineage: "Lineage",
  marketplace: "Marketplace",
  deploy: "Deploy results",
};

const ITEMS = [
  { id: "ops", label: "Operations", hint: "Live runs, versions, health" },
  { id: "approvals", label: "Approvals", hint: "Steward deploy gates" },
  { id: "history", label: "Run History", hint: "Past pipeline executions" },
  { id: "lineage", label: "Lineage", hint: "Catalog & graph" },
  { id: "marketplace", label: "Marketplace", hint: "Published data products" },
  { id: "deploy", label: "Deploy results", hint: "Last deploy output" },
];

export default function HeaderDockMenu({ activeDock, onSelect, onCloseAll }) {
  const [open, setOpen] = useState(false);
  const [hintSeen, setHintSeen] = useState(true);
  const rootRef = useRef(null);

  useEffect(() => {
    try {
      setHintSeen(globalThis.localStorage?.getItem("cognimesh_tools_hint_seen") === "1");
    } catch {
      setHintSeen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const markHintSeen = () => {
    if (hintSeen) return;
    setHintSeen(true);
    try {
      globalThis.localStorage?.setItem("cognimesh_tools_hint_seen", "1");
    } catch {
      /* ignore */
    }
  };

  const activeLabel = activeDock ? DOCK_LABELS[activeDock] || activeDock : null;

  return (
    <div className="header-menu" ref={rootRef}>
      <button
        type="button"
        className={`btn-secondary header-menu-trigger${activeDock ? " is-active" : ""}${!hintSeen ? " needs-hint" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={activeLabel ? `Panels menu, ${activeLabel} open` : "Open panels: Operations, Approvals, History, Lineage, Marketplace"}
        data-testid="header-tools-menu"
        title="Operations, Approvals, Run History, Lineage, Marketplace"
        onClick={() => {
          markHintSeen();
          setOpen((v) => !v);
        }}
      >
        <span className="header-menu-trigger-label">
          Panels
          {activeLabel ? <span className="header-menu-active-chip">{activeLabel}</span> : null}
        </span>
        {!activeDock && !hintSeen ? <span className="header-menu-pulse" aria-hidden="true" /> : null}
      </button>
      {open && (
        <div className="header-menu-dropdown" role="menu" data-testid="header-tools-dropdown">
          <p className="header-menu-caption">Workspace panels</p>
          {ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={activeDock === item.id}
              className={activeDock === item.id ? "active" : ""}
              onClick={() => {
                onSelect(item.id);
                setOpen(false);
              }}
            >
              <span className="header-menu-item-label">{item.label}</span>
              <span className="header-menu-item-hint">{item.hint}</span>
            </button>
          ))}
          {activeDock && (
            <button
              type="button"
              role="menuitem"
              className="header-menu-close-all"
              onClick={() => {
                onCloseAll();
                setOpen(false);
              }}
            >
              Close all panels
            </button>
          )}
        </div>
      )}
    </div>
  );
}
