const DB_NAME = 'spendwell';
const STORE = 'expenses';
const categories = {
  Income: { color: '#2c8d72', icon: '↗', terms: 'salary income paycheck wages bonus commission revenue cashflow pay earned paycheck' },
  Investment: { color: '#5d7bba', icon: '◈', terms: 'investment invest brokerage fund stock etf ira 401k account dividend interest savings transfer' },
  'Food & Dining': { color: '#e56b55', icon: '◒', terms: 'coffee cafe restaurant lunch dinner food grocery groceries uber eats takeaway bakery bar' },
  Transport: { color: '#81a6b5', icon: '↗', terms: 'uber lyft taxi bus train metro fuel gas parking toll bike car' },
  Home: { color: '#839a7b', icon: '⌂', terms: 'rent mortgage utility utilities electric water internet home furniture repair' },
  Shopping: { color: '#d8a34f', icon: '□', terms: 'amazon shop shopping clothes shoes target gift purchase market' },
  Health: { color: '#c78686', icon: '+', terms: 'doctor dentist pharmacy medicine gym health therapy' },
  Fun: { color: '#9c86a4', icon: '✦', terms: 'movie cinema concert game hobby travel vacation book music' },
  Subscriptions: { color: '#8f9c70', icon: '∞', terms: 'netflix spotify subscription adobe membership apple cloud' },
  Other: { color: '#9c9b91', icon: '•', terms: '' }
};

let expenses = [], visibleMonth = new Date(), showAllCategories = false, editingExpenseId = null;
const $ = id => document.getElementById(id);
const LOCAL_KEY = 'spendwell-expenses';
const currency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const parseDate = date => new Date(`${date}T12:00:00`);

const normalizeEntry = item => {
  const entry = item || {};
  const type = String(entry.type || 'expense').toLowerCase();
  const category = entry.category || (type === 'income' ? 'Income' : type === 'investment' ? 'Investment' : detectCategory(`${entry.name || ''} ${entry.note || ''}`));
  return {
    ...entry,
    id: String(entry.id),
    name: String(entry.name || ''),
    date: String(entry.date || new Date().toISOString().slice(0, 10)),
    amount: Number(entry.amount) || 0,
    type,
    category,
    note: String(entry.note || ''),
    created: Number(entry.created) || Date.now()
  };
};

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readLocalExpenses() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}

function writeLocalExpenses(items) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

function sortExpenses(items) {
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
}

async function getExpenses() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created));
    request.onerror = () => reject(request.error);
  });
}

async function saveExpense(expense) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(expense);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  } catch {
    const items = readLocalExpenses().filter(item => item.id !== expense.id);
    items.push(expense);
    writeLocalExpenses(items);
  }
}

async function deleteExpense(id) {
  let deletedFromDb = false;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    deletedFromDb = true;
  } catch {
    // local storage fallback
  }
  const localItems = readLocalExpenses().filter(item => item.id !== id);
  if (!deletedFromDb || localItems.length !== readLocalExpenses().length) {
    writeLocalExpenses(localItems);
  }
}

async function deleteAll() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  } catch {
    // local storage fallback
  }
  localStorage.removeItem(LOCAL_KEY);
}

function detectCategory(text) {
  const input = text.toLowerCase();
  let best = 'Other';
  let score = 0;
  Object.entries(categories).forEach(([category, data]) => {
    const matches = data.terms.split(' ').filter(term => input.includes(term)).length;
    if (matches > score) {
      best = category;
      score = matches;
    }
  });
  return best;
}

