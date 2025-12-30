// 環境に応じてAPI URLを自動設定
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

let currentUser = null;
let allUnavailableDates = []; // 全注文不可日

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

      // メニュー管理タブが開かれた場合、カレンダーを初期化
      if (tabName === 'admin-menus') {
        // カレンダーがまだ読み込まれていない場合のみ読み込む
        if (unavailableMonthSelect && unavailableMonthSelect.value) {
          loadUnavailableCalendar();
        }
      }
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

  const lastName = document.getElementById('register-last-name').value;
  const firstName = document.getElementById('register-first-name').value;
  const name = lastName + firstName; // 姓と名を結合
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

  // 注文不可日を読み込み
  await loadAllUnavailableDates();

  // 当日注文を読み込み
  await loadTodayOrder();

  // 月選択プルダウンを初期化（予約注文用）
  initMonthSelector();

  await loadOrderHistory();
}

// 全注文不可日を取得
async function loadAllUnavailableDates() {
  try {
    const response = await fetch(`${API_BASE}/admin/unavailable-dates`);
    allUnavailableDates = await response.json();
  } catch (error) {
    console.error('Error loading unavailable dates:', error);
    allUnavailableDates = [];
  }
}

// 指定日が注文不可日かチェック
function isUnavailableDate(dateStr) {
  return allUnavailableDates.some(d => d.unavailable_date === dateStr);
}

