import { useEffect, useRef, useState } from "react";

const DOCK_LABELS = {
  ops: "Operations",
  approvals: "Approvals",
  history: "Run History",
  lineage: "Lineage",
  marketplace: "Marketplace",
  deploy: "Deploy results",
};

export default function HeaderDockMenu({ activeDock, onSelect, onCloseAll }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const items = [
    { id: "ops", label: "Operations" },
    { id: "approvals", label: "Approvals" },
    { id: "history", label: "Run History" },
    { id: "lineage", label: "Lineage" },
    { id: "marketplace", label: "Marketplace" },
    { id: "deploy", label: "Deploy results" },
  ];

  return (
    <div className="header-menu" ref={rootRef}>
      <button
        type="button"
        className={`btn-secondary header-menu-trigger${activeDock ? " is-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        Tools
        {activeDock ? ` · ${DOCK_LABELS[activeDock] || activeDock}` : ""}
      </button>
      {open && (
        <div className="header-menu-dropdown" role="menu">
          {items.map((item) => (
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
              {item.label}
            </button>
          ))}
          {activeDock && (
            <button type="button" role="menuitem" className="header-menu-close-all" onClick={() => { onCloseAll(); setOpen(false); }}>
              Close all panels
            </button>
          )}
        </div>
      )}
    </div>
  );
}
