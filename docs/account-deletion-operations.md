# Processing Account Deletion Requests

Users email the existing support address from their registered email. The app
opens the public deletion page. This is a manual support workflow, not an automatic
deletion service. An operator must monitor the inbox and fulfill verified requests.

1. Verify control of the registered email without requesting a password or ID image.
   Find the exact Supabase Auth UUID; do not trust an unverified sender's UUID.
2. Inventory the user's profile, posts, Lost & Found items, verification history,
   storage objects and organization roles before deleting rows. Cascades erase
   file paths needed for cleanup. Keep processing notes access-controlled.
3. Transfer any sole organization ownership with an authorized organization/admin.
   Events reference their creator with DELETE RESTRICT: transfer that attribution
   to an authorized organization operator. Do not weaken constraints or remove
   shared organization content to force deletion of one student's account.
4. Restrict the account and terminate its sessions using supported Supabase
   administration. Do not mistake changing a password for deleting an account.
5. Remove personal media through provider APIs/consoles, including orphaned uploads.
   In R2 inspect the exact UUID prefixes `avatars/users/<uuid>/`,
   `posts/users/<uuid>/`, and `lost-found/users/<uuid>/`. Do not delete another
   namespace or shared organization media. Inspect the actual Supabase Storage
   buckets for legacy avatars, post images, Lost & Found and verification documents,
   including replacements and verification history. Never SQL-delete storage metadata.
6. Resolve remaining storage ownership and FK dependencies before deleting the
   Auth user. Handle shared organization files separately with the organization.
7. Delete the Auth user through Supabase administration. Verify removal of the
   profile, personal posts, comments, likes, follows, interests, verification data,
   push tokens/preferences, terms acceptance and feed sessions. Inspect reports,
   notifications and audit records for remaining personal information; remove or
   anonymize it unless retention has a documented legitimate purpose consistent
   with the Privacy Policy.
8. Verify the account cannot sign in/access protected resources and deleted media
   is no longer served. Purge public media caches if required. Confirm completion
   to the registered address and keep only minimal restricted evidence of handling.

If any operation fails, keep the request open and retry that step. Do not report
success until Auth, database and media removal have been verified.

Before release, test this process on a disposable account containing personal
images, verification uploads and organization membership. Test both R2 and legacy
storage. The repo does not automate support fulfillment.

Publish `docs/terms/` and the updated policy pages via the existing GitHub Pages
workflow. Never store credentials or account-deletion request data in Git.
