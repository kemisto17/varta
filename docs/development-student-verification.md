# Development student verification

Student verification documents live in the private
`verification-documents` bucket. The mobile client can create a pending
submission, but it has no table permission or RLS policy that can change a
verification status.

## Apply the migration

Review and apply the committed Supabase migrations before testing the mobile
flow:

```bash
npx supabase db push
```

## Approve a test account

In the Supabase SQL Editor, replace the email below with the test account's
email and run the statement as the project owner:

```sql
update public.student_verifications as verification
set
  status = 'verified',
  reviewed_at = now()
from auth.users as account
where account.id = verification.user_id
  and lower(account.email) = lower('test-student@example.com')
  and verification.status = 'pending'
returning
  verification.user_id,
  verification.status,
  verification.reviewed_at;
```

The query updates only a pending submission and returns the approved row. Do
not add this capability to the mobile client. After approval, reopen Varta or
use **Check approval status** on the pending screen.
