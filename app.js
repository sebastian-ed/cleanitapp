const STORAGE_KEY = 'cleanit_diluciones_products_v1';
const STANDARD_CONTAINERS = [
  { label: 'Botella 500 ml', ml: 500 },
  { label: 'Pulverizador 750 ml', ml: 750 },
  { label: 'Pulverizador 1 L', ml: 1000 },
  { label: 'Botella 2 L', ml: 2000 },
  { label: 'Balde 4 L', ml: 4000 },
  { label: 'Balde / bidón 5 L', ml: 5000 },
  { label: 'Balde 10 L', ml: 10000 },
  { label: 'Balde 20 L', ml: 20000 },
];

const state = {
  products: [],
  filtered: [],
  category: 'Todos',
  search: '',
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isSupabaseConfigured() {
  const cfg = window.APP_CONFIG || {};
  return Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
}

function getClient() {
  if (!isSupabaseConfigured()) return null;
  return window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);
}

function fromDb(row) {
  return {
    dbId: row.id,
    id: row.slug,
    name: row.name,
    category: row.category || 'Sin categoría',
    type: row.product_type || '',
    shortDescription: row.short_description || '',
    validity: row.validity || '',
    readyToUse: Boolean(row.ready_to_use),
    status: row.status || 'active',
    sortOrder: Number(row.sort_order || 0),
    source: row.source_url || '',
    sourceLabel: row.source_label || 'Ficha técnica',
    surfaces: row.surfaces || [],
    instructions: row.instructions || [],
    precautions: row.precautions || [],
    dilutions: row.dilutions || [],
    packaging: row.packaging || [],
  };
}

async function loadProducts() {
  const client = getClient();
  if (client) {
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true });
    if (!error && data?.length) return data.map(fromDb);
    console.warn('Supabase no devolvió productos activos. Se usa semilla local.', error);
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved).filter((p) => p.status !== 'archived'); }
    catch { localStorage.removeItem(STORAGE_KEY); }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window.SEED_PRODUCTS || []));
  return (window.SEED_PRODUCTS || []).filter((p) => p.status !== 'archived');
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function searchable(product) {
  return normalizeText([
    product.name,
    product.category,
    product.type,
    product.shortDescription,
    product.validity,
    ...(product.surfaces || []),
    ...(product.instructions || []),
    ...(product.precautions || []),
    ...(product.dilutions || []).flatMap((d) => [d.label, d.ratio, d.use, d.rinse, d.contactTime]),
  ].join(' '));
}

function applyFilters() {
  const query = normalizeText(state.search);
  state.filtered = state.products.filter((product) => {
    const categoryMatch = state.category === 'Todos' || product.category === state.category;
    const queryMatch = !query || searchable(product).includes(query);
    return categoryMatch && queryMatch;
  });
  renderProducts();
}

function getCategories() {
  return ['Todos', ...new Set(state.products.map((p) => p.category || 'Sin categoría'))];
}

function renderCategoryChips() {
  const wrap = $('#categoryChips');
  wrap.innerHTML = getCategories().map((cat) => `
    <button class="chip ${cat === state.category ? 'active' : ''}" type="button" data-category="${escapeHTML(cat)}">${escapeHTML(cat)}</button>
  `).join('');
  $$('.chip', wrap).forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.dataset.category;
      renderCategoryChips();
      applyFilters();
    });
  });
}

function renderProducts() {
  const grid = $('#productGrid');
  const empty = $('#emptyState');
  $('#productCounter').textContent = `${state.filtered.length} producto${state.filtered.length === 1 ? '' : 's'}`;
  empty.hidden = state.filtered.length > 0;
  grid.innerHTML = state.filtered.map(renderProductCard).join('');

  $$('[data-open-product]', grid).forEach((btn) => btn.addEventListener('click', () => openProduct(btn.dataset.openProduct)));
  $$('[data-calc-product]', grid).forEach((btn) => btn.addEventListener('click', () => {
    openProduct(btn.dataset.calcProduct, true);
  }));
}

