const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');

async function main() {
  const emails = ['admin@taskflow.app', 'demo@taskflow.app'];
  for (const [i, email] of emails.entries()) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      console.log(`[seed] user exists: ${email}`);
      continue;
    }
    const hash = await bcrypt.hash('Password123!', config.bcryptRounds);
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(i === 0 ? 'المدير' : 'موظف تجريبي', email, hash, i === 0 ? 'admin' : 'user');
    console.log(`[seed] created: ${email} (id=${info.lastInsertRowid})`);

    if (i === 1) {
      const ins = db.prepare(
        'INSERT INTO projects (user_id, title, project_type, amount, status, notes) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const samples = [
        ['بحث علمي عن الذكاء الاصطناعي', 'research', 500, 'in_progress', ''],
        ['تصميم شعار للعميل', 'design', 300, 'done', 'بعد تعديل الألوان'],
        ['تقرير شهري', 'report', 200, 'pending', ''],
      ];
      for (const [t, type, amount, status, notes] of samples) {
        ins.run(info.lastInsertRowid, t, type, amount, status, notes);
      }
      console.log('[seed] sample projects added');
    }
  }
  console.log('[seed] done');
  db.close();
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
