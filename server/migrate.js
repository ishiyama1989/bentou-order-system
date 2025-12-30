const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'bentou.db');
const db = new sqlite3.Database(dbPath);

console.log('マイグレーション開始: department → delivery_location');

db.serialize(() => {
  // 1. 新しいusersテーブルを作成
  db.run(`
    CREATE TABLE IF NOT EXISTS users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      delivery_location TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('新しいテーブル作成エラー:', err);
      return;
    }
    console.log('✓ 新しいusersテーブルを作成しました');
  });

  // 2. データをコピー（department → delivery_location）
  db.run(`
    INSERT INTO users_new (id, name, email, password, delivery_location, role, created_at)
    SELECT id, name, email, password, department, role, created_at
    FROM users
  `, (err) => {
    if (err) {
      console.error('データコピーエラー:', err);
      return;
    }
    console.log('✓ データをコピーしました');
  });

  // 3. 古いテーブルを削除
  db.run('DROP TABLE users', (err) => {
    if (err) {
      console.error('古いテーブル削除エラー:', err);
      return;
    }
    console.log('✓ 古いusersテーブルを削除しました');
  });

  // 4. 新しいテーブルを元の名前にリネーム
  db.run('ALTER TABLE users_new RENAME TO users', (err) => {
    if (err) {
      console.error('テーブルリネームエラー:', err);
      return;
    }
    console.log('✓ 新しいテーブルをusersにリネームしました');

    // 5. departmentsテーブルをdelivery_locationsにリネーム
    db.run(`
      CREATE TABLE IF NOT EXISTS delivery_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('delivery_locationsテーブル作成エラー:', err);
        return;
      }
      console.log('✓ delivery_locationsテーブルを作成しました');

      // departmentsテーブルのデータをコピー
      db.run(`
        INSERT OR IGNORE INTO delivery_locations (name, created_at)
        SELECT name, created_at FROM departments
      `, (err) => {
        if (err) {
          console.error('配達場所データコピーエラー:', err);
          return;
        }
        console.log('✓ 配達場所データをコピーしました');

        // 配達場所の初期データを追加
        db.run(`
          INSERT OR IGNORE INTO delivery_locations (name) VALUES
          ('乗務員区'), ('大月駅'), ('文大前駅'), ('下吉田駅'), ('富士山駅')
        `, (err) => {
          if (err) {
            console.error('初期配達場所追加エラー:', err);
            return;
          }
          console.log('✓ 配達場所の初期データを追加しました');
          console.log('');
          console.log('マイグレーション完了！');
          db.close();
        });
      });
    });
  });
});
