import { Amplify } from "aws-amplify";

let configured = false;

export async function loadAuthConfig() {
  const res = await fetch("/api/v1/auth/config");
  return res.json();
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
