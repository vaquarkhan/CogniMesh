import { useId, Children, cloneElement, isValidElement } from "react";

/**
 * Accessible labeled field — associates control with label via htmlFor/id.
 */
export default function FormField({ label, tip, children, id: idProp }) {
  const autoId = useId().replace(/:/g, "");
  const id = idProp || `field-${autoId}`;
  const tipId = tip ? `${id}-tip` : undefined;

  let control = children;
  if (isValidElement(children)) {
    control = cloneElement(children, {
      id: children.props.id || id,
      "aria-describedby": tipId || children.props["aria-describedby"],
    });
  }

  return (
    <div className="field">
      <label htmlFor={id} className="field-label-row">
        <span>{label}</span>
      </label>
      {control}
      {tip && (
        <p className="field-tip" id={tipId}>
          {tip}
        </p>
      )}
    </div>
  );
}
