/**
 * 会員データの引き継ぎ (2026-09-25)
 *
 * 2026-09-20 17:36 の再起動で本番DBが db-latest に上書きされ、会員 3,770人が消えた。
 * Render の日次スナップショット (9/20 09:15) に戻すと会員は戻るが、上書き後に登録した会員が消える。
 * そこで「戻す前に今の会員データを暗号化して取り出す → 戻した後に書き戻す」をこのモジュールでやる。
 *
 *  buildPackage(db, since)  … 今のDBから会員まわりを取り出す (嬢・店は id でなく source_id/source_url を添える:
 *                               戻した先では id 体系が違うため)
 *  encrypt / decrypt         … AES-256-GCM。平文は API の外に出さない
 *  mergePackage(db, pkg)     … 戻した先のDBへ書き戻す。同じメアドは1アカウントにまとめる。同じ pkg は二度適用しない
 */
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const hasTable = (db, t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
const cols = (db, t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);

export function buildPackage(db, since) {
  const girlSrc = db.prepare('SELECT source_id FROM girls WHERE id = ?').pluck();
  const shopSrc = db.prepare('SELECT source_url FROM shops WHERE id = ?').pluck();
  const withGirl = (r) => ({ ...r, girl_source_id: r.girl_id == null ? null : girlSrc.get(r.girl_id) ?? null });
  const withShop = (r) => ({ ...r, shop_source_url: r.shop_id == null ? null : shopSrc.get(r.shop_id) ?? null });
  const pkg = { version: 1, since, created_at: new Date().toISOString() };
  pkg.users = hasTable(db, 'users') ? db.prepare('SELECT * FROM users').all() : [];
  pkg.sessions = hasTable(db, 'sessions') ? db.prepare("SELECT * FROM sessions WHERE expires_at > datetime('now')").all() : [];
  pkg.favorites = hasTable(db, 'favorites') ? db.prepare('SELECT * FROM favorites').all().map(withGirl) : [];
  const rcols = cols(db, 'reviews');
  pkg.reviews = db.prepare(
    `SELECT * FROM reviews WHERE ${rcols.includes('user_id') ? 'user_id IS NOT NULL OR ' : ''}
       (created_at >= ? AND browser_id NOT LIKE 'ext-%' AND browser_id NOT LIKE 'x-import-%')`,
  ).all(since).map(withGirl);
  pkg.feedback = hasTable(db, 'feedback')
    ? db.prepare('SELECT * FROM feedback WHERE created_at >= ?').all(since).map((r) => withShop(withGirl(r))) : [];
  pkg.contact_messages = hasTable(db, 'contact_messages')
    ? db.prepare('SELECT * FROM contact_messages WHERE created_at >= ?').all(since) : [];
  return pkg;
}

export function summarize(pkg) {
  return {
    since: pkg.since, created_at: pkg.created_at,
    users: pkg.users.length, sessions: pkg.sessions.length, favorites: pkg.favorites.length,
    reviews: pkg.reviews.length, feedback: pkg.feedback.length, contact_messages: pkg.contact_messages.length,
  };
}

const keyOf = (secret) => crypto.createHash('sha256').update(String(secret)).digest();

export function encrypt(obj, secret) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const data = Buffer.concat([c.update(zlib.gzipSync(JSON.stringify(obj))), c.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}

export function decrypt(blob, secret) {
  const d = crypto.createDecipheriv('aes-256-gcm', keyOf(secret), Buffer.from(blob.iv, 'base64'));
  d.setAuthTag(Buffer.from(blob.tag, 'base64'));
  const plain = Buffer.concat([d.update(Buffer.from(blob.data, 'base64')), d.final()]);
  return JSON.parse(zlib.gunzipSync(plain).toString('utf8'));
}

/** 行 row を表 t に入れる。id (PK) は落として採番させ、表に無い列は捨てる */
function insertRow(db, t, row, { dropId = true, orIgnore = false } = {}) {
  const tc = cols(db, t);
  const keys = Object.keys(row).filter((k) => tc.includes(k) && !(dropId && k === 'id') && row[k] !== undefined);
  const sql = `INSERT ${orIgnore ? 'OR IGNORE ' : ''}INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  return db.prepare(sql).run(keys.map((k) => row[k]));
}

export function mergePackage(db, pkg) {
  db.exec('CREATE TABLE IF NOT EXISTS carryover_applied (pkg_created_at TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime(\'now\')), report TEXT)');
  if (db.prepare('SELECT 1 FROM carryover_applied WHERE pkg_created_at = ?').get(pkg.created_at)) {
    return { skipped: true, reason: 'この pkg は適用済み' };
  }
  const r = { users_matched: 0, users_password_updated: 0, users_inserted: 0, sessions: 0, favorites: 0, favorites_skipped: 0,
              reviews: 0, reviews_skipped: 0, feedback: 0, feedback_skipped: 0, contact_messages: 0 };
  const girlBySrc = db.prepare('SELECT id FROM girls WHERE source_id = ?').pluck();
  const shopBySrc = db.prepare('SELECT id FROM shops WHERE source_url = ?').pluck();
  const userByEmail = db.prepare('SELECT id, created_at FROM users WHERE lower(email) = lower(?)');
  const userMap = new Map();

  db.transaction(() => {
    for (const u of pkg.users) {
      const ex = userByEmail.get(u.email);
      if (ex) {
        userMap.set(u.id, ex.id);
        r.users_matched++;
        // 消えた後に同じメアドで登録し直した人は、新しい方のパスワードを使っているはず
        if (u.created_at > ex.created_at && u.password_hash) {
          db.prepare('UPDATE users SET password_hash = ?, last_login_at = max(coalesce(last_login_at, \'\'), coalesce(?, \'\')) WHERE id = ?')
            .run(u.password_hash, u.last_login_at, ex.id);
          r.users_password_updated++;
        }
      } else {
        userMap.set(u.id, Number(insertRow(db, 'users', u).lastInsertRowid));
        r.users_inserted++;
      }
    }
    for (const s of pkg.sessions) {
      const uid = userMap.get(s.user_id);
      if (uid == null) continue;
      r.sessions += insertRow(db, 'sessions', { ...s, user_id: uid }, { dropId: false, orIgnore: true }).changes;
    }
    for (const f of pkg.favorites) {
      const uid = userMap.get(f.user_id);
      const gid = f.girl_source_id ? girlBySrc.get(f.girl_source_id) : null;
      if (uid == null || gid == null) { r.favorites_skipped++; continue; }
      r.favorites += insertRow(db, 'favorites', { user_id: uid, girl_id: gid, created_at: f.created_at }, { dropId: false, orIgnore: true }).changes;
    }
    for (const rv of pkg.reviews) {
      const gid = rv.girl_source_id ? girlBySrc.get(rv.girl_source_id) : null;
      if (gid == null) { r.reviews_skipped++; continue; }
      const uid = rv.user_id == null ? null : userMap.get(rv.user_id) ?? null;
      const { girl_source_id, ...row } = rv;
      const n = insertRow(db, 'reviews', { ...row, girl_id: gid, user_id: uid }, { orIgnore: true }).changes;
      if (n) r.reviews++; else r.reviews_skipped++;
    }
    for (const fb of pkg.feedback) {
      const uid = userMap.get(fb.user_id);
      const gid = fb.girl_source_id ? girlBySrc.get(fb.girl_source_id) : null;
      const sid = fb.shop_source_url ? shopBySrc.get(fb.shop_source_url) : null;
      if (uid == null || (fb.girl_id != null && gid == null) || (fb.shop_id != null && sid == null)) { r.feedback_skipped++; continue; }
      const { girl_source_id, shop_source_url, ...row } = fb;
      insertRow(db, 'feedback', { ...row, user_id: uid, girl_id: gid ?? null, shop_id: sid ?? null });
      r.feedback++;
    }
    for (const c of pkg.contact_messages) { insertRow(db, 'contact_messages', c); r.contact_messages++; }
    db.prepare('INSERT INTO carryover_applied (pkg_created_at, report) VALUES (?, ?)').run(pkg.created_at, JSON.stringify(r));
  })();
  return r;
}
