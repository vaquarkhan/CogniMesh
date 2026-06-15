import { CANVAS_TIPS } from "../lib/field-tips";

export default function CanvasTipBar({ variant, message, onDismiss }) {
  const text = message || CANVAS_TIPS[variant] || CANVAS_TIPS.noSelection;
  if (!text) return null;

  return (
    <div className={`canvas-tip-bar canvas-tip-${variant || "info"}`} role="status">
      <span>{text}</span>
      {onDismiss && (
        <button type="button" className="canvas-tip-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
