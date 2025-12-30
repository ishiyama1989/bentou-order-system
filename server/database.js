const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// データベースディレクトリを確保
const dbDir = path.join(__dirname, '..');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'bentou.db');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('データベース接続エラー:', err);
  } else {
    console.log('データベースに接続しました');
  }
});

// データベース初期化
db.serialize(() => {
  // ユーザーテーブル
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      delivery_location TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // メニューテーブル
  db.run(`
    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      available_date DATE NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 注文テーブル
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      menu_id INTEGER NOT NULL,
      order_date DATE NOT NULL,
      quantity INTEGER DEFAULT 1,
      delivery_location TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (menu_id) REFERENCES menus (id)
    )
  `);

  // 配達場所テーブル
  db.run(`
    CREATE TABLE IF NOT EXISTS delivery_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 月別メニュー画像テーブル
  db.run(`
    CREATE TABLE IF NOT EXISTS monthly_menu_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month)
    )
  `);

  // サンプルデータ挿入（管理者ユーザーの存在を確認）
  db.get("SELECT * FROM users WHERE email = 'admin@example.com'", (err, admin) => {
    if (err) {
      console.error('ユーザーチェックエラー:', err);
      return;
    }

    if (!admin) {
      console.log('サンプルデータを挿入します...');

      // サンプル配達場所
      db.run("INSERT OR IGNORE INTO delivery_locations (name) VALUES ('乗務員区'), ('大月駅'), ('文大前駅'), ('下吉田駅'), ('富士山駅')", (err) => {
        if (err) console.error('配達場所挿入エラー:', err);
      });

      // サンプルユーザー（管理者）
      db.run(`
        INSERT INTO users (name, email, password, delivery_location, role)
        VALUES ('管理者', 'admin@example.com', '1234', '乗務員区', 'admin')
      `, (err) => {
        if (err) {
          console.error('管理者挿入エラー:', err);
        } else {
          console.log('✓ 管理者アカウント作成: 管理者 / 1234');
        }
      });

      // サンプルユーザー（一般）
      db.run(`
        INSERT INTO users (name, email, password, delivery_location, role)
        VALUES ('田中太郎', 'tanaka@example.com', '5678', '大月駅', 'user')
      `, (err) => {
        if (err) console.error('田中太郎挿入エラー:', err);
      });

      db.run(`
        INSERT INTO users (name, email, password, delivery_location, role)
        VALUES ('佐藤花子', 'sato@example.com', '9012', '富士山駅', 'user')
      `, (err) => {
        if (err) console.error('佐藤花子挿入エラー:', err);
      });

      // サンプルメニュー（日替わり弁当のみ）
      const today = new Date().toISOString().split('T')[0];

      db.run(`
        INSERT INTO menus (name, description, price, available_date)
        VALUES ('日替わり弁当', '本日のおすすめメニュー', 550, '${today}')
      `, (err) => {
        if (err) console.error('メニュー挿入エラー:', err);
      });

      console.log('✓ サンプルデータの挿入が完了しました');
    } else {
      console.log('サンプルデータは既に存在します');
    }
  });
});

module.exports = db;