function render() {
  const key = monthKey(visibleMonth);
  const entries = expenses.map(normalizeEntry).filter(item => item.date.startsWith(key));
  const expenseEntries = entries.filter(item => item.type === 'expense');
  const incomeEntries = entries.filter(item => item.type === 'income');
  const investmentEntries = entries.filter(item => item.type === 'investment');

  const totalExpenses = expenseEntries.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = incomeEntries.reduce((sum, item) => sum + item.amount, 0);
  const totalInvestments = investmentEntries.reduce((sum, item) => sum + item.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  $('monthName').textContent = visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  $('monthCount').textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  $('totalSpent').textContent = currency(netBalance);
  $('categoryCount').textContent = new Set(expenseEntries.map(item => item.category)).size;

  const priorMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  const priorMonthEntries = expenses.map(normalizeEntry).filter(item => item.date.startsWith(monthKey(priorMonth)));
  const priorExpenseTotal = priorMonthEntries.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const priorIncomeTotal = priorMonthEntries.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const priorNetBalance = priorIncomeTotal - priorExpenseTotal;

  if (priorExpenseTotal || priorIncomeTotal) {
    const delta = netBalance - priorNetBalance;
    const percent = priorNetBalance === 0 ? 0 : Math.abs(delta) / Math.abs(priorNetBalance) * 100;
    $('comparisonText').textContent = `${Math.round(percent)}% ${delta >= 0 ? 'ahead' : 'behind'} than last month`;
  } else {
    $('comparisonText').textContent = `Income ${currency(totalIncome)} • Expenses ${currency(totalExpenses)} • Investments ${currency(totalInvestments)}`;
  }

  const grouped = expenseEntries.reduce((all, item) => {
    all[item.category] = (all[item.category] || 0) + item.amount;
    return all;
  }, {});
  const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const displayedCategories = showAllCategories ? sorted : sorted.slice(0, 4);
  const chartTotal = sorted.reduce((sum, [, amount]) => sum + amount, 0);

  $('categoryList').innerHTML = sorted.length
    ? displayedCategories.map(([category, amount]) => `
      <article class="category-item">
        <div class="category-meta">
          <span class="category-dot" style="background:${categories[category].color}"></span>
          <span class="category-name">${category}</span>
        </div>
        <div class="category-amount">${currency(amount)}</div>
        <div class="category-bar"><span style="width:${chartTotal ? (amount / chartTotal) * 100 : 0}%;background:${categories[category].color}"></span></div>
      </article>
    `).join('')
    : '<div class="empty-state"><strong>No spending yet</strong>Add your first expense to see your month take shape.</div>';

  $('transactionList').innerHTML = entries.length
    ? entries.map(item => {
        const icon = categories[item.category] || categories.Other;
        const amountText = item.type === 'expense' ? `-${currency(item.amount)}` : `+${currency(item.amount)}`;
        const className = item.type === 'expense' ? 'negative' : item.type === 'investment' ? 'investment' : 'positive';
        const color = item.type === 'expense' ? '#222522' : item.type === 'investment' ? '#5d7bba' : '#2c8d72';
        return `
          <div class="transaction">
            <div class="transaction-icon" style="background:${icon.color}22">${icon.icon}</div>
            <div class="transaction-info">
              <div class="transaction-name">${escapeHtml(item.name)}</div>
              <div class="transaction-detail">${item.category} · ${parseDate(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</div>
            </div>
            <div class="transaction-amount ${className}" style="color:${color}">${amountText}</div>
            <button class="edit-button" data-id="${escapeHtml(item.id)}" title="Edit ${escapeHtml(item.name)}" aria-label="Edit ${escapeHtml(item.name)}">Edit</button>
            <button class="delete-button" data-id="${escapeHtml(item.id)}" title="Delete ${escapeHtml(item.name)}" aria-label="Delete ${escapeHtml(item.name)}">Delete</button>
          </div>
        `;
      }).join('')
    : '<div class="empty-state"><strong>Your activity is quiet</strong>Your saved entries will show up here.</div>';

  document.querySelectorAll('.edit-button').forEach(button => { button.onclick = () => editExpense(button.dataset.id); });
  document.querySelectorAll('.delete-button').forEach(button => { button.onclick = () => removeExpense(button.dataset.id); });

  $('donut').style.background = sorted.length
    ? `conic-gradient(${sorted.map(([category, amount], i) => `${categories[category].color} ${sorted.slice(0, i).reduce((sum, part) => sum + part[1], 0) / chartTotal * 100}% ${sorted.slice(0, i + 1).reduce((sum, part) => sum + part[1], 0) / chartTotal * 100}%`).join(',')})`
    : '#d9d4ca';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function showToast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  setTimeout(() => $('toast').classList.remove('show'), 2400);
}

async function removeExpense(id) {
  const expense = expenses.find(item => item.id === id);
  if (!expense || !confirm(`Delete “${expense.name}”?`)) return;
  try {
    await deleteExpense(id);
    expenses = expenses.filter(item => item.id !== id);
    render();
    showToast('Entry deleted and backup updated');
  } catch {
    showToast('Unable to delete this entry');
  }
}

function editExpense(id) {
  const expense = expenses.find(item => item.id === id);
  if (!expense) return;
  const entry = normalizeEntry(expense);
  editingExpenseId = id;
  $('expenseName').value = entry.name;
  $('expenseAmount').value = entry.amount;
  $('expenseDate').value = entry.date;
  $('expenseType').value = entry.type || 'expense';
  $('expenseCategory').value = entry.category || 'auto';
  $('expenseNote').value = entry.note || '';
  $('expenseDialog').showModal();
}

function parseVoiceDate(transcript) {
  const lower = transcript.toLowerCase();
  const baseDate = new Date();
  if (lower.includes('yesterday')) return new Date(Date.now() - 86400000);
  if (lower.includes('today')) return baseDate;

  const dateText = transcript.match(/(?:date\s+)?(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{4})?)/i);
  if (!dateText) return baseDate;

  const parsed = new Date(dateText[1]);
  if (!Number.isNaN(parsed.getTime())) {
    if (!/\d{4}/.test(dateText[1])) parsed.setFullYear(baseDate.getFullYear());
    return parsed;
  }

  const numeric = dateText[1].split(/[/-]/).map(Number);
  const year = numeric[2] || baseDate.getFullYear();
  const normalizedYear = year < 100 ? 2000 + year : year;
  const numericDate = new Date(normalizedYear, numeric[0] - 1, numeric[1]);
  return Number.isNaN(numericDate.getTime()) ? baseDate : numericDate;
}

