export function normalizeControlPin(value) {
  const text = String(value ?? "").trim();
  const labeled = text.match(/Control PIN:\s*(\S+)/i);
  if (labeled) return labeled[1];
  return /\s/.test(text) ? "" : text;
}

export function controlCommands(controls, target) {
  const command = { target, value: !controls[target] };
  return target !== "auto" && controls.auto
    ? [{ target: "auto", value: false }, command]
    : [command];
}
