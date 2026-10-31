
const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const renderApiHost = import.meta.env.VITE_API_HOST?.trim();
const configuredApiBase = configuredApiUrl || renderApiHost ||
  (import.meta.env.DEV ? "http://127.0.0.1:5000" : "");

export const API_BASE_URL = (
  configuredApiBase && !/^https?:\/\//i.test(configuredApiBase)
    ? `https://${configuredApiBase}`
    : configuredApiBase
).replace(/\/+$/, "");