function parseVoiceExpense(transcript) {
  const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 };
  const amountMatch = transcript.match(/(?:\$|usd\s*)?(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?)?/i);
  const wordAmountMatch = transcript.toLowerCase().match(new RegExp(`\\b(${Object.keys(numberWords).join('|')})\\s+(?:dollars?|bucks?)\\b`));
  const amount = amountMatch ? Number(amountMatch[1]) : wordAmountMatch ? numberWords[wordAmountMatch[1]] : null;
  const lower = transcript.toLowerCase();

  let type = 'expense';
  if (/(salary|paycheck|income|bonus|earned|received|wages)/i.test(lower)) type = 'income';
  else if (/(invest|investment|brokerage|stock|etf|fund|retirement|ira|401k)/i.test(lower)) type = 'investment';

  const date = parseVoiceDate(transcript);
  const category = type === 'income' ? 'Income' : type === 'investment' ? 'Investment' : (Object.keys(categories).find(item => lower.includes(item.toLowerCase())) || detectCategory(transcript));

  const labeledName = transcript.match(/\b(?:i\s+)?buy\s+(.+?)\s+(?:price|cost|amount)\b/i);
  let name = labeledName
    ? labeledName[1].trim()
    : transcript
        .replace(/\b(?:i\s+)?buy\s+/i, '')
        .replace(/\b(?:price|cost|amount)\s*/i, '')
        .replace(/\bdate\s+.*/i, '')
        .replace(/(?:\$|usd\s*)?\d+(?:\.\d{1,2})?\s*(?:dollars?|bucks?)/i, '')
        .replace(new RegExp(`\\b(?:${Object.keys(numberWords).join('|')})\\s+(?:dollars?|bucks?)\\b`, 'i'), '')
        .replace(/\b(i|today|yesterday|for|expense|income|investment|spent|spend|paid|pay|on|price|date)\b/gi, '')
        .trim();

  if (!name || amount === null) return { amount, name: name || transcript, date, category, type };
  name = name.replace(/^(at|on|for)\s+/i, '').replace(/\s+/g, ' ').trim();
  return { amount, name, date, category, type };
}

function setupVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = $('voiceInput');
  if (!SpeechRecognition) {
    button.disabled = true;
    $('voiceStatus').textContent = 'Voice input is not supported in this browser.';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    button.classList.add('listening');
    button.innerHTML = '<span aria-hidden="true">🎙</span>';
    button.setAttribute('aria-label', 'Listening for entry');
    $('voiceStatus').textContent = 'Say an entry, for example: “Paycheck 3500 dollars today.”';
  };

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    const parsed = parseVoiceExpense(transcript);
    $('expenseName').value = parsed.name;
    if (parsed.amount !== null) $('expenseAmount').value = parsed.amount.toFixed(2);
    $('expenseDate').value = parsed.date.toISOString().slice(0, 10);
    $('expenseType').value = parsed.type || 'expense';
    $('expenseCategory').value = parsed.type === 'income' ? 'Income' : parsed.type === 'investment' ? 'Investment' : (categories[parsed.category] ? parsed.category : 'auto');
    $('voiceStatus').textContent = `Heard: “${transcript}”`;
  };

  recognition.onerror = event => {
    $('voiceStatus').textContent = event.error === 'not-allowed' ? 'Microphone permission was blocked.' : 'Could not hear that. Please try again.';
  };

  recognition.onend = () => {
    button.classList.remove('listening');
    button.innerHTML = '<span aria-hidden="true">🎙</span>';
    button.setAttribute('aria-label', 'Fill entry form using voice');
  };

  button.onclick = () => {
    if (!$('expenseDialog').open) {
      $('expenseForm').reset();
      $('expenseType').value = 'expense';
      $('expenseCategory').value = 'auto';
      $('expenseDate').value = new Date().toISOString().slice(0, 10);
      $('expenseDialog').showModal();
    }
    try { recognition.start(); } catch { recognition.stop(); }
  };
}

