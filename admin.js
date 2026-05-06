const STORAGE_KEY = 'cleanit_diluciones_products_v1';
const LOCAL_ADMIN = { email: 'admin@local', password: 'admin123' };

const app = {
  client: null,
  user: null,
  profile: null,
  products: [],
  localMode: false,
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

function makeClient() {
  if (!isSupabaseConfigured()) return null;
  return window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);
}

function showError(message) {
  const box = $('#globalError');
  box.textContent = message || '';
  box.classList.toggle('active', Boolean(message));
  if (message) setTimeout(() => box.classList.remove('active'), 7000);
}

function showSuccess(message) {
  const box = $('#globalSuccess');
  box.textContent = message || '';
  box.classList.toggle('active', Boolean(message));
  if (message) setTimeout(() => box.classList.remove('active'), 5000);
}

function toLines(text) {
  return String(text || '')
    .split(/\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function toTextarea(value) {
  if (!Array.isArray(value)) return '';
  return value.map((item) => typeof item === 'string' ? item : Object.values(item).filter(Boolean).join(' | ')).join('\n');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `producto-${Date.now()}`;
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

function toDb(product) {
  return {
    slug: product.id,
    name: product.name,
    category: product.category,
    product_type: product.type,
    short_description: product.shortDescription,
    validity: product.validity,
    ready_to_use: product.readyToUse,
    status: product.status,
    sort_order: product.sortOrder,
    source_url: product.source,
    source_label: product.sourceLabel || 'Ficha técnica',
    surfaces: product.surfaces,
    instructions: product.instructions,
    precautions: product.precautions,
    dilutions: product.dilutions,
    packaging: product.packaging,
    updated_at: new Date().toISOString(),
  };
}

function getLocalProducts() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { localStorage.removeItem(STORAGE_KEY); }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window.SEED_PRODUCTS || []));
  return JSON.parse(JSON.stringify(window.SEED_PRODUCTS || []));
}

function saveLocalProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

async function loadProducts() {
  if (app.localMode) {
    app.products = getLocalProducts().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    renderAdminProducts();
    return;
  }
  const { data, error } = await app.client.from('products').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  app.products = (data || []).map(fromDb);
  renderAdminProducts();
}

function renderAdminProducts() {
  const list = $('#adminProductList');
  if (!app.products.length) {
    list.innerHTML = '<div class="notice">No hay productos cargados todavía.</div>';
    return;
  }
  list.innerHTML = app.products.map((p) => `
    <article class="admin-product-item">
      <header>
        <div>
          <span class="pill">${escapeHTML(p.category)}</span>
          <span class="pill ${p.status === 'active' ? 'ready' : 'warn'}">${escapeHTML(p.status)}</span>
          ${p.readyToUse ? '<span class="pill ready">Listo para usar</span>' : `<span class="pill">${p.dilutions?.length || 0} dilución(es)</span>`}
          <h3>${escapeHTML(p.name)}</h3>
          <p>${escapeHTML(p.type || '')}${p.type ? ' · ' : ''}${escapeHTML(p.shortDescription || '')}</p>
        </div>
      </header>
      <div class="admin-product-actions">
        <button class="primary-btn" type="button" data-edit="${escapeHTML(p.id)}">Editar</button>
        <button class="danger-btn" type="button" data-delete="${escapeHTML(p.id)}">Eliminar</button>
      </div>
    </article>
  `).join('');
  $$('[data-edit]', list).forEach((btn) => btn.addEventListener('click', () => editProduct(btn.dataset.edit)));
  $$('[data-delete]', list).forEach((btn) => btn.addEventListener('click', () => deleteProduct(btn.dataset.delete)));
}

