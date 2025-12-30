const API_BASE = 'http://localhost:3000/api';

let currentUser = null;

// ログイン/登録タブ切り替え
window.switchLoginTab = function(tab) {
  const loginCard = document.getElementById('login-card');
  const registerCard = document.getElementById('register-card');
  const tabs = document.querySelectorAll('#login-screen .tab-btn');

  tabs.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`#login-screen .tab-btn[data-tab="${tab}"]`).classList.add('active');

  if (tab === 'login') {
    loginCard.classList.remove('hidden');
    registerCard.classList.add('hidden');
  } else {
    loginCard.classList.add('hidden');
    registerCard.classList.remove('hidden');
  }
};

// 画面切り替え
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}

// タブ切り替え
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      const parent = btn.closest('.container');

      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      parent.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

      btn.classList.add('active');
      parent.querySelector(`#${tabName}-tab`).classList.remove('hidden');
    });
  });
}

// ログイン
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('login-name').value;
  const password = document.getElementById('login-password').value;

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;

      if (currentUser.role === 'admin') {
        showAdminScreen();
      } else {
        showUserScreen();
      }
    } else {
      alert(data.error || 'ログインに失敗しました');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('ログインエラーが発生しました');
  }
});

// 新規登録
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('register-name').value;
  const password = document.getElementById('register-password').value;
  const department = document.getElementById('register-department').value;

  if (!department) {
    alert('所属を選択してください');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password, delivery_location: department })
    });

    const data = await response.json();

    if (response.ok) {
      alert('登録が完了しました！ログインしてください。');
      // 登録フォームをリセット
      document.getElementById('register-form').reset();
      // ログインタブに切り替え
      switchLoginTab('login');
      // 登録した名前をログインフォームに自動入力
      document.getElementById('login-name').value = name;
    } else {
      alert(data.error || '登録に失敗しました');
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert('登録エラーが発生しました');
  }
});

// ログアウト
document.getElementById('logout-btn').addEventListener('click', () => {
  currentUser = null;
  showScreen('login-screen');
});

document.getElementById('admin-logout-btn').addEventListener('click', () => {
  currentUser = null;
  showScreen('login-screen');
});

// ユーザー画面表示
async function showUserScreen() {
  showScreen('user-screen');
  document.getElementById('user-info').textContent = `${currentUser.name} (${currentUser.delivery_location})`;

  // 当日注文を読み込み
  await loadTodayOrder();

  // 月選択プルダウンを初期化（予約注文用）
  initMonthSelector();

  await loadOrderHistory();
}

