# The Herb Factor — UDC 2027 members site

Password-protected information site for The Herb Factor slot members. It covers the Ultimate Driver Championship 2027.

About 100 people share one login. The site is a single mobile-first page: intro, concept, cost and sign up, prizemoney, key dates, accommodation, sponsors, a gallery of the 2026 win, and contact. There is no database.

## Run locally

Node.js 22.

```bash
cp .env.example .env
# Edit MEMBER_USERNAME, MEMBER_PASSWORD and SESSION_SECRET
npm install
npm start
```

Open http://localhost:3000 and sign in. `npm test` checks login, logout and that member pages stay closed without a session.

Leave `NODE_ENV` unset, or set it to `development`, on your own machine. `NODE_ENV=production` marks the session cookie Secure, so a local `http://` login will not stick.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MEMBER_USERNAME` | Yes | Shared members username. Matched exactly, apart from spaces trimmed around it. |
| `MEMBER_PASSWORD` | Yes | Shared members password. Matched exactly. |
| `SESSION_SECRET` | Yes | Signs the session cookie. At least 16 characters, longer is better. |
| `SIGNUP_URL` | No | Where **Register now** goes. If the variable is unset, it defaults to `https://ultimate-driver-form.onrender.com`. If it is set but empty, the cost section shows “Link coming soon. I'll share this link when it's available.” |
| `PORT` | No | Port to listen on. Render sets this. Local default is `3000`. |
| `NODE_ENV` | No | Set to `production` on Render so the cookie is Secure and the app trusts the Render proxy. |

The session cookie is `thf.sid`: HttpOnly, SameSite=Lax, and Secure in production. It lasts 30 days and is extended while the member is using the site. Logging out destroys it.

## What is public

- `GET /login` and `POST /login`
- `POST /logout` (needs the session token from the page)
- `GET /healthz` returns `200` and `ok`, with no login and no session cookie
- Styles, fonts and the logo (the landing page shows the logo)
- `GET /robots.txt` asks crawlers not to index the site

Every other page, and the team photo, prizemoney graphic, sponsor logos and UDC 2026 gallery photos, require the members session. Gallery originals in `private/media/gallery/` are not served. The site uses the resized files from `npm run optimize-gallery`: longest edge 1600px in `web/`, and 600px in `thumbs/`. That script needs the `sharp` dev dependency, which production does not install. A wrong username or password returns the same message either way. Eight failures from the same address within 15 minutes are paused.

## Deploy on Render (free Web Service)

The repo includes `render.yaml`.

1. Push this repository to GitHub.
2. In Render, choose **New** → **Blueprint** and select the repo. Render reads `render.yaml` and creates a free Node web service in Singapore (closest region to Brisbane). You can change the region before you apply the blueprint.
3. When prompted, set `MEMBER_USERNAME` and `MEMBER_PASSWORD`. Leave them as something you are happy to share with the slot members, not a personal password.
4. `SESSION_SECRET` is generated for you. `SIGNUP_URL` is prefilled. `NODE_ENV` is `production`.
5. Deploy. The start command is `npm start`. Render’s health check calls `/healthz`.

Or create a **Web Service** by hand with the same settings: runtime Node, build command `npm install`, start command `npm start`, health check path `/healthz`, plan Free.

Free instances sleep after a period with no traffic. The first visit after that takes a few seconds, and everyone will need to log in again because sessions are kept in memory on that one instance. That is fine for this group. Do not scale beyond one instance unless you add a shared session store — a second instance would not recognise the cookie.

To show “Link coming soon” instead of the register button, set `SIGNUP_URL` to an empty value and redeploy.

## Content

Copy follows the members’ briefing deck. Dates are unchanged, including draft day on Wednesday 17th February. Obvious typos are corrected: accommodation, concept, “minute”, “per member”, “may be”, and Ballarat (the club’s name, as on its logo).

Barlow Condensed and Source Sans 3 are self-hosted under the SIL Open Font License (`public/fonts/OFL.txt`).
