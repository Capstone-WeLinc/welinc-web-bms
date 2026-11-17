# BMS web app

React and Vite browser app on `http://localhost:8003`. Start the shared stack,
then the BMS stack using the [BMS setup guide](../docs/context/bms/setup.md).
Sign-in and password recovery use the portal on 8000. Browser API calls use the
suite gateway on 3000, with business routes under `/bms`.

The web app stores access tokens in memory. The session host uses a HttpOnly
refresh cookie restricted to `/bms/session`. Refresh, idle expiry, multi-tab
coordination and sign-out follow the copied VRMS session implementation.
Customer tracking at `/track/:id` remains public and bypasses office sign-in.

Accounts are managed in the portal. BMS admins retain a separate Crew page for
local driver/helper business profiles. Work activity is served by BMS; account
activity, profile changes and deletion requests use shared auth's APIs.

## Development

Use Node 24 and npm. `.env.example` documents `VITE_API_BASE_URL` and
`VITE_PORTAL_URL`; both are required. Compose provides their local values.
To run Vite separately after the APIs are running:

```sh
npm ci
npm run dev
```

An optional `VITE_GOOGLE_MAPS_API_KEY` is public browser configuration. Restrict
it to the intended browser origins and APIs. Server secrets must never use a
`VITE_` name. Without the Maps browser key, the existing Leaflet fallback stays
available.

## Verification

```sh
npx tsc --noEmit -p tsconfig.app.json
npm run build:prod
npm run test:session
npm run test:unit
npm run test:ui
```

The UI suite mocks API responses and covers session behavior, account screens,
reports and exports. The live browser check requires the running shared/BMS
stack and suite seed accounts:

```sh
npx playwright test --project=chromium tests/integration-session.spec.ts --reporter=list
```

It signs in through the real portal, restores a BMS deep link, checks browser
storage and signs out. Older business E2E scenarios also need a working VMMS
fleet API and populated booking workflows; they are not the suite lead's
cross-system acceptance run. See the [verification record](../docs/context/bms/verification.md).

## Hosting

Set `VITE_API_BASE_URL` and `VITE_PORTAL_URL` to the target environment's HTTPS
addresses before `npm run build:prod`. Deploy `dist/` as a Static Web App.
`public/staticwebapp.config.json` supplies SPA fallback and security headers
with explicit Google Maps, Carto and font hosts. Leaflet and its CSS are bundled.
The CI template runs audit, lint, typecheck, session/report tests and this
production build. All sign-out controls use the shared confirmation/retry flow;
system-switch and failed-sign-out regressions are included. See the
[BMS hosting handoff](../docs/context/bms/hosting-handoff.md).