// 当日注文の読み込み
async function loadTodayOrder() {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];

    const todayOrderDiv = document.getElementById('today-order');

    // 8時を過ぎている場合
    if (currentHour >= 8) {
      todayOrderDiv.innerHTML = `
        <div class="card">
          <div class="alert alert-info">
            <p style="text-align: center; font-size: 16px; margin: 20px 0;">
              本日の注文受付は終了しました（締切：AM8:00）<br>
              明日以降の注文は「予約注文」タブからお願いします。
            </p>
          </div>
        </div>
      `;
      return;
    }

    // 既存の注文を取得
    const ordersResponse = await fetch(`${API_BASE}/orders/user/${currentUser.id}`);
    const existingOrders = await ordersResponse.json();

    // 今日の注文があるか確認
    const todayOrder = existingOrders.find(order => order.order_date === today);
    const isOrdered = todayOrder && todayOrder.quantity > 0;

    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[now.getDay()];
    const formattedDate = `${now.getMonth() + 1}月${now.getDate()}日（${weekday}）`;

    todayOrderDiv.innerHTML = `
      <div class="card today-order-card">
        <h3>${formattedDate}の注文</h3>
        <div class="today-order-content">
          <div class="quantity-selector-large">
            <label>数量：</label>
            <select id="today-quantity" class="quantity-select-large">
              <option value="0" ${!isOrdered || todayOrder?.quantity === 0 ? 'selected' : ''}>注文しない</option>
              <option value="1" ${todayOrder?.quantity === 1 ? 'selected' : ''}>1個</option>
              <option value="2" ${todayOrder?.quantity === 2 ? 'selected' : ''}>2個</option>
              <option value="3" ${todayOrder?.quantity === 3 ? 'selected' : ''}>3個</option>
              <option value="4" ${todayOrder?.quantity === 4 ? 'selected' : ''}>4個</option>
              <option value="5" ${todayOrder?.quantity === 5 ? 'selected' : ''}>5個</option>
            </select>
          </div>
          <button class="btn btn-primary btn-large" onclick="submitTodayOrder()">注文する</button>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading today order:', error);
  }
}

// 当日注文の送信
window.submitTodayOrder = async function() {
  const quantity = parseInt(document.getElementById('today-quantity').value);
  const today = new Date().toISOString().split('T')[0];

  try {
    const menuId = 1;

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        menu_id: menuId,
        order_date: today,
        quantity: quantity
      })
    });

    const data = await response.json();

    if (response.ok) {
      if (quantity === 0) {
        alert('本日の注文をキャンセルしました');
      } else {
        alert(`本日の注文を受け付けました！（${quantity}個）`);
      }
      await loadOrderHistory();
    } else {
      alert(data.error || '注文に失敗しました');
    }
  } catch (error) {
    console.error('Order error:', error);
    alert('注文エラーが発生しました');
  }
};

// 月選択プルダウンの初期化
function initMonthSelector() {
  const now = new Date();
  const select = document.getElementById('order-month-select');

  // 今月と翌月、翌々月を選択肢に追加
  const months = [];
  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    months.push({ year, month, label: `${year}年${month}月` });
  }

  select.innerHTML = months.map((m, index) =>
    `<option value="${m.year}-${m.month}" ${index === 0 ? 'selected' : ''}>${m.label}</option>`
  ).join('');

  // 月変更イベント
  select.addEventListener('change', () => {
    const [year, month] = select.value.split('-');
    loadMonthlyMenus(parseInt(year), parseInt(month));
  });

  // 初期表示（今月）
  loadMonthlyMenus(months[0].year, months[0].month);
}

// 月別メニュー読み込み（1日〜31日をカレンダー形式で表示）
async function loadMonthlyMenus(year, month) {
  try {
    const menusList = document.getElementById('menus-list');

    // 月別画像を取得
    const monthlyImageResponse = await fetch(`${API_BASE}/monthly-images/${year}/${month}`);
    const monthlyImage = await monthlyImageResponse.json();

    // 既存の注文を取得
    const ordersResponse = await fetch(`${API_BASE}/orders/user/${currentUser.id}`);
    const existingOrders = await ordersResponse.json();

    // 日付ごとの注文数をマップに格納
    const orderMap = {};
    existingOrders.forEach(order => {
      const menuId = order.menu_id;
      orderMap[order.order_date] = { quantity: order.quantity, menuId, deliveryLocation: order.delivery_location };
    });

    // その月の日数を取得
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const currentHour = today.getHours();

    // 8時以降は今日は注文不可
    const cutoffDate = new Date(today);
    if (currentHour >= 8) {
      cutoffDate.setDate(cutoffDate.getDate() + 1);
    }
    cutoffDate.setHours(0, 0, 0, 0);

    // 2ヶ月先の最終日
    const maxDate = new Date(today);
    maxDate.setMonth(maxDate.getMonth() + 2);
    maxDate.setDate(15); // 翌々月15日まで

    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const rows = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const weekday = weekdays[date.getDay()];

      // 注文可能期間チェック
      const isAvailable = date >= cutoffDate && date <= maxDate;
      const existingOrder = orderMap[dateStr];
      const existingQty = existingOrder ? existingOrder.quantity : 0;
      const existingLocation = existingOrder ? existingOrder.deliveryLocation : '';

      // ボタンのラベルとスタイルを決定
      const hasOrder = existingQty > 0;

      if (isAvailable) {
        if (hasOrder) {
          // 予約済み：表示のみ（キャンセルボタン付き）
          rows.push(`
            <tr>
              <td>${day}日</td>
              <td>${weekday}</td>
              <td>${existingLocation}</td>
              <td>${existingQty}個</td>
              <td>
                <button class="btn btn-danger btn-sm" onclick="cancelReservation('${dateStr}')">キャンセル</button>
              </td>
            </tr>
          `);
        } else {
          // 未予約：選択可能
          rows.push(`
            <tr>
              <td>${day}日</td>
              <td>${weekday}</td>
              <td>
                <select id="location-${dateStr}" class="location-select">
                  <option value="">選択してください</option>
                  <option value="乗務員区">乗務員区</option>
                  <option value="大月駅">大月駅</option>
                  <option value="文大前駅">文大前駅</option>
                  <option value="下吉田駅">下吉田駅</option>
                  <option value="富士山駅">富士山駅</option>
                </select>
              </td>
              <td>
                <select id="qty-${dateStr}" class="qty-select">
                  <option value="1" selected>1個</option>
                  <option value="2">2個</option>
                  <option value="3">3個</option>
                  <option value="4">4個</option>
                  <option value="5">5個</option>
                </select>
              </td>
              <td>
                <button class="btn btn-primary btn-sm" onclick="updateReservationOrder('${dateStr}')">予約</button>
              </td>
            </tr>
          `);
        }
      }
      // 注文不可の日付は表示しない
    }

    menusList.innerHTML = `
      ${monthlyImage && monthlyImage.image_url ? `
        <div class="menu-image-container">
          <img src="${monthlyImage.image_url}" alt="${month}月のメニュー" class="menu-image">
        </div>
      ` : ''}
      <div class="order-list">
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th>曜日</th>
              <th>配達場所</th>
              <th>個数</th>
              <th>注文</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error('Error loading monthly menus:', error);
  }
}

