import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://fhtirtprwihuevsbqmjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c0mtpzjvDGNk5-K9RjFEfQ_6D63uoKm';
const OWNER_EMAIL = 'thephulshop7@gmail.com';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let currentUser = null;
let isOwner = false;
let loginPending = false;

function adDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-NP', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
function isoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function money(value) { return `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}
function setAuthMessage(message = '') {
  const el = $('#authMessage');
  if (el) el.textContent = message;
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
async function refreshAll() { await Promise.all([refreshDashboard(), refreshTables()]); }

async function refreshDashboard() {
  try {
    const [sales, expenses, udhaar] = await Promise.all([getRows('sales'), getRows('expenses'), getRows('udhaar')]);
    const today = isoDate();
    const todaySales = sales.filter(x => x.date === today);
    const todayExpenses = expenses.filter(x => x.date === today);
    const saleTotal = todaySales.reduce((sum, x) => sum + Number(x.amount), 0);
    const expenseTotal = todayExpenses.reduce((sum, x) => sum + Number(x.amount), 0);
    const outstanding = udhaar.reduce((sum, x) => sum + Number(x.balance || 0), 0);
    $('#todaySales').textContent = money(saleTotal);
    $('#todayExpenses').textContent = money(expenseTotal);
    $('#netBalance').textContent = money(saleTotal - expenseTotal);
    $('#udhaarBalance').textContent = money(outstanding);
    $('#todaySaleCount').textContent = `${todaySales.length} transactions`;
    $('#todayExpenseCount').textContent = `${todayExpenses.length} entries`;
    $('#udhaarCount').textContent = `${udhaar.filter(x => Number(x.balance) > 0).length} customers`;
    const chart = $('#salesChart'); chart.innerHTML = '';
    const sevenDays = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = isoDate(d); sevenDays.push({ d, key, total: sales.filter(x => x.date === key).reduce((sum, x) => sum + Number(x.amount), 0) }); }
    const max = Math.max(1, ...sevenDays.map(day => day.total));
    for (const { d, total } of sevenDays) {
      const col = document.createElement('div'); col.className = 'bar-column';
      col.innerHTML = `<div class="bar" title="${money(total)}" style="height:${Math.max(3, total / max * 180)}px"></div><span class="bar-label">${d.toLocaleDateString('en-NP', { weekday: 'short' })}</span>`;
      chart.appendChild(col);
    }
    const recent = [...sales.map(x => ({ ...x, kind: 'Sale' })), ...expenses.map(x => ({ ...x, kind: 'Expense' }))].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 7);
    $('#recentActivity').innerHTML = recent.length ? recent.map(x => `<div class="activity-item"><span>${x.kind} · ${escapeHtml(x.note || x.category || x.customer || 'Entry')}</span><strong>${x.kind === 'Expense' ? '-' : '+'}${money(x.amount)}</strong></div>`).join('') : '<p class="date-text">No recent activity</p>';
  } catch (error) { toast(error.message); }
}
async function refreshTables() {
  try {
    const [sales, expenses, udhaar, inventory] = await Promise.all([getRows('sales'), getRows('expenses'), getRows('udhaar'), getRows('inventory')]);
    $('#salesTable').innerHTML = sales.map(x => `<tr><td>${x.date}</td><td>${escapeHtml(x.customer || '-')}</td><td>${escapeHtml(x.note || '-')}</td><td>${money(x.amount)}</td></tr>`).join('') || '<tr><td colspan="4">No sales yet</td></tr>';
    $('#expensesTable').innerHTML = expenses.map(x => `<tr><td>${x.date}</td><td>${escapeHtml(x.category)}</td><td>${escapeHtml(x.note || '-')}</td><td>${money(x.amount)}</td></tr>`).join('') || '<tr><td colspan="4">No expenses yet</td></tr>';
    $('#udhaarTable').innerHTML = udhaar.map(x => `<tr><td>${escapeHtml(x.customer)}</td><td>${escapeHtml(x.phone || '-')}</td><td>${escapeHtml(x.note || '-')}</td><td>${money(x.balance)}</td><td><button class="secondary-button settle-button" data-id="${x.id}">Settled</button></td></tr>`).join('') || '<tr><td colspan="5">No Udhaar records</td></tr>';
    $('#inventoryTable').innerHTML = inventory.map(x => `<tr><td>${escapeHtml(x.name)}</td><td>${escapeHtml(x.category || '-')}</td><td>${x.quantity}</td><td>${money(x.price)}</td><td>${money(Number(x.quantity) * Number(x.price))}</td></tr>`).join('') || '<tr><td colspan="5">No inventory items</td></tr>';
    $$('.settle-button').forEach(button => button.addEventListener('click', () => settleUdhaar(button.dataset.id)));
  } catch (error) { toast(error.message); }
}
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value == null ? '' : String(value); return div.innerHTML; }
async function settleUdhaar(id) {
  const { error } = await supabase.from('udhaar').update({ balance: 0 }).eq('id', id);
  if (error) return toast(error.message);
  toast('Balance settled'); await refreshAll();
}
function showView(name) {
  $$('.page-view').forEach(el => el.classList.add('hidden'));
  $(`#${name}View`)?.classList.remove('hidden');
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === name));
  $('#pageTitle').textContent = name.charAt(0).toUpperCase() + name.slice(1);
}