function renderProductCard(product) {
  const readyPill = product.readyToUse
    ? '<span class="pill ready">Listo para usar</span>'
    : `<span class="pill">${product.dilutions?.length || 0} dilución${product.dilutions?.length === 1 ? '' : 'es'}</span>`;
  const highRisk = (product.precautions || []).some((p) => /corrosivo|inflamable|no mezclar|gases tóxicos|acero inoxidable/i.test(p));
  const riskPill = highRisk ? '<span class="pill danger">Precaución crítica</span>' : '<span class="pill warn">Leer precauciones</span>';
  const dilutionPills = product.readyToUse
    ? '<span class="pill ready">Usar puro</span>'
    : (product.dilutions || []).slice(0, 3).map((d) => `<span class="pill">${escapeHTML(d.label)} · ${escapeHTML(d.ratio)}</span>`).join('');
  const safety = (product.precautions || []).slice(0, 2).map((p) => `<li>${escapeHTML(p)}</li>`).join('');

  return `
    <article class="product-card">
      <div class="card-top">
        <div>
          <div class="pill-row"><span class="pill">${escapeHTML(product.category)}</span>${readyPill}${riskPill}</div>
          <h3>${escapeHTML(product.name)}</h3>
          <p class="card-desc"><strong>${escapeHTML(product.type || '')}</strong>${product.type ? ' · ' : ''}${escapeHTML(product.shortDescription || '')}</p>
        </div>
      </div>
      <div class="pill-row">${dilutionPills}</div>
      <div class="safety-preview">
        <strong>Atajo de seguridad</strong>
        <ul>${safety || '<li>Revisar ficha técnica antes de usar.</li>'}</ul>
      </div>
      <div class="card-actions">
        <button class="primary-btn" type="button" data-calc-product="${escapeHTML(product.id)}">Calcular</button>
        <button class="soft-btn" type="button" data-open-product="${escapeHTML(product.id)}">Ver ficha</button>
      </div>
    </article>
  `;
}

function formatMl(value) {
  if (!Number.isFinite(value)) return '-';
  if (value === 0) return '0 ml';
  if (value >= 1000) {
    const liters = value / 1000;
    return `${formatNumber(liters)} L (${formatNumber(value)} ml)`;
  }
  return `${formatNumber(value)} ml`;
}

function formatNumber(value) {
  return Number(value).toLocaleString('es-AR', { maximumFractionDigits: value < 20 ? 2 : 1 });
}

function calcDilution(volumeMl, doseMlPerLiter, mode = 'water') {
  const dose = Number(doseMlPerLiter || 0);
  const volume = Number(volumeMl || 0);
  if (!dose || !volume) return { productMl: 0, waterMl: volume, finalMl: volume };
  if (mode === 'final') {
    const productMl = volume * dose / (1000 + dose);
    return { productMl, waterMl: volume - productMl, finalMl: volume };
  }
  const productMl = (volume / 1000) * dose;
  return { productMl, waterMl: volume, finalMl: volume + productMl };
}

function renderResult(product, dilution, volumeMl, mode) {
  if (!product) return '<p class="result-note">Seleccioná un producto.</p>';
  if (product.readyToUse || !dilution) {
    return `
      <div class="result-grid">
        <div class="result-metric"><small>Producto</small><strong>Usar puro</strong></div>
        <div class="result-metric"><small>Agua</small><strong>No diluir</strong></div>
      </div>
      <p class="result-note">${escapeHTML(product.name)} figura como producto listo para usar. No aplica cálculo de dilución.</p>
    `;
  }
  const result = calcDilution(volumeMl, Number(dilution.mlPerLiter), mode);
  const baseText = mode === 'final' ? 'volumen final aproximado' : 'litros de agua disponibles';
  return `
    <div class="result-grid">
      <div class="result-metric"><small>Producto</small><strong>${formatMl(result.productMl)}</strong></div>
      <div class="result-metric"><small>Agua</small><strong>${formatMl(result.waterMl)}</strong></div>
    </div>
    <p class="result-note">${escapeHTML(product.name)} · ${escapeHTML(dilution.label)} (${escapeHTML(dilution.ratio)}). Cálculo basado en ${baseText}. Resultado final aprox.: ${formatMl(result.finalMl)}.</p>
  `;
}

