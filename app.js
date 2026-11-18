const seedUsers = [
  { id: 1, name: "Você", email: "voce@familia.com", color: "#7059d8" },
  { id: 2, name: "Ana", email: "ana@familia.com", color: "#ee7c55" },
  { id: 3, name: "Carlos", email: "carlos@familia.com", color: "#4a9d91" }
];
const seedCards = [{ id: 1, name: "Nubank", digits: "4821" }, { id: 2, name: "Mercado Pago", digits: "9034" }];
const seedExpenses = [
  { id: 1, description: "Supermercado Bom Dia", amount: 284.90, date: "2026-11-17", userId: 1, cardId: 1, installments: 1 },
  { id: 2, description: "Academia", amount: 149.90, date: "2026-11-15", userId: 2, cardId: 1, installments: 1 },
  { id: 3, description: "Notebook", amount: 4200, date: "2026-11-10", userId: 3, cardId: 2, installments: 12 },
  { id: 4, description: "Restaurante", amount: 186.40, date: "2026-11-08", userId: 1, cardId: 1, installments: 1 }
];

const readStore = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};
let users = readStore("familyUsers", seedUsers).map((u, i) => ({ ...u, email: u.email || `${String(u.name || "membro").toLowerCase().replace(/\s+/g, ".")}@familia.com`, color: u.color || seedUsers[i % seedUsers.length].color }));
let cards = readStore("familyCards", seedCards);
let expenses = readStore("familyExpenses", seedExpenses);
let importedRows = [];
let activeUser = null;
let billMonth = new Date().toISOString().slice(0, 7);

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const save = () => {
  localStorage.setItem("familyUsers", JSON.stringify(users));
  localStorage.setItem("familyCards", JSON.stringify(cards));
  localStorage.setItem("familyExpenses", JSON.stringify(expenses));
};
const monthKey = date => String(date || "").slice(0, 7);
const getUser = id => users.find(user => user.id == id) || users[0] || { name: "Membro", color: "#7059d8" };
const getCard = id => cards.find(card => card.id == id) || { name: "Cartão", digits: "0000" };
const monthLabel = month => {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

function installmentForMonth(expense, month) {
  const monthsFromStart = (Number(month.slice(0, 4)) - Number(monthKey(expense.date).slice(0, 4))) * 12 + Number(month.slice(5, 7)) - Number(monthKey(expense.date).slice(5, 7));
  if (monthsFromStart < 0 || monthsFromStart >= Number(expense.installments || 1)) return null;
  const count = Number(expense.installments || 1);
  const portion = Math.round((Number(expense.amount) / count + Number.EPSILON) * 100) / 100;
  const amount = monthsFromStart === count - 1 ? Math.round((Number(expense.amount) - portion * (count - 1) + Number.EPSILON) * 100) / 100 : portion;
  return { number: monthsFromStart + 1, count, amount };
}
function getMonthExpenses(month) {
  return expenses.map(expense => ({ expense, installment: installmentForMonth(expense, month) })).filter(row => row.installment);
}
function renderOptions() {
  document.querySelector("#expense-user").innerHTML = users.map(user => `<option value="${user.id}" ${activeUser && user.id === activeUser.id ? "selected" : ""}>${escapeHTML(user.name)}</option>`).join("");
  document.querySelector("#expense-card").innerHTML = cards.map(card => `<option value="${card.id}">${escapeHTML(card.name)} • ${escapeHTML(card.digits)}</option>`).join("");
}
function renderExpenseList(elementId, rows) {
  const element = document.querySelector(`#${elementId}`);
  if (!rows.length) { element.innerHTML = '<div class="empty">Nenhuma compra nesta fatura</div>'; return; }
  element.innerHTML = rows.map(({ expense, installment }) => {
    const user = getUser(expense.userId);
    const card = getCard(expense.cardId);
    const installmentText = installment.count > 1 ? `${installment.number}/${installment.count} · ${money(installment.amount)} da parcela` : "À vista";
    return `<div class="expense-item"><div class="expense-icon">${installment.count > 1 ? "◫" : "⌑"}</div><div class="expense-info"><strong>${escapeHTML(expense.description)}</strong><small>${escapeHTML(user.name)} · ${escapeHTML(card.name)} · compra em ${new Date(`${expense.date}T12:00:00`).toLocaleDateString("pt-BR")}</small></div><div class="expense-amount"><strong>${money(installment.amount)}</strong><small>${installmentText}</small></div></div>`;
  }).join("");
}
function renderDashboard() {
  const rows = getMonthExpenses(billMonth);
  const total = rows.reduce((sum, row) => sum + row.installment.amount, 0);
  document.querySelector("#total-spend").textContent = money(total);
  document.querySelector("#purchase-count").textContent = rows.length;
  document.querySelector("#installment-count").textContent = `${rows.filter(row => row.installment.count > 1).length} compras parceladas`;
  document.querySelector("#card-count").textContent = cards.length;
  document.querySelector("#page-title").textContent = "Visão geral";
  const totals = users.map(user => ({ user, total: rows.filter(row => row.expense.userId == user.id).reduce((sum, row) => sum + row.installment.amount, 0) }));
  const max = Math.max(...totals.map(row => row.total), 1);
  document.querySelector("#user-chart").innerHTML = totals.length ? totals.map(row => `<div class="bar-row"><span>${escapeHTML(row.user.name)}</span><div class="bar"><div style="width:${row.total / max * 100}%;background:${escapeHTML(row.user.color)}"></div></div><span class="bar-value">${money(row.total)}</span></div>`).join("") : '<div class="empty">Adicione membros para acompanhar os gastos.</div>';
  renderExpenseList("recent-list", rows.slice().reverse().slice(0, 5));
  renderExpenseList("all-expenses", rows.slice().reverse());
}
function renderCards() {
  document.querySelector("#card-grid").innerHTML = cards.length ? cards.map((card, index) => `<article class="bank-card" style="background:${index % 2 ? "linear-gradient(135deg,#3a3a42,#16171b)" : "linear-gradient(135deg,#7059d8,#4e3aa2)"}"><small>CARTÃO FAMÍLIA</small><strong>${escapeHTML(card.name)}</strong><span class="digits">•••• •••• •••• ${escapeHTML(card.digits)}</span></article>`).join("") : '<div class="empty">Nenhum cartão cadastrado</div>';
}
function renderUsers() {
  document.querySelector("#user-grid").innerHTML = users.map(user => {
    const total = getMonthExpenses(billMonth).filter(row => row.expense.userId == user.id).reduce((sum, row) => sum + row.installment.amount, 0);
    return `<article class="user-card"><div class="avatar" style="background:${escapeHTML(user.color)}">${escapeHTML(user.name.charAt(0).toUpperCase())}</div><div><strong>${escapeHTML(user.name)}</strong><small>${escapeHTML(user.email)} · ${money(total)} nesta fatura</small></div></article>`;
  }).join("");
}
function render() { renderOptions(); renderDashboard(); renderCards(); renderUsers(); }
function setActiveUser(user) {
  activeUser = user;
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#app-shell").hidden = false;
  document.querySelector("#sidebar-name").textContent = user.name;
  document.querySelector("#sidebar-email").textContent = user.email;
  document.querySelector("#sidebar-avatar").textContent = user.name.charAt(0).toUpperCase();
  document.querySelector("#sidebar-avatar").style.background = user.color;
  localStorage.setItem("familyActiveUser", String(user.id));
  render();
}

document.querySelector("#login-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email")).trim().toLowerCase();
  const user = users.find(member => member.email.toLowerCase() === email);
  if (!user || !form.get("password")) { document.querySelector("#login-error").textContent = "Não encontramos esse e-mail. Cadastre o membro ou tente um e-mail existente."; return; }
  document.querySelector("#login-error").textContent = "";
  setActiveUser(user);
});
document.querySelector("#logout").addEventListener("click", () => { localStorage.removeItem("familyActiveUser"); activeUser = null; document.querySelector("#app-shell").hidden = true; document.querySelector("#login-screen").hidden = false; });

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item === button));
  document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === button.dataset.page));
  const titles = { dashboard: "Visão geral", expenses: "Compras", cards: "Cartões", users: "Usuários", invoice: "Importar fatura" };
  document.querySelector("#page-title").textContent = titles[button.dataset.page];
}));
document.querySelector("#bill-month").value = billMonth;
document.querySelector("#bill-month").addEventListener("change", event => { if (event.target.value) { billMonth = event.target.value; render(); } });
const open = selector => document.querySelector(selector).showModal();
document.querySelector("#open-expense").addEventListener("click", () => open("#expense-modal"));
document.querySelector("#open-card").addEventListener("click", () => open("#card-modal"));
document.querySelector("#open-user").addEventListener("click", () => open("#user-modal"));
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));