function switchTab(id) {
  $$('.admin-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.adminTab === id));
  $$('.admin-view').forEach((view) => view.classList.toggle('active', view.id === id));
}

function clearForm() {
  $('#editorTitle').textContent = 'Nuevo producto';
  $('#productForm').reset();
  $('#productForm').elements.id.value = '';
  $('#productForm').elements.dbId.value = '';
  $('#productForm').elements.status.value = 'active';
  $('#productForm').elements.readyToUse.value = 'false';
  $('#productForm').elements.sortOrder.value = '100';
  $('#deleteFromFormBtn').hidden = true;
  $('#dilutionRows').innerHTML = '';
  addDilutionRow();
}

function addDilutionRow(data = {}) {
  const row = document.createElement('div');
  row.className = 'dilution-row';
  row.innerHTML = `
    <label>Uso<input data-dilution-field="label" placeholder="Limpieza general" value="${escapeHTML(data.label || '')}" /></label>
    <label>Ratio<input data-dilution-field="ratio" placeholder="1:40" value="${escapeHTML(data.ratio || '')}" /></label>
    <label>ml/L<input data-dilution-field="mlPerLiter" type="number" step="0.1" min="0" placeholder="25" value="${escapeHTML(data.mlPerLiter ?? '')}" /></label>
    <button class="icon-btn" type="button" aria-label="Quitar dilución">×</button>
    <label style="grid-column:1 / -1">Uso recomendado<input data-dilution-field="use" placeholder="Ej: limpieza diaria de pisos" value="${escapeHTML(data.use || '')}" /></label>
    <label>Tiempo<input data-dilution-field="contactTime" placeholder="Ej: 10 min" value="${escapeHTML(data.contactTime || '')}" /></label>
    <label style="grid-column:span 2">Enjuague<input data-dilution-field="rinse" placeholder="Ej: no necesita enjuague" value="${escapeHTML(data.rinse || '')}" /></label>
  `;
  row.querySelector('.icon-btn').addEventListener('click', () => row.remove());
  $('#dilutionRows').appendChild(row);
}

function readDilutions() {
  return $$('.dilution-row').map((row, index) => {
    const get = (field) => row.querySelector(`[data-dilution-field="${field}"]`)?.value.trim() || '';
    const label = get('label');
    const mlPerLiter = Number(get('mlPerLiter'));
    if (!label && !mlPerLiter) return null;
    return {
      id: slugify(label || `dilucion-${index + 1}`),
      label,
      ratio: get('ratio'),
      mlPerLiter: Number.isFinite(mlPerLiter) ? mlPerLiter : 0,
      use: get('use'),
      contactTime: get('contactTime'),
      rinse: get('rinse'),
    };
  }).filter(Boolean);
}

function packagingFromTextarea(text) {
  return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [content, presentation, units, sku, ean] = line.split('|').map((x) => x?.trim() || '');
    return { content, presentation, units, sku, ean };
  });
}

function productFromForm() {
  const form = $('#productForm').elements;
  const name = form.name.value.trim();
  const slug = slugify(form.slug.value.trim() || name);
  const readyToUse = form.readyToUse.value === 'true';
  return {
    dbId: form.dbId.value || undefined,
    id: slug,
    name,
    category: form.category.value.trim() || 'Sin categoría',
    type: form.type.value.trim(),
    shortDescription: form.shortDescription.value.trim(),
    validity: form.validity.value.trim(),
    readyToUse,
    status: form.status.value,
    sortOrder: Number(form.sortOrder.value || 100),
    source: form.source.value.trim(),
    sourceLabel: 'Ficha técnica',
    surfaces: toLines(form.surfaces.value),
    instructions: toLines(form.instructions.value),
    precautions: toLines(form.precautions.value),
    dilutions: readyToUse ? [] : readDilutions(),
    packaging: packagingFromTextarea(form.packaging.value),
  };
}

function fillForm(product) {
  clearForm();
  $('#editorTitle').textContent = `Editar ${product.name}`;
  const form = $('#productForm').elements;
  form.id.value = product.id;
  form.dbId.value = product.dbId || '';
  form.slug.value = product.id;
  form.name.value = product.name || '';
  form.category.value = product.category || '';
  form.type.value = product.type || '';
  form.validity.value = product.validity || '';
  form.shortDescription.value = product.shortDescription || '';
  form.surfaces.value = toTextarea(product.surfaces || []);
  form.source.value = product.source || '';
  form.instructions.value = toTextarea(product.instructions || []);
  form.precautions.value = toTextarea(product.precautions || []);
  form.status.value = product.status || 'active';
  form.sortOrder.value = product.sortOrder || 100;
  form.readyToUse.value = String(Boolean(product.readyToUse));
  $('#dilutionRows').innerHTML = '';
  (product.dilutions?.length ? product.dilutions : []).forEach(addDilutionRow);
  if (!product.dilutions?.length) addDilutionRow();
  form.packaging.value = (product.packaging || []).map((p) => [p.content, p.presentation, p.units, p.sku, p.ean].filter(Boolean).join(' | ')).join('\n');
  $('#deleteFromFormBtn').hidden = false;
}

function editProduct(slug) {
  const product = app.products.find((p) => p.id === slug);
  if (!product) return;
  fillForm(product);
  switchTab('editorView');
}

