import { useEffect, useState } from "react";

export default function MobileWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => setShow(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!show) return null;

  return (
    <div className="mobile-warning" role="alert">
      CogniMesh pipeline designer works best on desktop. Please use a wider screen for drag-and-drop editing.
    </div>
  );
}
