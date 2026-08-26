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
let expenses = [], visibleMonth = new Date(), showAllCategories = false, editingExpenseId = null;
const $ = id => document.getElementById(id);
const LOCAL_KEY = 'spendwell-expenses';
const currency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const parseDate = date => new Date(`${date}T12:00:00`);

function openDb() { return new Promise((resolve, reject) => { if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return; } const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function readLocalExpenses() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; } }
function writeLocalExpenses(items) { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); }
function sortExpenses(items) { return items.sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created); }
async function getExpenses() { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).getAll(); request.onsuccess = () => resolve(request.result.sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created)); request.onerror = () => reject(request.error); }); }
async function saveExpense(expense) { try { const db = await openDb(); await new Promise((resolve, reject) => { const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(expense); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); } catch { const items = readLocalExpenses().filter(item => item.id !== expense.id); items.push(expense); writeLocalExpenses(items); } }
async function deleteExpense(id) { let deletedFromDb = false; try { const db = await openDb(); await new Promise((resolve, reject) => { const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); deletedFromDb = true; } catch { /* local storage is the fallback */ } const localItems = readLocalExpenses().filter(item => item.id !== id); if (!deletedFromDb || localItems.length !== readLocalExpenses().length) writeLocalExpenses(localItems); }
async function deleteAll() { try { const db = await openDb(); await new Promise((resolve, reject) => { const request = db.transaction(STORE, 'readwrite').objectStore(STORE).clear(); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); } catch { /* local storage is the fallback */ } localStorage.removeItem(LOCAL_KEY); }
function detectCategory(text) { const input = text.toLowerCase(); let best = 'Other', score = 0; Object.entries(categories).forEach(([category, data]) => { const matches = data.terms.split(' ').filter(term => input.includes(term)).length; if (matches > score) { best = category; score = matches; } }); return best; }
function render() {
  const key = monthKey(visibleMonth), current = expenses.filter(item => item.date.startsWith(key));
  const total = current.reduce((sum, item) => sum + item.amount, 0); $('monthName').textContent = visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); $('monthCount').textContent = `${current.length} ${current.length === 1 ? 'entry' : 'entries'}`; $('totalSpent').textContent = currency(total); $('categoryCount').textContent = new Set(current.map(item => item.category)).size;
  const prior = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1), priorTotal = expenses.filter(item => item.date.startsWith(monthKey(prior))).reduce((sum, item) => sum + item.amount, 0); $('comparisonText').textContent = priorTotal ? `${Math.round(((total - priorTotal) / priorTotal) * 100)}% ${total > priorTotal ? 'more' : 'less'} than last month` : 'Stored privately on this device';
  const grouped = current.reduce((all, item) => { all[item.category] = (all[item.category] || 0) + item.amount; return all; }, {}), sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]), displayedCategories = showAllCategories ? sorted : sorted.slice(0, 4); $('categoryList').innerHTML = sorted.length ? displayedCategories.map(([category, amount]) => `<article class="category-item"><div class="category-meta"><span class="category-dot" style="background:${categories[category].color}"></span><span class="category-name">${category}</span></div><div class="category-amount">${currency(amount)}</div><div class="category-bar"><span style="width:${total ? amount / total * 100 : 0}%;background:${categories[category].color}"></span></div></article>`).join('') : '<div class="empty-state"><strong>No spending yet</strong>Add your first expense to see your month take shape.</div>';
  $('transactionList').innerHTML = current.length ? current.map(item => `<div class="transaction"><div class="transaction-icon" style="background:${categories[item.category].color}22">${categories[item.category].icon}</div><div class="transaction-info"><div class="transaction-name">${escapeHtml(item.name)}</div><div class="transaction-detail">${item.category} · ${parseDate(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</div></div><div class="transaction-amount">${currency(item.amount)}</div><button class="edit-button" data-id="${escapeHtml(item.id)}" title="Edit ${escapeHtml(item.name)}" aria-label="Edit ${escapeHtml(item.name)}">Edit</button><button class="delete-button" data-id="${escapeHtml(item.id)}" title="Delete ${escapeHtml(item.name)}" aria-label="Delete ${escapeHtml(item.name)}">Delete</button></div>`).join('') : '<div class="empty-state"><strong>Your activity is quiet</strong>Your saved expenses will show up here.</div>';
  document.querySelectorAll('.edit-button').forEach(button => { button.onclick = () => editExpense(button.dataset.id); });
  document.querySelectorAll('.delete-button').forEach(button => { button.onclick = () => removeExpense(button.dataset.id); });
  $('donut').style.background = sorted.length ? `conic-gradient(${sorted.map(([category, amount], i) => `${categories[category].color} ${sorted.slice(0, i).reduce((sum, part) => sum + part[1], 0) / total * 100}% ${sorted.slice(0, i + 1).reduce((sum, part) => sum + part[1], 0) / total * 100}%`).join(',')})` : '#d9d4ca';
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function showToast(message) { $('toast').textContent = message; $('toast').classList.add('show'); setTimeout(() => $('toast').classList.remove('show'), 2400); }
async function removeExpense(id) { const expense = expenses.find(item => item.id === id); if (!expense || !confirm(`Delete “${expense.name}”?`)) return; try { await deleteExpense(id); expenses = expenses.filter(item => item.id !== id); render(); showToast('Expense deleted and backup updated'); } catch { showToast('Unable to delete this expense'); } }
function editExpense(id) { const expense = expenses.find(item => item.id === id); if (!expense) return; editingExpenseId = id; $('expenseName').value = expense.name; $('expenseAmount').value = expense.amount; $('expenseDate').value = expense.date; $('expenseCategory').value = expense.category; $('expenseNote').value = expense.note || ''; $('expenseDialog').showModal(); }
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
  const date = parseVoiceDate(transcript);
  const category = Object.keys(categories).find(item => lower.includes(item.toLowerCase())) || detectCategory(transcript);
  const labeledName = transcript.match(/\b(?:i\s+)?buy\s+(.+?)\s+(?:price|cost|amount)\b/i);
  let name = labeledName ? labeledName[1].trim() : transcript.replace(/\b(?:i\s+)?buy\s+/i, '').replace(/\b(?:price|cost|amount)\s*/i, '').replace(/\bdate\s+.*/i, '').replace(/(?:\$|usd\s*)?\d+(?:\.\d{1,2})?\s*(?:dollars?|bucks?)?/i, '').replace(new RegExp(`\\b(?:${Object.keys(numberWords).join('|')})\\s+(?:dollars?|bucks?)\\b`, 'i'), '').replace(/\b(i|today|yesterday|for|expense|spent|spend|paid|pay|on|price|date)\b/gi, '').trim();
  if (!name || amount === null) return { amount, name: name || transcript, date, category };
  name = name.replace(/^(at|on|for)\s+/i, '').replace(/\s+/g, ' ').trim();
  return { amount, name, date, category };
}
function setupVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = $('voiceInput');
  if (!SpeechRecognition) { button.disabled = true; $('voiceStatus').textContent = 'Voice input is not supported in this browser.'; return; }
  const recognition = new SpeechRecognition(); recognition.lang = 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;
  recognition.onstart = () => { button.classList.add('listening'); button.innerHTML = '<span aria-hidden="true">🎙</span>'; button.setAttribute('aria-label', 'Listening for expense'); $('voiceStatus').textContent = 'Say an expense, for example: “Coffee 5 dollars today.”'; };
  recognition.onresult = event => { const transcript = event.results[0][0].transcript; const parsed = parseVoiceExpense(transcript); $('expenseName').value = parsed.name; if (parsed.amount !== null) $('expenseAmount').value = parsed.amount.toFixed(2); $('expenseDate').value = parsed.date.toISOString().slice(0, 10); $('expenseCategory').value = categories[parsed.category] ? parsed.category : 'auto'; $('voiceStatus').textContent = `Heard: “${transcript}”`; };
  recognition.onerror = event => { $('voiceStatus').textContent = event.error === 'not-allowed' ? 'Microphone permission was blocked.' : 'Could not hear that. Please try again.'; };
  recognition.onend = () => { button.classList.remove('listening'); button.innerHTML = '<span aria-hidden="true">🎙</span>'; button.setAttribute('aria-label', 'Fill expense form using voice'); };
  button.onclick = () => { if (!$('expenseDialog').open) { $('expenseForm').reset(); $('expenseDate').value = new Date().toISOString().slice(0, 10); $('expenseDialog').showModal(); } try { recognition.start(); } catch { recognition.stop(); } };
}