async function saveProduct(event) {
  event.preventDefault();
  const product = productFromForm();
  if (!product.name) return showError('Falta el nombre del producto.');
  if (!product.readyToUse && !product.dilutions.length) return showError('Si el producto no es listo para usar, cargá al menos una dilución.');

  if (app.localMode) {
    const index = app.products.findIndex((p) => p.id === ($('#productForm').elements.id.value || product.id));
    if (index >= 0) app.products[index] = product; else app.products.push(product);
    app.products.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    saveLocalProducts(app.products);
    renderAdminProducts();
    showSuccess('Producto guardado en modo local.');
    switchTab('productsView');
    return;
  }

  const payload = toDb(product);
  let result;
  if (product.dbId) {
    result = await app.client.from('products').update(payload).eq('id', product.dbId).select().single();
  } else {
    result = await app.client.from('products').insert(payload).select().single();
  }
  if (result.error) return showError(result.error.message);
  showSuccess('Producto guardado.');
  await loadProducts();
  switchTab('productsView');
}

async function deleteProduct(slug) {
  const product = app.products.find((p) => p.id === slug);
  if (!product) return;
  if (!confirm(`¿Eliminar ${product.name}? Esta acción no conviene usarla como archivo histórico.`)) return;

  if (app.localMode) {
    app.products = app.products.filter((p) => p.id !== slug);
    saveLocalProducts(app.products);
    renderAdminProducts();
    clearForm();
    showSuccess('Producto eliminado en modo local.');
    return;
  }

  const { error } = await app.client.from('products').delete().eq('id', product.dbId);
  if (error) return showError(error.message);
  showSuccess('Producto eliminado.');
  await loadProducts();
  clearForm();
}

async function seedSupabase() {
  if (app.localMode) return showError('No hay Supabase configurado. Pegá las credenciales en config.js primero.');
  const rows = (window.SEED_PRODUCTS || []).map(toDb);
  const { error } = await app.client.from('products').upsert(rows, { onConflict: 'slug' });
  if (error) return showError(error.message);
  showSuccess('Productos iniciales cargados en Supabase.');
  await loadProducts();
}