$('addExpense').onclick = () => {
  editingExpenseId = null;
  $('expenseForm').reset();
  $('expenseType').value = 'expense';
  $('expenseCategory').value = 'auto';
  $('expenseDate').value = new Date().toISOString().slice(0, 10);
  $('expenseDialog').showModal();
};

$('closeExpense').onclick = () => $('expenseDialog').close();
$('previousMonth').onclick = () => { visibleMonth.setMonth(visibleMonth.getMonth() - 1); render(); };
$('nextMonth').onclick = () => { visibleMonth.setMonth(visibleMonth.getMonth() + 1); render(); };
$('clearAll').onclick = async () => {
  if (expenses.length && confirm('Delete every saved entry from this device?')) {
    await deleteAll();
    expenses = [];
    render();
    showToast('All entries removed');
  }
};
$('allCategories').onclick = () => {
  showAllCategories = !showAllCategories;
  $('allCategories').textContent = showAllCategories ? 'Show less' : 'View all';
  render();
};
$('exportButton').onclick = () => {
  const blob = new Blob([JSON.stringify(expenses, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'spendwell-expenses.json';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Entry backup downloaded');
};
$('importButton').onclick = () => $('importFile').click();
$('importFile').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported) || imported.some(item => !item || !item.id || !item.name || !item.date || !Number.isFinite(Number(item.amount)))) {
      throw new Error('Invalid backup');
    }
    await deleteAll();
    const normalized = imported.map(item => ({
      ...item,
      id: String(item.id),
      name: String(item.name),
      amount: Number(item.amount),
      type: String(item.type || 'expense').toLowerCase(),
      category: item.category || (item.type === 'income' ? 'Income' : item.type === 'investment' ? 'Investment' : 'Other'),
      created: Number(item.created) || Date.now()
    }));
    for (const item of normalized) await saveExpense(item);
    expenses = sortExpenses(normalized);
    render();
    showToast(`${expenses.length} entries imported`);
  } catch {
    showToast('Invalid expense JSON file');
  }
  event.target.value = '';
};

$('expenseType').onchange = () => {
  const type = $('expenseType').value;
  if (type === 'income') $('expenseCategory').value = 'Income';
  else if (type === 'investment') $('expenseCategory').value = 'Investment';
  else if ($('expenseCategory').value === 'Income' || $('expenseCategory').value === 'Investment') $('expenseCategory').value = 'auto';
};

$('expenseForm').onsubmit = async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  const name = form.get('name').trim();
  const type = String(form.get('type') || 'expense');
  const categoryValue = String(form.get('category') || 'auto');
  const category = type === 'income'
    ? 'Income'
    : type === 'investment'
      ? 'Investment'
      : (categoryValue === 'auto' ? detectCategory(`${name} ${form.get('note')}`) : categoryValue);

  const existing = editingExpenseId ? expenses.find(item => item.id === editingExpenseId) : null;
  const expense = {
    id: existing ? existing.id : (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    name,
    amount: Number(form.get('amount')),
    date: form.get('date'),
    type,
    category,
    note: form.get('note').trim(),
    created: existing ? existing.created : Date.now()
  };

  try {
    await saveExpense(expense);
    expenses = await getExpenses();
    if (!expenses.some(item => item.id === expense.id)) {
      expenses = sortExpenses([...readLocalExpenses().filter(item => item.id !== expense.id), expense]);
    }
    editingExpenseId = null;
    event.target.reset();
    $('expenseDialog').close();
    visibleMonth = parseDate(form.get('date'));
    render();
    showToast(existing ? 'Entry updated' : `${type.charAt(0).toUpperCase() + type.slice(1)} saved`);
  } catch {
    showToast('Unable to save this entry');
  }
};

setupVoiceInput();
getExpenses().then(data => {
  expenses = data.length ? data : sortExpenses(readLocalExpenses());
  render();
}).catch(() => {
  expenses = sortExpenses(readLocalExpenses());
  render();
  showToast('Using local browser storage');
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
