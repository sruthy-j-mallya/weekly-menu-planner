const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MEALS = ['breakfast','lunch','dinner'];

const PALETTE = [
  { hex: '#f5c97a', label: 'Amber'    },
  { hex: '#f0a07a', label: 'Peach'    },
  { hex: '#e87878', label: 'Rose'     },
  { hex: '#9ecfa3', label: 'Sage'     },
  { hex: '#7ab8d4', label: 'Sky'      },
  { hex: '#a78fd4', label: 'Lavender' },
  { hex: '#d4a0c0', label: 'Mauve'    },
  { hex: '#c2b49a', label: 'Latte'    },
];

// ── State ──────────────────────────────────────────────────────────
let dishes      = [];    // { id, name, category, color }
let schedule    = {};    // { 'Monday-breakfast': [dishId, ...] }
let dragInfo    = null;
let activeFilter = 'All';
let selectedColor = PALETTE[0].hex;

// ── Persist ────────────────────────────────────────────────────────
function save() {
  localStorage.setItem('wm_dishes',   JSON.stringify(dishes));
  localStorage.setItem('wm_schedule', JSON.stringify(schedule));
}

function load() {
  try {
    const d = localStorage.getItem('wm_dishes');
    const s = localStorage.getItem('wm_schedule');
    if (d) dishes   = JSON.parse(d);
    if (s) schedule = JSON.parse(s);
  } catch(e) {}
}

// ── Build table rows ───────────────────────────────────────────────
const tbody = document.getElementById('menuBody');
DAYS.forEach(day => {
  const tr = document.createElement('tr');
  const tdDay = document.createElement('td');
  tdDay.className = 'day-name';
  tdDay.textContent = day;
  tr.appendChild(tdDay);

  MEALS.forEach(meal => {
    const key = `${day}-${meal}`;
    if (!schedule[key]) schedule[key] = [];
    const td = document.createElement('td');
    td.className = 'meal-cell';
    td.dataset.key = key;

    td.addEventListener('dragover',  e => { e.preventDefault(); td.classList.add('drag-over'); });
    td.addEventListener('dragleave', ()  => td.classList.remove('drag-over'));
    td.addEventListener('drop', e => {
      e.preventDefault();
      td.classList.remove('drag-over');
      if (!dragInfo) return;
      const { dishId, fromCell } = dragInfo;
      if (fromCell) schedule[fromCell] = schedule[fromCell].filter(id => id !== dishId);
      if (!schedule[key].includes(dishId)) schedule[key].push(dishId);
      save(); render();
    });

    tr.appendChild(td);
  });
  tbody.appendChild(tr);
});

// ── Build colour swatches ──────────────────────────────────────────
const colorRow = document.getElementById('colorRow');
PALETTE.forEach((p, i) => {
  const sw = document.createElement('button');
  sw.className = 'color-swatch' + (i === 0 ? ' selected' : '');
  sw.style.background = p.hex;
  sw.title = p.label;
  sw.type  = 'button';
  sw.addEventListener('click', () => {
    selectedColor = p.hex;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    sw.classList.add('selected');
  });
  colorRow.appendChild(sw);
});

// ── Helpers ────────────────────────────────────────────────────────
function getCategories() {
  return [...new Set(dishes.map(d => d.category).filter(Boolean))].sort();
}

function contrastFg(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return (r*299 + g*587 + b*114)/1000 > 155 ? '#3a2810' : '#fff8f0';
}

