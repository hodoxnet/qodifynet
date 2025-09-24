export function parseJsonFromMixedOutput(output: string): any {
  const out = (output || "").trim();
  // Fast path
  try {
    return JSON.parse(out);
  } catch {}

  // Try to extract a JSON array or object from noisy output
  const firstArray = out.indexOf("[");
  const firstObject = out.indexOf("{");

  let start = -1;
  let end = -1;
  if (firstArray !== -1 && (firstObject === -1 || firstArray < firstObject)) {
    start = firstArray;
    end = out.lastIndexOf("]");
  } else if (firstObject !== -1) {
    start = firstObject;
    end = out.lastIndexOf("}");
  }

  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = out.slice(start, end + 1);
    return JSON.parse(jsonStr);
  }

  // As a last resort, try to remove leading prompts/arrows
  const cleaned = out
    .replace(/^>\s*/gm, "")
    .replace(/^PS\s*>\s*/gm, "")
    .trim();
  return JSON.parse(cleaned);
}

