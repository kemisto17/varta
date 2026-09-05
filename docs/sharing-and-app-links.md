# Sharing and Android App Links

Varta shares only a content type and UUID. The link never contains a Supabase
session, signed media URL, author details, or post text. The destination screen
loads the content normally, so existing authentication, verification, RLS,
block, status, and deletion checks remain authoritative.

## Shared URLs

~~~text
https://kemisto17.github.io/varta/open/?type=post&id=POST_UUID
https://kemisto17.github.io/varta/open/?type=event&id=EVENT_UUID
~~~

The `docs/open/index.html` page attempts to open the validated destination with
the existing `varta` custom scheme. If the app does not open, it redirects to
Varta's Google Play listing:

~~~text
https://play.google.com/store/apps/details?id=com.kemisto17.varta
~~~

Only eligible, opted-in accounts can install while Varta remains in closed
testing. The website's **Join testing** button therefore uses the separate
closed-test opt-in URL; the share fallback itself always targets the listing.

## Publish the domain association

Android retrieves Digital Asset Links from the host root, even though Varta is
a GitHub Pages project site under `/varta/`. Create a public GitHub repository
named `kemisto17.github.io` and publish this file from that user site's root:

~~~text
.well-known/assetlinks.json
~~~

Use the JSON snippet supplied by Play Console under **Release > Setup > App
signing**, or fill the following template with the Play App Signing certificate
SHA-256 fingerprint. Do not substitute the upload-key fingerprint for builds
installed by Google Play.

~~~json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.kemisto17.varta",
      "sha256_cert_fingerprints": [
        "PLAY_APP_SIGNING_SHA256_FINGERPRINT"
      ]
    }
  }
]
~~~

The final file must be available without authentication or redirects at:

~~~text
https://kemisto17.github.io/.well-known/assetlinks.json
~~~

Add an empty `.nojekyll` file to the root user-site repository so GitHub Pages
publishes the `.well-known` directory unchanged.

## Build and verify

The App Link intent filter is generated from `app.json`, so regenerate the
native Android project before building the 1.0.4 bundle:

~~~powershell
npx.cmd expo prebuild --platform android
~~~

Install a Play-signed test build, wait for Android's domain verification, then
check the association and open one real shared URL:

~~~powershell
adb shell pm get-app-links com.kemisto17.varta
adb shell am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "https://kemisto17.github.io/varta/open/?type=post&id=POST_UUID"
~~~

Test links from both a normal browser and an in-app browser such as WhatsApp.
Also test signed-out, wrong-university, blocked, deleted, malformed, and offline
destinations. They must never bypass the destination screen's existing access
checks.