// ── Render ─────────────────────────────────────────────────────────
function render() {
  // -- Filter pills --
  const filterRow = document.getElementById('filterRow');
  filterRow.innerHTML = '';
  const cats = getCategories();
  if (cats.length) {
    ['All', ...cats].forEach(cat => {
      const pill = document.createElement('button');
      pill.className = 'filter-pill' + (activeFilter === cat ? ' active' : '');
      pill.textContent = cat;
      pill.addEventListener('click', () => { activeFilter = cat; render(); });
      filterRow.appendChild(pill);
    });
  }

  // -- Dish pool --
  const pool = document.getElementById('dishPool');
  pool.innerHTML = '';
  const placedIds = new Set(Object.values(schedule).flat());
  const poolDishes = dishes.filter(d => {
    if (placedIds.has(d.id)) return false;
    if (activeFilter !== 'All' && d.category !== activeFilter) return false;
    return true;
  });
  pool.classList.toggle('empty', poolDishes.length === 0);
  poolDishes.forEach(d => pool.appendChild(makeTag(d, null)));

  // -- Category select in modal --
  const catSelect = document.getElementById('catSelect');
  const prev = catSelect.value;
  catSelect.innerHTML = '<option value="">— select existing —</option>';
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    catSelect.appendChild(o);
  });
  if (prev) catSelect.value = prev;

  // -- Table cells --
  document.querySelectorAll('.meal-cell').forEach(td => {
    const key = td.dataset.key;
    const wrap = document.createElement('div');
    wrap.className = 'cell-tags';
    (schedule[key] || []).forEach(id => {
      const d = dishes.find(x => x.id === id);
      if (d) wrap.appendChild(makeTag(d, key));
    });
    td.innerHTML = '';
    td.appendChild(wrap);
  });
}

function makeTag(dish, cellKey) {
  const bg = dish.color || PALETTE[0].hex;
  const fg = contrastFg(bg);
  const dotOpacity = fg === '#fff8f0' ? '0.55' : '0.3';

  const tag = document.createElement('div');
  tag.className  = 'tag';
  tag.draggable  = true;
  tag.style.cssText = `background:${bg};color:${fg};border-color:${bg}`;
  tag.innerHTML =
    `<span class="tag-dot" style="background:${fg};opacity:${dotOpacity}"></span>` +
    (dish.category ? `<span class="tag-category">${dish.category}</span>` : '') +
    `<span class="tag-name">${dish.name}</span>` +
    `<button class="tag-del" style="color:${fg}" title="Remove">×</button>`;

  tag.addEventListener('dragstart', () => {
    dragInfo = { dishId: dish.id, fromCell: cellKey };
    setTimeout(() => tag.classList.add('dragging'), 0);
  });
  tag.addEventListener('dragend', () => { tag.classList.remove('dragging'); dragInfo = null; });

  tag.querySelector('.tag-del').addEventListener('click', e => {
    e.stopPropagation();
    if (cellKey) {
      schedule[cellKey] = schedule[cellKey].filter(id => id !== dish.id);
    } else {
      dishes = dishes.filter(d => d.id !== dish.id);
      Object.keys(schedule).forEach(k => { schedule[k] = schedule[k].filter(id => id !== dish.id); });
    }
    save(); render();
  });

  return tag;
}

// ── Add dish modal ─────────────────────────────────────────────────
const modalBg   = document.getElementById('modalBg');
const dishInput = document.getElementById('dishInput');
const catCustom = document.getElementById('catCustom');

function openAddModal() {
  modalBg.classList.add('open');
  dishInput.value = '';
  catCustom.value = '';
  document.getElementById('catSelect').value = '';
  selectedColor = PALETTE[0].hex;
  document.querySelectorAll('.color-swatch').forEach((s,i) => s.classList.toggle('selected', i === 0));
  setTimeout(() => dishInput.focus(), 50);
}

document.getElementById('openModal').addEventListener('click', openAddModal);
document.getElementById('closeModal').addEventListener('click', () => modalBg.classList.remove('open'));
modalBg.addEventListener('click', e => { if (e.target === modalBg) modalBg.classList.remove('open'); });

function addDish() {
  const name = dishInput.value.trim();
  if (!name) { dishInput.focus(); return; }
  const category = (catCustom.value.trim() || document.getElementById('catSelect').value).trim();
  dishes.push({ id: Date.now().toString(), name, category, color: selectedColor });
  modalBg.classList.remove('open');
  save(); render();
}

