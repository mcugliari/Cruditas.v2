const SUPABASE_URL = "https://jzoosgflgezrhhphcqml.supabase.co";
const SUPABASE_KEY = "sb_publishable_RzqmU62ZqTbjc5LFFvs13A_T-3uQUiH";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let pedidoEditandoId = null; // null = Nuevo pedido; ID = Editando existente
let carrito = {};            // { idProducto: cantidad }
let cacheProductos = [];
let cachePrecios = [];
let cacheCategorias = [];

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
    inicializarCrudClienteLista();
  } else if (seccionId === 'productos') {
    cargarProductos();
  } else if (seccionId === 'listas') {
    inicializarModuloListas();
  } else if (seccionId === 'pedidos') {
    inicializarPOS(); // Carga la pantalla de Toma de Pedidos
  } else if (seccionId === 'pedidos-dia') {
    cargarTablaPedidos(); // Carga el listado/gestión de pedidos del día
  }
}

// --- MÓDULO CLIENTES ---
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

function abrirModalEditar(id, nombre, telefono, direccion) {
  document.getElementById('edit-cli-id').value = id;
  document.getElementById('edit-cli-nombre').value = nombre;
  document.getElementById('edit-cli-telefono').value = telefono;
  document.getElementById('edit-cli-direccion').value = direccion;

  $('#modal-editar-cliente').modal('show');
}

async function guardarEdicionCliente(event) {
  event.preventDefault();

  const id = document.getElementById('edit-cli-id').value;
  const nombre = document.getElementById('edit-cli-nombre').value;
  const telefono = document.getElementById('edit-cli-telefono').value;
  const direccion = document.getElementById('edit-cli-direccion').value;

  const { error } = await supabaseClient
    .from('TB_BCLIENTES')
    .update({ nombre, telefono, direccion })
    .eq('id', id);

  if (error) {
    alert('Error al actualizar cliente: ' + error.message);
  } else {
    $('#modal-editar-cliente').modal('hide');
    cargarClientes();
  }
}

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
  const linkPedidos = document.querySelector('a[onclick*="pedidos"]');
  navegarA('pedidos', linkPedidos);
});

// --- MÓDULO PRODUCTOS ---
async function cargarCategoriasSelect() {
  if (cacheCategorias && cacheCategorias.length > 0) {
    const select = document.getElementById('prod-categoria');
    if (select) {
      select.innerHTML = '<option value="">-- Seleccionar Categoría --</option>' + 
        cacheCategorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    }
    return;
  }

  const { data: categorias, error } = await supabaseClient
    .from('TB_BCATEGORIAS')
    .select('*')
    .order('nombre', { ascending: true });

  if (!error && categorias) {
    cacheCategorias = categorias;
    const select = document.getElementById('prod-categoria');
    if (select) {
      select.innerHTML = '<option value="">-- Seleccionar Categoría --</option>' + 
        categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    }
  }
}