// 予約注文の更新
window.updateReservationOrder = async function(dateStr) {
  const quantity = parseInt(document.getElementById(`qty-${dateStr}`).value);
  const deliveryLocation = document.getElementById(`location-${dateStr}`).value;

  // 注文する場合は配達場所が必須
  if (quantity > 0 && !deliveryLocation) {
    alert('配達場所を選択してください');
    return;
  }

  try {
    // メニューIDは1固定（日替わり弁当のみ）
    const menuId = 1;

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        menu_id: menuId,
        order_date: dateStr,
        quantity: quantity,
        delivery_location: deliveryLocation
      })
    });

    const data = await response.json();

    if (response.ok) {
      if (quantity === 0) {
        alert('注文をキャンセルしました');
      } else {
        alert(`${quantity}個で予約しました！`);
      }
      // 現在選択されている年月を取得してメニューをリロード
      const select = document.getElementById('order-month-select');
      if (select && select.value) {
        const [year, month] = select.value.split('-');
        await loadMonthlyMenus(parseInt(year), parseInt(month));
      }
      await loadOrderHistory();
    } else {
      alert(data.error || '注文に失敗しました');
    }
  } catch (error) {
    console.error('Order error:', error);
    alert('注文エラーが発生しました');
  }
};

// 予約キャンセル
window.cancelReservation = async function(dateStr) {
  if (!confirm('予約をキャンセルしますか？')) {
    return;
  }

  try {
    // メニューIDは1固定（日替わり弁当のみ）
    const menuId = 1;

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        menu_id: menuId,
        order_date: dateStr,
        quantity: 0,
        delivery_location: null
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert('予約をキャンセルしました');
      // 現在選択されている年月を取得してメニューをリロード
      const select = document.getElementById('order-month-select');
      if (select && select.value) {
        const [year, month] = select.value.split('-');
        await loadMonthlyMenus(parseInt(year), parseInt(month));
      }
      await loadOrderHistory();
    } else {
      alert(data.error || 'キャンセルに失敗しました');
    }
  } catch (error) {
    console.error('Cancel error:', error);
    alert('キャンセルエラーが発生しました');
  }
};

