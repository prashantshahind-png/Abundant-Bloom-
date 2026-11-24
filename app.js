import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://fhtirtprwihuevsbqmjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c0mtpzjvDGNk5-K9RjFEfQ_6D63uoKm';
const OWNER_EMAIL = 'thephulshop7@gmail.com';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let currentUser = null;
let isOwner = false;

function isoDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function money(value) { return `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }
function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value == null ? '' : String(value); return el.innerHTML; }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }
function setTodayDefaults() { const today = isoDate(); $$('input[type="date"]').forEach(input => { if (!input.value) input.value = today; }); }
async function getRows(table) { const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false }); if (error) throw error; return data || []; }
async function getSettings() { const { data, error } = await supabase.from('cash_bank_settings').select('*').eq('id', 1).maybeSingle(); if (error) throw error; return data || { opening_cash: 0, opening_bank: 0 }; }
async function insertRow(table, values) { const { error } = await supabase.from(table).insert({ ...values, created_by: currentUser?.email }); if (error) throw error; toast('Saved successfully'); await refreshAll(); }
async function refreshAll() { await Promise.all([refreshDashboard(), refreshTables()]); }

async function refreshDashboard() {
  try {
    const [sales, expenses, udhaar, settings, orders] = await Promise.all([getRows('sales'), getRows('expenses'), getRows('udhaar'), getSettings(), getRows('orders').catch(() => [])]);
    const now = new Date(), todayKey = isoDate(now);
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const weekStart = isoDate(monday), monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const todaySales = sales.filter(row => row.date === todayKey), todayExpenses = expenses.filter(row => row.date === todayKey);
    const sum = rows => rows.reduce((total, row) => total + Number(row.amount || 0), 0);
    const cashSales = sales.filter(row => row.payment_method === 'cash'), bankSales = sales.filter(row => row.payment_method === 'bank');
    const cashExpenses = expenses.filter(row => row.payment_method === 'cash'), bankExpenses = expenses.filter(row => row.payment_method === 'bank');
    $('#cashBalance').textContent = money(Number(settings.opening_cash || 0) + sum(cashSales) - sum(cashExpenses));
    $('#bankBalance').textContent = money(Number(settings.opening_bank || 0) + sum(bankSales) - sum(bankExpenses));
    $('#openingCash').value = Number(settings.opening_cash || 0); $('#openingBank').value = Number(settings.opening_bank || 0);
    $('#todaySales').textContent = money(sum(todaySales));
    $('#weekSales').textContent = money(sum(sales.filter(row => row.date >= weekStart && row.date <= todayKey)));
    $('#monthSales').textContent = money(sum(sales.filter(row => row.date >= monthStart && row.date <= todayKey)));
    $('#todayExpenses').textContent = money(sum(todayExpenses));
    $('#netBalance').textContent = money(sum(todaySales) - sum(todayExpenses));
    $('#udhaarBalance').textContent = money(sum(udhaar.map(row => ({ amount: row.balance }))));
    $('#todaySaleCount').textContent = `${todaySales.length} transactions`;
    $('#todayExpenseCount').textContent = `${todayExpenses.length} entries`;
    $('#udhaarCount').textContent = `${udhaar.filter(row => Number(row.balance) > 0).length} customers`;

    const chart = $('#salesChart'); chart.innerHTML = '';
    const days = [];
    for (let i = 6; i >= 0; i--) { const date = new Date(now); date.setDate(now.getDate() - i); const key = isoDate(date); days.push({ date, total: sum(sales.filter(row => row.date === key)) }); }
    const max = Math.max(1, ...days.map(day => day.total));
    for (const day of days) { const column = document.createElement('div'); column.className = 'bar-column'; column.innerHTML = `<div class="bar" title="${money(day.total)}" style="height:${Math.max(3, day.total / max * 180)}px"></div><span class="bar-label">${day.date.toLocaleDateString('en-NP', { weekday: 'short' })}</span>`; chart.appendChild(column); }
    const recent = [...sales.map(row => ({ ...row, kind: 'Sale' })), ...expenses.map(row => ({ ...row, kind: 'Expense' })), ...orders.map(row => ({ ...row, kind: 'Order' }))].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 7);
    $('#recentActivity').innerHTML = recent.length ? recent.map(row => `<div class="activity-item"><span>${row.kind} · ${escapeHtml(row.note || row.category || row.customer || row.items || 'Entry')}</span><strong>${row.kind === 'Expense' ? '-' : ''}${money(row.amount)}</strong></div>`).join('') : '<p class="date-text">No recent activity</p>';
  } catch (error) { toast(error.message); }
}

async function refreshTables() {
  try {
    const [sales, expenses, udhaar, orders] = await Promise.all([getRows('sales'), getRows('expenses'), getRows('udhaar'), getRows('orders').catch(() => [])]);
    $('#salesTable').innerHTML = sales.map(row => `<tr><td>${row.date}</td><td>${escapeHtml(row.customer || '-')}</td><td>${escapeHtml(row.note || '-')}</td><td>${row.payment_method === 'bank' ? 'Online / Bank' : row.payment_method === 'cash' ? 'Cash' : 'Not set'}</td><td>${money(row.amount)}</td></tr>`).join('') || '<tr><td colspan="5">No sales yet</td></tr>';
    $('#expensesTable').innerHTML = expenses.map(row => `<tr><td>${row.date}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.note || '-')}</td><td>${row.payment_method === 'bank' ? 'Online / Bank' : row.payment_method === 'cash' ? 'Cash' : 'Not set'}</td><td>${money(row.amount)}</td></tr>`).join('') || '<tr><td colspan="5">No expenses yet</td></tr>';
    $('#udhaarTable').innerHTML = udhaar.map(row => `<tr><td>${escapeHtml(row.customer)}</td><td>${escapeHtml(row.phone || '-')}</td><td>${escapeHtml(row.note || '-')}</td><td>${money(row.balance)}</td><td><button class="secondary-button settle-button" data-id="${row.id}">Settled</button></td></tr>`).join('') || '<tr><td colspan="5">No Udhaar records</td></tr>';
    $('#ordersTable').innerHTML = orders.map(row => `<tr><td>${row.date || '-'}</td><td>${escapeHtml(row.customer)}</td><td><a href="tel:${escapeHtml(row.phone)}">${escapeHtml(row.phone)}</a></td><td>${escapeHtml(row.items || '-')}</td><td>${money(row.amount)}</td><td>${row.delivery_date || '-'}</td><td>${escapeHtml(row.status)}</td><td><select class="status-select" data-id="${row.id}"><option value="pending" ${row.status === 'pending' ? 'selected' : ''}>Pending</option><option value="confirmed" ${row.status === 'confirmed' ? 'selected' : ''}>Confirmed</option><option value="completed" ${row.status === 'completed' ? 'selected' : ''}>Completed</option><option value="cancelled" ${row.status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></td></tr>`).join('') || '<tr><td colspan="8">No orders yet</td></tr>';
    $$('.settle-button').forEach(button => button.onclick = () => settleUdhaar(button.dataset.id));
    $$('.status-select').forEach(select => select.onchange = () => updateOrderStatus(select.dataset.id, select.value));
  } catch (error) { toast(error.message); }
}
async function settleUdhaar(id) { const { error } = await supabase.from('udhaar').update({ balance: 0 }).eq('id', id); if (error) return toast(error.message); toast('Balance settled'); await refreshAll(); }
async function updateOrderStatus(id, status) { const { error } = await supabase.from('orders').update({ status }).eq('id', id); if (error) return toast(error.message); toast('Order status updated'); await refreshAll(); }
function showView(name) { $$('.page-view').forEach(view => view.classList.add('hidden')); $(`#${name}View`)?.classList.remove('hidden'); $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name)); $('#pageTitle').textContent = name === 'udhaar' ? 'Udhaar' : name.charAt(0).toUpperCase() + name.slice(1); }

$('#openingBalanceForm').onsubmit = async event => {
  event.preventDefault(); if (!isOwner) return toast('Only the owner can change starting balances');
  const form = new FormData(event.target), cash = Number(form.get('opening_cash')), bank = Number(form.get('opening_bank'));
  const { error } = await supabase.from('cash_bank_settings').upsert({ id: 1, opening_cash: cash, opening_bank: bank, updated_by: currentUser.email, updated_at: new Date().toISOString() });
  if (error) return toast(error.message);
  toast('Starting balances saved'); await refreshDashboard();
};
$('#googleLogin').onclick = async () => { const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}${location.pathname}` } }); if (error) $('#authMessage').textContent = error.message; };
$('#logout').onclick = async () => supabase.auth.signOut();
$$('.nav-item').forEach(button => button.onclick = () => showView(button.dataset.view));
$('#orderForm').onsubmit = async event => { event.preventDefault(); const form = new FormData(event.target); try { await insertRow('orders', { customer: form.get('customer'), phone: form.get('phone'), items: form.get('items'), amount: form.get('amount'), date: form.get('date'), delivery_date: form.get('delivery_date') || null, status: form.get('status') }); event.target.reset(); setTodayDefaults(); } catch (error) { toast(error.message); } };
$('#saleForm').onsubmit = async event => { event.preventDefault(); const form = new FormData(event.target); try { await insertRow('sales', { amount: form.get('amount'), payment_method: form.get('payment_method'), customer: form.get('customer'), note: form.get('note'), date: form.get('date') }); event.target.reset(); setTodayDefaults(); } catch (error) { toast(error.message); } };
$('#expenseForm').onsubmit = async event => { event.preventDefault(); const form = new FormData(event.target); try { await insertRow('expenses', { amount: form.get('amount'), payment_method: form.get('payment_method'), category: form.get('category'), note: form.get('note'), date: form.get('date') }); event.target.reset(); setTodayDefaults(); } catch (error) { toast(error.message); } };
$('#udhaarForm').onsubmit = async event => { event.preventDefault(); const form = new FormData(event.target); try { await insertRow('udhaar', { customer: form.get('customer'), balance: form.get('amount'), phone: form.get('phone'), note: form.get('note') }); event.target.reset(); } catch (error) { toast(error.message); } };
$('#staffForm').onsubmit = async event => { event.preventDefault(); if (!isOwner) return toast('Only the owner can add staff'); const form = new FormData(event.target); try { await insertRow('staff', { email: form.get('email').trim().toLowerCase(), role: form.get('role'), active: true }); event.target.reset(); await refreshStaff(); } catch (error) { toast(error.message); } };
async function refreshStaff() { try { const staff = await getRows('staff'); $('#staffTable').innerHTML = staff.map(row => `<tr><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.role)}</td><td>${row.active ? 'Active' : 'Disabled'}</td></tr>`).join('') || '<tr><td colspan="3">No staff added</td></tr>'; } catch (error) { toast(error.message); } }
$('#generateReport').onclick = async () => { const from = $('#reportFrom').value, to = $('#reportTo').value; if (!from || !to) return toast('Choose both dates'); try { const [sales, expenses] = await Promise.all([getRows('sales'), getRows('expenses')]); const salesTotal = sales.filter(row => row.date >= from && row.date <= to).reduce((sum, row) => sum + Number(row.amount), 0); const expenseTotal = expenses.filter(row => row.date >= from && row.date <= to).reduce((sum, row) => sum + Number(row.amount), 0); $('#reportOutput').innerHTML = `<div class="report-stat"><span>Sales</span><strong>${money(salesTotal)}</strong></div><div class="report-stat"><span>Expenses</span><strong>${money(expenseTotal)}</strong></div><div class="report-stat"><span>Net balance</span><strong>${money(salesTotal - expenseTotal)}</strong></div>`; } catch (error) { toast(error.message); } };
$('#exportCsv').onclick = async () => { try { const [sales, expenses, orders] = await Promise.all([getRows('sales'), getRows('expenses'), getRows('orders').catch(() => [])]); const rows = [['Type', 'Date', 'Name/Category', 'Note/Phone', 'Payment method', 'Amount'], ...sales.map(row => ['Sale', row.date, row.customer || '', row.note || '', row.payment_method || '', row.amount]), ...expenses.map(row => ['Expense', row.date, row.category || '', row.note || '', row.payment_method || '', row.amount]), ...orders.map(row => ['Order', row.date, row.customer || '', `${row.phone || ''} ${row.items || ''}`, '', row.amount])]; const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `abundant-bloom-${isoDate()}.csv`; link.click(); } catch (error) { toast(error.message); } };

async function handleSession(session) {
  if (!session) { currentUser = null; $('#loginView').classList.remove('hidden'); $('#mainView').classList.add('hidden'); return; }
  currentUser = session.user;
  const email = (currentUser.email || '').toLowerCase().trim(); isOwner = email === OWNER_EMAIL;
  let allowed = isOwner;
  if (!isOwner) { const { data, error } = await supabase.from('staff').select('role,active').eq('email', email).maybeSingle(); if (error) { $('#authMessage').textContent = error.message; return; } allowed = !!data?.active; }
  if (!allowed) { $('#authMessage').textContent = 'This account is not authorised'; await supabase.auth.signOut(); return; }
  $('#authMessage').textContent = ''; $('#loginView').classList.add('hidden'); $('#mainView').classList.remove('hidden');
  $('#userBadge').innerHTML = `<div><strong>${escapeHtml(currentUser.user_metadata?.full_name || email)}</strong><br><small>${isOwner ? 'Owner' : 'Staff'}</small></div>`;
  $$('.owner-only').forEach(element => element.classList.toggle('hidden', !isOwner));
  $('#openingBalanceForm').classList.toggle('hidden', !isOwner);
  await refreshAll(); if (isOwner) await refreshStaff();
}
async function init() {
  $('#todayText').textContent = new Intl.DateTimeFormat('en-NP', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  setTodayDefaults();
  const { data: { session }, error } = await supabase.auth.getSession(); if (error) $('#authMessage').textContent = error.message;
  await handleSession(session);
  supabase.auth.onAuthStateChange((_event, session) => setTimeout(() => handleSession(session), 0));
}
init();
