import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://fhtirtprwihuevsbqmjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c0mtpzjvDGNk5-K9RjFEfQ_6D63uoKm';
const OWNER_EMAIL = 'thephulshop7@gmail.com';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let currentUser = null;
let isOwner = false;

function isoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
function escapeHtml(value) {
  const el = document.createElement('div');
  el.textContent = value == null ? '' : String(value);
  return el.innerHTML;
}
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}
function setTodayDefaults() {
  const today = isoDate();
  $$('input[type="date"]').forEach(input => { if (!input.value) input.value = today; });
}
async function getRows(table) {
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
async function insertRow(table, values) {
  const { error } = await supabase.from(table).insert({ ...values, created_by: currentUser?.email });
  if (error) throw error;
  toast('Saved successfully');
  await refreshAll();
}
async function refreshAll() {
  await Promise.all([refreshDashboard(), refreshTables()]);
}

async function refreshDashboard() {
  try {
    const [sales, expenses, udhaar] = await Promise.all([getRows('sales'), getRows('expenses'), getRows('udhaar')]);
    const now = new Date();
    const todayKey = isoDate(now);
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const weekStart = isoDate(monday);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const todaySales = sales.filter(row => row.date === todayKey);
    const todayExpenses = expenses.filter(row => row.date === todayKey);
    const todaySalesTotal = todaySales.reduce((sum, row) => sum + Number(row.amount), 0);
    const todayExpensesTotal = todayExpenses.reduce((sum, row) => sum + Number(row.amount), 0);
    const weekSalesTotal = sales.filter(row => row.date >= weekStart && row.date <= todayKey).reduce((sum, row) => sum + Number(row.amount), 0);
    const monthSalesTotal = sales.filter(row => row.date >= monthStart && row.date <= todayKey).reduce((sum, row) => sum + Number(row.amount), 0);
    const outstanding = udhaar.reduce((sum, row) => sum + Number(row.balance || 0), 0);

    $('#todaySales').textContent = money(todaySalesTotal);
    $('#weekSales').textContent = money(weekSalesTotal);
    $('#monthSales').textContent = money(monthSalesTotal);
    $('#todayExpenses').textContent = money(todayExpensesTotal);
    $('#netBalance').textContent = money(todaySalesTotal - todayExpensesTotal);
    $('#udhaarBalance').textContent = money(outstanding);
    $('#todaySaleCount').textContent = `${todaySales.length} transactions`;
    $('#todayExpenseCount').textContent = `${todayExpenses.length} entries`;
    $('#udhaarCount').textContent = `${udhaar.filter(row => Number(row.balance) > 0).length} customers`;

    const chart = $('#salesChart');
    chart.innerHTML = '';
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now); date.setDate(now.getDate() - i);
      const key = isoDate(date);
      const total = sales.filter(row => row.date === key).reduce((sum, row) => sum + Number(row.amount), 0);
      days.push({ date, total });
    }
    const max = Math.max(1, ...days.map(day => day.total));
    for (const day of days) {
      const column = document.createElement('div');
      column.className = 'bar-column';
      column.innerHTML = `<div class="bar" title="${money(day.total)}" style="height:${Math.max(3, day.total / max * 180)}px"></div><span class="bar-label">${day.date.toLocaleDateString('en-NP', { weekday: 'short' })}</span>`;
      chart.appendChild(column);
    }

    let orders = [];
    try { orders = await getRows('orders'); } catch (_) {}
    const recent = [...sales.map(row => ({ ...row, kind: 'Sale' })), ...expenses.map(row => ({ ...row, kind: 'Expense' })), ...orders.map(row => ({ ...row, kind: 'Order' }))]
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 7);
    $('#recentActivity').innerHTML = recent.length
      ? recent.map(row => `<div class="activity-item"><span>${row.kind} · ${escapeHtml(row.note || row.category || row.customer || 'Entry')}</span><strong>${row.kind === 'Expense' ? '-' : ''}${money(row.amount)}</strong></div>`).join('')
      : '<p class="date-text">No recent activity</p>';
  } catch (error) { toast(error.message); }
}

