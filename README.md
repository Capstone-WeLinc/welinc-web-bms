# BMS web app

This React and Vite app is the browser interface for the BMS ecosystem. For first-time setup and the full local startup sequence, use the [root developer setup](../README.md).

## Development

The root launcher starts Vite on port `5173` and proxies browser requests under `/api` to the BMS gateway on port `3005`. It also starts the Auth bridge, Booking, Dispatch, Completion, Analytics API, and Analytics projection worker needed by the screens. This is the recommended way to work on the frontend:

- Start the ecosystem from the repository root using the Windows or macOS/Linux command in the [root setup guide](../README.md).
- Open [http://localhost:5173](http://localhost:5173).

The app's local `.env` is created from [`.env.example`](.env.example) by the root launcher. `VITE_BMS_API_BASE_URL` should remain `/api`; `BMS_DEV_API_TARGET` should point to the gateway. Do not point BMS browser requests directly at the old partner bridge.

If the full launcher is not managing the frontend process and the gateway and APIs are already running, start only Vite with `npm run dev` from this folder. Do not start a second Vite process on port `5173` while the ecosystem launcher is running.

A browser Google Maps key is optional and separate from the server-side Google Routes key. If provided as `VITE_GOOGLE_MAPS_API_KEY`, restrict it to the intended browser origins and Maps JavaScript API. Without it, the map uses its Leaflet fallback.

## Checks

From this folder:

```sh
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

The gateway owns API routing and the service APIs own their data. See the root README for service boundaries, local database ports, demo logins, and troubleshooting.
