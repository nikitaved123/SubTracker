// ========== СИСТЕМА АУТЕНТИФИКАЦИИ ==========
let currentUser = null;

function getUsers() {
  const users = localStorage.getItem('subtrack_users');
  return users ? JSON.parse(users) : [];
}

function saveUsers(users) {
  localStorage.setItem('subtrack_users', JSON.stringify(users));
}

function getUserData(email) {
  const data = localStorage.getItem(`subtrack_data_${email}`);
  if (data) {
    return JSON.parse(data);
  }
  return {
    subscriptions: [
      { 
        id: "sub1", name: "Яндекс Музыка", price: 249, cycle: "monthly", startDate: "2024-01-12", nextBill: "2025-05-20", 
        color: "green", icon: "ti-music", category: "Музыка",
        priceHistory: [
          { date: "2024-01-12", price: 199 },
          { date: "2024-08-01", price: 229 },
          { date: "2025-01-15", price: 249 }
        ]
      },
      { 
        id: "sub2", name: "Кинопоиск HD", price: 399, cycle: "monthly", startDate: "2024-02-03", nextBill: "2025-06-03", 
        color: "blue", icon: "ti-device-tv", category: "Видео",
        priceHistory: [
          { date: "2024-02-03", price: 349 },
          { date: "2024-09-10", price: 399 }
        ]
      },
      { 
        id: "sub3", name: "Apple iCloud", price: 99, cycle: "monthly", startDate: "2024-04-10", nextBill: "2025-05-28", 
        color: "purple", icon: "ti-cloud", category: "Облако",
        priceHistory: [
          { date: "2024-04-10", price: 99 }
        ]
      },
      { 
        id: "sub4", name: "Telegram Premium", price: 159, cycle: "monthly", startDate: "2024-08-01", nextBill: "2025-05-22", 
        color: "orange", icon: "ti-brand-telegram", category: "Соцсети",
        priceHistory: [
          { date: "2024-08-01", price: 129 },
          { date: "2025-02-10", price: 159 }
        ]
      }
    ]
  };
}

function saveUserData(email, data) {
  localStorage.setItem(`subtrack_data_${email}`, JSON.stringify(data));
}

function register(name, email, password) {
  const users = getUsers();
  if (users.find(u => u.email === email)) {
    return { success: false, error: 'Пользователь с таким email уже существует' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Пароль должен быть не менее 6 символов' };
  }
  const newUser = {
    id: Date.now(),
    name: name,
    email: email,
    password: password,
    registeredAt: new Date().toISOString()
  };
  users.push(newUser);
  saveUsers(users);
  return { success: true };
}

function login(email, password) {
  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    return { success: true, user: user };
  }
  return { success: false, error: 'Неверный email или пароль' };
}

function logout() {
  currentUser = null;
  localStorage.removeItem('subtrack_current_user');
  document.getElementById('app').style.display = 'none';
  document.getElementById('authModal').style.display = 'flex';
}

// ========== ОСНОВНАЯ ЛОГИКА ПОДПИСОК ==========
let subscriptions = [];
let priceChartInstance = null;

function formatPrice(price) { return price + " ₽"; }
function formatDate(dateStr) { 
  let d = new Date(dateStr); 
  return d.toLocaleDateString('ru-RU', {day: 'numeric', month: 'short', year: 'numeric'}); 
}
function getDaysDiff(dateStr) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const billDate = new Date(dateStr);
  billDate.setHours(0,0,0,0);
  return Math.ceil((billDate - today) / (1000*60*60*24));
}
function getBadgeInfo(dateStr) {
  const days = getDaysDiff(dateStr);
  if (days <= 7) return { text: days + " дн.", class: "badge-warn" };
  return { text: days + " дней", class: "badge-ok" };
}

function renderSubCardActions(subId) {
  return `
    <div class="sub-actions">
      <button type="button" class="sub-action-btn edit" data-action="edit" data-id="${subId}" title="Редактировать" aria-label="Редактировать подписку">
        <i class="ti ti-pencil"></i>
      </button>
      <button type="button" class="sub-action-btn delete" data-action="delete" data-id="${subId}" title="Удалить" aria-label="Удалить подписку">
        <i class="ti ti-trash"></i>
      </button>
    </div>
  `;
}