async function loadAdmins() {
  const box = $('#adminProfiles');
  if (app.localMode) {
    box.innerHTML = '<div class="notice">La administración de usuarios requiere Supabase. En modo local no hay autorización real de cuentas.</div>';
    return;
  }
  const { data, error } = await app.client.from('admin_profiles').select('*').order('created_at', { ascending: false });
  if (error) {
    box.innerHTML = `<div class="error-msg active">${escapeHTML(error.message)}</div>`;
    return;
  }
  if (!data?.length) {
    box.innerHTML = '<div class="notice">Todavía no hay perfiles admin.</div>';
    return;
  }
  box.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Email</th><th>Rol</th><th>Estado</th><th>Alta</th><th>Acciones</th></tr></thead>
        <tbody>
          ${data.map((p) => `
            <tr>
              <td>${escapeHTML(p.email || '')}</td>
              <td>${escapeHTML(p.role || '')}</td>
              <td><span class="pill ${p.status === 'approved' ? 'ready' : 'warn'}">${escapeHTML(p.status || '')}</span></td>
              <td>${escapeHTML(new Date(p.created_at).toLocaleDateString('es-AR'))}</td>
              <td>
                <button class="soft-btn" type="button" data-approve="${escapeHTML(p.user_id)}">Aprobar</button>
                <button class="soft-btn" type="button" data-super="${escapeHTML(p.user_id)}">Superadmin</button>
                <button class="danger-btn" type="button" data-reject="${escapeHTML(p.user_id)}">Rechazar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  $$('[data-approve]', box).forEach((b) => b.addEventListener('click', () => updateAdmin(b.dataset.approve, { status: 'approved', role: 'admin' })));
  $$('[data-super]', box).forEach((b) => b.addEventListener('click', () => updateAdmin(b.dataset.super, { status: 'approved', role: 'superadmin' })));
  $$('[data-reject]', box).forEach((b) => b.addEventListener('click', () => updateAdmin(b.dataset.reject, { status: 'rejected' })));
}

async function updateAdmin(userId, patch) {
  if (!confirm('¿Confirmás el cambio de permisos?')) return;
  const { error } = await app.client.from('admin_profiles').update(patch).eq('user_id', userId);
  if (error) return showError(error.message);
  showSuccess('Permiso actualizado.');
  loadAdmins();
}

async function getProfile() {
  if (app.localMode) return { user_id: 'local', email: LOCAL_ADMIN.email, role: 'superadmin', status: 'approved' };
  const { data, error } = await app.client.from('admin_profiles').select('*').eq('user_id', app.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

async function enterAdmin() {
  app.profile = await getProfile();
  if (!app.profile || app.profile.status !== 'approved') {
    $('#authSection').hidden = true;
    $('#pendingSection').hidden = false;
    $('#adminShell').classList.remove('active');
    $('#logoutBtn').hidden = false;
    return;
  }
  $('#authSection').hidden = true;
  $('#pendingSection').hidden = true;
  $('#adminShell').classList.add('active');
  $('#logoutBtn').hidden = false;
  $('#adminIdentity').textContent = `${app.profile.email || app.user?.email || LOCAL_ADMIN.email} · ${app.profile.role}`;
  $('#backendStatus').textContent = app.localMode ? 'Modo local' : 'Supabase conectado';
  await loadProducts();
  await loadAdmins();
  clearForm();
}

async function logout() {
  if (!app.localMode && app.client) await app.client.auth.signOut();
  app.user = null;
  app.profile = null;
  $('#authSection').hidden = false;
  $('#pendingSection').hidden = true;
  $('#adminShell').classList.remove('active');
  $('#logoutBtn').hidden = true;
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email')).trim();
  const password = String(form.get('password'));

  if (app.localMode) {
    if (email === LOCAL_ADMIN.email && password === LOCAL_ADMIN.password) {
      app.user = { id: 'local', email };
      await enterAdmin();
      return;
    }
    return showError('Credenciales locales incorrectas. Usá admin@local / admin123 o configurá Supabase.');
  }

  const { data, error } = await app.client.auth.signInWithPassword({ email, password });
  if (error) return showError(error.message);
  app.user = data.user;
  await enterAdmin();
}

async function signup(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email')).trim();
  const password = String(form.get('password'));

  if (app.localMode) return showError('La creación real de admins requiere Supabase.');

  const { error } = await app.client.auth.signUp({ email, password });
  if (error) return showError(error.message);
  showSuccess('Cuenta creada. Queda pendiente de aprobación.');
}

async function changePassword(event) {
  event.preventDefault();
  const password = new FormData(event.currentTarget).get('password');
  if (app.localMode) {
    $('#passwordDialog').close();
    return showError('En modo local la contraseña demo no se modifica. Configurá Supabase para usar esta función.');
  }
  const { error } = await app.client.auth.updateUser({ password });
  if (error) return showError(error.message);
  $('#passwordDialog').close();
  event.currentTarget.reset();
  showSuccess('Contraseña actualizada.');
}

function wireEvents() {
  $('#loginForm').addEventListener('submit', login);
  $('#signupForm').addEventListener('submit', signup);
  $('#logoutBtn').addEventListener('click', logout);
  $('#pendingLogoutBtn').addEventListener('click', logout);
  $('#productForm').addEventListener('submit', saveProduct);
  $('#addDilutionBtn').addEventListener('click', () => addDilutionRow());
  $('#resetFormBtn').addEventListener('click', clearForm);
  $('#newProductBtn').addEventListener('click', () => { clearForm(); switchTab('editorView'); });
  $('#reloadProductsBtn').addEventListener('click', () => loadProducts().catch((e) => showError(e.message)));
  $('#deleteFromFormBtn').addEventListener('click', () => {
    const slug = $('#productForm').elements.id.value || $('#productForm').elements.slug.value;
    if (slug) deleteProduct(slug);
  });
  $('#seedSupabaseBtn').addEventListener('click', seedSupabase);
  $('#resetLocalBtn').addEventListener('click', () => {
    if (!confirm('¿Resetear datos locales y volver a la semilla inicial?')) return;
    saveLocalProducts(window.SEED_PRODUCTS || []);
    loadProducts();
    showSuccess('Datos locales reseteados.');
  });
  $('#reloadAdminsBtn').addEventListener('click', loadAdmins);
  $('#changePasswordBtn').addEventListener('click', () => $('#passwordDialog').showModal());
  $('[data-close-password]').addEventListener('click', () => $('#passwordDialog').close());
  $('#passwordForm').addEventListener('submit', changePassword);
  $$('.admin-tab').forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.adminTab)));
  $('#productForm').elements.name.addEventListener('input', (event) => {
    const slugInput = $('#productForm').elements.slug;
    if (!$('#productForm').elements.id.value && !slugInput.value) slugInput.value = slugify(event.target.value);
  });
}

async function init() {
  app.client = makeClient();
  app.localMode = !app.client;
  $('#demoHint').textContent = app.localMode
    ? 'Modo demo local: admin@local / admin123. No uses esto en producción.'
    : 'Supabase detectado. Ingresá con tu cuenta aprobada.';
  wireEvents();
  if (!app.localMode) {
    const { data } = await app.client.auth.getSession();
    if (data.session?.user) {
      app.user = data.session.user;
      await enterAdmin();
    }
    app.client.auth.onAuthStateChange((_event, session) => {
      app.user = session?.user || null;
    });
  }
  clearForm();
}

init().catch((error) => showError(error.message));
