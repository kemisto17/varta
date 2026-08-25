# Varta branding and settings

## Product naming

- Display/product name: `Varta`
- Visual wordmark: `VĀRTĀ`
- Technical package name: `varta`
- Expo slug and deep-link scheme: `varta`
- Android application ID: `com.kemisto17.varta`

These identifiers are the stable internal-alpha identity. Changing the Android application ID later would create a different installed app and Play Store listing.

## Appearance architecture

`ThemeProvider` loads `system`, `light`, or `dark` from the local Expo SQLite key-value store before the protected router renders. `System` subscribes to React Native Appearance changes. Screens consume semantic colors through `useTheme()` or `useThemedStyles()`; spacing and radius remain mode-independent.

The root navigator, tab bar, status bar, modal surfaces, and native root background receive the same resolved palette. Fullscreen media intentionally retains a black viewer palette.

## Safe areas and Android edge-to-edge

`SafeAreaProvider` is mounted once above the application providers. Screen roots use the shared `SafeAreaScreen` component so status bars, camera cutouts, notches, and side insets are applied consistently. Stack screens own all four edges. Tab scenes omit only the bottom edge because the inset-aware tab bar owns that space; this prevents double padding.

Android API 36 requires edge-to-edge rendering, so Varta does not attempt to disable it. Scrollable content stays inside its safe screen viewport, modal sheets add their own bottom and side insets, and fullscreen media may cover the display while its close control remains inside the top/right safe area. The resolved theme controls status-bar icon contrast.

## Splash assets

- `assets/images/varta-wordmark-light.png` — black transparent VĀRTĀ wordmark for the warm-white launch surface.
- `assets/images/varta-wordmark-dark.png` — warm-white transparent VĀRTĀ wordmark for the near-black launch surface.

Both assets are deterministic text renders rather than screenshots. Expo's splash plugin selects the appropriate asset from the native system appearance before JavaScript loads.

## Launcher icon assets

- `assets/images/varta-icon-monogram.png` — configured opaque launcher icon with a centered black VĀ on the warm near-white brand background.
- `assets/images/varta-adaptive-monogram.png` — configured transparent VĀ foreground for Android adaptive and themed icons; Expo supplies `#F8F7F4` as the adaptive background layer.
- `assets/images/varta-icon-wordmark.png` — prepared full-wordmark alternative with centered black VĀRTĀ on warm near-white.
- `assets/images/varta-icon.png` — retained only as the unreferenced legacy speech-bubble asset.

The full wordmark occupies roughly half the canvas width but only about 13% of its height. It is balanced at source size, yet becomes too small to read reliably at common launcher sizes. The VĀ monogram is therefore the configured variant. Its Android foreground occupies 48% of the 108 dp layer width (about 52 dp), is centered, and remains inside Android's 66 × 66 dp mask-safe zone.

Expo Go does not demonstrate Varta's final installed launcher icon; it launches the project inside the Expo Go host app. Validate the actual icon and adaptive masks using a Varta development build, preview APK, or production build. Check circle, squircle, rounded-square, and themed-icon launchers before approving the asset. The preview build keeps the VĀ fallback configured because the full VĀRTĀ wordmark is only about 13% of the square asset's height and is not reliably readable at launcher size.

## Settings behavior

- Theme preference is device-local and survives logout.
- Like, comment, badge, and event notification toggles are stored as self-owned Supabase rows and honored by trusted database triggers.
- Verification outcome notifications remain enabled because they are essential account messages.
- Organization-update controls are omitted because no such notification producer exists yet.
- Delete account is omitted until a privileged backend flow can revoke sessions and safely remove the Auth user.
