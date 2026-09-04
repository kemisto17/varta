# Changelog

This file records user-visible changes to Varta. Release dates are intentionally
omitted until the corresponding releases are published.

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