// 注文履歴読み込み
async function loadOrderHistory(year = null, month = null) {
  try {
    const response = await fetch(`${API_BASE}/orders/user/${currentUser.id}`);
    const allOrders = await response.json();

    const historyDiv = document.getElementById('order-history');

    if (allOrders.length === 0) {
      historyDiv.innerHTML = '<div class="empty-state"><p>注文履歴がありません</p></div>';
      return;
    }

    // 利用可能な月度を取得（16日〜15日の期間） - 1年分（12ヶ月）
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // 当前の月度を計算
    let fiscalYear = currentYear;
    let fiscalMonth = currentMonth;
    if (currentDay >= 16) {
      fiscalMonth += 1;
      if (fiscalMonth > 12) {
        fiscalMonth = 1;
        fiscalYear += 1;
      }
    }

    // 1年分の月度リストを生成（当月度から過去12ヶ月）
    const availableMonths = [];
    for (let i = 0; i < 12; i++) {
      let y = fiscalYear;
      let m = fiscalMonth - i;
      if (m < 1) {
        m += 12;
        y -= 1;
      }
      availableMonths.push(`${y}-${String(m).padStart(2, '0')}`);
    }

    const sortedMonths = availableMonths;

    // デフォルトは最新の月
    if (!year || !month) {
      const latest = sortedMonths[0].split('-');
      year = parseInt(latest[0]);
      month = parseInt(latest[1]);
    }

    // 選択された月度でフィルタリング（前月16日〜当月15日）
    const filteredOrders = allOrders.filter(order => {
      const orderDate = new Date(order.order_date);

      // 集計期間: 前月16日〜当月15日
      let startYear = year;
      let startMonth = month - 1;
      if (startMonth < 1) {
        startMonth = 12;
        startYear -= 1;
      }
      const startDate = new Date(startYear, startMonth - 1, 16);
      const endDate = new Date(year, month - 1, 15);

      return orderDate >= startDate && orderDate <= endDate;
    }).sort((a, b) => {
      // 日付順（昇順）でソート
      return new Date(a.order_date) - new Date(b.order_date);
    });

    // 合計を計算
    const totalQuantity = filteredOrders.reduce((sum, order) => sum + order.quantity, 0);
    const totalAmount = filteredOrders.reduce((sum, order) => sum + (order.price * order.quantity), 0);
    // 注文した日数（個数ではなく日数）
    const totalDays = filteredOrders.length;
    // 会社補助：1日あたり100円
    const totalSubsidy = totalDays * 100;
    // 自己負担額
    const selfPayment = totalAmount - totalSubsidy;

    // 月選択のプルダウンを作成
    const monthOptions = sortedMonths.map(ym => {
      const [y, m] = ym.split('-');
      const selected = parseInt(y) === year && parseInt(m) === month ? 'selected' : '';
      return `<option value="${ym}" ${selected}>${parseInt(m)}月度</option>`;
    }).join('');

    historyDiv.innerHTML = `
      <div class="card">
        <div class="order-header">
          <h3>注文履歴</h3>
          <div class="month-selector">
            <label>月を選択：</label>
            <select id="history-month-select">
              ${monthOptions}
            </select>
          </div>
        </div>
      </div>
      ${filteredOrders.length === 0 ?
        '<div class="empty-state"><p>この月の注文はありません</p></div>' :
        `<table>
          <thead>
            <tr>
              <th style="width: 20%;">日付</th>
              <th style="width: 15%;">曜日</th>
              <th style="width: 15%;">個数</th>
              <th style="width: 25%;">金額</th>
              <th style="width: 25%;">補助</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.map(order => {
              const date = new Date(order.order_date);
              const day = date.getDate();
              const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
              const weekday = weekdays[date.getDay()];
              return `
              <tr>
                <td>${day}日</td>
                <td>${weekday}</td>
                <td>${order.quantity}</td>
                <td>¥${order.price * order.quantity}</td>
                <td>¥100</td>
              </tr>
            `;
            }).join('')}
            <tr style="background: #f0f0f0; font-weight: bold;">
              <td colspan="2">合計</td>
              <td>${totalQuantity}</td>
              <td>¥${totalAmount}</td>
              <td>¥${totalSubsidy}</td>
            </tr>
            <tr style="background: #e3f2fd; font-weight: bold; color: #1976d2;">
              <td colspan="4" style="text-align: right; padding-right: 4px;">自己負担額</td>
              <td>¥${selfPayment}</td>
            </tr>
          </tbody>
        </table>`
      }
    `;

    // 月変更イベント
    const select = document.getElementById('history-month-select');
    if (select) {
      select.addEventListener('change', () => {
        const [y, m] = select.value.split('-');
        loadOrderHistory(parseInt(y), parseInt(m));
      });
    }
  } catch (error) {
    console.error('Error loading order history:', error);
  }
}

