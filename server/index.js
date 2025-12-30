const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;

// アップロードディレクトリの設定
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer設定
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'menu-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB制限
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('画像ファイルのみアップロード可能です（JPEG, PNG, GIF, WebP）'));
    }
  }
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// =========== 認証API ===========

// ログイン
app.post('/api/login', (req, res) => {
  const { name, email, password } = req.body;

  // 名前またはメールアドレスでログインを許可
  const loginField = name || email;

  db.get(
    'SELECT * FROM users WHERE (name = ? OR email = ?) AND password = ?',
    [loginField, loginField, password],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      if (!user) {
        return res.status(401).json({ error: '名前またはパスワードが間違っています' });
      }
      res.json({ user: { id: user.id, name: user.name, email: user.email, delivery_location: user.delivery_location, role: user.role } });
    }
  );
});

// =========== ユーザーAPI ===========

// ユーザー登録
app.post('/api/users/register', (req, res) => {
  const { name, password, delivery_location } = req.body;

  // バリデーション
  if (!name || !password || !delivery_location) {
    return res.status(400).json({ error: '全ての項目を入力してください' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
  }

  // 名前の重複チェック
  db.get('SELECT id FROM users WHERE name = ?', [name], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'データベースエラー' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'この名前は既に登録されています' });
    }

    // メールアドレスは名前から自動生成（ダミー値）
    const email = `${name}@system.local`;

    // ユーザーを登録
    db.run(
      'INSERT INTO users (name, email, password, delivery_location, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, delivery_location, 'user'],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'データベースエラー' });
        }

        res.json({
          message: 'ユーザー登録が完了しました',
          userId: this.lastID
        });
      }
    );
  });
});

// 全ユーザー取得
app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, email, delivery_location, role FROM users', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'データベースエラー' });
    }
    res.json(users);
  });
});

// =========== メニューAPI ===========

// 今日のメニュー取得
app.get('/api/menus/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  db.all(
    'SELECT * FROM menus WHERE available_date = ?',
    [today],
    (err, menus) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json(menus);
    }
  );
});

// 期間指定でメニュー取得（16日〜翌々月15日まで）
app.get('/api/menus/available', (req, res) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentHour = now.getHours();

  // 当日8時以降は翌日から表示
  let startDate = new Date(now);
  if (currentHour >= 8) {
    startDate.setDate(startDate.getDate() + 1);
  }

  // 2ヶ月後の15日まで
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 2);
  endDate.setDate(15);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  db.all(
    'SELECT * FROM menus WHERE available_date >= ? AND available_date <= ? ORDER BY available_date ASC',
    [startDateStr, endDateStr],
    (err, menus) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json(menus);
    }
  );
});

// 全メニュー取得
app.get('/api/menus', (req, res) => {
  db.all('SELECT * FROM menus ORDER BY available_date DESC', (err, menus) => {
    if (err) {
      return res.status(500).json({ error: 'データベースエラー' });
    }
    res.json(menus);
  });
});

// メニュー追加
app.post('/api/menus', (req, res) => {
  const { name, description, price, available_date, image_url } = req.body;

  db.run(
    'INSERT INTO menus (name, description, price, available_date, image_url) VALUES (?, ?, ?, ?, ?)',
    [name, description, price, available_date, image_url || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json({ id: this.lastID, message: 'メニューを追加しました' });
    }
  );
});

// メニュー削除
app.delete('/api/menus/:id', (req, res) => {
  const { id } = req.params;

  db.run(
    'DELETE FROM menus WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'メニューが見つかりません' });
      }
      res.json({ message: 'メニューを削除しました' });
    }
  );
});

// =========== 注文API ===========

// 注文作成・更新
app.post('/api/orders', (req, res) => {
  const { user_id, menu_id, order_date, quantity, delivery_location } = req.body;

  // 既存の注文を確認
  db.get(
    'SELECT * FROM orders WHERE user_id = ? AND order_date = ?',
    [user_id, order_date],
    (err, existingOrder) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }

      if (existingOrder) {
        // 既存の注文がある場合
        if (quantity === 0) {
          // 個数が0なら削除
          db.run('DELETE FROM orders WHERE id = ?', [existingOrder.id], function(err) {
            if (err) {
              return res.status(500).json({ error: 'データベースエラー' });
            }
            res.json({ message: '注文をキャンセルしました' });
          });
        } else {
          // 個数を更新
          db.run(
            'UPDATE orders SET quantity = ?, menu_id = ?, delivery_location = ? WHERE id = ?',
            [quantity, menu_id, delivery_location || null, existingOrder.id],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'データベースエラー' });
              }
              res.json({ message: '注文を更新しました' });
            }
          );
        }
      } else {
        // 新規注文
        if (quantity > 0) {
          db.run(
            'INSERT INTO orders (user_id, menu_id, order_date, quantity, delivery_location) VALUES (?, ?, ?, ?, ?)',
            [user_id, menu_id, order_date, quantity, delivery_location || null],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'データベースエラー' });
              }
              res.json({ id: this.lastID, message: '注文しました' });
            }
          );
        } else {
          res.json({ message: '注文をスキップしました' });
        }
      }
    }
  );
});

