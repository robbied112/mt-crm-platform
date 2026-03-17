const LEGACY_LOGO_PATTERNS = [
  /sidekick/i,
  /^(?:\.\/|\/)?logo\.png(?:[?#].*)?$/i,
];

export function isLegacyLogoUrl(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;
  return LEGACY_LOGO_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function sanitizeTenantLogoUrl(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (!normalized || isLegacyLogoUrl(normalized)) return "";
  return normalized;
}

export function sanitizeTenantBranding(config) {
  if (!config || typeof config !== "object") return config;

  const sanitizedLogo = sanitizeTenantLogoUrl(config.logo);
  if (sanitizedLogo === (config.logo || "")) {
    return config;
  }

  return {
    ...config,
    logo: sanitizedLogo,
  };
}