// 当日注文の読み込み
async function loadTodayOrder() {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    // タイムゾーンを考慮した今日の日付を取得
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const todayOrderDiv = document.getElementById('today-order');

    // 今日が注文不可日かチェック
    if (isUnavailableDate(today)) {
      todayOrderDiv.innerHTML = `
        <div class="card">
          <div class="alert alert-error">
            <p style="text-align: center; font-size: 16px; margin: 20px 0;">
              本日は注文できません<br>
              明日以降の注文は「予約注文」タブからお願いします。
            </p>
          </div>
        </div>
      `;
      return;
    }

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

    // 既に注文済みの場合はキャンセル画面を表示
    if (isOrdered) {
      todayOrderDiv.innerHTML = `
        <div class="card today-order-card">
          <h3>${formattedDate}の注文</h3>
          <div class="alert alert-success" style="margin: 20px 0; padding: 20px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px;">
            <p style="text-align: center; font-size: 18px; margin: 10px 0; color: #155724;">
              ✓ 注文済み
            </p>
            <p style="text-align: center; font-size: 16px; margin: 5px 0; color: #155724;">
              配達先: ${todayOrder.delivery_location}
            </p>
            <p style="text-align: center; font-size: 16px; margin: 5px 0; color: #155724;">
              数量: ${todayOrder.quantity}個
            </p>
          </div>
          <div class="today-order-content">
            <button class="btn btn-danger btn-large" onclick="cancelTodayOrder()">注文をキャンセル</button>
          </div>
        </div>
      `;
    } else {
      // 未注文の場合は注文フォームを表示
      todayOrderDiv.innerHTML = `
        <div class="card today-order-card">
          <h3>${formattedDate}の注文</h3>
          <div class="today-order-content">
            <div class="quantity-selector-large">
              <label>配達先：</label>
              <select id="today-delivery-location" class="quantity-select-large">
                <option value="乗務員区" ${currentUser.delivery_location === '乗務員区' ? 'selected' : ''}>乗務員区</option>
                <option value="運転指令" ${currentUser.delivery_location === '運転指令' ? 'selected' : ''}>運転指令</option>
                <option value="管理駅" ${currentUser.delivery_location === '管理駅' ? 'selected' : ''}>管理駅</option>
                <option value="索道" ${currentUser.delivery_location === '索道' ? 'selected' : ''}>索道</option>
                <option value="技術所" ${currentUser.delivery_location === '技術所' ? 'selected' : ''}>技術所</option>
              </select>
            </div>
            <div class="quantity-selector-large">
              <label>数量：</label>
              <select id="today-quantity" class="quantity-select-large">
                <option value="1" selected>1個</option>
                <option value="2">2個</option>
                <option value="3">3個</option>
                <option value="4">4個</option>
                <option value="5">5個</option>
              </select>
            </div>
            <button class="btn btn-primary btn-large" onclick="submitTodayOrder()">注文する</button>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading today order:', error);
  }
}

// 当日注文の送信
window.submitTodayOrder = async function() {
  const quantity = parseInt(document.getElementById('today-quantity').value);
  const deliveryLocation = document.getElementById('today-delivery-location').value;

  // タイムゾーンを考慮した今日の日付を取得
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  try {
    const menuId = 1;

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        menu_id: menuId,
        order_date: today,
        quantity: quantity,
        delivery_location: deliveryLocation
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert(`本日の注文を受け付けました！（${quantity}個）`);
      await loadOrderHistory();
      await loadTodayOrder(); // 当日注文画面を更新
    } else {
      alert(data.error || '注文に失敗しました');
    }
  } catch (error) {
    console.error('Order error:', error);
    alert('注文エラーが発生しました');
  }
};

// 当日注文のキャンセル
window.cancelTodayOrder = async function() {
  if (!confirm('本日の注文をキャンセルしますか？')) {
    return;
  }

  // タイムゾーンを考慮した今日の日付を取得
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  try {
    const menuId = 1;

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        menu_id: menuId,
        order_date: today,
        quantity: 0,  // 数量0でキャンセル
        delivery_location: currentUser.delivery_location
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert('本日の注文をキャンセルしました');
      await loadOrderHistory();
      await loadTodayOrder(); // 当日注文画面を更新
    } else {
      alert(data.error || 'キャンセルに失敗しました');
    }
  } catch (error) {
    console.error('Cancel error:', error);
    alert('キャンセルエラーが発生しました');
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

// 予約注文の月を変更
window.changeOrderMonth = function(delta) {
  const select = document.getElementById('order-month-select');
  if (!select || !select.value) return;

  const [currentYear, currentMonth] = select.value.split('-').map(Number);
  const currentDate = new Date(currentYear, currentMonth - 1, 1);

  // 新しい月を計算
  currentDate.setMonth(currentDate.getMonth() + delta);
  const newYear = currentDate.getFullYear();
  const newMonth = currentDate.getMonth() + 1;

  // 範囲チェック（今月から2ヶ月先まで）
  const now = new Date();
  const minDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const newDate = new Date(newYear, newMonth - 1, 1);

  if (newDate < minDate || newDate > maxDate) {
    return; // 範囲外なら何もしない
  }

  // 新しい値を設定
  const newValue = `${newYear}-${newMonth}`;
  select.value = newValue;

  // メニューを再読み込み
  loadMonthlyMenus(newYear, newMonth);
};

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
      const isInDateRange = date >= cutoffDate && date <= maxDate;
      const isUnavailable = isUnavailableDate(dateStr);
      const isAvailable = isInDateRange && !isUnavailable;

      const existingOrder = orderMap[dateStr];
      const existingQty = existingOrder ? existingOrder.quantity : 0;
      const existingLocation = existingOrder ? existingOrder.deliveryLocation : '';

      // ボタンのラベルとスタイルを決定
      const hasOrder = existingQty > 0;

      if (isUnavailable && isInDateRange) {
        // 注文不可日の表示
        rows.push(`
          <tr class="disabled-row">
            <td>${day}日</td>
            <td>${weekday}</td>
            <td colspan="3" style="text-align: center; color: #e74c3c; font-weight: bold;">注文不可</td>
          </tr>
        `);
      } else if (isAvailable) {
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

  // 今日の日付をデフォルトに設定（タイムゾーンを考慮）
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;
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

// 本日の注文の日付を変更
window.changeDailyDate = async function(delta) {
  const input = document.getElementById('admin-daily-date');
  if (!input || !input.value) return;

  // 日付文字列をパースして、年月日を取得
  const [year, month, day] = input.value.split('-').map(Number);

  // Date オブジェクトを作成（ローカルタイムゾーン）
  const currentDate = new Date(year, month - 1, day);

  // 日付を変更
  currentDate.setDate(currentDate.getDate() + delta);

  // YYYY-MM-DD 形式で取得
  const newYear = currentDate.getFullYear();
  const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
  const newDay = String(currentDate.getDate()).padStart(2, '0');
  const newValue = `${newYear}-${newMonth}-${newDay}`;

  input.value = newValue;

  // 注文データを再読み込み
  await loadDailyOrders(newValue);
  await loadDeliveryLocations(newValue);
};

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

    // 所属ごとにグループ化
    const groupedByLocation = {};
    summary.forEach(item => {
      const location = item.delivery_location || '未設定';
      if (!groupedByLocation[location]) {
        groupedByLocation[location] = [];
      }
      groupedByLocation[location].push(item);
    });

    // 全体の合計を計算
    let grandTotalOrders = 0;
    let grandTotalQuantity = 0;
    let grandTotalAmount = 0;
    let grandTotalSubsidy = 0;
    let grandTotalBurden = 0;

    // 所属ごとのテーブルを生成
    let tablesHTML = '';
    Object.keys(groupedByLocation).sort().forEach(location => {
      const items = groupedByLocation[location];

      // 所属ごとの小計を計算
      let locationTotalOrders = 0;
      let locationTotalQuantity = 0;
      let locationTotalAmount = 0;
      let locationTotalSubsidy = 0;
      let locationTotalBurden = 0;

      const rowsHTML = items.map(item => {
        const subsidy = item.order_count * 100;
        const personalBurden = item.total_amount - subsidy;

        locationTotalOrders += item.order_count;
        locationTotalQuantity += item.total_quantity;
        locationTotalAmount += item.total_amount;
        locationTotalSubsidy += subsidy;
        locationTotalBurden += personalBurden;

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
      }).join('');

      // 全体の合計に加算
      grandTotalOrders += locationTotalOrders;
      grandTotalQuantity += locationTotalQuantity;
      grandTotalAmount += locationTotalAmount;
      grandTotalSubsidy += locationTotalSubsidy;
      grandTotalBurden += locationTotalBurden;

      // 各所属のテーブル
      tablesHTML += `
        <div class="card" style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #3498db; padding-bottom: 8px;">
            <h3 style="margin: 0; color: #2c3e50;">${location}</h3>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-success btn-sm export-location-csv" data-location="${location}" style="font-size: 12px; padding: 5px 10px;">CSV</button>
              <button class="btn btn-success btn-sm export-location-excel" data-location="${location}" style="font-size: 12px; padding: 5px 10px;">Excel</button>
            </div>
          </div>
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
              ${rowsHTML}
              <tr style="background-color: #ecf0f1; font-weight: 600;">
                <td style="text-align: center;">小計</td>
                <td style="text-align: center;">${locationTotalOrders}回</td>
                <td style="text-align: center;">${locationTotalQuantity}個</td>
                <td style="text-align: center;">¥${locationTotalAmount.toLocaleString()}</td>
                <td style="text-align: center;">¥${locationTotalSubsidy.toLocaleString()}</td>
                <td style="text-align: center;">¥${locationTotalBurden.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    });

    // 全体の合計テーブル
    const grandTotalHTML = `
      <div class="card" style="background-color: #e8f4f8; border: 2px solid #3498db;">
        <h3 style="margin-bottom: 15px; color: #2c3e50;">全体合計</h3>
        <table>
          <thead>
            <tr>
              <th style="text-align: center;">項目</th>
              <th style="text-align: center;">注文回数</th>
              <th style="text-align: center;">合計個数</th>
              <th style="text-align: center;">合計金額</th>
              <th style="text-align: center;">補助</th>
              <th style="text-align: center;">負担金額</th>
            </tr>
          </thead>
          <tbody>
            <tr style="font-weight: 700; font-size: 16px;">
              <td style="text-align: center;">合計</td>
              <td style="text-align: center;">${grandTotalOrders}回</td>
              <td style="text-align: center;">${grandTotalQuantity}個</td>
              <td style="text-align: center;">¥${grandTotalAmount.toLocaleString()}</td>
              <td style="text-align: center;">¥${grandTotalSubsidy.toLocaleString()}</td>
              <td style="text-align: center;">¥${grandTotalBurden.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // 全所属まとめて出力ボタン
    const combinedExportHTML = `
      <div class="export-buttons" style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
        <h3 style="margin-bottom: 10px; font-size: 16px; color: #2c3e50;">全所属まとめて出力</h3>
        <div style="display: flex; gap: 10px;">
          <button id="export-csv-combined" class="btn btn-success" style="flex: 1;">CSV出力</button>
          <button id="export-excel-combined" class="btn btn-success" style="flex: 1;">Excel出力</button>
        </div>
      </div>
    `;

    summaryDiv.innerHTML = combinedExportHTML + tablesHTML + grandTotalHTML;

    // 全所属まとめて出力ボタンのイベントリスナー
    document.getElementById('export-csv-combined').addEventListener('click', () => {
      window.open(`${API_BASE}/orders/export/monthly-csv-combined?year=${year}&month=${month}`, '_blank');
    });

    document.getElementById('export-excel-combined').addEventListener('click', () => {
      window.open(`${API_BASE}/orders/export/monthly-excel-combined?year=${year}&month=${month}`, '_blank');
    });

    // 動的に追加された所属ごとのエクスポートボタンにイベントリスナーを設定
    document.querySelectorAll('.export-location-csv').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const location = e.target.getAttribute('data-location');
        const year = document.getElementById('monthly-year').value;
        const month = document.getElementById('monthly-month').value;
        window.open(`${API_BASE}/orders/export/monthly-csv-single?year=${year}&month=${month}&location=${encodeURIComponent(location)}`, '_blank');
      });
    });

    document.querySelectorAll('.export-location-excel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const location = e.target.getAttribute('data-location');
        const year = document.getElementById('monthly-year').value;
        const month = document.getElementById('monthly-month').value;
        window.open(`${API_BASE}/orders/export/monthly-excel-single?year=${year}&month=${month}&location=${encodeURIComponent(location)}`, '_blank');
      });
    });
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

// 月別画像月選択のデフォルト値を設定
const monthlyImageMonthInput = document.getElementById('monthly-image-month');
if (monthlyImageMonthInput) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthlyImageMonthInput.value = defaultMonth;
}

// 月別画像の月を変更
window.changeMonthlyImageMonth = function(delta) {
  const input = document.getElementById('monthly-image-month');
  if (!input || !input.value) return;

  const [currentYear, currentMonth] = input.value.split('-').map(Number);
  const currentDate = new Date(currentYear, currentMonth - 1, 1);

  // 新しい月を計算
  currentDate.setMonth(currentDate.getMonth() + delta);
  const newYear = currentDate.getFullYear();
  const newMonth = currentDate.getMonth() + 1;

  // 新しい値を設定
  const newValue = `${newYear}-${String(newMonth).padStart(2, '0')}`;
  input.value = newValue;
};

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

  // タイムゾーンを考慮した今日の日付を取得
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

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

// =========== 注文不可日カレンダー ===========

// 注文不可日の配列
let unavailableDates = [];
// 選択中の日付の配列
let selectedDates = [];

// 月選択の初期化
const unavailableMonthSelect = document.getElementById('unavailable-month-select');
if (unavailableMonthSelect) {
  // デフォルトは今月
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  unavailableMonthSelect.value = defaultMonth;

  // 月変更時にカレンダーを更新
  unavailableMonthSelect.addEventListener('change', async () => {
    await loadUnavailableCalendar();
  });
}

// 注文不可日設定の月を変更
window.changeUnavailableMonth = function(delta) {
  if (!unavailableMonthSelect || !unavailableMonthSelect.value) return;

  const [currentYear, currentMonth] = unavailableMonthSelect.value.split('-').map(Number);
  const currentDate = new Date(currentYear, currentMonth - 1, 1);

  // 新しい月を計算
  currentDate.setMonth(currentDate.getMonth() + delta);
  const newYear = currentDate.getFullYear();
  const newMonth = currentDate.getMonth() + 1;

  // 新しい値を設定
  const newValue = `${newYear}-${String(newMonth).padStart(2, '0')}`;
  unavailableMonthSelect.value = newValue;

  // 選択をクリア
  selectedDates = [];

  // カレンダーを再読み込み
  loadUnavailableCalendar();
};

// カレンダーを読み込む
async function loadUnavailableCalendar() {
  const monthValue = unavailableMonthSelect.value;
  if (!monthValue) return;

  const [year, month] = monthValue.split('-');

  try {
    // その月の注文不可日を取得
    const response = await fetch(`${API_BASE}/admin/unavailable-dates/${year}/${month}`);
    unavailableDates = await response.json();

    // カレンダーを描画
    renderCalendar(parseInt(year), parseInt(month));
  } catch (error) {
    console.error('Error loading unavailable dates:', error);
  }
}

// カレンダーを描画
function renderCalendar(year, month) {
  const calendarDiv = document.getElementById('unavailable-calendar');

  // その月の1日
  const firstDay = new Date(year, month - 1, 1);
  // その月の最終日
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();

  // 1日が何曜日か（0=日曜, 1=月曜, ...）
  const firstDayOfWeek = firstDay.getDay();

  // 今日の日付
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let html = '<div class="calendar-grid">';

  // 曜日ヘッダー
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  weekdays.forEach(day => {
    html += `<div class="calendar-day-header">${day}</div>`;
  });

  // 空白セル（月初めまで）
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // 日付セル
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentDate = new Date(year, month - 1, day);

    // 過去の日付かチェック
    const isPast = currentDate < today;

    // 注文不可日かチェック
    const isUnavailable = unavailableDates.some(d => d.unavailable_date === dateStr);

    // 選択中かチェック
    const isSelected = selectedDates.includes(dateStr);

    let classes = 'calendar-day';
    if (isPast) {
      classes += ' past';
    } else if (isSelected) {
      classes += ' selected';
    } else if (isUnavailable) {
      classes += ' unavailable';
    }

    html += `<div class="${classes}" data-date="${dateStr}" onclick="selectDate('${dateStr}', ${isPast})">${day}</div>`;
  }

  html += '</div>';

  // 凡例と設定ボタン
  html += `
    <div class="calendar-legend">
      <div class="calendar-legend-item">
        <div class="calendar-legend-box available"></div>
        <span>注文可能</span>
      </div>
      <div class="calendar-legend-item">
        <div class="calendar-legend-box" style="background: #cfe2ff; border-color: #3498db;"></div>
        <span>選択中</span>
      </div>
      <div class="calendar-legend-item">
        <div class="calendar-legend-box unavailable"></div>
        <span>注文不可</span>
      </div>
    </div>
    <div style="margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
      <button class="btn btn-success" onclick="applyUnavailableDates()" style="min-width: 200px; flex: 1; max-width: 250px;">設定を適用</button>
      <button class="btn btn-secondary" onclick="clearSelection()" style="min-width: 200px; flex: 1; max-width: 250px;">選択をクリア</button>
    </div>
  `;

  calendarDiv.innerHTML = html;
}

// 日付を選択
window.selectDate = function(dateStr, isPast) {
  // 過去の日付は選択不可
  if (isPast) {
    alert('過去の日付は変更できません');
    return;
  }

  // 既に選択されている場合は選択解除
  const index = selectedDates.indexOf(dateStr);
  if (index > -1) {
    selectedDates.splice(index, 1);
  } else {
    // 選択されていない場合は選択
    selectedDates.push(dateStr);
  }

  // カレンダーを再描画
  const monthValue = unavailableMonthSelect.value;
  const [year, month] = monthValue.split('-');
  renderCalendar(parseInt(year), parseInt(month));
};

// 選択をクリア
window.clearSelection = function() {
  selectedDates = [];
  const monthValue = unavailableMonthSelect.value;
  const [year, month] = monthValue.split('-');
  renderCalendar(parseInt(year), parseInt(month));
};

// 設定を適用
window.applyUnavailableDates = async function() {
  if (selectedDates.length === 0) {
    alert('日付が選択されていません');
    return;
  }

  try {
    // 各選択された日付に対して処理
    const promises = selectedDates.map(async (dateStr) => {
      const isCurrentlyUnavailable = unavailableDates.some(d => d.unavailable_date === dateStr);

      if (isCurrentlyUnavailable) {
        // 注文不可日を削除（注文可能に戻す）
        return fetch(`${API_BASE}/admin/unavailable-dates/${dateStr}`, {
          method: 'DELETE'
        });
      } else {
        // 注文不可日に設定
        return fetch(`${API_BASE}/admin/unavailable-dates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr, reason: null })
        });
      }
    });

    await Promise.all(promises);

    // 選択をクリア
    selectedDates = [];

    // カレンダーを再読み込み
    await loadUnavailableCalendar();

    alert('設定を適用しました');
  } catch (error) {
    console.error('Error applying unavailable dates:', error);
    alert('エラーが発生しました');
  }
};

// 初期化
setupTabs();