function editSubscription(id) {
  const sub = subscriptions.find(s => s.id === id);
  if (!sub || !currentUser) return;

  const name = prompt("Название сервиса:", sub.name);
  if (name === null) return;
  if (!name.trim()) {
    alert("Название не может быть пустым");
    return;
  }

  let price = parseInt(prompt("Стоимость в рублях (месяц):", String(sub.price)), 10);
  if (isNaN(price) || price <= 0) price = sub.price;

  let nextBillDate = prompt("Дата следующего списания (ГГГГ-ММ-ДД)", sub.nextBill);
  if (nextBillDate === null) return;
  if (!nextBillDate || isNaN(Date.parse(nextBillDate))) {
    alert("Некорректная дата");
    return;
  }

  const oldPrice = sub.price;
  sub.name = name.trim();
  sub.price = price;
  sub.nextBill = nextBillDate;

  if (price !== oldPrice) {
    const today = new Date().toISOString().slice(0, 10);
    const lastEntry = sub.priceHistory[sub.priceHistory.length - 1];
    if (!lastEntry || lastEntry.date !== today || lastEntry.price !== price) {
      sub.priceHistory.push({ date: today, price: price });
    }
  }

  saveUserData(currentUser.email, { subscriptions });
  updateAllUI();
}

function deleteSubscription(id) {
  const sub = subscriptions.find(s => s.id === id);
  if (!sub || !currentUser) return;

  if (!confirm(`Удалить подписку «${sub.name}»?`)) return;

  subscriptions = subscriptions.filter(s => s.id !== id);
  saveUserData(currentUser.email, { subscriptions });
  updateAllUI();
}

function handleSubCardAction(event) {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  event.stopPropagation();

  const id = btn.dataset.id;
  if (btn.dataset.action === "edit") editSubscription(id);
  if (btn.dataset.action === "delete") deleteSubscription(id);
}

function renderHomePage() {
  const totalMonthly = subscriptions.reduce((sum, s) => sum + s.price, 0);
  const yearlyTotal = totalMonthly * 12;
  const urgentCount = subscriptions.filter(s => getDaysDiff(s.nextBill) <= 7).length;
  document.getElementById("homeStats").innerHTML = `
    <div class="stat-card"><div class="stat-label">В месяц</div><div class="stat-value">${totalMonthly} ₽</div><div class="stat-sub">${subscriptions.length} активных подписок</div></div>
    <div class="stat-card"><div class="stat-label">В год</div><div class="stat-value">${yearlyTotal} ₽</div><div class="stat-sub">прогнозируемые расходы</div></div>
    <div class="stat-card"><div class="stat-label">Скоро списание</div><div class="stat-value warning-text">${urgentCount} сервиса</div><div class="stat-sub">в ближайшие 7 дней</div></div>
  `;
  const homeList = document.getElementById("homeSubList");
  if(subscriptions.length === 0) { 
    homeList.innerHTML = '<div class="empty-state">Нет активных подписок. Добавьте первую ➕</div>'; 
    return; 
  }
  homeList.innerHTML = subscriptions.map(sub => {
    const badge = getBadgeInfo(sub.nextBill);
    return `
      <div class="sub-card" data-id="${sub.id}">
        <div class="sub-icon ${sub.color}"><i class="ti ${sub.icon}"></i></div>
        <div class="sub-info"><div class="sub-name">${sub.name}</div><div class="sub-cycle">Ежемесячно · с ${new Date(sub.startDate).toLocaleDateString('ru-RU')}</div></div>
        <div class="sub-right"><div class="sub-price">${formatPrice(sub.price)}</div><div class="sub-date">${formatDate(sub.nextBill)}</div><span class="badge ${badge.class}">${badge.text}</span></div>
        ${renderSubCardActions(sub.id)}
      </div>
    `;
  }).join('');
}

function renderSubscriptionsPage() {
  const container = document.getElementById("allSubscriptionsContainer");
  if(subscriptions.length === 0) {
    container.innerHTML = '<div class="empty-state">Нет активных подписок. Нажмите «Добавить»</div>';
    return;
  }
  container.innerHTML = subscriptions.map(sub => {
    const badge = getBadgeInfo(sub.nextBill);
    return `
      <div class="sub-card" data-id="${sub.id}">
        <div class="sub-icon ${sub.color}"><i class="ti ${sub.icon}"></i></div>
        <div class="sub-info"><div class="sub-name">${sub.name}</div><div class="sub-cycle">Ежемесячно · след. платеж ${formatDate(sub.nextBill)}</div></div>
        <div class="sub-right"><div class="sub-price">${formatPrice(sub.price)}</div><span class="badge ${badge.class}" style="margin-top:8px;">${badge.text}</span></div>
        ${renderSubCardActions(sub.id)}
      </div>
    `;
  }).join('');
}

