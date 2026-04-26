# Auth0 Integration

## Two account types

Both Distributors and Clients use the same Auth0 tenant with a custom `account_type` claim.

## Auth0 setup (in dashboard)

1. Create application: "Strata" (SPA type)
2. Set Allowed Callback URLs: `http://localhost:5173, https://strata.com`
3. Set Allowed Logout URLs: same
4. Create API: audience = `https://strata-api`
5. Add a **Login Action** (post-login trigger):

```js
// Auth0 Action: Set account_type claim
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://strata.com/';
  const accountType = event.user.user_metadata?.account_type || 'client';
  api.idToken.setCustomClaim(namespace + 'account_type', accountType);
  api.accessToken.setCustomClaim(namespace + 'account_type', accountType);
};
```

6. Set `account_type` in `user_metadata` during signup (see signup flow below)

## Signup flow

During signup, before calling Auth0, Strata shows a role selector:

```
┌──────────────────────────────────────────────────────┐
│  Join Strata as...                                   │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────────┐  │
│  │  Distributor       │  │  Client                │  │
│  │  Earn revenue from │  │  Run AI workloads at   │  │
│  │  your site's idle  │  │  1/10th the AWS cost   │  │
│  │  compute           │  │                        │  │
│  └────────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

After selection, redirect to Auth0 with `screen_hint: 'signup'` and pass account_type via `user_metadata` using Auth0 Management API pre-signup, OR use `params` in the Universal Login URL and read it in the Action.

Simpler for hackathon: use two separate signup buttons that each call `loginWithRedirect` with a different `appState.accountType`, then the post-login Action reads `event.request.query.account_type`.

```ts
// Distributor signup
loginWithRedirect({
  authorizationParams: {
    screen_hint: 'signup',
    account_type: 'distributor', // read by Action via event.request.query
  },
});

// Client signup
loginWithRedirect({
  authorizationParams: {
    screen_hint: 'signup',
    account_type: 'client',
  },
});
```

Update the Action to read from query params:

```js
// Auth0 Action (updated)
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://strata.com/';
  // On first login, set account_type from query param; persist to metadata
  let accountType = event.user.user_metadata?.account_type;
  if (!accountType) {
    accountType = event.request.query?.account_type || 'client';
    await api.user.setUserMetadata({ account_type: accountType });
  }
  api.idToken.setCustomClaim(namespace + 'account_type', accountType);
  api.accessToken.setCustomClaim(namespace + 'account_type', accountType);
};
```

## Frontend: read account_type and route

```ts
import { useAuth0 } from '@auth0/auth0-react';
import { jwtDecode } from 'jwt-decode';

function useAccountType() {
  const { getAccessTokenSilently } = useAuth0();
  const [accountType, setAccountType] = useState<string | null>(null);

  useEffect(() => {
    getAccessTokenSilently().then(token => {
      const decoded = jwtDecode(token);
      setAccountType(decoded['https://strata.com/account_type']);
    });
  }, []);

  return accountType;
}

// In App.tsx router
const accountType = useAccountType();
// Redirect post-login to /client or /distributor
```

## Backend: validate JWT + extract claims

```js
const { auth } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  audience: 'https://strata-api',
  issuerBaseURL: process.env.AUTH0_DOMAIN,
});

// In a route handler
app.post('/api/jobs', checkJwt, (req, res) => {
  const accountType = req.auth.payload['https://strata.com/account_type'];
  if (accountType !== 'client') return res.status(403).json({ error: 'Clients only' });
  // ...
});
```

## Env vars needed

```
# Frontend (.env)
VITE_AUTH0_DOMAIN=https://YOUR_TENANT.auth0.com
VITE_AUTH0_CLIENT_ID=YOUR_CLIENT_ID
VITE_AUTH0_AUDIENCE=https://strata-api

# Backend (.env)
AUTH0_DOMAIN=https://YOUR_TENANT.auth0.com/
AUTH0_AUDIENCE=https://strata-api
```