// 管理画面表示
async function showAdminScreen() {
  showScreen('admin-screen');
  document.getElementById('admin-info').textContent = `${currentUser.name} (管理者)`;

  // 今日の日付をデフォルトに設定
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('admin-daily-date').value = today;

  // 本日の注文を読み込み
  await loadDailyOrders(today);

  // 他のデータも読み込み
  await loadAllMenus();

  // 利用可能な月次集計期間を読み込み
  await loadAvailablePeriods();

  // 日付変更イベント
  document.getElementById('admin-daily-date').addEventListener('change', async (e) => {
    await loadDailyOrders(e.target.value);
    await loadDeliveryLocations(e.target.value);
  });

  // 全配達場所PDF出力ボタン
  document.getElementById('download-all-pdf-btn').addEventListener('click', () => {
    const date = document.getElementById('admin-daily-date').value;
    if (!date) {
      alert('日付を選択してください');
      return;
    }
    // 全配達場所のPDFダウンロード
    window.open(`${API_BASE}/orders/pdf/${date}`, '_blank');
  });

  // 選択した配達場所のPDF出力ボタン
  document.getElementById('download-location-pdf-btn').addEventListener('click', () => {
    const date = document.getElementById('admin-daily-date').value;
    const location = document.getElementById('delivery-location-select').value;

    if (!date) {
      alert('日付を選択してください');
      return;
    }
    if (!location) {
      alert('配達場所を選択してください');
      return;
    }

    // 選択した配達場所のPDFダウンロード
    window.open(`${API_BASE}/orders/pdf/${date}/${encodeURIComponent(location)}`, '_blank');
  });

  // 初回の配達場所リストをロード
  await loadDeliveryLocations(today);
}

