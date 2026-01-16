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
      employment_type TEXT DEFAULT '正社員',
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

  // 注文不可日テーブル
  db.run(`
    CREATE TABLE IF NOT EXISTS unavailable_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unavailable_date DATE NOT NULL UNIQUE,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // サンプルデータ挿入（管理者ユーザーの存在を確認）
  // Renderなどのエフェメラル環境では毎回データベースが初期化される可能性があるため、
  // テーブル作成後に必ず確認する
  db.get("SELECT * FROM users WHERE email = 'admin@example.com'", (err, admin) => {
    if (err) {
      console.error('ユーザーチェックエラー:', err);
      // エラーでもサンプルデータを挿入してみる（テーブルが空の場合）
    }

    if (!admin || err) {
      console.log('サンプルデータを挿入します...');

      // サンプル配達場所
      db.run("INSERT OR IGNORE INTO delivery_locations (name) VALUES ('乗務員区'), ('運転指令'), ('管理駅'), ('索道'), ('技術所')", (err) => {
        if (err) console.error('配達場所挿入エラー:', err);
      });

      // サンプルユーザー（管理者）
      db.run(`
        INSERT OR IGNORE INTO users (name, email, password, delivery_location, employment_type, role)
        VALUES ('管理者', 'admin@example.com', '1234', '乗務員区', '正社員', 'admin')
      `, (err) => {
        if (err) {
          console.error('管理者挿入エラー:', err);
        } else {
          console.log('✓ 管理者アカウント作成: 管理者 / 1234');
        }
      });

      // サンプルユーザー（一般） - 各所属2名ずつ

      // 乗務員区
      db.run(`
        INSERT OR IGNORE INTO users (name, email, password, delivery_location, employment_type, role)
        VALUES ('山田一郎', 'yamada@example.com', '1111', '乗務員区', '正社員', 'user')
      `, (err) => {
        if (err) console.error('山田一郎挿入エラー:', err);
        else console.log('✓ 山田一郎 / 1111 (乗務員区)');
      });

      // 運転指令
      db.run(`
        INSERT OR IGNORE INTO users (name, email, password, delivery_location, employment_type, role)
        VALUES ('田中太郎', 'tanaka@example.com', '5678', '運転指令', '契約社員', 'user')
      `, (err) => {
        if (err) console.error('田中太郎挿入エラー:', err);
        else console.log('✓ 田中太郎 / 5678 (運転指令)');
      });

      db.run(`
        INSERT OR IGNORE INTO users (name, email, password, delivery_location, employment_type, role)
        VALUES ('鈴木次郎', 'suzuki@example.com', '2222', '運転指令', 'アルバイト', 'user')
      `, (err) => {
        if (err) console.error('鈴木次郎挿入エラー:', err);
        else console.log('✓ 鈴木次郎 / 2222 (運転指令)');
      });

      // 管理駅
      db.run(`
        INSERT OR IGNORE INTO users (name, email, password, delivery_location, employment_type, role)
        VALUES ('高橋三郎', 'takahashi@example.com', '3333', '管理駅', '正社員', 'user')
      `, (err) => {
        if (err) console.error('高橋三郎挿入エラー:', err);
        else console.log('✓ 高橋三郎 / 3333 (管理駅)');
      });

      db.run(`
        INSERT OR IGNORE INTO users (name, email, password, delivery_location, employment_type, role)
        VALUES ('伊藤四郎', 'ito@example.com', '4444', '管理駅', '契約社員', 'user')
      `, (err) => {
        if (err) console.error('伊藤四郎挿入エラー:', err);
        else console.log('✓ 伊藤四郎 / 4444 (管理駅)');
      });

      // 索道
      db.run(`
        INSERT OR IGNORE INTO users (name, email, password, delivery_location, employment_type, role)
        VALUES ('渡辺五郎', 'watanabe@example.com', '5555', '索道', 'アルバイト', 'user')
      `, (err) => {
        if (err) console.error('渡辺五郎挿入エラー:', err);
        else console.log('✓ 渡辺五郎 / 5555 (索道)');
      });

      db.run(`
        INSERT OR IGNORE INTO users (name, email, password, delivery_location, employment_type, role)
        VALUES ('中村六郎', 'nakamura@example.com', '6666', '索道', '正社員', 'user')
      `, (err) => {
        if (err) console.error('中村六郎挿入エラー:', err);
        else console.log('✓ 中村六郎 / 6666 (索道)');
      });

      // 技術所
      db.run(`
        INSERT OR IGNORE INTO users (name, email, password, delivery_location, employment_type, role)
        VALUES ('佐藤花子', 'sato@example.com', '9012', '技術所', '契約社員', 'user')
      `, (err) => {
        if (err) console.error('佐藤花子挿入エラー:', err);
        else console.log('✓ 佐藤花子 / 9012 (技術所)');
      });

      db.run(`
        INSERT OR IGNORE INTO users (name, email, password, delivery_location, employment_type, role)
        VALUES ('小林七郎', 'kobayashi@example.com', '7777', '技術所', 'アルバイト', 'user')
      `, (err) => {
        if (err) console.error('小林七郎挿入エラー:', err);
        else console.log('✓ 小林七郎 / 7777 (技術所)');
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