function renderStatsPage() {
  const totalMonth = subscriptions.reduce((a,b)=>a+b.price,0);
  const avg = subscriptions.length ? (totalMonth/subscriptions.length).toFixed(0) : 0;
  const maxSub = subscriptions.length ? [...subscriptions].sort((a,b)=>b.price-a.price)[0] : null;
  document.getElementById("statsDetailed").innerHTML = `
    <div class="stat-card"><div class="stat-label">📆 Месячные траты</div><div class="stat-value">${totalMonth} ₽</div><div class="stat-sub">всего подписок: ${subscriptions.length}</div></div>
    <div class="stat-card"><div class="stat-label">📈 Средняя цена</div><div class="stat-value">${avg} ₽</div><div class="stat-sub">на один сервис</div></div>
    <div class="stat-card"><div class="stat-label">💰 Самая дорогая</div><div class="stat-value">${maxSub ? maxSub.name : '—'}</div><div class="stat-sub">${maxSub ? maxSub.price + ' ₽' : ''}</div></div>
  `;
}

function renderNotificationsPage() {
  const upcoming = subscriptions.filter(s => getDaysDiff(s.nextBill) <= 10).sort((a,b)=> getDaysDiff(a.nextBill) - getDaysDiff(b.nextBill));
  const container = document.getElementById("notificationsList");
  if(upcoming.length === 0) {
    container.innerHTML = '<div class="empty-state">✅ Нет предстоящих уведомлений. Все спокойно!</div>';
    return;
  }
  container.innerHTML = upcoming.map(sub => {
    const days = getDaysDiff(sub.nextBill);
    const urgency = days <= 3 ? '⚠️ Скоро!' : '📅 Напоминание';
    return `<div class="notif-item"><div><i class="ti ${sub.icon}" style="margin-right:10px;"></i><strong>${sub.name}</strong></div><div style="margin-top:8px;">${urgency} · списание ${formatPrice(sub.price)} через ${days} дн. (${formatDate(sub.nextBill)})</div></div>`;
  }).join('');
}

function renderPriceAnalytics() {
  const allPriceEvents = [];
  subscriptions.forEach(sub => {
    sub.priceHistory.forEach(hist => {
      allPriceEvents.push({ date: hist.date, price: hist.price });
    });
  });
  allPriceEvents.sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const dateMap = new Map();
  allPriceEvents.forEach(event => {
    if (!dateMap.has(event.date)) dateMap.set(event.date, []);
    dateMap.get(event.date).push(event.price);
  });
  
  const labels = [];
  const avgPrices = [];
  for (let [date, prices] of dateMap.entries()) {
    labels.push(formatDate(date));
    const avg = prices.reduce((a,b) => a + b, 0) / prices.length;
    avgPrices.push(Math.round(avg));
  }
  
  const ctx = document.getElementById('priceChart').getContext('2d');
  if (priceChartInstance) priceChartInstance.destroy();
  if (labels.length > 0) {
    priceChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Средняя цена подписок (₽)',
          data: avgPrices,
          borderColor: '#6d5dfc',
          backgroundColor: 'rgba(109, 93, 252, 0.05)',
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: '#5b4bf0',
          pointBorderColor: '#fff',
          pointHoverRadius: 7,
          tension: 0.2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 12 } } }
        }
      }
    });
  }
  
  let tableHtml = `
    <table class="price-history-table">
      <thead><tr><th>Подписка</th><th>Дата изменения</th><th>Цена</th><th>Изменение</th></tr></thead>
      <tbody>
  `;
  subscriptions.forEach(sub => {
    const history = [...sub.priceHistory].sort((a,b) => new Date(a.date) - new Date(b.date));
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      let changeHtml = '';
      if (i > 0) {
        const prevPrice = history[i-1].price;
        const diff = entry.price - prevPrice;
        const percent = ((diff / prevPrice) * 100).toFixed(1);
        if (diff > 0) {
          changeHtml = `<span class="price-change-badge price-change-up"><i class="ti ti-arrow-up"></i> +${diff}₽ (+${percent}%)</span>`;
        } else if (diff < 0) {
          changeHtml = `<span class="price-change-badge price-change-down"><i class="ti ti-arrow-down"></i> ${diff}₽ (${percent}%)</span>`;
        } else {
          changeHtml = `<span class="price-change-badge price-change-neutral"><i class="ti ti-minus"></i> 0₽</span>`;
        }
      } else {
        changeHtml = `<span class="price-change-badge price-change-neutral">Начальная цена</span>`;
      }
      tableHtml += `
        <tr>
          <td><strong>${sub.name}</strong> <i class="ti ${sub.icon}" style="opacity:0.6;"></i></td>
          <td>${formatDate(entry.date)}</td>
          <td>${formatPrice(entry.price)}</td>
          <td>${changeHtml}</td>
        </tr>
      `;
    }
  });
  tableHtml += '</tbody></table>';
  document.getElementById("priceHistoryTable").innerHTML = tableHtml;
}

