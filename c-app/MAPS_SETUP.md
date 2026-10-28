# Customer app maps

## Run a native development build

Expo Go has its own native Google Maps credentials. The key in this project is
embedded only when building Turiya Mobility. A blank Expo Go map does not prove this
project's Android key is invalid.

1. Install dependencies with `npm install`.
2. Set `GOOGLE_MAPS_ANDROID_API_KEY` in `.env.local` to an Android key.
3. Run `npm run maps:check`. This checks local wiring, not Google authorization.
4. With Android Studio's SDK and JDK configured, connect a phone with USB
   debugging enabled, then run `npm run android:build`.
   On Windows the command automatically uses Android Studio's bundled JDK
   when `JAVA_HOME` is unset. A custom `JAVA_HOME` takes precedence.
5. Open the installed Turiya Mobility development app. For subsequent sessions run
   `npm run start:dev`. Both phone and API server must be reachable on the same
   network; set `EXPO_PUBLIC_API_URL` if automatic host detection is unsuitable.

Use `npm run start:go` only when intentionally testing Expo Go.
Changing a native API key requires a rebuild; reloading JavaScript is insufficient.

## Google Cloud configuration still required

- Enable billing and **Maps SDK for Android** in the Android key's project.
- Restrict that key to Android package `com.happymiles.customer` and the SHA-1
  certificate fingerprint of the actual build. After local native generation,
  `android/gradlew.bat signingReport` reports signing fingerprints. EAS builds
  may use a different signing certificate; inspect EAS credentials for that build.
- Use separate keys for Android, iOS, web, and the backend. Do not copy the
  backend key into a mobile build. The existing shared keys cannot be safely
  split merely by renaming environment variables; create replacement keys in
  Google Cloud, then update the corresponding environment values.
- The backend's Places and Routes APIs are separate from native map tiles.
  Successful search or directions does not verify Maps SDK authorization.
- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_MAP_ID` is optional. Leave it unset for a
  standard map. It is ignored in Expo Go. Use an Android map ID belonging to
  the native key's project if enabling cloud styling.
- The current iOS wrapper deliberately uses Apple Maps, even in native builds.
  An iOS Google key alone does not switch the app to Google Maps.

## EAS alternative

The `development`, `preview`, and `production` profiles are in `eas.json`.
Link the project to your Expo account with `npx eas-cli init`. Set
`GOOGLE_MAPS_ANDROID_API_KEY` in the selected EAS environment (development for
the development profile). `.env.local` is ignored by Git and should not be
assumed to upload. Then run:

```sh
npx eas-cli build --platform android --profile development
```

No Expo account linkage, Google Cloud changes, or cloud build is performed by
adding these files. Never put key values in committed `eas.json`.

## Diagnose a blank map

Development logs emit `[Maps] Native map ready` and `[Maps] Map tiles loaded`.
A warning after 30 seconds means no tile-loaded callback has arrived; it does
not establish the cause. GPS failure keeps the default map/search usable.

Connect the phone and run `adb devices`; authorize debugging on the phone.
Open the blank map, then inspect `adb logcat` for Google Maps authorization,
API token, network, or renderer failures. Do not share raw log output without
redacting API keys. Test both home and ride-booking maps, including permission
denial, cancellation, and returning to the home tab.

References: [Expo Maps setup](https://docs.expo.dev/versions/latest/sdk/map-view/),
[EAS profiles](https://docs.expo.dev/build/eas-json/),
[Google key restrictions](https://developers.google.com/maps/api-security-best-practices).