async function cargarProductos() {
  await cargarCategoriasSelect();
  const tbody = document.getElementById('tabla-productos-body');

  const { data: productos, error } = await supabaseClient
    .from('TB_BPRODUCTOS')
    .select(`
      id,
      nombre,
      m_permite_docena,
      id_categoria,
      TB_BCATEGORIAS ( nombre )
    `)
    .order('id_categoria', { ascending: true })
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
        <button class="btn btn-sm btn-warning mr-1" onclick="abrirModalEditarProducto(${prod.id}, '${prod.nombre}', ${prod.id_categoria}, ${prod.m_permite_docena})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${prod.id}, '${prod.nombre}')">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function abrirModalNuevoProducto() {
  document.getElementById('prod-id').value = '';
  document.getElementById('form-producto').reset();
  document.getElementById('modal-producto-title').innerText = 'Nuevo Producto';
  $('#modal-producto').modal('show');
}

function abrirModalEditarProducto(id, nombre, id_categoria, permiteDocena) {
  document.getElementById('prod-id').value = id;
  document.getElementById('prod-nombre').value = nombre;
  document.getElementById('prod-categoria').value = id_categoria;
  document.getElementById('prod-permite-docena').checked = permiteDocena;
  document.getElementById('modal-producto-title').innerText = 'Editar Producto';
  $('#modal-producto').modal('show');
}

async function guardarProducto(event) {
  event.preventDefault();

  const id = document.getElementById('prod-id').value;
  const nombre = document.getElementById('prod-nombre').value;
  const id_categoria = document.getElementById('prod-categoria').value;
  const m_permite_docena = document.getElementById('prod-permite-docena').checked;

  const payload = { nombre, id_categoria, m_permite_docena };

  let result = id 
    ? await supabaseClient.from('TB_BPRODUCTOS').update(payload).eq('id', id)
    : await supabaseClient.from('TB_BPRODUCTOS').insert([payload]);

  if (result.error) {
    alert('Error al guardar producto: ' + result.error.message);
  } else {
    $('#modal-producto').modal('hide');
    cargarProductos();
  }
}

async function eliminarProducto(id, nombre) {
  if (confirm(`¿Estás seguro de borrar "${nombre}"?`)) {
    const { error } = await supabaseClient.from('TB_BPRODUCTOS').delete().eq('id', id);
    if (error) alert('Error al eliminar: ' + error.message);
    else cargarProductos();
  }
}

// --- MÓDULO LISTAS DE PRECIOS ---
async function inicializarModuloListas() {
  const select = document.getElementById('select-lista-activa');
  if (select.children.length > 1 && select.value !== '') return;

  const { data: listas, error } = await supabaseClient
    .from('TB_TLISTA_PRECIOS')
    .select('*')
    .order('id', { ascending: true });

  if (!error && listas && listas.length > 0) {
    select.innerHTML = listas.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
    cargarMatrizPrecios();
  }
}

async function cargarMatrizPrecios() {
  const idLista = document.getElementById('select-lista-activa').value;
  if (!idLista) return;

  const { data: categorias } = await supabaseClient.from('TB_BCATEGORIAS').select('*').order('id', { ascending: true });
  const { data: preciosExistentes } = await supabaseClient.from('TB_DLISTA_PRECIOS').select('*').eq('id_lista_precio', idLista);

  const tbodyCat = document.getElementById('tabla-precios-categorias-body');
  tbodyCat.innerHTML = categorias.map(cat => {
    const p = preciosExistentes.find(x => x.id_categoria == cat.id && x.id_producto === null) || {};
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

  const tbodyProd = document.getElementById('tabla-precios-productos-body');
  const preciosProd = preciosExistentes.filter(x => x.id_producto !== null);

  if (preciosProd.length === 0) {
    tbodyProd.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No hay precios especiales asignados.</td></tr>`;
    return;
  }

  const idsProds = preciosProd.map(x => x.id_producto);
  const { data: productos } = await supabaseClient.from('TB_BPRODUCTOS').select('id, nombre').in('id', idsProds);

  tbodyProd.innerHTML = preciosProd.map(p => {
    const prod = productos.find(x => x.id == p.id_producto) || { nombre: 'Producto #' + p.id_producto };
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

async function guardarPrecioCategoria(id_categoria, idDetalle) {
  const idLista = document.getElementById('select-lista-activa').value;
  const precio_unidad = document.getElementById(`cat-un-${id_categoria}`).value || null;
  const precio_docena = document.getElementById(`cat-doc-${id_categoria}`).value || null;

  const payload = {
    id_lista_precio: idLista,
    id_categoria: id_categoria,
    id_producto: null,
    precio_unidad: precio_unidad ? parseFloat(precio_unidad) : null,
    precio_docena: precio_docena ? parseFloat(precio_docena) : null
  };

  let res = idDetalle 
    ? await supabaseClient.from('TB_DLISTA_PRECIOS').update(payload).eq('id', idDetalle)
    : await supabaseClient.from('TB_DLISTA_PRECIOS').insert([payload]);

  if (res.error) alert('Error: ' + res.error.message);
  else cargarMatrizPrecios();
}

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
  const id_producto = document.getElementById('modal-especial-producto').value;
  const precio_unidad = parseFloat(document.getElementById('modal-especial-unidad').value);
  const docVal = document.getElementById('modal-especial-docena').value;
  const precio_docena = docVal ? parseFloat(docVal) : null;

  const payload = { id_lista_precio: idLista, id_categoria: null, id_producto, precio_unidad, precio_docena };

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

// --- MÓDULO POS (TOMA DE PEDIDOS) ---
async function inicializarPOS() {
  await cargarSelectsPOS();
  await cargarPOS();
}

async function cargarSelectsPOS() {
  const { data: clientes } = await supabaseClient.from('TB_BCLIENTES').select('*').order('nombre');
  const { data: listas } = await supabaseClient.from('TB_TLISTA_PRECIOS').select('*');
  const { data: medios } = await supabaseClient.from('TB_BMEDIO_PAGO').select('*');

  const selectCli = document.getElementById('select-cliente-pedido');
  if (selectCli && clientes) selectCli.innerHTML = clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  const selectLis = document.getElementById('select-lista-pedido');
  if (selectLis && listas) selectLis.innerHTML = listas.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');

  const selectMed = document.getElementById('select-medio-pago');
  if (selectMed && medios) selectMed.innerHTML = medios.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');

  await alCambiarCliente();
}

async function alCambiarCliente() {
  const selectCli = document.getElementById('select-cliente-pedido');
  if (!selectCli || !selectCli.value) return;

  const { data } = await supabaseClient
    .from('TB_ACLIENTE_LISTA_PRECIOS')
    .select('id_lista_precio')
    .eq('id_cliente', selectCli.value)
    .eq('m_predeterminada', true)
    .maybeSingle();

  if (data && data.id_lista_precio) {
    document.getElementById('select-lista-pedido').value = data.id_lista_precio;
  }
  
  await cargarPOS();
}

async function cargarPOS() {
  const selectLis = document.getElementById('select-lista-pedido');
  const idLista = selectLis && selectLis.value ? parseInt(selectLis.value) : 1;

  const { data: categorias } = await supabaseClient.from('TB_BCATEGORIAS').select('*').order('id');
  const { data: productos } = await supabaseClient.from('TB_BPRODUCTOS').select('*').order('id');
  const { data: precios } = await supabaseClient.from('TB_DLISTA_PRECIOS').select('*').eq('id_lista_precio', idLista);

  cacheCategorias = categorias || [];
  cacheProductos = productos || [];
  cachePrecios = precios || [];

  renderizarGrillaPOS();
}

function renderizarGrillaPOS() {
  const contenedor = document.getElementById('contenedor-menu-productos');
  if (!contenedor) return;

  if (!Array.isArray(cacheCategorias) || !Array.isArray(cacheProductos)) {
    contenedor.innerHTML = '<p class="text-muted text-center my-3">Cargando menú...</p>';
    return;
  }

  const paletaColores = ['primary', 'success', 'warning', 'danger', 'info', 'secondary'];
  let htmlCompleto = '';

  cacheCategorias.forEach((cat, index) => {
    const prodsCat = cacheProductos.filter(p => Number(p.id_categoria || p.idCategoria) === Number(cat.id));
    if (prodsCat.length === 0) return;

    const colorCat = paletaColores[index % paletaColores.length];

    htmlCompleto += `
      <div class="pos-cat-header mb-2 mt-2">${cat.nombre}</div>
      <div class="row">
    `;

    prodsCat.forEach(p => {
      const cant = carrito[p.id] || 0;
      const idCatProd = p.id_categoria || p.idCategoria;
      const precios = obtenerPrecioProducto(p.id, idCatProd);
      const claseActiva = cant > 0 ? 'pos-card-activa' : '';

      htmlCompleto += `
        <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-3">
          <div class="card h-100 pos-card-producto border-0 border-left-${colorCat} ${claseActiva}">
            <strong class="pos-prod-title" title="${p.nombre}">${p.nombre}</strong>
            <span class="pos-prod-price mb-3">$${precios.unidad.toLocaleString('es-AR')}</span>
            
            <div class="pos-qty-pill mb-2">
              <button type="button" class="btn btn-pos-sq" onclick="alterarCantidad(${p.id}, -1)">-</button>
              <span class="pos-cant-num" id="cant-prod-${p.id}">${cant}</span>
              <button type="button" class="btn btn-pos-sq" onclick="alterarCantidad(${p.id}, 1)">+</button>
            </div>

            <div class="d-flex justify-content-between gap-1">
              <button type="button" class="btn btn-docena-pill flex-fill mr-1" onclick="alterarCantidad(${p.id}, -12)">-12 u.</button>
              <button type="button" class="btn btn-docena-pill flex-fill" onclick="alterarCantidad(${p.id}, 12)">+12 u.</button>
            </div>

          </div>
        </div>
      `;
    });

    htmlCompleto += `</div>`;
  });

  contenedor.innerHTML = htmlCompleto;
  actualizarResumenCarrito();
}

function obtenerPrecioProducto(idProd, idCat, idLista = null) {
  if (!cachePrecios || cachePrecios.length === 0) return { unidad: 0, docena: 0 };

  const idP = Number(idProd);
  const idC = Number(idCat);
  const idL = idLista ? Number(idLista) : Number(document.getElementById('select-lista-pedido')?.value || 0);

  const preciosFiltrados = cachePrecios.filter(p => !idL || Number(p.id_lista_precio || p.id_lista) === idL);
  const listaABuscar = preciosFiltrados.length > 0 ? preciosFiltrados : cachePrecios;

  const pProd = listaABuscar.find(p => p.id_producto !== null && Number(p.id_producto) === idP);
  if (pProd) {
    const un = Number(pProd.precio_unidad ?? pProd.precio ?? 0);
    const doc = pProd.precio_docena ? Number(pProd.precio_docena) : (un * 12);
    return { unidad: un, docena: doc };
  }

  const pCat = listaABuscar.find(p => Number(p.id_categoria) === idC && (p.id_producto === null || p.id_producto === undefined));
  if (pCat) {
    const un = Number(pCat.precio_unidad ?? pCat.precio ?? 0);
    const doc = pCat.precio_docena ? Number(pCat.precio_docena) : (un * 12);
    return { unidad: un, docena: doc };
  }

  return { unidad: 0, docena: 0 };
}

function calcularSubtotalItem(cantidad, precios, permiteDocena = true) {
  if (!permiteDocena || !precios.docena) {
    return cantidad * precios.unidad;
  }
  const docenas = Math.floor(cantidad / 12);
  const sueltas = cantidad % 12;

  return (docenas * precios.docena) + (sueltas * precios.unidad);
}

function alterarCantidad(idProducto, delta) {
  const actual = carrito[idProducto] || 0;
  const nueva = Math.max(0, actual + delta);
  
  if (nueva === 0) {
    delete carrito[idProducto];
  } else {
    carrito[idProducto] = nueva;
  }

  const elCant = document.getElementById(`cant-prod-${idProducto}`);
  if (elCant) {
    elCant.innerText = nueva;
    const tarjeta = elCant.closest('.pos-card-producto');
    if (tarjeta) {
      if (nueva > 0) tarjeta.classList.add('pos-card-activa');
      else tarjeta.classList.remove('pos-card-activa');
    }
  } else {
    renderizarGrillaPOS();
  }

  actualizarResumenCarrito();
}

function actualizarResumenCarrito() {
  const contenedorItems = document.getElementById('resumen-carrito-items');
  const keys = Object.keys(carrito);

  if (keys.length === 0) {
    if (contenedorItems) contenedorItems.innerHTML = `<p class="text-center text-muted small my-3">El carrito está vacío</p>`;
    document.getElementById('cant-docenas').innerText = '0 u.';
    document.getElementById('cant-total-items').innerText = '0';
    document.getElementById('monto-total-pedido').innerText = '$0';
    return;
  }

  let totalItems = 0;
  let montoTotal = 0;
  let html = '<ul class="list-group list-group-flush small">';

  keys.forEach(idProd => {
    const p = cacheProductos.find(x => x.id == idProd);
    if (!p) return;

    const cant = carrito[idProd];
    const idCatProd = p.id_categoria;
    const cat = cacheCategorias.find(c => Number(idCatProd) === Number(c.id));
    const nombreCat = cat ? cat.nombre : '';
    const textoProducto = nombreCat ? `${nombreCat} ${p.nombre}` : p.nombre;
    
    const precios = obtenerPrecioProducto(p.id, idCatProd);
    const subtotal = calcularSubtotalItem(cant, precios, p.m_permite_docena);

    totalItems += cant;
    montoTotal += subtotal;

    let detalleTexto = `${cant} u. x $${precios.unidad}`;
    if (p.m_permite_docena && precios.docena && cant >= 12) {
      const doc = Math.floor(cant / 12);
      const ult = cant % 12;
      detalleTexto = `${doc} doc. ($${precios.docena})` + (ult > 0 ? ` + ${ult} u. ($${precios.unidad})` : '');
    }

    html += `
      <li class="list-group-item d-flex justify-content-between align-items-center p-2 bg-transparent border-bottom">
        <div>
          <strong class="d-block">${textoProducto}</strong>
          <small class="text-muted">${detalleTexto}</small>
        </div>
        <span class="font-weight-bold">$${subtotal.toLocaleString('es-AR')}</span>
      </li>
    `;
  });

  html += '</ul>';
  if (contenedorItems) contenedorItems.innerHTML = html;

  const totalDocenas = (totalItems / 12).toFixed(1);
  document.getElementById('cant-docenas').innerText = `${totalDocenas} doc.`;
  document.getElementById('cant-total-items').innerText = totalItems;
  document.getElementById('monto-total-pedido').innerText = `$${montoTotal.toLocaleString('es-AR')}`;
}

function resetearPedido() {
  pedidoEditandoId = null;
  carrito = {};
  renderizarGrillaPOS();
}

function vaciarCarrito() {
  resetearPedido();
}

async function guardarPedido(estadoInicial) {
  const keys = Object.keys(carrito);
  if (keys.length === 0) {
    mostrarNotificacion('Agregá al menos un producto al carrito.', 'warning');
    return;
  }

  const idCliente = document.getElementById('select-cliente-pedido').value;
  const idLista = document.getElementById('select-lista-pedido').value;
  const selectMedio = document.getElementById('select-medio-pago');
  const idMedio = selectMedio ? selectMedio.value : null;

  let montoTotal = 0;
  const detalles = [];

  keys.forEach(idProd => {
    const p = cacheProductos.find(x => Number(x.id) === Number(idProd));
    if (!p) return;

    const cantidadTotal = Number(carrito[idProd]) || 0;
    if (cantidadTotal <= 0) return;

    const precios = obtenerPrecioProducto(p.id, p.id_categoria || p.idCategoria, idLista);
    const precioUnidad = precios.unidad || 0;
    const precioDocena = precios.docena || (precioUnidad * 12);
    const permiteDocena = Boolean(p.m_permite_docena);

    if (permiteDocena && cantidadTotal >= 12) {
      const cantDocenas = Math.floor(cantidadTotal / 12);
      const unidadesSueltas = cantidadTotal % 12;

      detalles.push({
        id_pedido: null,
        id_producto: p.id,
        cantidad: cantDocenas * 12,
        precio: precioDocena * cantDocenas
      });
      montoTotal += cantDocenas * precioDocena;

      if (unidadesSueltas > 0) {
        detalles.push({
          id_pedido: null,
          id_producto: p.id,
          cantidad: unidadesSueltas,
          precio: precioUnidad * unidadesSueltas
        });
        montoTotal += unidadesSueltas * precioUnidad;
      }
    } else {
      detalles.push({
        id_pedido: null,
        id_producto: p.id,
        cantidad: cantidadTotal,
        precio: precioUnidad
      });
      montoTotal += cantidadTotal * precioUnidad;
    }
  });
  
  let idPedidoFinal = pedidoEditandoId;

  if (pedidoEditandoId) {
    // MODO EDICIÓN: Actualizar cabecera
    const { error: errUpdate } = await supabaseClient
      .from('TB_TPEDIDOS')
      .update({
        id_cliente: idCliente,
        id_lista_precio: idLista,
        id_medio_pago: idMedio,
        estado: estadoInicial,
        importe_total: montoTotal
      })
      .eq('id', pedidoEditandoId);

    if (errUpdate) {
      mostrarNotificacion('Error al actualizar cabecera: ' + errUpdate.message, 'danger');
      return;
    }

    // Borrar detalles anteriores
    await supabaseClient.from('TB_DPEDIDOS').delete().eq('id_pedido', pedidoEditandoId);

  } else {
    // MODO NUEVO: Insertar nueva cabecera
    const { data: pedido, error } = await supabaseClient
      .from('TB_TPEDIDOS')
      .insert([{
        fecha: new Date().toISOString().split('T')[0],
        id_cliente: idCliente,
        id_lista_precio: idLista,
        id_medio_pago: idMedio,
        estado: estadoInicial,
        importe_total: montoTotal
      }])
      .select()
      .single();

    if (error) {
      mostrarNotificacion('Error al guardar el pedido: ' + error.message, 'danger');
      return;
    }
    idPedidoFinal = pedido.id;
  }

  // Se asigna SIEMPRE el id_pedido correspondiente a los detalles antes de insertar
  detalles.forEach(d => d.id_pedido = idPedidoFinal);

  const { error: errorDetalle } = await supabaseClient
    .from('TB_DPEDIDOS')
    .insert(detalles);

  if (errorDetalle) {
    mostrarNotificacion('Error al guardar el detalle: ' + errorDetalle.message, 'danger');
    return;
  }

  mostrarNotificacion(`¡Pedido #${idPedidoFinal} ${pedidoEditandoId ? 'actualizado' : 'registrado'} con éxito!`, 'success');

  pedidoEditandoId = null;
  resetearPedido();
}

// --- GESTIÓN DE PEDIDOS DEL DÍA / HISTÓRICO ---
async function cargarTablaPedidos() {
  const inputDesde = document.getElementById('filtro-fecha-desde');
  const inputHasta = document.getElementById('filtro-fecha-hasta');
  const inputBuscar = document.getElementById('filtro-buscar-pedido');
  
  if (inputDesde && !inputDesde.value) {
    const hoy = new Date().toISOString().split('T')[0];
    inputDesde.value = hoy;
    inputHasta.value = hoy;
  }

  const fechaDesde = `${inputDesde.value}T00:00:00.000Z`;
  const fechaHasta = `${inputHasta.value}T23:59:59.999Z`;
  const estadoFiltro = document.getElementById('filtro-estado-pedido').value;

  let query = supabaseClient
    .from('TB_TPEDIDOS')
    .select('id, fecha, created_at, estado, importe_total, TB_BCLIENTES(nombre), TB_BMEDIO_PAGO(nombre)')
    .gte('created_at', fechaDesde)
    .lte('created_at', fechaHasta)
    .order('id', { ascending: false });

  if (estadoFiltro !== 'TODOS') {
    query = query.eq('estado', estadoFiltro);
  }

  const { data: pedidos, error } = await query;
  if (error) return;

  // Filtrado opcional en memoria por nombre de cliente o ID del pedido
  let pedidosFiltrados = pedidos || [];
  if (inputBuscar && inputBuscar.value.trim() !== '') {
    const busqueda = inputBuscar.value.trim().toLowerCase();
    pedidosFiltrados = pedidosFiltrados.filter(p => {
      const cliNombre = p.TB_BCLIENTES?.nombre?.toLowerCase() || '';
      const idStr = String(p.id);
      return cliNombre.includes(busqueda) || idStr.includes(busqueda);
    });
  }

  // Cálculo de KPIs
  let totalCobrado = 0;
  let totalPendienteCobro = 0;
  let cantPreparacion = 0;
  let cantPreparados = 0;
  let cantAnulados = 0;

  pedidosFiltrados.forEach(p => {
    if (p.estado === 'COMPLETADO') totalCobrado += (p.importe_total || 0);
    if (p.estado === 'ENTREGADO_IMPAGO') totalPendienteCobro += (p.importe_total || 0);
    if (p.estado === 'PREPARACION') cantPreparacion++;
    if (p.estado === 'PREPARADO') cantPreparados++;
    if (p.estado === 'ANULADO') cantAnulados++;
  });

  if (document.getElementById('kpi-total-cobrado')) {
    document.getElementById('kpi-total-cobrado').innerText = `$${totalCobrado.toLocaleString('es-AR')}`;
    document.getElementById('kpi-total-pendiente-cobro').innerText = `$${totalPendienteCobro.toLocaleString('es-AR')}`;
    document.getElementById('kpi-cant-preparacion').innerText = cantPreparacion;
    document.getElementById('kpi-cant-preparados').innerText = cantPreparados;
    document.getElementById('kpi-cant-anulados').innerText = cantAnulados;
  }

  const tbody = document.getElementById('tabla-pedidos-body');
  if (!tbody) return;

  if (pedidosFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">No hay pedidos registrados para estos filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = pedidosFiltrados.map(p => {
    const clienteNombre = p.TB_BCLIENTES ? p.TB_BCLIENTES.nombre : 'Consumidor Final';
    const medioPago = p.TB_BMEDIO_PAGO ? p.TB_BMEDIO_PAGO.nombre : 'Sin especificar';
    const hora = new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const fechaPedido = new Date(`${p.fecha.split('T')[0]}T00:00:00`).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    let badgeClass = 'badge-secondary';
    let estadoTexto = p.estado;

    if (p.estado === 'PREPARACION') { badgeClass = 'badge-info'; estadoTexto = '⏳ En Preparación'; }
    if (p.estado === 'PREPARADO') { badgeClass = 'badge-primary'; estadoTexto = '🔔 Preparado'; }
    if (p.estado === 'ENTREGADO_IMPAGO') { badgeClass = 'badge-warning'; estadoTexto = '📦 Entregado (Impago)'; }
    if (p.estado === 'COMPLETADO') { badgeClass = 'badge-success'; estadoTexto = '✅ Completado'; }
    if (p.estado === 'ANULADO') { badgeClass = 'badge-danger'; estadoTexto = '🚫 Anulado'; }

    let botonesAccion = '';

    if (p.estado === 'PREPARACION') {
      botonesAccion += `
        <button class="btn btn-outline-primary" title="Marcar como Preparado" onclick="cambiarEstadoPedido(${p.id}, 'PREPARADO')">
          <i class="fas fa-box-open"></i>
        </button>
        <button class="btn btn-outline-secondary" title="Editar Pedido" onclick="editarPedido(${p.id})">
          <i class="fas fa-edit"></i>
        </button>
      `;
    }

    if (p.estado === 'PREPARADO') {
      botonesAccion += `
        <button class="btn btn-outline-success" title="Cobrar y Entregar" onclick="cambiarEstadoPedido(${p.id}, 'COMPLETADO')">
          <i class="fas fa-check"></i>
        </button>
        <button class="btn btn-outline-warning" title="Entregar sin Cobrar (Impago)" onclick="cambiarEstadoPedido(${p.id}, 'ENTREGADO_IMPAGO')">
          <i class="fas fa-truck"></i>
        </button>
        <button class="btn btn-outline-secondary" title="Editar Pedido" onclick="editarPedido(${p.id})">
          <i class="fas fa-edit"></i>
        </button>
      `;
    }

    if (p.estado === 'ENTREGADO_IMPAGO') {
      botonesAccion += `
        <button class="btn btn-outline-success" title="Registrar Cobro" onclick="cambiarEstadoPedido(${p.id}, 'COMPLETADO')">
          <i class="fas fa-dollar-sign"></i>
        </button>
      `;
    }

    if (p.estado !== 'ANULADO') {
      botonesAccion += `
        <button class="btn btn-outline-danger" title="Anular Pedido" onclick="cambiarEstadoPedido(${p.id}, 'ANULADO')">
          <i class="fas fa-ban"></i>
        </button>
      `;
    }

    botonesAccion += `
      <button class="btn btn-outline-info" onclick="verDetallePedido(${p.id})" title="Ver detalle">
        <i class="fas fa-eye"></i>
      </button>
    `;

    return `
      <tr>
        <td class="font-weight-bold">#${p.id}</td>
        <td>${fechaPedido} ${hora} hs</td>
        <td class="font-weight-bold">${clienteNombre}</td>
        <td><small class="badge badge-light border">${medioPago}</small></td>
        <td class="text-right font-weight-bold">$${(p.importe_total || 0).toLocaleString('es-AR')}</td>
        <td class="text-center"><span class="badge ${badgeClass} p-2">${estadoTexto}</span></td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            ${botonesAccion}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function cambiarEstadoPedido(idPedido, nuevoEstado) {
  if (nuevoEstado === 'ANULADO' && !confirm('¿Seguro que deseas anular este pedido? Se excluirá del cierre de caja.')) {
    return;
  }

  const { error } = await supabaseClient
    .from('TB_TPEDIDOS')
    .update({ estado: nuevoEstado })
    .eq('id', idPedido);

  if (error) {
    mostrarNotificacion('Error al cambiar el estado: ' + error.message, 'danger');
  } else {
    cargarTablaPedidos();
  }
}

async function editarPedido(idPedido) {
  try {
    const { data: pedido, error } = await supabaseClient
      .from('TB_TPEDIDOS')
      .select(`
        *,
        TB_DPEDIDOS(id_producto, cantidad)
      `)
      .eq('id', idPedido)
      .single();

    if (error || !pedido) {
      mostrarNotificacion('Error al cargar el pedido para edición', 'danger');
      return;
    }

    pedidoEditandoId = pedido.id;

    const linkPedidos = document.querySelector('a[onclick*="pedidos"]');
    navegarA('pedidos', linkPedidos);

    if (document.getElementById('select-cliente-pedido')) {
      document.getElementById('select-cliente-pedido').value = pedido.id_cliente;
    }
    if (document.getElementById('select-lista-pedido')) {
      document.getElementById('select-lista-pedido').value = pedido.id_lista_precio;
    }
    if (document.getElementById('select-medio-pago') && pedido.id_medio_pago) {
      document.getElementById('select-medio-pago').value = pedido.id_medio_pago;
    }

    await cargarPOS();

    carrito = {};
    (pedido.TB_DPEDIDOS || []).forEach(item => {
      const idProd = item.id_producto;
      carrito[idProd] = (carrito[idProd] || 0) + item.cantidad;
    });

    renderizarGrillaPOS();
    mostrarNotificacion(`Editando Pedido #${pedido.id}`, 'info');

  } catch (err) {
    console.error('Error en editarPedido:', err);
    mostrarNotificacion('Ocurrió un error al intentar editar el pedido.', 'danger');
  }
}

// --- MÓDULO ASOCIACIÓN CLIENTE - LISTA PRECIOS ---
async function inicializarCrudClienteLista() {
  await cargarSelectsAsociacion();
  await listarAsociacionesClienteLista();
}

async function cargarSelectsAsociacion() {
  const { data: clientes } = await supabaseClient.from('TB_BCLIENTES').select('id, nombre').order('nombre');
  const { data: listas } = await supabaseClient.from('TB_TLISTA_PRECIOS').select('id, nombre');

  const selectCli = document.getElementById('asoc-select-cliente');
  const selectLis = document.getElementById('asoc-select-lista');

  if (selectCli && clientes) selectCli.innerHTML = clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  if (selectLis && listas) selectLis.innerHTML = listas.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
}

async function listarAsociacionesClienteLista() {
  const tbody = document.getElementById('tabla-asoc-cliente-lista');
  if (!tbody) return;

  const { data, error } = await supabaseClient
    .from('TB_ACLIENTE_LISTA_PRECIOS')
    .select(`
      id,
      id_cliente,
      id_lista_precio,
      m_predeterminada,
      TB_BCLIENTES ( nombre ),
      TB_TLISTA_PRECIOS ( nombre )
    `)
    .order('id_cliente');

  if (error) {
    console.error(error);
    return;
  }

  tbody.innerHTML = data.map(item => `
    <tr>
      <td class="font-weight-bold">${item.TB_BCLIENTES?.nombre || 'N/A'}</td>
      <td>${item.TB_TLISTA_PRECIOS?.nombre || 'N/A'}</td>
      <td class="text-center">
        ${item.m_predeterminada 
          ? '<span class="badge badge-success px-2 py-1">Sí</span>' 
          : '<span class="badge badge-secondary px-2 py-1">No</span>'}
      </td>
      <td class="text-right">
        <button class="btn btn-sm btn-outline-info mr-1" onclick="editarAsociacion(${item.id}, ${item.id_cliente}, ${item.id_lista_precio}, ${item.m_predeterminada})">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="eliminarAsociacion(${item.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

async function guardarAsociacionClienteLista(event) {
  event.preventDefault();

  const id = document.getElementById('asoc-id').value;
  const idCliente = parseInt(document.getElementById('asoc-select-cliente').value);
  const idLista = parseInt(document.getElementById('asoc-select-lista').value);
  const esPredeterminada = document.getElementById('asoc-predeterminada').checked;

  if (esPredeterminada) {
    await supabaseClient
      .from('TB_ACLIENTE_LISTA_PRECIOS')
      .update({ m_predeterminada: false })
      .eq('id_cliente', idCliente);
  }

  const payload = { id_cliente: idCliente, id_lista_precio: idLista, m_predeterminada: esPredeterminada };

  let res = id 
    ? await supabaseClient.from('TB_ACLIENTE_LISTA_PRECIOS').update(payload).eq('id', id)
    : await supabaseClient.from('TB_ACLIENTE_LISTA_PRECIOS').insert([payload]);

  if (res.error) {
    alert('Error al guardar: ' + res.error.message);
  } else {
    resetearFormAsociacion();
    await listarAsociacionesClienteLista();
  }
}

function editarAsociacion(id, idCliente, idLista, esPredeterminada) {
  document.getElementById('asoc-id').value = id;
  document.getElementById('asoc-select-cliente').value = idCliente;
  document.getElementById('asoc-select-lista').value = idLista;
  document.getElementById('asoc-predeterminada').checked = esPredeterminada;
}

async function eliminarAsociacion(id) {
  if (!confirm('¿Eliminar esta asociación?')) return;

  const { error } = await supabaseClient.from('TB_ACLIENTE_LISTA_PRECIOS').delete().eq('id', id);
  if (error) {
    alert('Error al eliminar: ' + error.message);
  } else {
    await listarAsociacionesClienteLista();
  }
}

function resetearFormAsociacion() {
  document.getElementById('asoc-id').value = '';
  document.getElementById('asoc-predeterminada').checked = false;
}

document.querySelectorAll('.main-sidebar .nav-link').forEach(link => {
  link.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
    document.body.classList.add('sidebar-collapse');
  });
});

// --- VER DETALLE DEL PEDIDO Y NOTIFICACIONES ---
async function verDetallePedido(idPedido) {
  try {
    const { data: pedido, error } = await supabaseClient
      .from('TB_TPEDIDOS')
      .select(`
        *,
        TB_BCLIENTES(nombre),
        TB_BMEDIO_PAGO(nombre),
        TB_DPEDIDOS(
          cantidad,
          precio,
          TB_BPRODUCTOS(
            nombre,
            TB_BCATEGORIAS(nombre)
          )
        )
      `)
      .eq('id', idPedido)
      .single();

    if (error) throw error;
    if (!pedido) return;

    const formatearMoneda = (val) => Number(val || 0).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    document.getElementById('detalle-id-pedido').innerText = pedido.id;
    document.getElementById('detalle-cliente').innerText = pedido.TB_BCLIENTES?.nombre || 'Consumidor Final';
    document.getElementById('detalle-medio-pago').innerText = pedido.TB_BMEDIO_PAGO?.nombre || 'Sin especificar';
    document.getElementById('detalle-monto-total').innerText = `$${formatearMoneda(pedido.importe_total)}`;

    const items = pedido.TB_DPEDIDOS || [];
    const htmlItems = items.length > 0 
      ? items.map(item => `
          <tr>
            <td>${item.TB_BPRODUCTOS?.TB_BCATEGORIAS?.nombre} ${item.TB_BPRODUCTOS?.nombre || 'Producto'}</td>
            <td class="text-center">${item.cantidad}</td>
            <td class="text-right">$${formatearMoneda(item.precio)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="4" class="text-center text-muted">No hay ítems registrados.</td></tr>`;

    document.getElementById('tabla-detalle-body').innerHTML = htmlItems;
    $('#modalDetallePedido').modal('show');

  } catch (err) {
    console.error('Error al cargar detalle del pedido:', err);
    mostrarNotificacion('Ocurrió un error al cargar el detalle.', 'danger');
  }
}

function mostrarNotificacion(mensaje, tipo = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 8px;';
    document.body.appendChild(container);
  }

  const colores = {
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  };
  const colorFondo = colores[tipo] || colores.success;
  const colorTexto = tipo === 'warning' ? '#212529' : '#ffffff';

  const toast = document.createElement('div');
  toast.innerText = mensaje;
  toast.style.cssText = `
    background-color: ${colorFondo};
    color: ${colorTexto};
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: bold;
    font-size: 0.9rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.25s ease-in-out;
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 250);
  }, 2500);
}