// 配達場所リスト読み込み
async function loadDeliveryLocations(date) {
  try {
    const response = await fetch(`${API_BASE}/delivery-locations/${date}`);
    const locations = await response.json();

    const select = document.getElementById('delivery-location-select');
    select.innerHTML = '<option value="">配達場所を選択</option>';

    locations.forEach(location => {
      const option = document.createElement('option');
      option.value = location;
      option.textContent = location;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading delivery locations:', error);
  }
}

// 日別注文データ読み込み
async function loadDailyOrders(date) {
  try {
    // 日別個人注文詳細を取得
    const ordersResponse = await fetch(`${API_BASE}/orders/daily/${date}`);
    const orders = await ordersResponse.json();

    // 配達場所別集計を表示
    const deptDiv = document.getElementById('daily-dept-summary');

    if (orders.length === 0) {
      deptDiv.innerHTML = '<div class="empty-state"><p>この日の注文はありません</p></div>';
    } else {
      // 配達場所別にグループ化
      const locationGroups = {};
      orders.forEach(order => {
        const location = order.delivery_location || '未設定';
        if (!locationGroups[location]) {
          locationGroups[location] = [];
        }
        locationGroups[location].push(order);
      });

      // 全体合計を計算
      const totalQuantity = orders.reduce((sum, order) => sum + order.quantity, 0);
      const totalAmount = orders.reduce((sum, order) => sum + (order.price * order.quantity), 0);
      const totalPeople = orders.length;

      deptDiv.innerHTML = `
        <table>
          <thead>
            <tr>
              <th style="text-align: center;">配達場所</th>
              <th style="text-align: center;">注文者</th>
              <th style="text-align: center;">個数</th>
              <th style="text-align: center;">金額</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(locationGroups).sort().map(location => {
              const locationOrders = locationGroups[location];
              const locationRowCount = locationOrders.length;

              return locationOrders.map((order, index) => {
                const isFirstRow = index === 0;
                const isLastRow = index === locationOrders.length - 1;

                return `
                  <tr>
                    ${isFirstRow ? `<td rowspan="${locationRowCount}" style="vertical-align: top; text-align: center; border-bottom: ${isLastRow ? '2px solid #ddd' : '1px solid #ddd'};">${location}</td>` : ''}
                    <td style="text-align: center;">${order.user_name}</td>
                    <td style="text-align: center;">${order.quantity}個</td>
                    <td style="text-align: right;">¥${(order.price * order.quantity).toLocaleString()}</td>
                  </tr>
                `;
              }).join('');
            }).join('')}
            <tr style="font-weight: bold; background: #f0f0f0;">
              <td style="text-align: center;">合計</td>
              <td style="text-align: center;">${totalPeople}名</td>
              <td style="text-align: center;">${totalQuantity}個</td>
              <td style="text-align: right;">¥${totalAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      `;
    }
  } catch (error) {
    console.error('Error loading daily orders:', error);
  }
}

// 利用可能な月次集計期間を読み込み
async function loadAvailablePeriods() {
  try {
    const response = await fetch(`${API_BASE}/orders/available-periods`);
    const periods = await response.json();

    if (periods.length === 0) {
      return;
    }

    // 利用可能な年を取得
    const availableYears = [...new Set(periods.map(p => p.year))].sort();

    // 年のドロップダウンを更新
    const yearSelect = document.getElementById('monthly-year');
    yearSelect.innerHTML = availableYears.map(year =>
      `<option value="${year}">${year}年</option>`
    ).join('');

    // 月のドロップダウンの月名マッピング
    const monthNames = {
      '01': '1月度（12/16~1/15）',
      '02': '2月度（1/16~2/15）',
      '03': '3月度（2/16~3/15）',
      '04': '4月度（3/16~4/15）',
      '05': '5月度（4/16~5/15）',
      '06': '6月度（5/16~6/15）',
      '07': '7月度（6/16~7/15）',
      '08': '8月度（7/16~8/15）',
      '09': '9月度（8/16~9/15）',
      '10': '10月度（9/16~10/15）',
      '11': '11月度（10/16~11/15）',
      '12': '12月度（11/16~12/15）'
    };

    // 利用可能な月を取得（重複排除）
    const availableMonths = [...new Set(periods.map(p => p.month))].sort();

    // 月のドロップダウンを更新
    const monthSelect = document.getElementById('monthly-month');
    monthSelect.innerHTML = availableMonths.map(month =>
      `<option value="${month}">${monthNames[month]}</option>`
    ).join('');

    // 最新の期間をデフォルトに設定
    const latestPeriod = periods[periods.length - 1];
    yearSelect.value = latestPeriod.year;
    monthSelect.value = latestPeriod.month;

  } catch (error) {
    console.error('Error loading available periods:', error);
  }
}

// 月次集計
document.getElementById('monthly-summary-btn').addEventListener('click', async () => {
  const year = document.getElementById('monthly-year').value;
  const month = document.getElementById('monthly-month').value;

  try {
    const response = await fetch(`${API_BASE}/orders/summary/monthly?year=${year}&month=${month}`);
    const summary = await response.json();

    const summaryDiv = document.getElementById('monthly-summary');

    if (summary.length === 0) {
      summaryDiv.innerHTML = '<p class="empty-state">データがありません</p>';
      return;
    }

    summaryDiv.innerHTML = `
      <table>
        <thead>
          <tr>
            <th style="text-align: center;">従業員</th>
            <th style="text-align: center;">注文回数</th>
            <th style="text-align: center;">合計個数</th>
            <th style="text-align: center;">合計金額</th>
            <th style="text-align: center;">補助</th>
            <th style="text-align: center;">負担金額</th>
          </tr>
        </thead>
        <tbody>
          ${summary.map(item => {
            const subsidy = item.order_count * 100;
            const personalBurden = item.total_amount - subsidy;
            return `
              <tr>
                <td style="text-align: center;">${item.user_name}</td>
                <td style="text-align: center;">${item.order_count}回</td>
                <td style="text-align: center;">${item.total_quantity}個</td>
                <td style="text-align: center;">¥${item.total_amount.toLocaleString()}</td>
                <td style="text-align: center;">¥${subsidy.toLocaleString()}</td>
                <td style="text-align: center;">¥${personalBurden.toLocaleString()}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error loading monthly summary:', error);
  }
});

// 月別画像のドラッグ&ドロップとファイル選択
const monthlyDropzone = document.getElementById('monthly-image-dropzone');
const monthlyFileInput = document.getElementById('monthly-image-file');
const monthlyPreview = document.getElementById('monthly-image-preview');
const monthlyPreviewImg = document.getElementById('monthly-preview-img');
const monthlyFilename = document.getElementById('monthly-image-filename');
const monthlyImageUrl = document.getElementById('monthly-image-url');

// ドラッグ&ドロップイベント
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  monthlyDropzone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  monthlyDropzone.addEventListener(eventName, () => {
    monthlyDropzone.classList.add('highlight');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  monthlyDropzone.addEventListener(eventName, () => {
    monthlyDropzone.classList.remove('highlight');
  });
});

monthlyDropzone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleMonthlyImageFiles(files);
});

