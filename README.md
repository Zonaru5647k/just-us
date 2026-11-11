# Just Us

Private chat for Shima and Tima. The site runs on GitHub Pages, messages and media live in Supabase, and only your two accounts can read anything.

## Folder layout

```
site/          the app (index.html, app.js, content.js, styles.css, config.js)
stickers/      your sticker images, one subfolder per tab (stickers/Spicy/hot.gif)
positions/     your position card files (he.txt, she (1).txt, ...)
supabase/      schema.sql, run once
scripts/       used by the GitHub Actions, you don't run these
.github/       the two Actions: deploy site, sync positions
```

## Setup (about 20 minutes, once)

### 1. Supabase

1. Create a free project at supabase.com.
2. **Authentication > Sign In / Providers**: turn **off** "Allow new users to sign up".
3. **Authentication > Users > Add user > Create new user**: make one account for Shima and one for Tima (email + password, tick "Auto confirm"). Copy both user IDs.
4. **SQL Editor**: paste all of `supabase/schema.sql` and run it.
5. Still in SQL Editor, run this with your real IDs:
   ```sql
   insert into public.members (user_id, name) values
     ('SHIMA-USER-ID', 'shima'),
     ('TIMA-USER-ID',  'tima');
   ```
6. **Project Settings > API Keys**: copy the **Project URL**, the **Publishable key** (or legacy `anon` key) and the **Secret key** (or legacy `service_role` key).

### 2. Config

Open `site/config.js` and paste the Project URL and the **Publishable** key.
Never put the Secret key in any file.

### 3. GitHub

1. Create a **private** repo and upload everything in this folder (keep the `.github` folder).
   Pages on a private repo needs GitHub Pro, which is free with the GitHub Student Developer Pack (apply with your university email).
2. **Settings > Pages > Source**: choose **GitHub Actions**.
3. **Settings > Secrets and variables > Actions > New repository secret**, add two:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_SECRET_KEY` = your Secret key
4. Go to **Actions**, run **Deploy site** once (or push any change). Your link appears in the run summary.

### 4. First open

Each of you opens the link, signs in with your own email and password once, then picks a 4-digit PIN for that device. After that it only asks for the PIN.

## Day to day

**Stickers**: drop PNG, WEBP, JPG or GIF files into `stickers/<Tab name>/`. Each folder becomes a tab. Keep GIFs under about 3 MB. Sticker files are reachable by anyone who knows the exact URL, so nothing private in there.

**Positions**: upload `.txt` files to `positions/`. The **Sync positions** Action puts them into Supabase within a minute. They are never published on the website itself.
- `he.txt`, `he (1).txt`, `he 2.txt` ... only Shima sees these
- `she.txt`, `she (1).txt`, `she2.txt` ... only Tima sees these
- any other name: both see them
- Each line in quotes becomes a card. The short heading line above it becomes the card title. A file with no quotes: every line is a card, titled after the file.
- Deleting or editing a file and pushing again replaces all repo cards.

**Built-in lines and games**: edit `site/content.js`.

## Good to know

- **Panic button**: shows a working calculator. Type your PIN and press `=` to get back.
- **Auto-lock**: leaving the app for over a minute asks for the PIN again.
- **Disappearing messages**: the timer starts when sent. Expired messages and their files are deleted by whichever of you has the app open. If neither opens it, they get deleted the next time one of you does.
- **View once**: hold to view. On release the file is deleted from storage for good.
- **Delete for both**: tap any message. Deletes the row and the file.
- **Screenshots** can't be blocked on a website.
- **Free Supabase projects pause after a week with no activity.** If that happens, open the Supabase dashboard and click Restore.
- **Forgot PIN**: tap "Forgot PIN? Sign out" and sign in again with your password.
