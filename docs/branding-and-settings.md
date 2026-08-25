# Varta branding and settings

## Product naming

- Display/product name: `Varta`
- Visual wordmark: `VĀRTĀ`
- Technical package name: `varta`
- Existing Expo slug and deep-link scheme: `campus`

The technical identifiers remain ASCII and stable so current authentication and development links do not break.

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

## Final icon handoff

`assets/images/varta-icon.png` remains the current working icon so builds stay valid. It is not the approved final direction because it contains the older speech-bubble mark.

When the approved monogram is supplied, prepare:

- `varta-icon.png`: 1024 × 1024 opaque PNG, near-white background with a centered black V or VĀ monogram and generous safe space.
- `varta-adaptive-foreground.png`: 1024 × 1024 transparent PNG containing only the black monogram inside the central safe area.
- `varta-monochrome.png`: 1024 × 1024 transparent single-color mask for Android themed icons.
- `varta-favicon.png`: at least 48 × 48 PNG derived from the same monogram.

Then point `icon`, `ios.icon`, `android.adaptiveIcon.foregroundImage`, `android.adaptiveIcon.monochromeImage`, and `web.favicon` at the final files, retaining a near-white Android adaptive background.

Expo Go does not demonstrate Varta's final installed launcher icon; it launches the project inside the Expo Go host app. Validate the actual icon and adaptive masks using a Varta development build, preview APK, or production build. Check circle, squircle, and rounded-square launchers before approving the asset.

## Settings behavior

- Theme preference is device-local and survives logout.
- Like, comment, badge, and event notification toggles are stored as self-owned Supabase rows and honored by trusted database triggers.
- Verification outcome notifications remain enabled because they are essential account messages.
- Organization-update controls are omitted because no such notification producer exists yet.
- Delete account is omitted until a privileged backend flow can revoke sessions and safely remove the Auth user.