async function refreshTables() {
  try {
    const [sales, expenses, udhaar, orders] = await Promise.all([getRows('sales'), getRows('expenses'), getRows('udhaar'), getRows('orders').catch(() => [])]);
    $('#salesTable').innerHTML = sales.map(row => `<tr><td>${row.date}</td><td>${escapeHtml(row.customer || '-')}</td><td>${escapeHtml(row.note || '-')}</td><td>${money(row.amount)}</td></tr>`).join('') || '<tr><td colspan="4">No sales yet</td></tr>';
    $('#expensesTable').innerHTML = expenses.map(row => `<tr><td>${row.date}</td><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.note || '-')}</td><td>${money(row.amount)}</td></tr>`).join('') || '<tr><td colspan="4">No expenses yet</td></tr>';
    $('#udhaarTable').innerHTML = udhaar.map(row => `<tr><td>${escapeHtml(row.customer)}</td><td>${escapeHtml(row.phone || '-')}</td><td>${escapeHtml(row.note || '-')}</td><td>${money(row.balance)}</td><td><button class="secondary-button settle-button" data-id="${row.id}">Settled</button></td></tr>`).join('') || '<tr><td colspan="5">No Udhaar records</td></tr>';
    $('#ordersTable').innerHTML = orders.map(row => `<tr><td>${row.date || '-'}</td><td>${escapeHtml(row.customer)}</td><td><a href="tel:${escapeHtml(row.phone)}">${escapeHtml(row.phone)}</a></td><td>${escapeHtml(row.items || '-')}</td><td>${money(row.amount)}</td><td>${row.delivery_date || '-'}</td><td><span class="status ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td><td><select class="status-select" data-id="${row.id}"><option value="pending" ${row.status === 'pending' ? 'selected' : ''}>Pending</option><option value="confirmed" ${row.status === 'confirmed' ? 'selected' : ''}>Confirmed</option><option value="completed" ${row.status === 'completed' ? 'selected' : ''}>Completed</option><option value="cancelled" ${row.status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></td></tr>`).join('') || '<tr><td colspan="8">No orders yet</td></tr>';
    $$('.settle-button').forEach(button => button.onclick = () => settleUdhaar(button.dataset.id));
    $$('.status-select').forEach(select => select.onchange = () => updateOrderStatus(select.dataset.id, select.value));
  } catch (error) { toast(error.message); }
}

async function settleUdhaar(id) {
  const { error } = await supabase.from('udhaar').update({ balance: 0 }).eq('id', id);
  if (error) return toast(error.message);
  toast('Balance settled'); await refreshAll();
}
async function updateOrderStatus(id, status) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id);
  if (error) return toast(error.message);
  toast('Order status updated'); await refreshAll();
}
function showView(name) {
  $$('.page-view').forEach(view => view.classList.add('hidden'));
  $(`#${name}View`)?.classList.remove('hidden');
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  $('#pageTitle').textContent = name === 'udhaar' ? 'Udhaar' : name.charAt(0).toUpperCase() + name.slice(1);
}

