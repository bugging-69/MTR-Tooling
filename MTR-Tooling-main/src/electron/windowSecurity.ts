export const secureWebPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const;

const allowedExternalHosts = new Set(['go.microsoft.com']);

export const isAllowedExternalUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && allowedExternalHosts.has(url.hostname);
  } catch {
    return false;
  }
};
