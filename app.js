const SUPABASE_URL = "https://jzoosgflgezrhhphcqml.supabase.co";
const SUPABASE_KEY = "sb_publishable_RzqmU62ZqTbjc5LFFvs13A_T-3uQUiH";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function navegarA(seccionId, elementoMenu) {
  // 1. Ocultar todas las secciones
  const secciones = document.querySelectorAll('.modulo-app');
  secciones.forEach(sec => sec.style.display = 'none');

  // 2. Desmarcar todos los ítems activos del menú
  const links = document.querySelectorAll('.nav-sidebar .nav-link');
  links.forEach(l => l.classList.remove('active'));

  // 3. Mostrar la sección seleccionada
  const seccionObjetivo = document.getElementById(`sec-${seccionId}`);
  if (seccionObjetivo) {
    seccionObjetivo.style.display = 'block';
  }

  // 4. Marcar como activo el ítem actual
  if (elementoMenu) {
    elementoMenu.classList.add('active');
  }

  // 5. EJECUTAR CARGA SEGÚN LA SECCIÓN DETECTADA
  if (seccionId === 'clientes') {
    cargarClientes();
  } else if (seccionId === 'productos') {
    cargarProductos();
  } else if (seccionId === 'listas') {
    inicializarModuloListas();
  }

}