function productById(id) { return state.products.find((p) => p.id === id); }

function renderQuickCalculatorOptions() {
  const productSelect = $('#quickProductSelect');
  productSelect.innerHTML = state.products.map((p) => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`).join('');
  $('#quickMode').value = window.APP_CONFIG?.DEFAULT_VOLUME_MODE || 'water';
  productSelect.addEventListener('change', syncQuickDilutions);
  $('#quickDilutionSelect').addEventListener('change', updateQuickResult);
  $('#quickVolume').addEventListener('input', updateQuickResult);
  $('#quickUnit').addEventListener('change', updateQuickResult);
  $('#quickMode').addEventListener('change', updateQuickResult);
  syncQuickDilutions();
}

function syncQuickDilutions() {
  const product = productById($('#quickProductSelect').value) || state.products[0];
  const select = $('#quickDilutionSelect');
  if (!product) return;
  if (product.readyToUse || !product.dilutions?.length) {
    select.innerHTML = '<option value="ready">Listo para usar</option>';
    select.disabled = true;
  } else {
    select.disabled = false;
    select.innerHTML = product.dilutions.map((d) => `<option value="${escapeHTML(d.id)}">${escapeHTML(d.label)} · ${escapeHTML(d.ratio)}</option>`).join('');
  }
  updateQuickResult();
}

function updateQuickResult() {
  const product = productById($('#quickProductSelect').value);
  const unit = $('#quickUnit').value;
  const raw = Number($('#quickVolume').value || 0);
  const volumeMl = unit === 'l' ? raw * 1000 : raw;
  const dilution = product?.dilutions?.find((d) => d.id === $('#quickDilutionSelect').value) || product?.dilutions?.[0];
  $('#quickResult').innerHTML = renderResult(product, dilution, volumeMl, $('#quickMode').value);
}

function standardTable(product) {
  if (product.readyToUse || !product.dilutions?.length) {
    return `
      <div class="info-card">
        <h4>Tabla de preparación</h4>
        <p class="small-muted">Este producto está cargado como listo para usar. No se genera tabla de dilución.</p>
      </div>`;
  }
  const rows = product.dilutions.map((d) => {
    const cells = STANDARD_CONTAINERS.map((c) => {
      const { productMl } = calcDilution(c.ml, d.mlPerLiter, 'water');
      return `<td>${formatMl(productMl)}</td>`;
    }).join('');
    return `<tr><td><strong>${escapeHTML(d.label)}</strong><br><span class="small-muted">${escapeHTML(d.ratio)} · ${escapeHTML(String(d.mlPerLiter))} ml/L</span></td>${cells}</tr>`;
  }).join('');
  const headers = STANDARD_CONTAINERS.map((c) => `<th>${escapeHTML(c.label)}</th>`).join('');
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Uso</th>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="small-muted">Tabla calculada sobre la base práctica de la ficha: ml de producto por litro de agua.</p>
  `;
}

function renderDialog(product) {
  const sourceLink = product.source ? `<a class="source-link" href="${escapeHTML(product.source)}" target="_blank" rel="noopener">Abrir ${escapeHTML(product.sourceLabel || 'ficha técnica')}</a>` : '';
  const dilutionOptions = product.readyToUse
    ? '<option value="ready">Listo para usar</option>'
    : product.dilutions.map((d) => `<option value="${escapeHTML(d.id)}">${escapeHTML(d.label)} · ${escapeHTML(d.ratio)}</option>`).join('');

  return `
    <div class="dialog-scroll">
      <section class="dialog-hero">
        <div class="pill-row"><span class="pill">${escapeHTML(product.category)}</span>${product.readyToUse ? '<span class="pill ready">Listo para usar</span>' : '<span class="pill">Concentrado</span>'}</div>
        <h2>${escapeHTML(product.name)}</h2>
        <p>${escapeHTML(product.type || '')}${product.type ? ' · ' : ''}${escapeHTML(product.shortDescription || '')}</p>
      </section>
      <section class="dialog-body">
        <div class="dialog-calculator" id="modalCalculator">
          <h3>Calculadora del producto</h3>
          <div class="form-grid two">
            <label>Uso / Dilución<select id="modalDilution" ${product.readyToUse ? 'disabled' : ''}>${dilutionOptions}</select></label>
            <label>Base del cálculo<select id="modalMode"><option value="water">Tengo esta cantidad de agua</option><option value="final">Quiero preparar esta cantidad final</option></select></label>
          </div>
          <div class="inline-fields">
            <label>Cantidad<input id="modalVolume" type="number" min="0" step="0.1" value="5" inputmode="decimal" /></label>
            <label>Unidad<select id="modalUnit"><option value="l">litros</option><option value="ml">ml</option></select></label>
          </div>
          <div class="result-card" id="modalResult"></div>
        </div>

        <div>
          <h3>Tabla rápida por recipiente</h3>
          ${standardTable(product)}
        </div>

        <div class="info-grid">
          <article class="info-card">
            <h4>Forma de uso</h4>
            <ol>${(product.instructions || []).map((x) => `<li>${escapeHTML(x)}</li>`).join('') || '<li>Sin instrucciones cargadas.</li>'}</ol>
          </article>
          <article class="info-card">
            <h4>Precauciones críticas</h4>
            <ul>${(product.precautions || []).map((x) => `<li>${escapeHTML(x)}</li>`).join('') || '<li>Sin precauciones cargadas.</li>'}</ul>
          </article>
        </div>

        <div class="info-grid">
          <article class="info-card">
            <h4>Superficies / usos</h4>
            <div class="pill-row">${(product.surfaces || []).map((s) => `<span class="pill">${escapeHTML(s)}</span>`).join('') || '<span class="small-muted">No cargado</span>'}</div>
          </article>
          <article class="info-card">
            <h4>Datos</h4>
            <p class="small-muted"><strong>Validez:</strong> ${escapeHTML(product.validity || 'No informada')}</p>
            ${sourceLink ? `<p>${sourceLink}</p>` : ''}
          </article>
        </div>
      </section>
    </div>
  `;
}

function openProduct(id, focusCalculator = false) {
  const product = productById(id);
  if (!product) return;
  const dialog = $('#productDialog');
  $('#dialogContent').innerHTML = renderDialog(product);
  dialog.showModal();
  setupModalCalculator(product);
  if (focusCalculator) $('#modalCalculator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setupModalCalculator(product) {
  const update = () => {
    const raw = Number($('#modalVolume').value || 0);
    const volumeMl = $('#modalUnit').value === 'l' ? raw * 1000 : raw;
    const dilution = product.dilutions?.find((d) => d.id === $('#modalDilution').value) || product.dilutions?.[0];
    $('#modalResult').innerHTML = renderResult(product, dilution, volumeMl, $('#modalMode').value);
  };
  ['modalDilution', 'modalMode', 'modalVolume', 'modalUnit'].forEach((id) => $(`#${id}`)?.addEventListener('input', update));
  ['modalDilution', 'modalMode', 'modalUnit'].forEach((id) => $(`#${id}`)?.addEventListener('change', update));
  $('#modalMode').value = window.APP_CONFIG?.DEFAULT_VOLUME_MODE || 'water';
  update();
}

function initDialogs() {
  $('[data-close-dialog]').addEventListener('click', () => $('#productDialog').close());
  $('[data-open-help]').addEventListener('click', () => $('#helpDialog').showModal());
  $('[data-close-help]').addEventListener('click', () => $('#helpDialog').close());
  [$('#productDialog'), $('#helpDialog')].forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

function initSearch() {
  $('#searchInput').addEventListener('input', (event) => {
    state.search = event.target.value;
    applyFilters();
  });
  $('#clearSearch').addEventListener('click', () => {
    $('#searchInput').value = '';
    state.search = '';
    applyFilters();
  });
}

async function init() {
  state.products = await loadProducts();
  state.filtered = [...state.products];
  renderCategoryChips();
  renderProducts();
  renderQuickCalculatorOptions();
  initSearch();
  initDialogs();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML('afterbegin', `<div class="error-msg active" style="margin:16px">Error al iniciar la app: ${escapeHTML(error.message)}</div>`);
});
