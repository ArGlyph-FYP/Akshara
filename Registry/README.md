# Akshara Registry

This web app manages data collection for the Akshara study in both branches, Sinhala (`SI-xxx`) and Tamil (`TA-xxx`).

| Who | What they do |
|---|---|
| **Admins** (research team) | Issue participant codes, record consent, upload scans (single or bulk), QC, set calibration anchors, edit the rubric, run the Phase A survey, invite raters, generate rating assignments, handle withdrawals, download the dataset |
| **Raters** (independent, per script) | Work through their own queue: overall score, legibility, per-criterion scores, weak-region boxes. They never see participant codes |
| **Survey readers** (Phase A) | Open a share link with no account needed, confirm they are 18+ and consent, then score pilot samples and give open-text reasons |

Stack: Next.js 15 (App Router) on **Vercel**, with **Firestore**, **Cloud Storage** and **Firebase Auth** (password or email link for staff, anonymous for survey readers).

## How access works

- Browsers only use Firebase Auth. After sign-in, the ID token is exchanged for an httpOnly `__session` cookie (`app/api/session`).
- **All** Firestore and Storage access happens on the server with the Admin SDK, after `lib/auth.ts` checks the session and the `users/{uid}` role. `firestore.rules` and `storage.rules` deny all client access.
- Scans are served only through `/api/image/[sampleId]`. That route allows admins, raters with an assignment for the sample, and readers of an open survey that includes it.
- Only people an admin has added (Team & raters page) can sign in as staff.

## Privacy, following the consent form

- The app stores **no names and no consent scans**, only the date consent was recorded and who recorded it. Paper consent forms stay locked away.
- Each participant gets a random `writerId`. **Public** exports contain writer IDs only, never `SI-`/`TA-` codes. Raters appear as aliases (`R03`) and survey readers as hashes (`rd_…`).
- Withdrawing a participant excludes their samples from rating and from all exports immediately. "Delete data" then permanently removes their scans, ratings and survey responses.

## Run locally (emulators, no real project needed)

You need Node 20+ and **JDK 21+** for the Firebase emulators.

```bash
cp .env.example .env.local      # already points at the emulators
npm install
npm run emulators               # terminal 1: auth, firestore, storage, UI on http://127.0.0.1:4000
npm run seed:demo               # terminal 2: demo users, criteria, fake scans, an open survey
npm run dev                     # http://localhost:3000
```

To sign in, enter `admin@akshara.test` (or `rater1.si@akshara.test`) on `/login`. The sign-in link is printed in the emulator terminal; open it in the same browser. The seed script prints the survey link.

## Deploy (Vercel + Firebase)

The app runs on **Vercel**. Firebase provides only Auth, Firestore and Storage (project `akshara-fyp`).

1. **Firebase console** (Blaze plan):
   - **Authentication → Sign-in method:** enable **Email/Password** (with **Email link**) and **Anonymous**.
   - **Authentication → Settings → Authorized domains:** add `registry.akshara.website` (and the `*.vercel.app` production URL).
   - Firestore (production mode) and Storage created.
2. **Rules:** `npx firebase deploy --only firestore:rules,firestore:indexes,storage`.
3. **Bucket CORS**, so browsers can upload scans straight to Storage: `npm run cors:prod` (add origins with `-- --origins https://a,https://b`).
4. **Vercel → New Project →** import the GitHub repo, set **Root Directory = `Registry`** (framework: Next.js), and add these environment variables (Production):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_STORAGE_BUCKET`, `…_APP_ID` | same values as in `.env.prod` |
   | `FIREBASE_SERVICE_ACCOUNT` | the service account JSON, one line |

   Leave all `*_EMULATOR_HOST` and `NEXT_PUBLIC_USE_EMULATORS` variables **unset**.
5. **Domain:** Vercel → Project → Settings → Domains → add `registry.akshara.website`, then at your DNS provider add a **CNAME** `registry` → `cname.vercel-dns.com` (or whatever value Vercel shows).
6. **First admin** (from your machine; real-project config and key live in the gitignored `.env.prod`):
   ```bash
   npm run set-admin:prod -- you@uom.lk --name "Your Name" --scripts si --password   # asks for the password, hidden
   ```

Because Vercel caps request and response bodies at about 4.5 MB, scans never pass through the server. Uploads go straight to Storage with signed PUT URLs, and `/api/image/*` checks access and then redirects to a 15-minute signed URL. Full image exports can exceed the function time limit, so use `npm run export:prod -- --out ../data/akshara` for those; label-only exports work fine on the Export page.

`npm run env:prod` / `npm run env:emulators` switch what a local `npm run dev` talks to.

## Typical workflow

1. **Participants:** issue codes (or register a pre-written code) and tick consent when a signed form comes back.
2. **Upload:** drop scans named `SI-001.jpg`, `TA-014_p2.png` and so on. Anything else can be matched by typing the code.
3. **Samples:** approve or reject each scan, and mark a few calibration anchors with reference scores.
4. **Survey (Phase A):** create a survey per script, tick pilot samples, open it and share the link. Download responses as CSV for thematic coding.
5. **Criteria:** enter the rubric that comes out of the survey coding. Changing it later? Start a new version, and old ratings stay linked to their version.
6. **Team & raters:** add raters with their script. They sign in with an emailed link, or set a password with "Forgot password?" on the login page. "Generate" gives a sign-in link you can send directly if the email doesn't arrive.
7. **Assignments:** set raters per sample and the repeat %, then **Generate**. Run it again after each upload batch; it only adds what's missing.
8. **Export:** one click gives the public dataset ZIP, or run `npm run export -- --out ../data/akshara` to write it to disk for training.

## Export layout

```
manifest.json          filters, counts, rubric versions, sha256 per image
samples.csv            sample_id, writer_id, script, phase, page_no, file, width, height, status, is_anchor
ratings.csv            one row per rating: rater alias, kind (normal | anchor | repeat), overall, legibility, duration
criterion_scores.csv   long format: rating_id × criterion_key → score
regions.json           COCO-style boxes (pixels) with criterion category, rater and note
criteria.json          rubric definitions, all versions
survey_responses.csv   (optional) reader hash, native_reader, score, liked / disliked text
images/                {sample_id}.jpg|png
```

Group cross-validation folds by `writer_id`. Use `kind=repeat` rows for intra-rater reliability. Leave `kind=anchor` out of training labels.

## Development

```bash
npm test            # unit tests: filename parsing, assignment planner, export privacy
npm run typecheck
npm run lint
npm run build
```

| Path | Purpose |
|---|---|
| `lib/assign.ts` | Assignment planner: anchors first, balanced coverage, blinded repeats |
| `lib/export.ts` | Dataset builder (pure functions, unit tested) |
| `lib/auth.ts`, `lib/data.ts` | Session and role checks, Firestore access |
| `app/admin/*` | Admin pages; each folder has its own `actions.ts` |
| `app/rate/*` | Rater queue and scoring screen |
| `app/survey/[token]` | Public Phase A survey |
