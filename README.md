# The Saviour — Private Two-Person Chat PWA 🛡️

**The Saviour** is a complete, private, mobile-first Progressive Web App (PWA) created exclusively for **two authorized souls**. It combines real-time messaging, secure photo sharing with short-lived signed URLs, shared memories, mood check-ins, couple mini-games, and privacy-conscious relationship metrics.

Zero third parties can read messages or access photos. The application is built entirely on **100% Free Tiers**: **Supabase Free** (Database, Auth, Realtime, Storage) and **Cloudflare Pages Free** (Global CDN Hosting). No credit card or paid subscription is required.

---

## 📱 Features Summary

1. **Strict 2-User Access Control:** 
   - No public signup page.
   - Enforced by PostgreSQL **Row Level Security (RLS)**.
   - Any unauthorized user who registers or tries to log in is immediately blocked at the database level.
2. **Real-time Messaging:**
   - Instant live delivery using Supabase Realtime channels.
   - Sent, delivered, and read status tracking.
   - Live partner typing indicator and online presence.
   - Emoji reactions (❤️, 😂, 🥺, 🔥, 👏, 🎉) with live reaction counters.
   - Soft-delete own messages with clear policy ("This message was deleted").
   - Live search messages filter.
   - Reply-to message preview banner.
   - Clean date separators (Today, Yesterday, Date).
3. **Private Photo Sharing:**
   - Uploads to a strictly **private Supabase Storage bucket** (`chat-photos`).
   - Client-side automatic canvas compression and resizing before upload (saving storage and staying well within free tier limits).
   - Temporary short-lived signed URLs (1-hour expiration) generated securely for viewing.
   - Fullscreen tap lightbox with download capability.
4. **9 Free Built-in Virtual Gifts:**
   - Chai ☕, Pizza 🍕, Teddy bear 🧸, Rose 🌹, Chocolate 🍫, Crown 👑, Panda 🐼, Cake 🎂, Drama Queen trophy 🏆.
   - Styled chat cards with sender name and romantic/fun messages.
5. **Mood Sanctuary:**
   - 10 expressive moods (Loving 🥰, Happy 😊, Chill 😎, Excited 🥳, Dramatic 🎭, Overthinking 🤯, Sleepy 🥱, Tired 😴, Sad 🥺, Angry 😤).
   - Display partner's latest mood badge on header.
   - Private mood history log with delete options.
6. **Daily Question of the Day (QOTD):**
   - 30 curated deep questions.
   - Dual-answer system: Partner answers are locked until both have answered (with instant peek toggle).
   - Past question archive and "Save QA to Memories" button.
7. **Daily Mystery Card:**
   - Curated daily cards: Jokes, compliments, conversation starters, challenges, quizzes, fun facts.
   - 3D interactive flip card animation.
   - Mark completed and save to memories.
8. **5 Interactive Couple Mini-Games:**
   - **Who Knows Whom Better?** (5-round preference quiz)
   - **This or That** (8-round rapid-fire vibe match)
   - **Guess My Answer** (Secret lock & reveal guessing game)
   - **Emoji Riddles** (Decode movies and phrases from emojis)
   - **Truth or Silly Dare** (Playful prompts and dares)
9. **Statistics Dashboard & Milestones:**
   - Real calculated metrics: Total messages, messages by sender (Donut chart), photos shared, reactions count, active days, busiest hour of day, busiest day of week, current & longest chat streaks.
   - Time filters: All time, Last 30 days, Last 7 days.
   - Milestones & Achievements (First Message, Century Club, 500 Messages, Photo Collector, Quiz Master, 7-Day Streak).
   - **Chat Wrapped:** Celebratory annual/monthly recap card.
   - Relationship health reminder: *Message volume is not a measure of relationship quality.*
10. **Shared Memories Archive:**
    - Timeline of cherished messages, photos, Q&As, gifts, and custom written notes.
    - Filter by content type, real-time search, and deletion.
11. **Special-Day Countdowns:**
    - Custom event creation: Anniversaries, birthdays, vacations, milestones.
    - Live countdown ticker (Days, Hours, Minutes remaining).
