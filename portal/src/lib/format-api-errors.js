/**
 * Flatten preview/deploy API errors into human-readable strings.
 */
export function formatApiErrors(result) {
  const errs = [];
  if (result?.errors?.length) {
    errs.push(...result.errors.map((e) => (typeof e === "string" ? e : e.message || String(e))));
  }
  if (result?.compileError) errs.push(result.compileError);
  for (const e of result?.validation?.errors || []) {
    errs.push(typeof e === "string" ? e : `${e.path}: ${e.message}`);
  }
  for (const e of result?.integrityGate?.errors || []) {
    errs.push(typeof e === "string" ? e : e.message || `${e.field}: ${e.message}`);
  }
  return errs.length ? errs : ["Preview failed"];
}