function renderProfilePage() {
  if (!currentUser) return;
  document.getElementById("profileEmail").textContent = currentUser.email;
  document.getElementById("profileName").textContent = currentUser.name;
  document.getElementById("profileDate").textContent = new Date(currentUser.registeredAt).toLocaleDateString('ru-RU');
  document.getElementById("profileSubCount").textContent = subscriptions.length;
  document.getElementById("profileInfo").innerHTML = `<h2>${currentUser.name}</h2><p>${currentUser.email}</p>`;
}

function showAddSubscriptionDialog() {
  let name = prompt("Название сервиса:", "Новая подписка");
  if(!name) return;
  let price = parseInt(prompt("Текущая стоимость в рублях (месяц):", "299"));
  if(isNaN(price) || price <=0) price = 299;
  let nextBillDate = prompt("Дата следующего списания (ГГГГ-ММ-ДД)", "2025-06-15");
  if(!nextBillDate || isNaN(Date.parse(nextBillDate))) nextBillDate = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);
  
  const colors = ["green","blue","purple","orange"];
  const icons = ["ti-wallet","ti-cloud","ti-device-mobile","ti-crown"];
  const newId = "sub_" + Date.now();
  
  subscriptions.push({
    id: newId, name: name, price: price, cycle: "monthly", startDate: new Date().toISOString().slice(0,10),
    nextBill: nextBillDate, color: colors[subscriptions.length % colors.length], 
    icon: icons[subscriptions.length % icons.length], category: "Другое",
    priceHistory: [{ date: new Date().toISOString().slice(0,10), price: price }]
  });
  
  saveUserData(currentUser.email, { subscriptions });
  updateAllUI();
  alert(`Подписка "${name}" добавлена!`);
}

function updateAllUI() {
  renderHomePage();
  renderSubscriptionsPage();
  renderStatsPage();
  renderNotificationsPage();
  renderPriceAnalytics();
  renderProfilePage();
}

function initApp() {
  const savedUser = localStorage.getItem('subtrack_current_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    const userData = getUserData(currentUser.email);
    subscriptions = userData.subscriptions;
    document.getElementById('app').style.display = 'flex';
    document.getElementById('authModal').style.display = 'none';
    updateAllUI();
  } else {
    document.getElementById('app').style.display = 'none';
    document.getElementById('authModal').style.display = 'flex';
  }
}

document.getElementById('showRegisterBtn').addEventListener('click', () => {
  document.getElementById('loginForm').classList.remove('active');
  document.getElementById('registerForm').classList.add('active');
});
document.getElementById('showLoginBtn').addEventListener('click', () => {
  document.getElementById('registerForm').classList.remove('active');
  document.getElementById('loginForm').classList.add('active');
});
document.getElementById('closeModalBtn').addEventListener('click', () => {
  if (!currentUser) return;
  document.getElementById('authModal').style.display = 'none';
});

document.getElementById('loginBtn').addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const result = login(email, password);
  if (result.success) {
    currentUser = result.user;
    localStorage.setItem('subtrack_current_user', JSON.stringify(currentUser));
    const userData = getUserData(currentUser.email);
    subscriptions = userData.subscriptions;
    document.getElementById('app').style.display = 'flex';
    document.getElementById('authModal').style.display = 'none';
    updateAllUI();
  } else {
    alert(result.error);
  }
});

document.getElementById('registerBtn').addEventListener('click', () => {
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirmPassword').value;
  if (password !== confirm) {
    alert('Пароли не совпадают');
    return;
  }
  const result = register(name, email, password);
  if (result.success) {
    alert('Регистрация успешна! Теперь войдите.');
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('regName').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('regConfirmPassword').value = '';
  } else {
    alert(result.error);
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  logout();
});

const navItems = document.querySelectorAll('.nav-item[data-page]');
const pages = document.querySelectorAll('.page');
const pageTitleSpan = document.getElementById('pageTitle');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    const pageId = item.dataset.page;
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    pageTitleSpan.textContent = item.innerText.trim();
    if(pageId === 'stats') renderPriceAnalytics();
    if(pageId === 'profile') renderProfilePage();
  });
});

document.getElementById('globalAddBtn').addEventListener('click', showAddSubscriptionDialog);

document.getElementById('homeSubList').addEventListener('click', handleSubCardAction);
document.getElementById('allSubscriptionsContainer').addEventListener('click', handleSubCardAction);

const notifToggle = document.getElementById('notifToggle');
if (notifToggle) {
  notifToggle.classList.add('active');
  notifToggle.addEventListener('click', () => notifToggle.classList.toggle('active'));
}

initApp();