12. **Installable PWA (Progressive Web App):**
    - Installable on iPhone, Android, and Desktop without an app store.
    - Offline awareness banner.
    - Safe static asset caching only (strictly zero caching of private API tokens or photos).

---

## 🛠️ Step-by-Step Setup Guide

Follow these simple steps to deploy and run **The Saviour** for free.

### Step 1: Install Node.js
If you do not already have Node.js installed:
- Download and install Node.js (v18.0.0 or later) from [nodejs.org](https://nodejs.org/).
- Verify in your terminal:
  ```bash
  node -v
  npm -v
  ```

### Step 2: Install Project Dependencies
In the root project directory (`the-saviour`), run:
```bash
npm install
```

---

### Step 3: Create a Free Supabase Project
1. Go to [supabase.com](https://supabase.com/) and sign up or log in.
2. Click **New Project**.
3. Choose an organization, enter a project name (e.g. `the-saviour-db`), set a strong database password, and choose the closest region to you.
4. Select the **Free Tier** ($0/month).
5. Click **Create new project** and wait ~2 minutes for it to provision.

---

### Step 4: Configure Project Credentials (.env)
1. In your Supabase Dashboard, go to **Project Settings** (gear icon) → **API**.
2. Copy the following two values:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **anon / public key** (starts with `eyJhbGciOi...`)
3. In the root of this project, create a file named `.env`:
   ```bash
   cp .env.example .env
   ```
4. Paste your values into `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ...
   ```
> ⚠️ **CRITICAL SECURITY RULE:** Never paste your `service_role` secret key into `.env` or any frontend file. Only the public `anon` key belongs in client code. Row Level Security protects your database.

---

### Step 5: Run Database Schema Migrations & Seed Data
1. In your Supabase Dashboard, click on **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Open [`supabase/migrations/20261025000000_the_saviour_schema.sql`](file:///d:/the-saviour/supabase/migrations/20261025000000_the_saviour_schema.sql), copy its entire contents, paste it into the SQL Editor, and click **Run**.
4. Open [`supabase/seed.sql`](file:///d:/the-saviour/supabase/seed.sql), copy its entire contents, paste it into the SQL Editor, and click **Run**.

---

### Step 6: Authorize the Two Accounts
Because The Saviour enforces strict two-user access control, public registration is blocked. You must register the two allowed email addresses in the whitelist.

In the **SQL Editor**, run this query replacing with your two exact emails:
```sql
INSERT INTO public.authorized_users (email, notes) VALUES
  ('person1@example.com', 'Person One'),
  ('person2@example.com', 'Person Two');
```

Then create their logins in Supabase Auth:
1. In the Supabase Dashboard, go to **Authentication** → **Users**.
2. Click **Add User** → **Create User**.
3. Enter `person1@example.com` and set a password. Uncheck "Auto Confirm User" or leave it checked so they can log in immediately without email confirmation.
4. Repeat for `person2@example.com`.

*(Alternatively, users can sign up using Supabase Auth, but only if their email exists in `authorized_users` beforehand. Any other email is rejected automatically by the database trigger!)*

---

### Step 7: Verify Private Storage Bucket
The SQL migration automatically creates a private bucket named `chat-photos`. To verify:
1. In the Supabase Dashboard, go to **Storage**.
2. Check that the `chat-photos` bucket is visible.
3. Verify that **Public bucket** is **OFF** (Private).
4. Under **Policies**, verify that the 3 policies are active:
   - "Authorized users can read chat photos"
   - "Authorized users can upload chat photos"
   - "Users can delete their own chat photos"

---

### Step 8: Start the Local Development Server
Run:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Step 9: Test with Two Separate Browser Sessions
To test real-time chat between both users on one computer:
1. Open [http://localhost:3000](http://localhost:3000) in a standard Chrome window and log in as `person1@example.com`.
2. Open [http://localhost:3000](http://localhost:3000) in an **Incognito / Private Window** (or another browser like Firefox/Edge) and log in as `person2@example.com`.
3. Test the following:
   - Type a message in window 1: Notice the instant typing dots in window 2.
   - Send the message: Check that it appears instantly in window 2 with a chime.
   - Add a reaction (❤️): See the reaction pill increment live.
   - Upload a photo: Verify preview, compression, upload, and tap to zoom in Lightbox.
   - Send a Virtual Gift (Chai / Pizza): Check that the styled card renders cleanly.
   - Check in with a mood: Check that partner's mood badge appears in the header.
   - Answer the Daily Question in both windows: Verify the reveal unlocks.

---

### Step 10: Deploy to Cloudflare Pages (Free Tier)
Deploy your PWA globally with zero hosting costs:

#### Method A: Git Integration (Recommended)
1. Push your repository to your private GitHub or GitLab account.
2. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Workers & Pages**.
3. Click **Create application** → **Pages** → **Connect to Git**.
4. Select your `the-saviour` repository.
5. In the build settings:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
6. Under **Environment variables**, add:
   - `VITE_SUPABASE_URL` = `https://your-project-ref.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your_anon_key_here`
7. Click **Save and Deploy**. Cloudflare will build and give you a free `*.pages.dev` HTTPS URL!

#### Method B: Direct Upload via Wrangler CLI
```bash
npm run build
npx wrangler pages deploy dist --project-name the-saviour
```

---

### Step 11: Install the PWA on Mobile Devices

#### iPhone / iPad (Safari)
1. Open your deployed Cloudflare Pages URL in **Safari** (e.g. `https://the-saviour.pages.dev`).
2. Tap the **Share** button (box with upward arrow at the bottom of Safari).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. The Saviour icon now opens full-screen without Safari browser bars!

#### Android (Chrome)
1. Open the URL in **Google Chrome**.
2. Tap the banner at the top or bottom of the screen: **Install The Saviour**.
3. Or tap the **Three dots menu** (top right) → **Install app** / **Add to Home screen**.

#### Mac / Windows / Chromebook (Chrome / Edge)
1. Click the **Install** button located inside the address bar (computer monitor with downward arrow icon).
2. The Saviour opens as a standalone desktop window.

---

### Step 12: Free-Tier Quota Monitoring
Both Supabase and Cloudflare Pages offer very generous permanent free tiers:

| Resource | Free Tier Limit | Optimization in The Saviour |
| :--- | :--- | :--- |
| **Cloudflare Pages Bandwidth** | **Unlimited** requests/bandwidth | Static shell cached via Service Worker |
| **Supabase Database Storage** | **500 MB** | Messages and metadata consume < 50 MB for hundreds of thousands of messages |
| **Supabase File Storage** | **1 GB** free | Auto client-side compression reduces photos from ~4MB to ~250KB each |
| **Supabase Realtime** | **200 concurrent connections** | Only 2 active users, consumes < 1% of quota |
| **Supabase Monthly Active Users** | **50,000 MAU** | Exactly 2 users |

---

## 🔒 Security Architecture Details

1. **Row Level Security (RLS) on PostgreSQL:**
   Every single table (`messages`, `profiles`, `moods`, `daily_answers`, `games`, `memories`, `special_events`) has RLS enabled with security definer functions checking:
   ```sql
   public.is_authorized()
   ```
   Even if a third party obtains the public Anon Key, any attempt to read or insert data without being one of the two authorized emails is rejected with `403 Forbidden` by PostgreSQL.
2. **Private Storage Protection:**
   The `chat-photos` bucket is marked `public = false`. File access requires an authenticated session and generates a cryptographically signed HMAC token that expires in 60 minutes.
3. **No Service Role Keys in Frontend:**
   The privileged administrative service-role key is never used in client code or environment variables.

---

## ❓ Troubleshooting Common Issues

- **"Access Restricted: This private sanctuary is restricted to 2 authorized accounts":**
  Ensure your email was added to the `authorized_users` table in Supabase via Step 6.
- **Photos fail to upload:**
  Make sure the `chat-photos` bucket was created in Step 7, and that the image format is JPEG, PNG, or WebP under 5 MB.
- **Realtime messages not appearing without refresh:**
  Verify that the `supabase_realtime` publication includes the `messages` table (executed in migration Step 5). In the Supabase Dashboard, check **Database** → **Replication** → ensure `messages` has Realtime turned on.
- **Push notification permissions:**
  Web notifications require HTTPS (which Cloudflare Pages provides automatically).

---

## 📜 License
Private personal project. MIT License.