$('addExpense').onclick = () => { editingExpenseId = null; $('expenseForm').reset(); $('expenseDate').value = new Date().toISOString().slice(0, 10); $('expenseDialog').showModal(); };
$('closeExpense').onclick = () => $('expenseDialog').close();
$('previousMonth').onclick = () => { visibleMonth.setMonth(visibleMonth.getMonth() - 1); render(); };
$('nextMonth').onclick = () => { visibleMonth.setMonth(visibleMonth.getMonth() + 1); render(); };
$('clearAll').onclick = async () => { if (expenses.length && confirm('Delete every saved expense from this device?')) { await deleteAll(); expenses = []; render(); showToast('All expenses removed'); } };
$('allCategories').onclick = () => { showAllCategories = !showAllCategories; $('allCategories').textContent = showAllCategories ? 'Show less' : 'View all'; render(); };
$('exportButton').onclick = () => { const blob = new Blob([JSON.stringify(expenses, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'spendwell-expenses.json'; link.click(); URL.revokeObjectURL(link.href); showToast('Expense backup downloaded'); };
$('importButton').onclick = () => $('importFile').click();
$('importFile').onchange = async event => { const file = event.target.files[0]; if (!file) return; try { const imported = JSON.parse(await file.text()); if (!Array.isArray(imported) || imported.some(item => !item || !item.id || !item.name || !item.date || !categories[item.category] || !Number.isFinite(Number(item.amount)))) throw new Error('Invalid backup'); await deleteAll(); const normalized = imported.map(item => ({ ...item, id: String(item.id), name: String(item.name), amount: Number(item.amount), created: Number(item.created) || Date.now() })); for (const item of normalized) await saveExpense(item); expenses = sortExpenses(normalized); render(); showToast(`${expenses.length} expenses imported`); } catch { showToast('Invalid expense JSON file'); } event.target.value = ''; };
$('expenseForm').onsubmit = async event => { event.preventDefault(); const form = new FormData(event.target), name = form.get('name').trim(), category = form.get('category') === 'auto' ? detectCategory(`${name} ${form.get('note')}`) : form.get('category'), existing = editingExpenseId ? expenses.find(item => item.id === editingExpenseId) : null, expense = { id: existing ? existing.id : crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, name, amount: Number(form.get('amount')), date: form.get('date'), category, note: form.get('note').trim(), created: existing ? existing.created : Date.now() }; try { await saveExpense(expense); expenses = await getExpenses(); if (!expenses.some(item => item.id === expense.id)) { expenses = sortExpenses([...readLocalExpenses().filter(item => item.id !== expense.id), expense]); } editingExpenseId = null; event.target.reset(); $('expenseDialog').close(); visibleMonth = parseDate(form.get('date')); render(); showToast(existing ? 'Expense updated' : `Sorted into ${category}`); } catch { showToast('Unable to save this expense'); } };
setupVoiceInput();
getExpenses().then(data => { expenses = data.length ? data : sortExpenses(readLocalExpenses()); render(); }).catch(() => { expenses = sortExpenses(readLocalExpenses()); render(); showToast('Using local browser storage'); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});