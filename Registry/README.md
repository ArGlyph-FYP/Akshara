# Akshara Registry

This web app manages data collection for the Akshara study in both branches, Sinhala (`SI-xxx`) and Tamil (`TA-xxx`).

| Who | What they do |
|---|---|
| **Admins** (research team) | Three sidebar tabs: **Dataset** (upload, check, browse with filters, writers & consent, export), **Survey** (perception and rubric studies built from dataset samples, assigned to raters manually or at random; rubric criteria) and **Raters** (create logins, copy credentials, reset passwords) |
| **Survey readers (public link)** | Open a study's public link, enter name, optional contact, age group and first-language answer, confirm 18+ and consent, then rate the samples the system hands them. No login; progress is kept on that device |
| **Raters (accounts)** | Sign in with the email + password an admin gave them and work through each assigned study: perception (score + reasons) or rubric (overall, legibility, criteria, weak-region boxes). They never see participant codes |

Stack: Next.js 15 (App Router) on **Vercel**, with **Firestore**, **Cloud Storage** and **Firebase Auth** (email + password; email link also works).

## How access works

- Browsers only use Firebase Auth. After sign-in, the ID token is exchanged for an httpOnly `__session` cookie (`app/api/session`).
- **All** Firestore and Storage access happens on the server with the Admin SDK, after `lib/auth.ts` checks the session and the `users/{uid}` role. `firestore.rules` and `storage.rules` deny all client access.
- Scans are served only through `/api/image/[sampleId]`. That route allows admins and raters who have the sample in one of their studies; in production it redirects to a 15-minute signed URL.
- Only people an admin has added (Team & raters page) can sign in as staff.

## Privacy, following the consent form

- The app stores **no names and no consent scans**, only the date consent was recorded and who recorded it. Paper consent forms stay locked away.
- Each participant gets a random `writerId`. **Public** exports contain writer IDs only, never `SI-`/`TA-` codes. Raters and survey readers appear only as aliases (`R03`).
- Withdrawing a participant excludes their samples from rating and from all exports immediately. "Delete data" then permanently removes their scans and every rating of them.

## Run locally (emulators, no real project needed)

You need Node 20+ and **JDK 21+** for the Firebase emulators.

```bash
cp .env.example .env.local      # already points at the emulators
npm install
npm run emulators               # terminal 1: auth, firestore, storage, UI on http://127.0.0.1:4000
npm run seed:demo               # terminal 2: demo users, criteria, fake scans, a perception and a rubric study
npm run dev                     # http://localhost:3000
```

Sign in on `/login` as `admin@akshara.test` (or `rater1.si@akshara.test`) with the password `Demo#2026`. Public survey links: `/join/demo-si` and `/join/demo-ta`.

## Deploy (Vercel + Firebase)

The app runs on **Vercel**. Firebase provides only Auth, Firestore and Storage (project `akshara-fyp`).

1. **Firebase console** (Blaze plan):
   - **Authentication → Sign-in method:** enable **Email/Password** (Email link optional) and **Anonymous** (used by public survey links).
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

1. **Dataset → Writers:** issue codes (or add a pre-written code) and mark consent when a signed form comes back.
2. **Dataset → Upload scans:** drop files named `SI-001.jpg`, `TA-014_p2.png`… (others: type the code). A thumbnail is made in the browser.
3. **Dataset:** click a scan to check it (approve / reject) or make it a calibration anchor. Filter by *not rated / in progress / fully rated*, phase, check status or study.
4. **Raters → Create rater:** name, email, script(s); copy the generated login details and send them yourself.
5. **Survey → New study** (or select scans in Dataset → *Use in survey*):
   - *Perception* (Phase A): pick 10–15 pilot samples and choose **Public link**. Share the link (one per study, so one for Sinhala and one for Tamil); everyone who opens it gives their details and rates. By default each reader rates all samples, so every sample gets many readers; set "samples per reader" to hand out the least-rated samples first instead.
   - *Rubric* (Phase C): needs criteria (Survey → Rubric criteria); usually approved main samples, random N raters per sample with blinded repeats.
6. **Study page:** progress by rater and by sample, add or remove a rater on a sample, *Assign* again after adding samples or raters, read responses, download CSV, close the study.
7. **Dataset → Export:** labels-only or public ZIP; for the full image set run `npm run export:prod -- --out ../data/akshara`.

## Export layout

```
manifest.json          filters, counts, rubric versions, sha256 per image
samples.csv            sample_id, writer_id, script, phase, page_no, file, width, height, status, is_anchor
ratings.csv            one row per rubric rating: study, rater alias, kind (normal | anchor | repeat), overall, legibility, duration
criterion_scores.csv   long format: rating_id × criterion_key → score
regions.json           COCO-style boxes (pixels) with criterion category, rater and note
criteria.json          rubric definitions, all versions
perception_responses.csv  (optional) study, sample, rater alias, score, liked / disliked text
studies.json           every study: type, scales, rubric version
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
| `app/admin/dataset`, `app/admin/survey`, `app/admin/raters` | The three admin tabs and their server actions |
| `components/admin/SampleBrowser.tsx` | Shared filter bar + infinite-scroll sample grid (Dataset and study picker) |
| `app/rate/*` | Rater home, perception form, rubric form |
| `app/join/[token]`, `app/api/public-join` | Public survey sign-up; `lib/assign.ts → planForNewReader` hands out least-covered samples |
