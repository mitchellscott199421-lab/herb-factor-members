const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const { photos, byId } = require('./gallery');

const ROOT = __dirname;
const MEDIA_DIR = path.join(ROOT, 'private', 'media');
const GALLERY_FILE = /^photo-(0[1-9]|1[0-3])\.jpg$/;

for (const photo of photos) {
  const webFile = path.join(MEDIA_DIR, 'gallery', 'web', `photo-${photo.id}.jpg`);
  const thumbFile = path.join(MEDIA_DIR, 'gallery', 'thumbs', `photo-${photo.id}.jpg`);
  if (!fs.existsSync(webFile) || !fs.existsSync(thumbFile)) {
    console.error(`Missing optimised gallery file for photo-${photo.id}.jpg. Run npm run optimize-gallery.`);
    process.exit(1);
  }
}
const DEFAULT_SIGNUP_URL = 'https://ultimate-driver-form.onrender.com';

const MEDIA = new Set([
  'logo.png',
  'team.jpg',
  'prizemoney.jpg',
  'sponsor-alabar.jpg',
  'sponsor-betfair.png',
  'sponsor-ballarat.png',
]);

function requiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    console.error(`Missing ${name}. Copy .env.example to .env and set it before starting.`);
    process.exit(1);
  }
  return value;
}

const sessionSecret = requiredEnv('SESSION_SECRET');
requiredEnv('MEMBER_USERNAME');
requiredEnv('MEMBER_PASSWORD');

if (sessionSecret.length < 16) {
  console.error('SESSION_SECRET must be at least 16 characters.');
  process.exit(1);
}

function safeEqual(left, right) {
  const a = crypto.createHash('sha256').update(String(left), 'utf8').digest();
  const b = crypto.createHash('sha256').update(String(right), 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

function signupUrl() {
  const raw = process.env.SIGNUP_URL;
  const value = raw === undefined ? DEFAULT_SIGNUP_URL : raw.trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
  } catch {
    return '';
  }
  return value;
}

function ensureCsrf(req) {
  if (!req.session.csrf) {
    req.session.csrf = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrf;
}

const attempts = new Map();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_LIMIT = 8;

function recentAttempts(ip) {
  const now = Date.now();
  const kept = (attempts.get(ip) || []).filter((at) => now - at < ATTEMPT_WINDOW_MS);
  if (kept.length) attempts.set(ip, kept);
  else attempts.delete(ip);
  return kept;
}

function recordFailure(ip) {
  const kept = recentAttempts(ip);
  kept.push(Date.now());
  attempts.set(ip, kept);
}

function cookieClearOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));
app.set('view cache', process.env.NODE_ENV === 'production');
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
  );
  next();
});

app.get('/healthz', (req, res) => {
  res.status(200).type('text/plain').send('ok');
});

app.use('/css', express.static(path.join(ROOT, 'public', 'css'), { maxAge: '1h', index: false }));
app.use('/js', express.static(path.join(ROOT, 'public', 'js'), { maxAge: '1h', index: false }));
app.use('/fonts', express.static(path.join(ROOT, 'public', 'fonts'), { maxAge: '7d', index: false }));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

app.get('/favicon.ico', (req, res) => {
  res.redirect(302, '/media/logo.png');
});

app.get('/media/logo.png', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile('logo.png', { root: MEDIA_DIR, dotfiles: 'deny' });
});

app.use(express.urlencoded({ extended: false, limit: '20kb' }));

app.use(
  session({
    name: 'thf.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.redirect('/login');
}

function renderLogin(req, res, { error = null, status = 200, username = '' } = {}) {
  res.status(status).render('login', {
    error,
    csrf: ensureCsrf(req),
    username,
  });
}

app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/');
  renderLogin(req, res);
});

app.post('/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (recentAttempts(ip).length >= ATTEMPT_LIMIT) {
    return renderLogin(req, res, {
      error: 'Too many attempts. Please wait a few minutes and try again.',
      status: 429,
    });
  }

  const sent = typeof req.body._csrf === 'string' ? req.body._csrf : '';
  const expected = req.session && req.session.csrf ? req.session.csrf : '';
  if (!expected || !safeEqual(sent, expected)) {
    return renderLogin(req, res, { error: 'Please try again.', status: 403 });
  }

  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (username.length > 200 || password.length > 200) {
    recordFailure(ip);
    return renderLogin(req, res, {
      error: 'Username or password is incorrect.',
      status: 401,
      username,
    });
  }

  const userOk = safeEqual(username, process.env.MEMBER_USERNAME);
  const passOk = safeEqual(password, process.env.MEMBER_PASSWORD);
  if (!userOk || !passOk) {
    recordFailure(ip);
    return renderLogin(req, res, {
      error: 'Username or password is incorrect.',
      status: 401,
      username,
    });
  }

  attempts.delete(ip);
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).type('text/plain').send('Something went wrong. Please try again.');
    }
    req.session.authenticated = true;
    req.session.csrf = crypto.randomBytes(32).toString('hex');
    req.session.save(() => {
      res.redirect('/');
    });
  });
});

app.post('/logout', (req, res) => {
  const sent = typeof req.body._csrf === 'string' ? req.body._csrf : '';
  const expected = req.session && req.session.csrf ? req.session.csrf : '';
  if (!expected || !safeEqual(sent, expected)) {
    return res.status(403).type('text/plain').send('Forbidden');
  }
  req.session.destroy(() => {
    res.clearCookie('thf.sid', cookieClearOptions());
    res.redirect('/login');
  });
});

app.get('/media/gallery/:variant/:file', (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).end();
  }
  const variant = req.params.variant;
  const file = req.params.file;
  if ((variant !== 'web' && variant !== 'thumbs') || !GALLERY_FILE.test(file)) {
    return res.status(404).end();
  }
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(file, { root: path.join(MEDIA_DIR, 'gallery', variant), dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

app.get('/media/:name', (req, res) => {
  const name = req.params.name;
  if (!req.session || !req.session.authenticated) {
    return res.status(401).end();
  }
  if (name !== path.basename(name) || !MEDIA.has(name) || name === 'logo.png') {
    return res.status(404).end();
  }
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(name, { root: MEDIA_DIR, dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

app.get('/', requireAuth, (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.render('home', {
    csrf: ensureCsrf(req),
    signupUrl: signupUrl(),
    photos,
    byId,
  });
});

app.use((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(404).type('text/plain').send('Not found');
  }
  if (!req.session || !req.session.authenticated) {
    return res.redirect('/login');
  }
  res.status(404).type('text/plain').send('Page not found');
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`The Herb Factor members site listening on port ${port}`);
  });
}

module.exports = app;