document.querySelector("#expense-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  expenses.push({ id: Date.now(), description: String(form.get("description")).trim(), amount: Number(form.get("amount")), date: form.get("date"), userId: Number(form.get("user")), cardId: Number(form.get("card")), installments: Number(form.get("installments")) });
  save(); event.currentTarget.reset(); document.querySelector('#expense-form [name="date"]').value = new Date().toISOString().slice(0, 10); document.querySelector("#expense-modal").close(); render();
});
document.querySelector("#card-form").addEventListener("submit", event => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  cards.push({ id: Date.now(), name: String(form.get("name")).trim(), digits: String(form.get("digits")) }); save(); event.currentTarget.reset(); document.querySelector("#card-modal").close(); render();
});
document.querySelector("#user-form").addEventListener("submit", event => {
  event.preventDefault(); const form = new FormData(event.currentTarget); const email = String(form.get("email")).trim().toLowerCase();
  if (users.some(user => user.email.toLowerCase() === email)) { alert("Este e-mail já está cadastrado."); return; }
  users.push({ id: Date.now(), name: String(form.get("name")).trim(), email, color: form.get("color") }); save(); event.currentTarget.reset(); document.querySelector("#user-modal").close(); render();
});

function parseAmount(value) {
  let text = String(value || "").replace(/[^\d,.-]/g, "");
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const amount = Number(text);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}
function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
  const split = line => { const result = []; let value = "", quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; } else if (char === delimiter && !quoted) { result.push(value.trim()); value = ""; } else value += char; } result.push(value.trim()); return result; };
  const header = split(lines[0]).map(value => value.toLowerCase());
  const find = (columns, terms, fallback) => { const index = header.findIndex(name => terms.some(term => name.includes(term))); return index >= 0 ? columns[index] : columns[fallback]; };
  return lines.slice(1).map(line => { const columns = split(line); const description = find(columns, ["descr", "estabele", "loja", "merchant", "compra", "lançamento"], 0); const amount = find(columns, ["valor", "amount", "total"], 1); const date = find(columns, ["data", "date"], 2); const installments = find(columns, ["parcela", "installment"], -1); return { description: description || "Compra importada", amount: parseAmount(amount), date: normalizeDate(date), installments: parseInstallments(installments), checked: true }; }).filter(row => row.amount > 0);
}
function normalizeDate(value) {
  const text = String(value || "").trim();
  const br = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (br) return `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : `${billMonth}-01`;
}
function parseInstallments(value) { const match = String(value || "").match(/(\d+)\s*(?:\/|de)\s*(\d+)/i); return match ? Number(match[2]) : 1; }
function parsePdfLines(lines) {
  const rows = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const dateMatch = line.match(/(\d{2}[./-]\d{2}(?:[./-]\d{2,4})?)/);
    const amountMatch = line.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+\.\d{2}/g);
    if (!dateMatch || !amountMatch?.length) continue;
    const description = line.replace(dateMatch[0], "").replace(amountMatch[amountMatch.length - 1], "").replace(/\s+/g, " ").trim();
    const amount = parseAmount(amountMatch[amountMatch.length - 1]);
    if (description && amount > 0) rows.push({ description, amount, date: normalizeDate(dateMatch[0]), installments: parseInstallments(line), checked: true });
  }
  return rows;
}
function renderImportedRows() {
  const container = document.querySelector("#import-list");
  document.querySelector("#import-selected").disabled = !importedRows.some(row => row.checked);
  if (!importedRows.length) { container.innerHTML = '<div class="empty">Não encontramos lançamentos automaticamente. Confira o arquivo ou importe um CSV.</div>'; return; }
  container.innerHTML = importedRows.map((row, index) => `<div class="import-row"><label class="import-check"><input type="checkbox" data-row="${index}" ${row.checked ? "checked" : ""} /><span></span></label><div class="expense-info"><strong>${escapeHTML(row.description)}</strong><small>${new Date(`${row.date}T12:00:00`).toLocaleDateString("pt-BR")} · ${row.installments > 1 ? `${row.installments} parcelas` : "à vista"} · revisar dados</small></div><div class="expense-amount"><strong>${money(row.amount)}</strong><select data-owner="${index}" aria-label="Responsável">${users.map(user => `<option value="${user.id}" ${activeUser && user.id === activeUser.id ? "selected" : ""}>${escapeHTML(user.name)}</option>`).join("")}</select></div></div>`).join("");
  container.querySelectorAll("[data-row]").forEach(input => input.addEventListener("change", () => { importedRows[Number(input.dataset.row)].checked = input.checked; renderImportedRows(); }));
  container.querySelectorAll("[data-owner]").forEach(input => input.addEventListener("change", () => { importedRows[Number(input.dataset.owner)].userId = Number(input.value); }));
}
document.querySelector("#invoice-file").addEventListener("change", async event => {
  const file = event.target.files?.[0]; if (!file) return;
  document.querySelector("#file-name").textContent = `Analisando ${file.name}…`;
  document.querySelector("#import-list").innerHTML = '<div class="empty">Leitura automática em andamento…</div>';
  try {
    if (file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".txt")) importedRows = parseCSV(await file.text());
    else if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const lines = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber); const content = await page.getTextContent();
        let line = "", previousY = null;
        for (const item of content.items) { const y = item.transform?.[5]; if (previousY !== null && Math.abs(y - previousY) > 3) { lines.push(line); line = ""; } line += `${item.str} `; previousY = y; }
        if (line) lines.push(line);
      }
      importedRows = parsePdfLines(lines);
      if (!importedRows.length) document.querySelector("#import-list").innerHTML = '<div class="empty">O PDF não apresentou texto de compras legível. PDFs digitalizados e layouts diferentes podem exigir OCR/IA no servidor. Tente CSV ou confira manualmente.</div>';
    } else throw new Error("Leitor de PDF indisponível. Tente um arquivo CSV.");
    document.querySelector("#file-name").textContent = file.name;
    renderImportedRows();
  } catch (error) {
    importedRows = []; document.querySelector("#file-name").textContent = file.name;
    document.querySelector("#import-list").innerHTML = `<div class="empty">Não foi possível ler o arquivo: ${escapeHTML(error.message)}. Tente CSV ou revise o PDF.</div>`;
    document.querySelector("#import-selected").disabled = true;
  }
});
document.querySelector("#import-selected").addEventListener("click", () => {
  const selected = importedRows.filter(row => row.checked);
  if (!selected.length || !cards.length) { alert("Cadastre um cartão antes de importar compras."); return; }
  selected.forEach((row, index) => expenses.push({ id: Date.now() + index, description: row.description, amount: row.amount, date: row.date, userId: row.userId || activeUser?.id || users[0]?.id, cardId: cards[0].id, installments: row.installments || 1 }));
  save(); importedRows = []; document.querySelector("#invoice-file").value = ""; document.querySelector("#file-name").textContent = "Compras importadas. Selecione outra fatura para continuar."; document.querySelector("#import-list").innerHTML = '<div class="empty">Importação concluída. Consulte as compras na fatura correspondente.</div>'; document.querySelector("#import-selected").disabled = true; render();
});

document.querySelector('#expense-form [name="date"]').value = new Date().toISOString().slice(0, 10);
const rememberedUser = users.find(user => String(user.id) === localStorage.getItem("familyActiveUser"));
if (rememberedUser) setActiveUser(rememberedUser);
