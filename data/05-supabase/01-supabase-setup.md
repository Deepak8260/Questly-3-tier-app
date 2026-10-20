# Supabase Setup: Database, Auth, Storage and Realtime

Create the Supabase project that Questly uses for login, data, avatars
and live battles, from an empty account to a working app.

| | |
|---|---|
| **Do this** | Once, **before** running the app anywhere: on your laptop or on AWS |
| **You need** | A free account at <https://supabase.com> |
| **Time** | About 20 minutes |
| **Afterwards** | Put the values in the `.env` files: on your laptop, or on AWS with [Jenkins 3](../04-jenkins/03-agent-workspace-and-env-files.md) |

## Contents

1. [What Supabase does in Questly](#what-supabase-does-in-questly)
2. [Step 1: Create the project](#step-1-create-the-project)
3. [Step 2: Copy the URL and the keys](#step-2-copy-the-url-and-the-keys)
4. [Step 3: Turn on pg_cron](#step-3-turn-on-pg_cron)
5. [Step 4: Run the migrations, in order](#step-4-run-the-migrations-in-order)
6. [Step 5: Check what was created](#step-5-check-what-was-created)
7. [Step 6: Configure login](#step-6-configure-login)
8. [Step 7: Put the values in the `.env` files](#step-7-put-the-values-in-the-env-files)
9. [Step 8: Make yourself an admin](#step-8-make-yourself-an-admin)
10. [Step 9: Test it](#step-9-test-it)
11. [Optional: the Edge Function](#optional-the-edge-function)
12. [Checklist](#checklist)
13. [Troubleshooting](#troubleshooting)

---

## What Supabase does in Questly

Supabase is a hosted Postgres database with login, file storage and live
updates built in. Questly uses five parts of it:

| Part | Used for | Set up in |
|---|---|---|
| **Auth** | Sign up, sign in, sessions | Step 6 |
| **Postgres** | 11 tables: profiles, quiz attempts, battles, contests, settings | Step 4 |
| **Realtime** | Live battles and contest leaderboards | Step 4 (migrations) |
| **Storage** | Profile pictures, in the bucket `avatars` | Step 4 (migrations) |
| **Cron** | Starts contests on time, every minute | Steps 3 and 4 |

Who talks to Supabase:

| Who | Key used | Can do |
|---|---|---|
| Browser and Next.js | **anon** key (public) | Only what the Row Level Security rules allow |
| Express backend | **service_role** key (secret) | Everything. Used to save quiz scores. |

---

## Step 1: Create the project

1. Sign in at <https://supabase.com/dashboard> and click **New project**.
2. Fill in:

| Field | Value |
|---|---|
| Organization | Your own (created at sign-up) |
| Project name | `questly` |
| Database password | Click **Generate a password** and save it somewhere safe |
| Region | **South Asia (Mumbai)**, the same region as the AWS servers |
| Plan | Free |

3. Click **Create new project** and wait about two minutes until the
   dashboard opens.

## Step 2: Copy the URL and the keys

| Value | Where in the dashboard | Goes into |
|---|---|---|
| **Project URL**, such as `https://abcd1234.supabase.co` | **Project Settings → Data API** | `SUPABASE_URL` (backend) and `NEXT_PUBLIC_SUPABASE_URL` (frontend) |
| **anon** key | **Project Settings → API Keys** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend) |
| **service_role** key | **Project Settings → API Keys** (click **Reveal**) | `SUPABASE_SERVICE_ROLE_KEY` (backend only) |

If the API Keys page shows **Publishable** and **Secret** keys, open the
**Legacy API keys** tab. The code expects the `anon` and `service_role`
keys.

**The service_role key bypasses all security rules.** Never put it in the
frontend, never commit it, and never share it.

## Step 3: Turn on pg_cron

The contest migration schedules a job that starts contests on time. It
needs the `pg_cron` extension, which is off in a new project.

1. **Database → Extensions** (or **Integrations → Cron**).
2. Search for `pg_cron` and switch it **on**.

If you skip this, step 4 fails on the contest migration with
`schema "cron" does not exist`.

## Step 4: Run the migrations, in order

The SQL files are in [`database/supabase/migrations/`](../../database/supabase/migrations).
Run them one at a time in the **SQL Editor**:

1. Open **SQL Editor → New query**.
2. Open the file in VS Code, copy all of it, and paste it into the editor.
3. Click **Run**. It must end with `Success. No rows returned`.
4. Repeat with the next file.

| Order | File | Creates |
|---|---|---|
| 1 | `20260301_base_tables.sql` | `profiles`, `questly_quiz_attempts`, `admin_settings`, the `is_super_admin()` check, and their security rules |
| 2 | `20260310_live_contest_system.sql` | `contests`, `contest_participants`, `contest_answers`, `contest_results`, realtime for contests, the every-minute cron job |
| 3 | `20260313_battle_system.sql` | `quiz_battles`, `battle_answers`, `battle_results`, realtime for battles |
| 4 | `20260313_fix_participants_rls.sql` | Replaces a broken security rule on `contest_participants` |
| 5 | `20260707_add_profile_avatar_and_bio.sql` | Avatar, bio and settings columns on `profiles`, and the `avatars` storage bucket |

**The order matters.** File 2 uses `profiles`, which file 1 creates.

**Run each file once.**
- **Safe to run again:** files 1, 4 and 5.
- **Not safe:** files 2 and 3. A second run stops with `policy ... already exists`. That error means the file already ran; nothing is broken.

All five files were checked with PostgreSQL's own parser: every
statement is valid SQL.

## Step 5: Check what was created

**Tables.** Open **Table Editor**. You should see 11 tables:

```
profiles               questly_quiz_attempts   admin_settings
contests               contest_participants    contest_answers    contest_results
quiz_battles           battle_answers          battle_results
```

Each one shows **RLS enabled**.

**Realtime.** Open **Database → Publications → supabase_realtime**. These
six tables must be switched on: `contests`, `contest_participants`,
`contest_results`, `quiz_battles`, `battle_answers`, `battle_results`.

**Storage.** Open **Storage**. A public bucket called `avatars` must exist.

**Cron.** In the SQL Editor, run:

```sql
select jobname, schedule from cron.job;
```

It must show `auto-start-contests` with `* * * * *`.

## Step 6: Configure login

### 6.1 Email sign-in

**Authentication → Sign In / Providers → Email**: make sure it is
**enabled**.

| Setting | Choose | Effect |
|---|---|---|
| Confirm email **on** (default) | Safer | New users must click a link in an email before they can sign in. The link goes to the Site URL below. |
| Confirm email **off** | Easier for testing | Users can sign in straight after signing up. |

### 6.2 Allowed addresses

**Authentication → URL Configuration**:

| Field | Value |
|---|---|
| Site URL | `https://questly.kumardevops.online` (or `http://localhost:3000` if you only run it locally) |
| Redirect URLs | Add `http://localhost:3000/**` and `https://questly.kumardevops.online/**` |

If these are wrong, the confirmation email and the login redirect send
users to the wrong place, often `localhost`.

## Step 7: Put the values in the `.env` files

**backend/.env**

```
PORT=3001
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
GEMINI_API_KEY=<Gemini API key>
```

**frontend/.env**

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

| Where the app runs | What to do |
|---|---|
| Your laptop | Copy `backend/.env.example` and `frontend/.env.example` to `.env` and fill them in as above. |
| AWS | Follow [Jenkins 3](../04-jenkins/03-agent-workspace-and-env-files.md). The Supabase values are the same; only `NEXT_PUBLIC_API_BASE_URL` changes. |

## Step 8: Make yourself an admin

The admin pages (`/admin`) and the database's security rules both check
`profiles.role = 'super_admin'`.

1. Start the app and **sign up** with your own email.
2. Open the **dashboard** once. That creates your row in `profiles`.
3. In the Supabase **SQL Editor**, run this with your email:

   ```sql
   update profiles
   set    role = 'super_admin'
   where  id = (select id from auth.users where email = 'you@example.com');
   ```

4. It must say `Success. 1 row affected`. Reload the app; `/admin` now
   opens.

The admin layout also lets in one hard-coded email
(`frontend/app/admin/layout.tsx`). That only opens the pages. Saving
settings, changing roles or deleting users still needs the
`super_admin` role in the database.

## Step 9: Test it

| Do this in the app | Check in Supabase |
|---|---|
| Sign up | **Authentication → Users** shows the new user |
| Open the dashboard | **Table Editor → profiles** has a row with your email |
| Generate and finish a quiz | **questly_quiz_attempts** has a new row with your score |
| Upload a profile picture in Settings | **Storage → avatars** has a file in `avatars/<your user id>/` |
| Start a battle with a second account | **quiz_battles** has a row, and both screens update without reloading |

If the quiz finishes but no row appears, check the backend's log for
`[save-attempt] Insert error`. The service_role key or the Project URL in
`backend/.env` is usually wrong.

---

## Optional: the Edge Function

`database/supabase/functions/auto-start-contests/` holds a Supabase Edge
Function that switches contests from `published` to `live` when they are
due.

**You do not need it.** The cron job from step 4 already does the same
update in SQL every minute. Deploy it only if you prefer the function to
the SQL job. With the Supabase CLI, from the `database` folder:

```powershell
cd database
npx supabase login
npx supabase functions deploy auto-start-contests --project-ref <project-ref>
```

`<project-ref>` is the part before `.supabase.co` in the Project URL.
Supabase gives every function `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` automatically.

**Also not needed: `POST /api/quiz/init-db`.** That backend route adds
columns to `questly_quiz_attempts` through a database function,
`exec_sql`, that does not exist. The base migration in step 4 already
creates every column, so don't call this route.

---

## Checklist

| Check | Where |
|---|---|
| Project is in the Mumbai region | Project Settings → General |
| `pg_cron` is on | Database → Extensions |
| All 5 migrations ran | SQL Editor history, and the 11 tables in Table Editor |
| 6 tables publish realtime | Database → Publications → supabase_realtime |
| `avatars` bucket exists | Storage |
| `auto-start-contests` cron job exists | `select jobname from cron.job;` |
| Email sign-in enabled, Site URL and Redirect URLs set | Authentication |
| `.env` files filled in | `backend/.env`, `frontend/.env` |
| Your role is `super_admin` | Table Editor → profiles |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `schema "cron" does not exist` while running migration 2 | pg_cron is off. | Step 3, then run migration 2 again. |
| `relation "profiles" does not exist` while running migration 2 | Migration 1 was skipped. | Run `20260301_base_tables.sql` first. |
| `policy ... already exists` | The file already ran. | Nothing to fix. Go to the next file. |
| `Invalid API key` in the browser or the backend log | Wrong key, or a Publishable/Secret key was used. | Copy the `anon` / `service_role` keys again (step 2). |
| Sign-up works, sign-in says "Email not confirmed" | Confirm email is on. | Click the link in the email, or turn Confirm email off (step 6.1). |
| The confirmation email opens `localhost` | Site URL is still `http://localhost:3000`. | Step 6.2. |
| Quiz scores are not saved | The backend has no service_role key or the wrong URL. | Check `backend/.env`, then restart the backend or run the Jenkins job. |
| `/admin` opens but saving settings fails with `row-level security` | Your role is not `super_admin` in the database. | Step 8. |
| Battles or leaderboards do not update live | The tables are not in the realtime publication. | Step 5, Realtime. Switch them on. |
| The project stopped responding after a quiet week | Free projects pause after a period of no activity. | Dashboard → your project → **Restore**. |