// ユーザーの注文履歴取得
app.get('/api/orders/user/:userId', (req, res) => {
  const { userId } = req.params;

  db.all(
    `SELECT o.*, m.name as menu_name, m.price
     FROM orders o
     JOIN menus m ON o.menu_id = m.id
     WHERE o.user_id = ?
     ORDER BY o.created_at DESC`,
    [userId],
    (err, orders) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json(orders);
    }
  );
});

// 全注文取得（管理者用）
app.get('/api/orders', (req, res) => {
  db.all(
    `SELECT o.*, u.name as user_name, u.delivery_location, m.name as menu_name, m.price
     FROM orders o
     JOIN users u ON o.user_id = u.id
     JOIN menus m ON o.menu_id = m.id
     ORDER BY o.created_at DESC`,
    (err, orders) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json(orders);
    }
  );
});

// 日別集計
app.get('/api/orders/summary/daily', (req, res) => {
  const { date } = req.query;

  db.all(
    `SELECT m.name as menu_name, SUM(o.quantity) as total_quantity, COUNT(DISTINCT o.user_id) as user_count
     FROM orders o
     JOIN menus m ON o.menu_id = m.id
     WHERE o.order_date = ?
     GROUP BY m.id`,
    [date],
    (err, summary) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json(summary);
    }
  );
});

// 配達場所別集計（金額付き）
app.get('/api/orders/summary/department', (req, res) => {
  const { date } = req.query;

  db.all(
    `SELECT o.delivery_location, SUM(o.quantity) as total_quantity, COUNT(DISTINCT o.user_id) as user_count, SUM(m.price * o.quantity) as total_amount
     FROM orders o
     JOIN menus m ON o.menu_id = m.id
     WHERE o.order_date = ?
     GROUP BY o.delivery_location`,
    [date],
    (err, summary) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json(summary);
    }
  );
});

// 日別個人注文詳細
app.get('/api/orders/daily/:date', (req, res) => {
  const { date } = req.params;

  db.all(
    `SELECT o.*, u.name as user_name, u.delivery_location, m.name as menu_name, m.price
     FROM orders o
     JOIN users u ON o.user_id = u.id
     JOIN menus m ON o.menu_id = m.id
     WHERE o.order_date = ?
     ORDER BY u.delivery_location, u.name`,
    [date],
    (err, orders) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json(orders);
    }
  );
});

// 利用可能な月次集計期間を取得
app.get('/api/orders/available-periods', (req, res) => {
  db.all(
    `SELECT DISTINCT order_date FROM orders ORDER BY order_date`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }

      // 注文日から月次集計期間（前月16日〜当月15日）を計算
      const periods = new Set();

      rows.forEach(row => {
        const date = new Date(row.order_date);
        const day = date.getDate();
        let year = date.getFullYear();
        let month = date.getMonth() + 1; // 0-11 to 1-12

        // 15日以前なら、その月の集計期間
        // 16日以降なら、翌月の集計期間
        if (day >= 16) {
          month += 1;
          if (month > 12) {
            month = 1;
            year += 1;
          }
        }

        periods.add(`${year}-${String(month).padStart(2, '0')}`);
      });

      // Set を配列に変換してソート
      const periodArray = Array.from(periods).sort().map(period => {
        const [year, month] = period.split('-');
        return { year: parseInt(year), month };
      });

      res.json(periodArray);
    }
  );
});

