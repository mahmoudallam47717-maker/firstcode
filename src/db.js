const { sql } = require('@vercel/postgres');

async function initDB() {
  try {
    // إنشاء الجداول الأساسية
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
        can_manage INTEGER NOT NULL DEFAULT 0 CHECK (can_manage IN (0,1)),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
        shift_start VARCHAR(50),
        shift_end VARCHAR(50),
        hourly_rate REAL NOT NULL DEFAULT 0,
        manual_deficit REAL NOT NULL DEFAULT 0,
        persona VARCHAR(50) NOT NULL DEFAULT 'specialist',
        specialist_code VARCHAR(100) UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        scheduled_start VARCHAR(50),
        scheduled_end VARCHAR(50),
        deficit_minutes INTEGER NOT NULL DEFAULT 0
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        intermediary_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        executor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
        code VARCHAR(100) NOT NULL DEFAULT '',
        title VARCHAR(255) NOT NULL,
        project_type VARCHAR(100) NOT NULL DEFAULT 'other',
        amount REAL NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done')),
        request_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (request_status IN ('pending','approved','rejected')),
        approved_at TIMESTAMP,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (is_confirmed IN (0,1)),
        notes TEXT NOT NULL DEFAULT '',
        phone VARCHAR(50) NOT NULL DEFAULT '',
        client_name VARCHAR(255) NOT NULL DEFAULT '',
        currency VARCHAR(10) NOT NULL DEFAULT 'egp',
        due_date TIMESTAMP,
        delivery_time VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // إنشاء الـ Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_shifts_started ON shifts(started_at);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_shift ON projects(shift_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at);`;
    
    // إنشاء Unique Index للأكواد لو مش فاضية
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_code ON projects(code) 
      WHERE code != '';
    `;

    // تحديث أكواد المختصين (Specialist Code)
    await sql`
      UPDATE users 
      SET specialist_code = 'SPEC-' || id 
      WHERE persona = 'specialist' AND (specialist_code IS NULL OR TRIM(specialist_code) = '');
    `;

    console.log('[Database] PostgreSQL initialized successfully on Vercel.');
  } catch (error) {
    console.error('[Database] Initialization error:', error);
  }
}

// تشغيل دالة التهيئة
initDB();

module.exports = {
  // تغليف عمليات الـ DB عشان تشتغل زي SQLite بالظبط في باقي الكود
  prepare: (query) => {
    return {
      get: async (...values) => {
        const { rows } = await sql.query(query, values);
        return rows[0];
      },
      all: async (...values) => {
        const { rows } = await sql.query(query, values);
        return rows;
      },
      run: async (...values) => {
        const result = await sql.query(query, values);
        return { lastInsertRowid: result.insertId, changes: result.rowCount };
      }
    };
  },
  exec: async (query) => {
    await sql.query(query);
  }
};