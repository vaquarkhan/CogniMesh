import { Amplify } from "aws-amplify";

let configured = false;
const API_BASE = import.meta.env.VITE_API_URL || "";

async function safeJson(res, fallback) {
  try {
    const text = await res.text();
    if (!text?.trim()) return fallback;
    const trimmed = text.trim();
    if (trimmed.startsWith("<") || trimmed.startsWith("<!")) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function loadAuthConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/config`);
    return await safeJson(res, { authDisabled: true });
  } catch {
    return { authDisabled: true };
  }
}

export async function configureAmplify() {
  const config = await loadAuthConfig();
  if (config.authDisabled) {
    return { authDisabled: true };
  }
  if (!config.userPoolId || !config.clientId) {
    return { authDisabled: true, misconfigured: true };
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.clientId,
        loginWith: { email: true },
      },
    },
  });
  configured = true;
  return { authDisabled: false };
}

export function isAmplifyConfigured() {
  return configured;
}
