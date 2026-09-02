export function normalizeControlPin(value) {
  const text = String(value ?? "").trim();
  const labeled = text.match(/Control PIN:\s*(\S+)/i);
  if (labeled) return labeled[1];
  return /\s/.test(text) ? "" : text;
}
