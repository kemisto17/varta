# Varta moderation workflow

Varta intentionally has no moderator controls or elevated credentials in the mobile app. Run these commands only in the Supabase SQL Editor while signed in as a trusted project administrator.

## 1. Review the queue

```sql
select
  report.id,
  report.created_at,
  report.status,
  report.target_type,
  report.target_id,
  report.reason,
  report.details,
  reporter.username as reporter_username,
  report.reviewed_at,
  report.resolution_note
from public.reports as report
join public.profiles as reporter
  on reporter.id = report.reporter_id
where report.status in ('pending', 'reviewing')
order by
  case report.status when 'pending' then 0 else 1 end,
  report.created_at asc;
```

`target_id` is the immutable audit identifier. The target-specific foreign key becomes `null` if the content or profile is later deleted, while the report remains available.

## 2. Inspect one target

Replace `<REPORT_UUID>` with the report ID from the queue.

```sql
select
  report.id as report_id,
  report.target_type,
  report.target_id,
  report.reason,
  report.details,
  post.author_id as post_author_id,
  post.content as post_content,
  post.image_path as post_image_path,
  comment.author_id as comment_author_id,
  comment.content as comment_content,
  reported_profile.username as profile_username,
  reported_profile.full_name as profile_full_name
from public.reports as report
left join public.posts as post
  on post.id = report.post_id
left join public.comments as comment
  on comment.id = report.comment_id
left join public.profiles as reported_profile
  on reported_profile.id = report.profile_id
where report.id = '<REPORT_UUID>'::uuid;
```

A row with empty target content means the target was already deleted. Do not infer that the report itself is invalid.

## 3. Claim a report for review

Use the moderator's real Auth user UUID for traceability.

```sql
update public.reports
set
  status = 'reviewing',
  reviewed_by = '<MODERATOR_AUTH_USER_UUID>'::uuid,
  reviewed_at = now(),
  resolution_note = null
where id = '<REPORT_UUID>'::uuid
  and status = 'pending'
returning id, status, reviewed_by, reviewed_at;
```

If no row is returned, another moderator may already have handled it. Re-open the queue before continuing.

## 4. Remove reported content when necessary

Deleting a post cascades to its likes and comments. Deleting a comment removes only that comment. Neither command deletes the author's profile.

For a post, first record its `image_path` from the inspection query, then run:

```sql
delete from public.posts as post
using public.reports as report
where report.id = '<REPORT_UUID>'::uuid
  and report.target_type = 'post'
  and post.id = report.post_id
returning post.id, post.author_id, post.image_path;
```

For a comment:

```sql
delete from public.comments as comment
using public.reports as report
where report.id = '<REPORT_UUID>'::uuid
  and report.target_type = 'comment'
  and comment.id = report.comment_id
returning comment.id, comment.author_id, comment.post_id;
```

Do not delete a profile as part of a post or comment takedown. Profile/account removal requires a separate, deliberate safety process.

### Post image cleanup

Deleting the database row cannot safely remove the binary from Storage through SQL. If the deleted post returned an `image_path`, open Supabase Dashboard → Storage → `post-media` and delete that exact object. Never delete rows directly from `storage.objects`; use the Storage dashboard or a trusted server-side Storage API.

## 5. Resolve or dismiss

After any takedown or other action:

```sql
update public.reports
set
  status = 'resolved',
  reviewed_by = '<MODERATOR_AUTH_USER_UUID>'::uuid,
  reviewed_at = coalesce(reviewed_at, now()),
  resolution_note = '<SHORT_INTERNAL_RESOLUTION_NOTE>'
where id = '<REPORT_UUID>'::uuid
  and status in ('pending', 'reviewing')
returning id, status, reviewed_at, resolution_note;
```

If no violation is found, use `dismissed` instead:

```sql
update public.reports
set
  status = 'dismissed',
  reviewed_by = '<MODERATOR_AUTH_USER_UUID>'::uuid,
  reviewed_at = coalesce(reviewed_at, now()),
  resolution_note = '<SHORT_INTERNAL_DISMISSAL_NOTE>'
where id = '<REPORT_UUID>'::uuid
  and status in ('pending', 'reviewing')
returning id, status, reviewed_at, resolution_note;
```

Resolution notes, reviewer IDs, and report rows are not readable by normal app users.
