import { Auth0Client } from "@auth0/nextjs-auth0/server";

let client: Auth0Client | null = null;

export function getAuth0Client(): Auth0Client {
  if (client) return client;
  if (
    !process.env.AUTH0_DOMAIN ||
    !process.env.AUTH0_CLIENT_ID ||
    !process.env.AUTH0_CLIENT_SECRET ||
    !process.env.AUTH0_SECRET ||
    !process.env.APP_BASE_URL
  ) {
    throw new Error(
      "Auth0 env not configured. Required: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL.",
    );
  }
  client = new Auth0Client();
  return client;
}
