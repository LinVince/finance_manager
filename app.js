const DB_NAME = 'spendwell';
const STORE = 'expenses';
const categories = {
  'Food & Dining': { color: '#e56b55', icon: '◒', terms: 'coffee cafe restaurant lunch dinner food grocery groceries uber eats takeaway bakery bar' },
  Transport: { color: '#81a6b5', icon: '↗', terms: 'uber lyft taxi bus train metro fuel gas parking toll bike car' },
  Home: { color: '#839a7b', icon: '⌂', terms: 'rent mortgage utility utilities electric water internet home furniture repair' },
  Shopping: { color: '#d8a34f', icon: '□', terms: 'amazon shop shopping clothes shoes target gift purchase market' },
  Health: { color: '#c78686', icon: '+', terms: 'doctor dentist pharmacy medicine gym health therapy' },
  Fun: { color: '#9c86a4', icon: '✦', terms: 'movie cinema concert game hobby travel vacation book music' },
  Subscriptions: { color: '#8f9c70', icon: '∞', terms: 'netflix spotify subscription adobe membership apple cloud' },
  Other: { color: '#9c9b91', icon: '•', terms: '' }
};
let expenses = [], visibleMonth = new Date(), showAllCategories = false;
const $ = id => document.getElementById(id);
const currency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const parseDate = date => new Date(`${date}T12:00:00`);

function openDb() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function getExpenses() { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).getAll(); request.onsuccess = () => resolve(request.result.sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created)); request.onerror = () => reject(request.error); }); }
async function saveExpense(expense) { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(expense); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); }
async function deleteAll() { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction(STORE, 'readwrite').objectStore(STORE).clear(); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); }
function detectCategory(text) { const input = text.toLowerCase(); let best = 'Other', score = 0; Object.entries(categories).forEach(([category, data]) => { const matches = data.terms.split(' ').filter(term => input.includes(term)).length; if (matches > score) { best = category; score = matches; } }); return best; }
function render() {
  const key = monthKey(visibleMonth), current = expenses.filter(item => item.date.startsWith(key));
  const total = current.reduce((sum, item) => sum + item.amount, 0); $('monthName').textContent = visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); $('monthCount').textContent = `${current.length} ${current.length === 1 ? 'entry' : 'entries'}`; $('totalSpent').textContent = currency(total); $('categoryCount').textContent = new Set(current.map(item => item.category)).size;
  const prior = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1), priorTotal = expenses.filter(item => item.date.startsWith(monthKey(prior))).reduce((sum, item) => sum + item.amount, 0); $('comparisonText').textContent = priorTotal ? `${Math.round(((total - priorTotal) / priorTotal) * 100)}% ${total > priorTotal ? 'more' : 'less'} than last month` : 'Stored privately on this device';
  const grouped = current.reduce((all, item) => { all[item.category] = (all[item.category] || 0) + item.amount; return all; }, {}), sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]), displayedCategories = showAllCategories ? sorted : sorted.slice(0, 4); $('categoryList').innerHTML = sorted.length ? displayedCategories.map(([category, amount]) => `<article class="category-item"><div class="category-meta"><span class="category-dot" style="background:${categories[category].color}"></span><span class="category-name">${category}</span></div><div class="category-amount">${currency(amount)}</div><div class="category-bar"><span style="width:${total ? amount / total * 100 : 0}%;background:${categories[category].color}"></span></div></article>`).join('') : '<div class="empty-state"><strong>No spending yet</strong>Add your first expense to see your month take shape.</div>';
  const recent = current.slice(0, 8); $('transactionList').innerHTML = recent.length ? recent.map(item => `<div class="transaction"><div class="transaction-icon" style="background:${categories[item.category].color}22">${categories[item.category].icon}</div><div class="transaction-info"><div class="transaction-name">${escapeHtml(item.name)}</div><div class="transaction-detail">${item.category} · ${parseDate(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</div></div><div class="transaction-amount">${currency(item.amount)}</div></div>`).join('') : '<div class="empty-state"><strong>Your activity is quiet</strong>Your saved expenses will show up here.</div>';
  $('donut').style.background = sorted.length ? `conic-gradient(${sorted.map(([category, amount], i) => `${categories[category].color} ${sorted.slice(0, i).reduce((sum, part) => sum + part[1], 0) / total * 100}% ${sorted.slice(0, i + 1).reduce((sum, part) => sum + part[1], 0) / total * 100}%`).join(',')})` : '#d9d4ca';
}
function escapeHtml(value) { return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function showToast(message) { $('toast').textContent = message; $('toast').classList.add('show'); setTimeout(() => $('toast').classList.remove('show'), 2400); }

$('addExpense').onclick = () => { $('expenseDate').value = new Date().toISOString().slice(0, 10); $('expenseDialog').showModal(); };
$('previousMonth').onclick = () => { visibleMonth.setMonth(visibleMonth.getMonth() - 1); render(); };
$('nextMonth').onclick = () => { visibleMonth.setMonth(visibleMonth.getMonth() + 1); render(); };
$('clearAll').onclick = async () => { if (expenses.length && confirm('Delete every saved expense from this device?')) { await deleteAll(); expenses = []; render(); showToast('All expenses removed'); } };
$('allCategories').onclick = () => { showAllCategories = !showAllCategories; $('allCategories').textContent = showAllCategories ? 'Show less' : 'View all'; render(); };
$('exportButton').onclick = () => { const blob = new Blob([JSON.stringify(expenses, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'spendwell-expenses.json'; link.click(); URL.revokeObjectURL(link.href); showToast('Expense backup downloaded'); };
$('expenseForm').onsubmit = async event => { event.preventDefault(); const form = new FormData(event.target), name = form.get('name').trim(), category = form.get('category') === 'auto' ? detectCategory(`${name} ${form.get('note')}`) : form.get('category'); await saveExpense({ id: crypto.randomUUID(), name, amount: Number(form.get('amount')), date: form.get('date'), category, note: form.get('note').trim(), created: Date.now() }); expenses = await getExpenses(); event.target.reset(); $('expenseDialog').close(); visibleMonth = parseDate(form.get('date')); render(); showToast(`Sorted into ${category}`); };
getExpenses().then(data => { expenses = data; render(); }).catch(() => showToast('Storage is unavailable in this browser'));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});