$('#googleLogin').addEventListener('click', async () => {
  if (loginPending) return;
  loginPending = true;
  const button = $('#googleLogin'); button.disabled = true; button.textContent = 'Connecting to Google…';
  setAuthMessage('Opening Google sign-in…');
  try {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${window.location.pathname}` } });
    if (error) throw error;
  } catch (error) {
    setAuthMessage(`Sign-in could not start: ${error.message}`);
    button.disabled = false; button.textContent = 'Continue with Google'; loginPending = false;
  }
});
$('#logout').addEventListener('click', async () => { await supabase.auth.signOut(); });
$$('.nav-item').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
$('#saleForm').addEventListener('submit', async event => { event.preventDefault(); const f = new FormData(event.target); try { await insertRow('sales', { amount: f.get('amount'), customer: f.get('customer'), note: f.get('note'), date: f.get('date') }); event.target.reset(); setTodayDefaults(); } catch (error) { toast(error.message); } });
$('#expenseForm').addEventListener('submit', async event => { event.preventDefault(); const f = new FormData(event.target); try { await insertRow('expenses', { amount: f.get('amount'), category: f.get('category'), note: f.get('note'), date: f.get('date') }); event.target.reset(); setTodayDefaults(); } catch (error) { toast(error.message); } });
$('#udhaarForm').addEventListener('submit', async event => { event.preventDefault(); const f = new FormData(event.target); try { await insertRow('udhaar', { customer: f.get('customer'), balance: f.get('amount'), phone: f.get('phone'), note: f.get('note') }); event.target.reset(); } catch (error) { toast(error.message); } });
$('#inventoryForm').addEventListener('submit', async event => { event.preventDefault(); const f = new FormData(event.target); try { await insertRow('inventory', { name: f.get('name'), quantity: f.get('quantity'), price: f.get('price'), category: f.get('category') }); event.target.reset(); } catch (error) { toast(error.message); } });
$('#staffForm').addEventListener('submit', async event => {
  event.preventDefault(); const f = new FormData(event.target);
  if (!isOwner) return toast('Only the owner can add staff');
  try { await insertRow('staff', { email: f.get('email').trim().toLowerCase(), role: f.get('role'), active: true }); event.target.reset(); await refreshStaff(); }
  catch (error) { toast(error.message); }
});
async function refreshStaff() {
  try { const staff = await getRows('staff'); $('#staffTable').innerHTML = staff.map(x => `<tr><td>${escapeHtml(x.email)}</td><td>${escapeHtml(x.role)}</td><td>${x.active ? 'Active' : 'Disabled'}</td></tr>`).join('') || '<tr><td colspan="3">No staff added</td></tr>'; }
  catch (error) { toast(error.message); }
}
async function getReportRows(from, to) {
  const [sales, expenses] = await Promise.all([getRows('sales'), getRows('expenses')]);
  return { sales: sales.filter(x => x.date >= from && x.date <= to), expenses: expenses.filter(x => x.date >= from && x.date <= to) };
}
$('#generateReport').addEventListener('click', async () => {
  const from = $('#reportFrom').value, to = $('#reportTo').value;
  if (!from || !to) return toast('Choose both dates');
  try { const { sales, expenses } = await getReportRows(from, to); const salesTotal = sales.reduce((s,x) => s + Number(x.amount), 0), expenseTotal = expenses.reduce((s,x) => s + Number(x.amount), 0); $('#reportOutput').innerHTML = `<div class="report-stat"><span>Sales</span><strong>${money(salesTotal)}</strong></div><div class="report-stat"><span>Expenses</span><strong>${money(expenseTotal)}</strong></div><div class="report-stat"><span>Net balance</span><strong>${money(salesTotal - expenseTotal)}</strong></div>`; }
  catch (error) { toast(error.message); }
});
$('#exportCsv').addEventListener('click', async () => {
  try { const [sales, expenses] = await Promise.all([getRows('sales'), getRows('expenses')]); const rows = [['Type','Date','Name/Category','Note','Amount'], ...sales.map(x => ['Sale',x.date,x.customer || '',x.note || '',x.amount]), ...expenses.map(x => ['Expense',x.date,x.category || '',x.note || '',x.amount])]; const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `abundant-bloom-${isoDate()}.csv`; link.click(); }
  catch (error) { toast(error.message); }
});
async function handleSession(session) {
  if (!session) { currentUser = null; $('#loginView').classList.remove('hidden'); $('#mainView').classList.add('hidden'); $('#googleLogin').disabled = false; $('#googleLogin').textContent = 'Continue with Google'; loginPending = false; return; }
  currentUser = session.user;
  const email = (currentUser.email || '').toLowerCase().trim(); isOwner = email === OWNER_EMAIL;
  let allowed = isOwner;
  if (!isOwner) {
    const { data, error } = await supabase.from('staff').select('role,active').eq('email', email).maybeSingle();
    if (error) throw new Error(`Signed in as ${email}, but staff access check failed: ${error.message}`);
    allowed = !!data?.active;
  }
  if (!allowed) { setAuthMessage(`Google sign-in succeeded as ${email}, but this account is not authorized. Sign in with ${OWNER_EMAIL}.`); await supabase.auth.signOut(); return; }
  setAuthMessage(''); $('#loginView').classList.add('hidden'); $('#mainView').classList.remove('hidden');
  $('#userBadge').innerHTML = `${currentUser.user_metadata?.avatar_url ? `<img class="avatar" src="${currentUser.user_metadata.avatar_url}" alt="">` : ''}<div><strong>${escapeHtml(currentUser.user_metadata?.full_name || email)}</strong><br><small>${isOwner ? 'Owner' : 'Staff'}</small></div>`;
  $$('.owner-only').forEach(el => el.classList.toggle('hidden', !isOwner));
  await refreshAll();
  if (isOwner) await refreshStaff();
}
async function init() {
  $('#todayText').textContent = adDate(); setTodayDefaults();
  try { const { data: { session }, error } = await supabase.auth.getSession(); if (error) throw error; await handleSession(session); }
  catch (error) { setAuthMessage(`Unable to restore sign-in: ${error.message}`); }
  supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => { handleSession(session).catch(error => setAuthMessage(`Sign-in succeeded, but the app could not load: ${error.message}`)); }, 0); });
}
init();