$('#googleLogin').onclick = async () => {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}${location.pathname}` } });
  if (error) $('#authMessage').textContent = error.message;
};
$('#logout').onclick = async () => supabase.auth.signOut();
$$('.nav-item').forEach(button => button.onclick = () => showView(button.dataset.view));

$('#orderForm').onsubmit = async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  try { await insertRow('orders', { customer: form.get('customer'), phone: form.get('phone'), items: form.get('items'), amount: form.get('amount'), date: form.get('date'), delivery_date: form.get('delivery_date') || null, status: form.get('status') }); event.target.reset(); setTodayDefaults(); } catch (error) { toast(error.message); }
};
$('#saleForm').onsubmit = async event => {
  event.preventDefault(); const form = new FormData(event.target);
  try { await insertRow('sales', { amount: form.get('amount'), customer: form.get('customer'), note: form.get('note'), date: form.get('date') }); event.target.reset(); setTodayDefaults(); } catch (error) { toast(error.message); }
};
$('#expenseForm').onsubmit = async event => {
  event.preventDefault(); const form = new FormData(event.target);
  try { await insertRow('expenses', { amount: form.get('amount'), category: form.get('category'), note: form.get('note'), date: form.get('date') }); event.target.reset(); setTodayDefaults(); } catch (error) { toast(error.message); }
};
$('#udhaarForm').onsubmit = async event => {
  event.preventDefault(); const form = new FormData(event.target);
  try { await insertRow('udhaar', { customer: form.get('customer'), balance: form.get('amount'), phone: form.get('phone'), note: form.get('note') }); event.target.reset(); } catch (error) { toast(error.message); }
};
$('#staffForm').onsubmit = async event => {
  event.preventDefault(); if (!isOwner) return toast('Only the owner can add staff');
  const form = new FormData(event.target);
  try { await insertRow('staff', { email: form.get('email').trim().toLowerCase(), role: form.get('role'), active: true }); event.target.reset(); await refreshStaff(); } catch (error) { toast(error.message); }
};
async function refreshStaff() {
  try { const staff = await getRows('staff'); $('#staffTable').innerHTML = staff.map(row => `<tr><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.role)}</td><td>${row.active ? 'Active' : 'Disabled'}</td></tr>`).join('') || '<tr><td colspan="3">No staff added</td></tr>'; } catch (error) { toast(error.message); }
}
$('#generateReport').onclick = async () => {
  const from = $('#reportFrom').value, to = $('#reportTo').value;
  if (!from || !to) return toast('Choose both dates');
  try { const [sales, expenses] = await Promise.all([getRows('sales'), getRows('expenses')]); const saleTotal = sales.filter(row => row.date >= from && row.date <= to).reduce((sum, row) => sum + Number(row.amount), 0); const expenseTotal = expenses.filter(row => row.date >= from && row.date <= to).reduce((sum, row) => sum + Number(row.amount), 0); $('#reportOutput').innerHTML = `<div class="report-stat"><span>Sales</span><strong>${money(saleTotal)}</strong></div><div class="report-stat"><span>Expenses</span><strong>${money(expenseTotal)}</strong></div><div class="report-stat"><span>Net balance</span><strong>${money(saleTotal - expenseTotal)}</strong></div>`; } catch (error) { toast(error.message); }
};
$('#exportCsv').onclick = async () => {
  try { const [sales, expenses, orders] = await Promise.all([getRows('sales'), getRows('expenses'), getRows('orders').catch(() => [])]); const rows = [['Type','Date','Name/Category','Note/Phone','Amount'], ...sales.map(row => ['Sale', row.date, row.customer || '', row.note || '', row.amount]), ...expenses.map(row => ['Expense', row.date, row.category || '', row.note || '', row.amount]), ...orders.map(row => ['Order', row.date, row.customer || '', `${row.phone || ''} ${row.items || ''}`, row.amount])]; const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `abundant-bloom-${isoDate()}.csv`; link.click(); } catch (error) { toast(error.message); }
};

async function handleSession(session) {
  if (!session) { currentUser = null; $('#loginView').classList.remove('hidden'); $('#mainView').classList.add('hidden'); return; }
  currentUser = session.user;
  const email = (currentUser.email || '').toLowerCase().trim();
  isOwner = email === OWNER_EMAIL;
  let allowed = isOwner;
  if (!isOwner) { const { data, error } = await supabase.from('staff').select('role,active').eq('email', email).maybeSingle(); if (error) { $('#authMessage').textContent = error.message; return; } allowed = !!data?.active; }
  if (!allowed) { $('#authMessage').textContent = 'This account is not authorised'; await supabase.auth.signOut(); return; }
  $('#authMessage').textContent = '';
  $('#loginView').classList.add('hidden');
  $('#mainView').classList.remove('hidden');
  $('#userBadge').innerHTML = `<div><strong>${escapeHtml(currentUser.user_metadata?.full_name || email)}</strong><br><small>${isOwner ? 'Owner' : 'Staff'}</small></div>`;
  $$('.owner-only').forEach(element => element.classList.toggle('hidden', !isOwner));
  await refreshAll();
  if (isOwner) await refreshStaff();
}

async function init() {
  $('#todayText').textContent = new Intl.DateTimeFormat('en-NP', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  setTodayDefaults();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) $('#authMessage').textContent = error.message;
  await handleSession(session);
  supabase.auth.onAuthStateChange((_event, session) => setTimeout(() => handleSession(session), 0));
}
init();