document.getElementById('confirmAdd').addEventListener('click', addDish);
dishInput.addEventListener('keydown', e => { if (e.key === 'Enter') addDish(); });

// ── Bulk import modal ──────────────────────────────────────────────
const bulkModalBg = document.getElementById('bulkModalBg');
const bulkJsonInput = document.getElementById('bulkJsonInput');
const bulkError = document.getElementById('bulkError');

function normalizeImportedDishes(parsed) {
  if (!Array.isArray(parsed)) throw new Error('JSON must be an array of dish objects.');
  const base = Date.now();
  const normalized = parsed.map((raw, i) => {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.name ?? '').trim();
    if (!name) return null;
    const idRaw = raw.id != null ? String(raw.id).trim() : '';
    const id = idRaw || `${base}-${i}`;
    const category = raw.category != null ? String(raw.category).trim() : '';
    const c = raw.color != null ? String(raw.color).trim() : '';
    const color = /^#[0-9a-fA-F]{6}$/.test(c) ? c : PALETTE[0].hex;
    return { id, name, category, color };
  }).filter(Boolean);

  const byId = new Map();
  normalized.forEach(d => byId.set(d.id, d));
  return [...byId.values()];
}

function pruneScheduleToDishes() {
  const ids = new Set(dishes.map(d => d.id));
  Object.keys(schedule).forEach(k => {
    schedule[k] = schedule[k].filter(id => ids.has(id));
  });
}

function openBulkModal() {
  bulkModalBg.classList.add('open');
  bulkJsonInput.value = '';
  bulkError.hidden = true;
  bulkError.textContent = '';
  setTimeout(() => bulkJsonInput.focus(), 50);
}

function applyBulkImport() {
  bulkError.hidden = true;
  bulkError.textContent = '';
  const text = bulkJsonInput.value.trim();
  if (!text) {
    bulkError.textContent = 'Paste a JSON array first.';
    bulkError.hidden = false;
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    bulkError.textContent = 'Invalid JSON — check brackets, commas, and quotes.';
    bulkError.hidden = false;
    return;
  }
  let next;
  try {
    next = normalizeImportedDishes(parsed);
  } catch (err) {
    bulkError.textContent = err.message || 'Could not read that format.';
    bulkError.hidden = false;
    return;
  }
  if (!next.length) {
    bulkError.textContent = 'No valid dishes found — each entry needs at least a name.';
    bulkError.hidden = false;
    return;
  }
  dishes = next;
  pruneScheduleToDishes();
  save();
  bulkModalBg.classList.remove('open');
  render();
}

document.getElementById('openBulkModal').addEventListener('click', openBulkModal);
document.getElementById('closeBulkModal').addEventListener('click', () => bulkModalBg.classList.remove('open'));
bulkModalBg.addEventListener('click', e => { if (e.target === bulkModalBg) bulkModalBg.classList.remove('open'); });
document.getElementById('confirmBulkImport').addEventListener('click', applyBulkImport);

// ── Clear week modal ───────────────────────────────────────────────
const confirmBg = document.getElementById('confirmBg');
document.getElementById('clearWeekBtn').addEventListener('click', () => confirmBg.classList.add('open'));
document.getElementById('cancelClear').addEventListener('click',  () => confirmBg.classList.remove('open'));
confirmBg.addEventListener('click', e => { if (e.target === confirmBg) confirmBg.classList.remove('open'); });

document.getElementById('confirmClear').addEventListener('click', () => {
  Object.keys(schedule).forEach(k => { schedule[k] = []; });
  confirmBg.classList.remove('open');
  save(); render();
});

// ── Init ───────────────────────────────────────────────────────────
load();
DAYS.forEach(day => MEALS.forEach(meal => {
  const key = `${day}-${meal}`;
  if (!schedule[key]) schedule[key] = [];
}));
render();
