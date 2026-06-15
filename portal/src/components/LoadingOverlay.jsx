export default function LoadingOverlay({ message = "Working…" }) {
  return (
    <div className="loading-overlay" role="progressbar" aria-busy="true">
      <div className="loading-spinner" />
      <p>{message}</p>
    </div>
  );
}