// 月次集計（個人別）- 前月16日〜当月15日の期間
app.get('/api/orders/summary/monthly', (req, res) => {
  const { year, month } = req.query;

  // 集計期間: 前月16日〜当月15日
  // 例: year=2025, month=01 → 2024-12-16 〜 2025-01-15

  // 前月の16日を計算
  let startYear = parseInt(year);
  let startMonth = parseInt(month) - 1;
  if (startMonth < 1) {
    startMonth = 12;
    startYear -= 1;
  }
  const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-16`;

  // 当月の15日
  const endDate = `${year}-${month}-15`;

  db.all(
    `SELECT u.name as user_name, u.delivery_location, COUNT(o.id) as order_count, SUM(o.quantity) as total_quantity, SUM(m.price * o.quantity) as total_amount
     FROM orders o
     JOIN users u ON o.user_id = u.id
     JOIN menus m ON o.menu_id = m.id
     WHERE o.order_date >= ? AND o.order_date <= ?
     GROUP BY u.id
     ORDER BY u.delivery_location, u.name`,
    [startDate, endDate],
    (err, summary) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json(summary);
    }
  );
});

// =========== PDF出力API ===========

// 配達場所一覧取得
app.get('/api/delivery-locations/:date', (req, res) => {
  const { date } = req.params;

  db.all(
    `SELECT DISTINCT o.delivery_location
     FROM orders o
     WHERE o.order_date = ?
     ORDER BY o.delivery_location`,
    [date],
    (err, locations) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      const locationList = locations.map(l => l.delivery_location).filter(l => l);
      res.json(locationList);
    }
  );
});

// 配達場所別注文リストPDF生成（全配達場所）
app.get('/api/orders/pdf/:date', (req, res) => {
  const { date } = req.params;

  // 配達場所別に注文を取得
  db.all(
    `SELECT o.id, o.user_id, o.menu_id, o.order_date, o.quantity,
            o.delivery_location, o.status, o.created_at,
            u.name as user_name, m.name as menu_name, m.price
     FROM orders o
     JOIN users u ON o.user_id = u.id
     JOIN menus m ON o.menu_id = m.id
     WHERE o.order_date = ?
     ORDER BY o.delivery_location, u.name`,
    [date],
    (err, orders) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }

      // 配達場所別にグループ化
      const groupedOrders = {};
      orders.forEach(order => {
        const location = order.delivery_location || '未設定';
        if (!groupedOrders[location]) {
          groupedOrders[location] = [];
        }
        groupedOrders[location].push(order);
      });

      // PDF生成
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      // レスポンスヘッダー設定
      res.setHeader('Content-Type', 'application/pdf');
      const encodedFilename = encodeURIComponent(`orders-${date}.pdf`);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);

      // PDFをレスポンスにパイプ
      doc.pipe(res);

      // 日本語フォント設定
      const fontPath = path.join(__dirname, 'fonts', 'NotoSansJP.ttf');
      doc.registerFont('NotoSans', fontPath);
      doc.font('NotoSans');

      // ページヘッダーを描画する関数
      const drawPageHeader = () => {
        doc.fontSize(14).text(`お弁当注文リスト - ${date}`, { align: 'center' });
        doc.moveDown(1.5);
      };

      // 最初のページのヘッダー
      drawPageHeader();

      // 配達場所ごとに出力
      Object.keys(groupedOrders).sort().forEach((location, index) => {
        if (index > 0) {
          doc.addPage();
          doc.font('NotoSans');
          drawPageHeader();
        }

        // 配達場所タイトル
        doc.fontSize(16).text(`配達場所: ${location}`, { underline: true });
        doc.moveDown(0.5);

        const locationOrders = groupedOrders[location];

        // 合計個数
        const totalQuantity = locationOrders.reduce((sum, order) => sum + order.quantity, 0);

        // サマリー
        doc.fontSize(11).text(`注文人数: ${locationOrders.length}名 / 合計個数: ${totalQuantity}個`);
        doc.moveDown(1);

        // テーブルヘッダー
        doc.fontSize(12);
        const headerY = doc.y;
        doc.text('氏名', 70, headerY, { width: 150, continued: false });
        doc.text('個数', 250, headerY, { width: 80, continued: false });
        doc.text('受取', 380, headerY, { width: 100, continued: false });

        doc.moveTo(50, doc.y + 5).lineTo(500, doc.y + 5).stroke();
        doc.moveDown(0.8);

        // 注文リスト
        locationOrders.forEach((order, orderIndex) => {
          const y = doc.y;

          // チェックボックス（□）
          doc.fontSize(14).text('□', 380, y, { width: 20, continued: false });

          // 名前
          doc.fontSize(12).text(order.user_name, 70, y, { width: 150, continued: false });

          // 個数
          doc.text(`${order.quantity}個`, 250, y, { width: 80, continued: false });

          doc.moveDown(1.2);

          // ページが足りなくなったら新しいページを追加
          if (doc.y > 700) {
            doc.addPage();
            doc.font('NotoSans');
            drawPageHeader();
            doc.fontSize(16).text(`配達場所: ${location}（続き）`, { underline: true });
            doc.moveDown(1);
            doc.fontSize(12);
          }
        });

        // 配達場所ごとの合計
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(13).text(`小計: ${locationOrders.length}名 / ${totalQuantity}個`, 70);
        doc.moveDown(1);
      });

      // PDF終了
      doc.end();
    }
  );
});

// 特定配達場所の注文リストPDF生成
app.get('/api/orders/pdf/:date/:location', (req, res) => {
  const { date, location } = req.params;

  // 特定配達場所の注文を取得
  db.all(
    `SELECT o.*, u.name as user_name, u.delivery_location, m.name as menu_name, m.price
     FROM orders o
     JOIN users u ON o.user_id = u.id
     JOIN menus m ON o.menu_id = m.id
     WHERE o.order_date = ? AND o.delivery_location = ?
     ORDER BY u.name`,
    [date, location],
    (err, orders) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }

      if (orders.length === 0) {
        return res.status(404).json({ error: '注文が見つかりません' });
      }

      // PDF生成
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      // レスポンスヘッダー設定（ファイル名をエンコード）
      const encodedFilename = encodeURIComponent(`orders-${date}-${location}.pdf`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);

      // PDFをレスポンスにパイプ
      doc.pipe(res);

      // 日本語フォント設定
      const fontPath = path.join(__dirname, 'fonts', 'NotoSansJP.ttf');
      doc.registerFont('NotoSans', fontPath);
      doc.font('NotoSans');

      // ページヘッダー
      doc.fontSize(14).text(`お弁当注文リスト - ${date}`, { align: 'center' });
      doc.moveDown(1.5);

      // 配達場所タイトル
      doc.fontSize(16).text(`配達場所: ${location}`, { underline: true });
      doc.moveDown(0.5);

      // 合計個数
      const totalQuantity = orders.reduce((sum, order) => sum + order.quantity, 0);

      // サマリー
      doc.fontSize(11).text(`注文人数: ${orders.length}名 / 合計個数: ${totalQuantity}個`);
      doc.moveDown(1);

      // テーブルヘッダー
      doc.fontSize(12);
      const headerY = doc.y;
      doc.text('氏名', 70, headerY, { width: 150, continued: false });
      doc.text('個数', 250, headerY, { width: 80, continued: false });
      doc.text('受取', 380, headerY, { width: 100, continued: false });

      doc.moveTo(50, doc.y + 5).lineTo(500, doc.y + 5).stroke();
      doc.moveDown(0.8);

      // 注文リスト
      orders.forEach((order) => {
        const y = doc.y;

        // チェックボックス（□）
        doc.fontSize(14).text('□', 380, y, { width: 20, continued: false });

        // 名前
        doc.fontSize(12).text(order.user_name, 70, y, { width: 150, continued: false });

        // 個数
        doc.text(`${order.quantity}個`, 250, y, { width: 80, continued: false });

        doc.moveDown(1.2);

        // ページが足りなくなったら新しいページを追加
        if (doc.y > 700) {
          doc.addPage();
          doc.font('NotoSans');
          doc.fontSize(14).text(`お弁当注文リスト - ${date}`, { align: 'center' });
          doc.moveDown(1.5);
          doc.fontSize(16).text(`配達場所: ${location}（続き）`, { underline: true });
          doc.moveDown(1);
          doc.fontSize(12);
        }
      });

      // 合計
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(13).text(`小計: ${orders.length}名 / ${totalQuantity}個`, 70);

      // PDF終了
      doc.end();
    }
  );
});

// =========== 画像アップロードAPI ===========

// 画像アップロード
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '画像ファイルが選択されていません' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl, message: '画像をアップロードしました' });
  } catch (error) {
    res.status(500).json({ error: '画像アップロードに失敗しました' });
  }
});

// =========== 月別画像API ===========

// 月別画像設定
app.post('/api/monthly-images', (req, res) => {
  const { year, month, image_url } = req.body;

  db.run(
    `INSERT INTO monthly_menu_images (year, month, image_url, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(year, month)
     DO UPDATE SET image_url = ?, updated_at = CURRENT_TIMESTAMP`,
    [year, month, image_url, image_url],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json({ message: '画像を設定しました' });
    }
  );
});

// 月別画像取得
app.get('/api/monthly-images/:year/:month', (req, res) => {
  const { year, month } = req.params;

  db.get(
    'SELECT * FROM monthly_menu_images WHERE year = ? AND month = ?',
    [year, month],
    (err, image) => {
      if (err) {
        return res.status(500).json({ error: 'データベースエラー' });
      }
      res.json(image || null);
    }
  );
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';

  // ローカルIPアドレスを取得
  Object.keys(networkInterfaces).forEach((ifname) => {
    networkInterfaces[ifname].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
      }
    });
  });

  console.log(`サーバーが起動しました:`);
  console.log(`  ローカル: http://localhost:${PORT}`);
  console.log(`  ネットワーク: http://${localIP}:${PORT}`);
  console.log('');
  console.log('=== スマホからアクセスする場合 ===');
  console.log(`スマホのブラウザで以下のURLを開いてください:`);
  console.log(`  http://${localIP}:${PORT}`);
  console.log('※PCとスマホが同じWi-Fiに接続されている必要があります');
  console.log('');
  console.log('=== テストアカウント ===');
  console.log('管理者: admin@example.com / admin123');
  console.log('一般ユーザー: tanaka@example.com / password123');
  console.log('====================');
});