// 1. LEER (READ)
async function cargarClientes() {
  const tbody = document.getElementById('tabla-clientes-body');
  
  const { data: clientes, error } = await supabaseClient
    .from('TB_BCLIENTES')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.error('Error al cargar clientes:', error);
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error: ${error.message}</td></tr>`;
    return;
  }

  if (!clientes || clientes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No hay clientes registrados aún.</td></tr>`;
    return;
  }

  // Renderizar filas con botones de acción (Editar / Eliminar)
  tbody.innerHTML = clientes.map(cli => `
    <tr>
      <td><span class="badge badge-secondary">#${cli.id}</span></td>
      <td class="font-weight-bold">${cli.nombre}</td>
      <td>${cli.telefono || '-'}</td>
      <td>${cli.direccion || '-'}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-warning mr-1" onclick="abrirModalEditar(${cli.id}, '${cli.nombre}', '${cli.telefono || ''}', '${cli.direccion || ''}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="eliminarCliente(${cli.id}, '${cli.nombre}')">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// 2. CREAR (CREATE)
async function guardarCliente(event) {
  event.preventDefault();

  const nombre = document.getElementById('cli-nombre').value;
  const telefono = document.getElementById('cli-telefono').value;
  const direccion = document.getElementById('cli-direccion').value;

  const { error } = await supabaseClient
    .from('TB_BCLIENTES')
    .insert([{ nombre, telefono, direccion }]);

  if (error) {
    alert('Error al guardar: ' + error.message);
  } else {
    document.getElementById('form-cliente').reset();
    cargarClientes();
  }
}

// 3. ACTUALIZAR (UPDATE)
// Abre el modal y rellena los campos con los datos actuales
function abrirModalEditar(id, nombre, telefono, direccion) {
  document.getElementById('edit-cli-id').value = id;
  document.getElementById('edit-cli-nombre').value = nombre;
  document.getElementById('edit-cli-telefono').value = telefono;
  document.getElementById('edit-cli-direccion').value = direccion;

  $('#modal-editar-cliente').modal('show');
}

// Envía el UPDATE a Supabase
async function guardarEdicionCliente(event) {
  event.preventDefault();

  const id = document.getElementById('edit-cli-id').value;
  const nombre = document.getElementById('edit-cli-nombre').value;
  const telefono = document.getElementById('edit-cli-telefono').value;
  const direccion = document.getElementById('edit-cli-direccion').value;

  const { error } = await supabaseClient
    .from('TB_BCLIENTES')
    .update({ nombre, telefono, direccion })
    .eq('id', id); // .eq indica la condición WHERE id = X

  if (error) {
    alert('Error al actualizar cliente: ' + error.message);
  } else {
    $('#modal-editar-cliente').modal('hide');
    cargarClientes();
  }
}

// 4. ELIMINAR (DELETE)
async function eliminarCliente(id, nombre) {
  if (confirm(`¿Estás seguro de que querés eliminar a ${nombre}?`)) {
    const { error } = await supabaseClient
      .from('TB_BCLIENTES')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      cargarClientes();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  cargarClientes();
});

//if (seccionId === 'productos') {
//  cargarProductos();
//}

// Actualización de navegación para cargar productos al entrar
// (Asegurate de incluir la condición seccionId === 'productos' en tu navegarA existente)

let categoriasCache = []; // Para no re-consultar categorías todo el tiempo

// 1. CARGAR CATEGORÍAS EN SELECTS
async function cargarCategoriasSelect() {
  if (categoriasCache.length > 0) return;

  const { data: categorias, error } = await supabaseClient
    .from('TB_BCATEGORIAS')
    .select('*')
    .order('nombre', { ascending: true });

  if (!error && categorias) {
    categoriasCache = categorias;
    const select = document.getElementById('prod-categoria');
    select.innerHTML = '<option value="">-- Seleccionar Categoría --</option>' + 
      categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  }
}

// 2. LEER PRODUCTOS (Con JOIN a Categorías)
async function cargarProductos() {
  await cargarCategoriasSelect();
  const tbody = document.getElementById('tabla-productos-body');

  const { data: productos, error } = await supabaseClient
    .from('TB_BPRODUCTOS')
    .select(`
      id,
      nombre,
      m_permite_docena,
      idCategoria,
      TB_BCATEGORIAS ( nombre )
    `)
    .order('idCategoria', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error al cargar productos:', error);
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error: ${error.message}</td></tr>`;
    return;
  }

  if (!productos || productos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No hay productos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = productos.map(prod => `
    <tr>
      <td><span class="badge badge-secondary">#${prod.id}</span></td>
      <td>
        <span class="badge badge-info">${prod.TB_BCATEGORIAS ? prod.TB_BCATEGORIAS.nombre : 'Sin Cat.'}</span>
      </td>
      <td class="font-weight-bold">${prod.nombre}</td>
      <td class="text-center">
        ${prod.m_permite_docena 
          ? '<span class="badge badge-success"><i class="fas fa-check mr-1"></i>Sí</span>' 
          : '<span class="badge badge-light border"><i class="fas fa-times mr-1 text-muted"></i>No</span>'}
      </td>
      <td class="text-center">
        <button class="btn btn-sm btn-warning mr-1" onclick="abrirModalEditarProducto(${prod.id}, '${prod.nombre}', ${prod.idCategoria}, ${prod.m_permite_docena})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${prod.id}, '${prod.nombre}')">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// 3. NUEVO PRODUCTO (Abre Modal)
function abrirModalNuevoProducto() {
  document.getElementById('prod-id').value = '';
  document.getElementById('form-producto').reset();
  document.getElementById('modal-producto-title').innerText = 'Nuevo Producto';
  $('#modal-producto').modal('show');
}

// 4. EDITAR PRODUCTO (Abre Modal cargado)
function abrirModalEditarProducto(id, nombre, idCategoria, permiteDocena) {
  document.getElementById('prod-id').value = id;
  document.getElementById('prod-nombre').value = nombre;
  document.getElementById('prod-categoria').value = idCategoria;
  document.getElementById('prod-permite-docena').checked = permiteDocena;
  document.getElementById('modal-producto-title').innerText = 'Editar Producto';
  $('#modal-producto').modal('show');
}

// 5. GUARDAR (Crear o Actualizar)
async function guardarProducto(event) {
  event.preventDefault();

  const id = document.getElementById('prod-id').value;
  const nombre = document.getElementById('prod-nombre').value;
  const idCategoria = document.getElementById('prod-categoria').value;
  const m_permite_docena = document.getElementById('prod-permite-docena').checked;

  const payload = {
    nombre,
    idCategoria,
    m_permite_docena
  };

  let result;
  if (id) {
    // UPDATE
    result = await supabaseClient
      .from('TB_BPRODUCTOS')
      .update(payload)
      .eq('id', id);
  } else {
    // INSERT
    result = await supabaseClient
      .from('TB_BPRODUCTOS')
      .insert([payload]);
  }

  if (result.error) {
    alert('Error al guardar producto: ' + result.error.message);
  } else {
    $('#modal-producto').modal('hide');
    cargarProductos();
  }
}

// 6. ELIMINAR PRODUCTO
async function eliminarProducto(id, nombre) {
  if (confirm(`¿Estás seguro de borrar "${nombre}"?`)) {
    const { error } = await supabaseClient
      .from('TB_BPRODUCTOS')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      cargarProductos();
    }
  }
}

// 1. CARGAR CÓDIGO AL NAVEGAR A LISTAS DE PRECIOS
// (Recordá agregar 'listas' en tu función navegarA)

async function inicializarModuloListas() {
  const select = document.getElementById('select-lista-activa');
  if (select.children.length > 1 && select.value !== '') return; // Ya cargado

  const { data: listas, error } = await supabaseClient
    .from('TB_TLISTA_PRECIOS')
    .select('*')
    .order('id', { ascending: true });

  if (!error && listas && listas.length > 0) {
    select.innerHTML = listas.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
    cargarMatrizPrecios();
  }
}

// 2. CARGAR MATRIZ DE PRECIOS SEGÚN LA LISTA SELECCIONADA
async function cargarMatrizPrecios() {
  const idLista = document.getElementById('select-lista-activa').value;
  if (!idLista) return;

  // Cargar Precios Base por Categoría
  const { data: categorias } = await supabaseClient
    .from('TB_BCATEGORIAS')
    .select('*')
    .order('id', { ascending: true });

  const { data: preciosExistentes } = await supabaseClient
    .from('TB_DLISTA_PRECIOS')
    .select('*')
    .eq('id_Lista_Precio', idLista);

  // Renderizar Categorías
  const tbodyCat = document.getElementById('tabla-precios-categorias-body');
  tbodyCat.innerHTML = categorias.map(cat => {
    const p = preciosExistentes.find(x => x.id_categoria == cat.id && x.id_Producto === null) || {};
    const un = p.precio_unidad ?? '';
    const doc = p.precio_docena ?? '';

    return `
      <tr>
        <td class="font-weight-bold">${cat.nombre}</td>
        <td><input type="number" step="0.01" class="form-control form-control-sm text-right" id="cat-un-${cat.id}" value="${un}" placeholder="0.00"></td>
        <td><input type="number" step="0.01" class="form-control form-control-sm text-right" id="cat-doc-${cat.id}" value="${doc}" placeholder="-"></td>
        <td class="text-center">
          <button class="btn btn-sm btn-success" onclick="guardarPrecioCategoria(${cat.id}, ${p.id || 'null'})">
            <i class="fas fa-save"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Renderizar Excepciones de Productos (Overrides)
  const tbodyProd = document.getElementById('tabla-precios-productos-body');
  const preciosProd = preciosExistentes.filter(x => x.id_Producto !== null);

  if (preciosProd.length === 0) {
    tbodyProd.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No hay precios especiales asignados.</td></tr>`;
    return;
  }

  // Traer nombres de productos para los que tienen precio especial
  const idsProds = preciosProd.map(x => x.id_Producto);
  const { data: productos } = await supabaseClient
    .from('TB_BPRODUCTOS')
    .select('id, nombre')
    .in('id', idsProds);

  tbodyProd.innerHTML = preciosProd.map(p => {
    const prod = productos.find(x => x.id == p.id_Producto) || { nombre: 'Producto #' + p.id_Producto };
    return `
      <tr>
        <td class="font-weight-bold">${prod.nombre}</td>
        <td class="text-right font-weight-bold text-success">$${p.precio_unidad || 0}</td>
        <td class="text-right">${p.precio_docena ? '$' + p.precio_docena : '-'}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-danger" onclick="eliminarPrecioEspecial(${p.id})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// 3. GUARDAR / ACTUALIZAR PRECIO BASE DE CATEGORÍA
async function guardarPrecioCategoria(idCategoria, idDetalle) {
  const idLista = document.getElementById('select-lista-activa').value;
  const precio_unidad = document.getElementById(`cat-un-${idCategoria}`).value || null;
  const precio_docena = document.getElementById(`cat-doc-${idCategoria}`).value || null;

  const payload = {
    id_Lista_Precio: idLista,
    id_categoria: idCategoria,
    id_Producto: null,
    precio_unidad: precio_unidad ? parseFloat(precio_unidad) : null,
    precio_docena: precio_docena ? parseFloat(precio_docena) : null
  };

  let res;
  if (idDetalle) {
    res = await supabaseClient.from('TB_DLISTA_PRECIOS').update(payload).eq('id', idDetalle);
  } else {
    res = await supabaseClient.from('TB_DLISTA_PRECIOS').insert([payload]);
  }

  if (res.error) alert('Error: ' + res.error.message);
  else cargarMatrizPrecios();
}

// 4. MÉTODOS PARA EXCEPCIONES POR PRODUCTO
async function abrirModalPrecioEspecial() {
  const { data: prods } = await supabaseClient.from('TB_BPRODUCTOS').select('id, nombre').order('nombre');
  const select = document.getElementById('modal-especial-producto');
  select.innerHTML = '<option value="">-- Seleccionar Producto --</option>' + 
    prods.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

  document.getElementById('form-precio-especial').reset();
  $('#modal-precio-especial').modal('show');
}

async function guardarPrecioEspecial(e) {
  e.preventDefault();
  const idLista = document.getElementById('select-lista-activa').value;
  const id_Producto = document.getElementById('modal-especial-producto').value;
  const precio_unidad = parseFloat(document.getElementById('modal-especial-unidad').value);
  const docVal = document.getElementById('modal-especial-docena').value;
  const precio_docena = docVal ? parseFloat(docVal) : null;

  const payload = { id_Lista_Precio: idLista, id_categoria: null, id_Producto, precio_unidad, precio_docena };

  const { error } = await supabaseClient.from('TB_DLISTA_PRECIOS').insert([payload]);
  if (error) alert('Error: ' + error.message);
  else {
    $('#modal-precio-especial').modal('hide');
    cargarMatrizPrecios();
  }
}

async function eliminarPrecioEspecial(idDetalle) {
  if (confirm('¿Eliminar precio especial? El producto volverá a tomar el precio base de su categoría.')) {
    await supabaseClient.from('TB_DLISTA_PRECIOS').delete().eq('id', idDetalle);
    cargarMatrizPrecios();
  }
}