// ファイル選択イベント
monthlyFileInput.addEventListener('change', (e) => {
  handleMonthlyImageFiles(e.target.files);
});

// 画像ファイル処理
async function handleMonthlyImageFiles(files) {
  if (files.length === 0) return;

  const file = files[0];

  // 画像ファイルチェック
  if (!file.type.startsWith('image/')) {
    alert('画像ファイルを選択してください');
    return;
  }

  // プレビュー表示
  const reader = new FileReader();
  reader.onload = (e) => {
    monthlyPreviewImg.src = e.target.result;
    monthlyFilename.textContent = file.name;
    monthlyPreview.style.display = 'block';
  };
  reader.readAsDataURL(file);

  // サーバーにアップロード
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`${API_BASE}/upload-image`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      monthlyImageUrl.value = data.imageUrl;
      console.log('画像アップロード成功:', data.imageUrl);
    } else {
      alert(data.error || '画像アップロードに失敗しました');
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    alert('画像アップロードエラーが発生しました');
  }
}

// 月別画像設定
document.getElementById('set-monthly-image-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const imageUrl = document.getElementById('monthly-image-url').value;
  if (!imageUrl) {
    alert('画像を選択してください');
    return;
  }

  const monthValue = document.getElementById('monthly-image-month').value; // "2025-01" 形式
  const [year, month] = monthValue.split('-');

  const imageData = {
    year: parseInt(year),
    month: parseInt(month),
    image_url: imageUrl
  };

  try {
    const response = await fetch(`${API_BASE}/monthly-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imageData)
    });

    const data = await response.json();

    if (response.ok) {
      alert(`${month}月の画像を設定しました！`);
      document.getElementById('set-monthly-image-form').reset();
      monthlyPreview.style.display = 'none';
      monthlyImageUrl.value = '';
    } else {
      alert(data.error || '画像設定に失敗しました');
    }
  } catch (error) {
    console.error('Error setting monthly image:', error);
    alert('画像設定エラーが発生しました');
  }
});

// メニュー追加
document.getElementById('add-menu-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const today = new Date().toISOString().split('T')[0];

  const menuData = {
    name: document.getElementById('menu-name').value,
    description: null,
    price: parseInt(document.getElementById('menu-price').value),
    available_date: today,
    image_url: null
  };

  try {
    const response = await fetch(`${API_BASE}/menus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(menuData)
    });

    const data = await response.json();

    if (response.ok) {
      alert('メニューを追加しました！');
      document.getElementById('add-menu-form').reset();
      await loadAllMenus();
    } else {
      alert(data.error || 'メニュー追加に失敗しました');
    }
  } catch (error) {
    console.error('Error adding menu:', error);
    alert('メニュー追加エラーが発生しました');
  }
});

// メニュー削除
window.deleteMenu = async function(menuId) {
  if (!confirm('このメニューを削除しますか？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/menus/${menuId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (response.ok) {
      alert('メニューを削除しました');
      await loadAllMenus();
    } else {
      alert(data.error || 'メニュー削除に失敗しました');
    }
  } catch (error) {
    console.error('Delete menu error:', error);
    alert('削除エラーが発生しました');
  }
};

// 全メニュー読み込み
async function loadAllMenus() {
  try {
    const response = await fetch(`${API_BASE}/menus`);
    const menus = await response.json();

    const menusDiv = document.getElementById('all-menus');

    if (menus.length === 0) {
      menusDiv.innerHTML = '<div class="empty-state"><p>登録済みメニューがありません</p></div>';
      return;
    }

    menusDiv.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>メニュー名</th>
            <th>価格</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${menus.map(menu => `
            <tr>
              <td>${menu.name}</td>
              <td>¥${menu.price}</td>
              <td>
                <button class="btn btn-danger btn-sm" onclick="deleteMenu(${menu.id})">削除</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error loading all menus:', error);
  }
}

// 初期化
setupTabs();
