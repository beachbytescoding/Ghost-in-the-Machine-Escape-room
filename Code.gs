/**
 * Beach Bytes: "Ghost in the Machine" certificate emailer
 *
 * SETUP (do this while signed in as beachbytes@owenstokes.com):
 *  1. Go to script.google.com > New project. Paste this whole file over Code.gs. Save.
 *  2. Deploy > New deployment > type: Web app.
 *       Execute as:      Me (beachbytes@owenstokes.com)
 *       Who has access:  Anyone
 *     Click Deploy, approve the permissions (it needs to send email), copy the Web app URL.
 *  3. In ghost-in-the-machine.html, paste that URL into CONFIG.EMAIL_ENDPOINT.
 *  4. Test: open the Web app URL in a browser. You should see {"ok":true,"service":"..."}.
 *  If you edit this script later: Deploy > Manage deployments > edit > New version.
 *
 * Privacy: addresses are never written to a sheet or log. Rate limiting uses a
 * hashed key in a cache that expires on its own (within 6 hours).
 */

const SUBJECT = 'Congratulations on escaping the Ghost in the Machine game at Beach Bytes';
const FROM_NAME = 'Beach Bytes';
const PER_ADDRESS_LIMIT = 3;    // emails per address per cache window (~6 hours)
const TOTAL_LIMIT = 300;        // emails in total per cache window (Workspace allows ~1,500/day)
const CACHE_SECONDS = 21600;    // 6 hours, the maximum CacheService allows

function doGet() {
  return json_({ ok: true, service: 'Ghost in the Machine certificate sender' });
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    const email = String(data.email || '').trim().toLowerCase();
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json_({ ok: false, error: 'bad_address' });
    }
    const name = String(data.name || '').replace(/[^\p{L}\p{N} '\-\.]/gu, '').trim().slice(0, 24);
    const mode = data.mode === 'mini' ? 'Mini' : (data.mode === 'long' ? 'Long' : 'Short');
    const seconds = clamp_(data.seconds, 0, 36000);
    const hints = clamp_(data.hints, 0, 3);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (!allow_(email)) return json_({ ok: false, error: 'limit' });
    } finally {
      lock.releaseLock();
    }

    const time = fmtTime_(seconds);
    const who = name ? esc_(name) : 'Brave escapee';
    const plain =
      (name ? name : 'Brave escapee') + ', you escaped the Ghost in the Machine!\n\n' +
      'Boo-lean the ghost says THANK YOU for setting him free.\n\n' +
      'Level: ' + mode + '\nFinal time: ' + time + '\nHints used: ' + hints + '\n\n' +
      'Thanks for playing at Beach Bytes!';

    const html =
      '<div style="font-family:Trebuchet MS,Segoe UI,Arial,sans-serif;background:#0f0819;padding:24px;">' +
      '<div style="max-width:520px;margin:0 auto;background:#22153b;border:3px solid #ff8a1f;border-radius:20px;padding:28px;text-align:center;color:#f7efff;">' +
      '<div style="font-size:56px;line-height:1;">&#128123;</div>' +
      '<h1 style="color:#ffc15a;margin:10px 0 4px;font-size:28px;">Certificate of Escape</h1>' +
      '<p style="margin:0 0 18px;color:#a898c4;">The Ghost in the Machine</p>' +
      '<p style="font-size:20px;margin:0 0 6px;"><b>' + who + '</b></p>' +
      '<p style="font-size:16px;line-height:1.5;margin:0 0 18px;">escaped the haunted computer and set Boo-lean the ghost free!<br>Congratulations on escaping the Ghost in the Machine game at Beach Bytes.</p>' +
      '<table style="margin:0 auto 18px;border-collapse:collapse;color:#f7efff;">' +
      '<tr><td style="padding:6px 14px;color:#a898c4;">Level</td><td style="padding:6px 14px;"><b>' + mode + '</b></td></tr>' +
      '<tr><td style="padding:6px 14px;color:#a898c4;">Final time</td><td style="padding:6px 14px;"><b>' + time + '</b></td></tr>' +
      '<tr><td style="padding:6px 14px;color:#a898c4;">Hints used</td><td style="padding:6px 14px;"><b>' + hints + '</b></td></tr></table>' +
      '<p style="font-size:30px;margin:0;">&#127875; &#127852; &#127875;</p>' +
      '<p style="color:#a898c4;font-size:13px;margin:16px 0 0;">Thanks for playing at Beach Bytes!</p>' +
      '</div></div>';

    MailApp.sendEmail({ to: email, subject: SUBJECT, body: plain, htmlBody: html, name: FROM_NAME });
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'server_error' });
  }
}

/* ---------- helpers ---------- */
function allow_(email) {
  const cache = CacheService.getScriptCache();
  const key = 'a_' + hash_(email);
  const perAddr = Number(cache.get(key) || 0);
  const total = Number(cache.get('total') || 0);
  if (perAddr >= PER_ADDRESS_LIMIT || total >= TOTAL_LIMIT) return false;
  cache.put(key, String(perAddr + 1), CACHE_SECONDS);
  cache.put('total', String(total + 1), CACHE_SECONDS);
  return true;
}
function hash_(s) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)
  ).slice(0, 24);
}
function clamp_(v, lo, hi) {
  v = Math.round(Number(v));
  if (isNaN(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}
function fmtTime_(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
