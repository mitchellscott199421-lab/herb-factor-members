const assert = require('assert');
const { after, before, describe, test } = require('node:test');

process.env.MEMBER_USERNAME = 'slotmember';
process.env.MEMBER_PASSWORD = 'correct-horse-battery';
process.env.SESSION_SECRET = 'test-secret-test-secret';
process.env.SIGNUP_URL = 'https://ultimate-driver-form.onrender.com';
process.env.NODE_ENV = 'test';

const app = require('../server');

let server;
let base;

function cookieHeader(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return raw.map((item) => item.split(';')[0]).join('; ');
}

async function loginPage() {
  const res = await fetch(`${base}/login`, { redirect: 'manual' });
  const html = await res.text();
  const token = html.match(/name="_csrf" value="([^"]+)"/);
  assert.ok(token, 'login form should include a csrf token');
  return { cookie: cookieHeader(res), token: token[1], html, status: res.status };
}

async function postLogin(cookie, token, username, password) {
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      cookie,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ _csrf: token, username, password }),
  });
  return res;
}

describe('members site', { concurrency: 1 }, () => {
  before(async () => {
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('health check is public', async () => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'ok');
    assert.match(res.headers.get('content-security-policy') || '', /object-src 'none'/);
    const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    assert.equal(cookies.length, 0);
  });

  test('pages and member images require login', async () => {
    const home = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(home.status, 302);
    assert.equal(home.headers.get('location'), '/login');

    const hidden = await fetch(`${base}/somewhere`, { redirect: 'manual' });
    assert.equal(hidden.status, 302);
    assert.equal(hidden.headers.get('location'), '/login');

    const photo = await fetch(`${base}/media/team.jpg`, { redirect: 'manual' });
    assert.equal(photo.status, 401);

    const prize = await fetch(`${base}/media/prizemoney.jpg`);
    assert.equal(prize.status, 401);

    const sponsor = await fetch(`${base}/media/sponsor-betfair.png`);
    assert.equal(sponsor.status, 401);

    const logo = await fetch(`${base}/media/logo.png`);
    assert.equal(logo.status, 200);
    assert.match(logo.headers.get('content-type'), /image\/png/);
  });

  test('wrong password is rejected and does not open the site', async () => {
    const page = await loginPage();
    assert.equal(page.html.includes('Racing Queensland'), false);
    assert.equal(page.html.includes('Albion Park'), false);
    assert.match(page.html, /Ultimate Driver Championship/);
    const res = await postLogin(page.cookie, page.token, 'slotmember', 'nope');
    assert.equal(res.status, 401);
    const html = await res.text();
    assert.match(html, /Username or password is incorrect/);
    const home = await fetch(`${base}/`, {
      redirect: 'manual',
      headers: { cookie: page.cookie },
    });
    assert.equal(home.status, 302);
  });

  test('the shared login opens every section and then logout closes it', async () => {
    const page = await loginPage();
    const res = await postLogin(page.cookie, page.token, 'slotmember', 'correct-horse-battery');
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/');
    const session = cookieHeader(res);
    assert.match(session, /thf\.sid=/);

    const home = await fetch(`${base}/`, { headers: { cookie: session } });
    assert.equal(home.status, 200);
    const html = await home.text();

    for (const heading of [
      'Intro',
      'Concept',
      'Cost &amp; sign up',
      'Prizemoney',
      'Key dates / functions',
      'Accommodation',
      'Sponsors',
      'Gallery',
      'UDC 2026',
      'Contact',
    ]) {
      assert.ok(html.includes(heading), `missing section ${heading}`);
    }

    for (const phrase of [
      'Hi Everyone',
      'back-to-back UDC titles in February 2027',
      'Ryan Spice',
      'Ryan, James and a select team',
      '100',
      'Slot members',
      '$500 per member',
      'Home Straight Bistro Sportsmans Function',
      '2 x Race Nights',
      '$330',
      '$70',
      'Race night marquees',
      'Payments will be due at the start of December',
      'digital process instead of manual forms',
      'Register now',
      'https://ultimate-driver-form.onrender.com',
      '$20k + $1k per win',
      '$12.5k + $1k per win',
      '$10.5k + $1k per win',
      '$7.5k + $1k per win',
      '$5k',
      '$550',
      '$320',
      'Wednesday 17th February',
      'Thursday 18th February',
      'Friday 19th February',
      'Saturday 20th February',
      'Sunday 21st February',
      'Rum Bar at the Brekky Creek',
      'Quest Breakfast Creek',
      'Portside Hamilton',
      '5 minute',
      'may be close to full already',
      'Ballarat &amp; District Trotting Club',
      '0410 720 483',
      'tel:+61410720483',
      'ryanspice@optusnet.com.au',
      'Buderim QLD 4556',
      'Log out',
    ]) {
      assert.ok(html.includes(phrase), `missing copy: ${phrase}`);
    }

    assert.equal(html.includes('minunte'), false);
    assert.equal(html.includes('ACCOMODATION'), false);
    assert.equal(html.includes('CONEPT'), false);
    assert.equal(html.includes('per members'), false);
    assert.equal(/\bBallart\b/.test(html), false);
    assert.equal(html.includes('Racing Queensland'), false);
    assert.equal(html.includes('Ryan &amp; James'), false);
    assert.equal(html.includes('2025'), false);
    assert.equal(html.includes('Albion Park, Brisbane'), false);
    assert.deepEqual(html.match(/Albion Park/g), [
      'Albion Park',
      'Albion Park',
    ]);
    assert.ok(html.includes('Albion Park Harness Racing Club'));
    assert.ok(html.includes('uber to Albion Park'));
    assert.equal(html.includes('<figcaption'), false);

    const photo = await fetch(`${base}/media/team.jpg`, { headers: { cookie: session } });
    assert.equal(photo.status, 200);
    assert.match(photo.headers.get('content-type'), /image\/jpeg/);

    const token = html.match(/name="_csrf" value="([^"]+)"/)[1];
    const out = await fetch(`${base}/logout`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        cookie: session,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ _csrf: token }),
    });
    assert.equal(out.status, 302);
    assert.equal(out.headers.get('location'), '/login');

    const again = await fetch(`${base}/`, {
      redirect: 'manual',
      headers: { cookie: session },
    });
    assert.equal(again.status, 302);
  });

  test('an empty sign-up URL shows the coming soon wording', async () => {
    process.env.SIGNUP_URL = '';
    try {
      const page = await loginPage();
      const res = await postLogin(page.cookie, page.token, 'slotmember', 'correct-horse-battery');
      const session = cookieHeader(res);
      const home = await fetch(`${base}/`, { headers: { cookie: session } });
      const html = await home.text();
      assert.match(html, /Link coming soon/);
      assert.match(html, /I'll share this link when it's available/);
      assert.equal(html.includes('Racing Queensland'), false);
      assert.equal(html.includes('Register now'), false);
      assert.equal(html.includes('ultimate-driver-form.onrender.com'), false);
    } finally {
      process.env.SIGNUP_URL = 'https://ultimate-driver-form.onrender.com';
    }
  });

  test('gallery photos stay behind the login and are on the page', async () => {
    const ids = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'];

    for (const id of ids) {
      for (const variant of ['web', 'thumbs']) {
        const hidden = await fetch(`${base}/media/gallery/${variant}/photo-${id}.jpg`, { redirect: 'manual' });
        assert.equal(hidden.status, 401, `${variant} photo-${id} should require login`);
      }
    }

    const original = await fetch(`${base}/media/gallery/photo-01.jpg`, { redirect: 'manual' });
    assert.notEqual(original.status, 200);

    const page = await loginPage();
    const res = await postLogin(page.cookie, page.token, 'slotmember', 'correct-horse-battery');
    const session = cookieHeader(res);

    for (const id of ids) {
      for (const [variant, limit] of [['web', 1600], ['thumbs', 600]]) {
        const photo = await fetch(`${base}/media/gallery/${variant}/photo-${id}.jpg`, {
          headers: { cookie: session },
        });
        assert.equal(photo.status, 200, `${variant} photo-${id}`);
        assert.match(photo.headers.get('content-type'), /image\/jpeg/);
        assert.match(photo.headers.get('cache-control') || '', /private/);
        const bytes = Buffer.from(await photo.arrayBuffer());
        const size = jpegSize(bytes);
        assert.ok(Math.max(size.width, size.height) <= limit, `${variant} photo-${id} is ${size.width}x${size.height}`);
        assert.ok(bytes.length > 1000);
      }
    }

    const missing = await fetch(`${base}/media/gallery/web/photo-99.jpg`, { headers: { cookie: session } });
    assert.equal(missing.status, 404);

    const badVariant = await fetch(`${base}/media/gallery/originals/photo-01.jpg`, { headers: { cookie: session } });
    assert.equal(badVariant.status, 404);

    const sneak = await fetch(`${base}/media/gallery/web/..%2f..%2fpackage.json`, {
      headers: { cookie: session },
      redirect: 'manual',
    });
    assert.notEqual(sneak.status, 200);
    const sneakBody = await sneak.text();
    assert.equal(sneakBody.includes('"herb-factor-members"'), false);

    const home = await fetch(`${base}/`, { headers: { cookie: session } });
    assert.equal(home.status, 200);
    const html = await home.text();

    assert.ok(html.includes('href="#gallery"'));
    assert.ok(html.includes('>Gallery<'));
    assert.ok(html.includes('UDC 2026'));
    assert.ok(html.includes('See the 2026 win'));
    assert.equal(html.includes('2025'), false);
    assert.equal(html.includes('data-caption'), false);
    assert.equal(html.includes('lightbox-caption'), false);
    assert.ok(html.includes('id="lightbox"'));
    assert.ok(html.includes('/js/gallery.js'));
    assert.ok(html.includes('>Previous<'));
    assert.ok(html.includes('>Next<'));
    assert.equal(html.includes('Racing Queensland'), false);
    assert.equal(/\/media\/gallery\/photo-\d+\.jpg/.test(html), false);
    assert.equal((html.match(/data-gallery-item/g) || []).length, 13);

    const hero = html.match(/<img[^>]*class="hero-photo"[^>]*>/);
    assert.ok(hero, 'hero photo should be an image');
    assert.equal(hero[0].includes('loading="lazy"'), false);
    assert.ok(hero[0].includes('fetchpriority="high"'));
    assert.ok(hero[0].includes('/media/gallery/web/photo-11.jpg'));
    assert.ok((html.match(/loading="lazy"/g) || []).length >= 18);

    for (const id of ids) {
      assert.ok(html.includes(`/media/gallery/web/photo-${id}.jpg`), `missing web photo ${id}`);
      assert.ok(html.includes(`/media/gallery/thumbs/photo-${id}.jpg`), `missing thumb ${id}`);
      assert.ok(html.includes(`data-photo="${id}"`), `missing opener ${id}`);
    }

    assert.equal((html.match(/data-photo="01"/g) || []).length, 2);
    assert.equal((html.match(/data-photo="11"/g) || []).length, 1);
    assert.ok(html.includes('Draft day indoors'));
    assert.ok(html.includes('Nutrien sales voucher being handed over'));
    assert.equal(html.includes('Ryan Spice'), true);
  });
});

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('JPEG size marker not found');
}
