# Changelog

This file records user-visible changes to Varta. Release dates are intentionally
omitted until the corresponding releases are published.

## v1.0.4

### Added

- Private Saved Posts available from Settings, with save controls on post cards.
- Cursor-paginated saved-post history with pull-to-refresh and normal post interactions.
- Native sharing for visible posts and published events.
- HTTPS share links that open Varta when installed and otherwise continue to Google Play.
- A refreshed public Varta website with product, safety, support, and policy links.

### Fixed

- Remembered the accepted Terms version on-device so returning users no longer see the Terms screen during every restart.
- Continued to revalidate Terms acceptance with Supabase without weakening publishing policies.

## v1.0.3

### Added

- Ranked Campus and chronological Latest modes in the unified Home feed.
- Home feed cards for posts, upcoming events, and active Lost & Found items.
- Threaded comment replies and username mentions in posts and comments.
- Mention suggestions, in-app mention notifications, and push routing.
- In-app Terms of Use acceptance plus privacy, child-safety, and account-deletion links.

### Fixed

- Stabilized Campus pagination so engagement changes and new posts do not reorder an active scroll session.
- Rechecked blocks, RLS visibility, deletion, and structured-content status on every feed page.
- Kept feed payload hydration batched to avoid per-card database requests.

## v1.0.1

### Added

- Password recovery with email deep links and a protected reset flow.
- Post editing for student-authored posts and posts from managed organizations.
- Lost & Found post types, an open-item feed, optional campus locations, and resolved status.
- Interactive post-image cropping in original, 1:1, 4:5, and 16:9 formats.

### Fixed

- Preserved post-image aspect ratios in the feed instead of forcing a crop.
- Improved Android keyboard handling in the report form.
- Displayed organization avatars consistently on event cards and event details.
- Added the Android Firebase client configuration required by notification builds.

## v1.0.0

- Initial V1 baseline with verified campus access, student profiles, the campus
  feed, organizations and events, search, notifications, moderation, and theme
  controls.
