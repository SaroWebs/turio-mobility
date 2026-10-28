# Turio Mobility

Turio Mobility is a multi-platform ride and mobility platform. This repository
contains the customer and driver experiences for web and mobile, together with
the Laravel backend that powers the applications.

## Repository structure

| Directory | Application | Stack |
| --- | --- | --- |
| [`c-app`](./c-app) | Customer mobile app | Expo, React Native, TypeScript |
| [`c-web`](./c-web) | Customer web app | React, TypeScript, Vite |
| [`d-app`](./d-app) | Driver mobile app | Expo, React Native, TypeScript |
| [`d-web`](./d-web) | Driver web app | React, TypeScript, Vite |
| [`server-app`](./server-app) | API and web administration | Laravel 12, PHP, Inertia, React, Vite |

The mobile and web clients communicate with the Laravel backend through the
customer and driver API surfaces. Realtime events use Laravel Echo with
Pusher-compatible broadcasting, and maps use Google Maps where configured.

## Prerequisites

Install the tools needed for the applications you plan to run:

- Node.js and npm
- PHP 8.2 or newer
- Composer
- A database supported by Laravel
- Android Studio and/or Xcode for native mobile development
- Expo CLI tooling for the mobile apps

## Getting started

Clone the repository and install dependencies in each application directory
you intend to use:

```bash
git clone https://github.com/SaroWebs/turio-mobility.git
cd turio-mobility

cd server-app
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

For each client application:

```bash
cd c-app
npm install
Copy-Item .env.example .env

cd ../c-web
npm install
Copy-Item .env.example .env

cd ../d-app
npm install
Copy-Item .env.example .env

cd ../d-web
npm install
```

Configure the copied environment files before starting the applications.
Client API URLs should point to the running backend. Do not commit `.env`
files, API keys, private keys, or other credentials.

## Running locally

### Backend and administration

From `server-app`:

```bash
npm run dev
```

This starts the Laravel server, queue worker, and Vite development server.
The backend is normally available at `http://localhost:8000`.

To run the backend processes separately:

```bash
php artisan serve
php artisan queue:listen --tries=1
npm run dev
```

### Customer web

From `c-web`:

```bash
npm run dev
```

Build and preview a production bundle:

```bash
npm run build
npm run preview
```

### Driver web

From `d-web`:

```bash
npm run dev
```

Build and preview a production bundle:

```bash
npm run build
npm run preview
```

### Customer mobile

From `c-app`:

```bash
npm start
```

Useful platform commands:

```bash
npm run android
npm run ios
npm run web
```

### Driver mobile

From `d-app`:

```bash
npm start
```

Useful platform commands:

```bash
npm run android
npm run ios
npm run web
```

When testing on a physical device, make sure the device can reach the
development machine and set `EXPO_PUBLIC_API_URL` if automatic host detection
does not resolve the backend address.

## Environment configuration

Each client includes an `.env.example` file documenting its expected
configuration:

- `c-app/.env.example` and `d-app/.env.example` use `EXPO_PUBLIC_*` variables.
- `c-web/.env.example` uses `VITE_*` variables.
- `server-app/.env.example` contains Laravel, database, broadcasting, and
  frontend build configuration.

Common integrations include:

- Backend API URL
- Google Maps API key and map ID
- Pusher-compatible realtime credentials and connection settings
- Database and Laravel application settings

Use restricted, environment-specific keys and follow the provider guidance for
browser, Android, and server credentials.

## Validation

Run the checks for the application you changed:

```bash
# c-web
npm run verify

# d-web
npm run lint
npm run build

# c-app
npm run lint

# d-app
npm run verify

# server-app
npm run types
composer test
```

For the customer mobile app, Android builds also run the maps configuration
check:

```bash
npm run android:build
```

## Development notes

- Keep changes scoped to the relevant application directory.
- Keep generated files, dependencies, local databases, logs, and credentials
  out of commits; the root `.gitignore` already excludes these categories.
- Coordinate API contract changes between `server-app` and both customer and
  driver clients.
- Use the existing application-level documentation for specialized setup,
  such as the customer mobile maps configuration in
  [`c-app/MAPS_SETUP.md`](./c-app/MAPS_SETUP.md).

## License

This project is maintained by SaroWebs. Licensing details will be added when
the project license is finalized.
