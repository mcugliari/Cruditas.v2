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
  // Activa por defecto la vista de Toma de Pedidos
  const linkPedidos = document.querySelector('a[onclick*="pedidos"]');
  navegarA('pedidos', linkPedidos);
}); // FIN DOMContentLoaded


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

// 3. NUEVO PRODUCTO (Abre Modal)
function abrirModalNuevoProducto() {
  document.getElementById('prod-id').value = '';
  document.getElementById('form-producto').reset();
  document.getElementById('modal-producto-title').innerText = 'Nuevo Producto';
  $('#modal-producto').modal('show');
}

// 4. EDITAR PRODUCTO (Abre Modal cargado)
function abrirModalEditarProducto(id, nombre, id_categoria, permiteDocena) {
  document.getElementById('prod-id').value = id;
  document.getElementById('prod-nombre').value = nombre;
  document.getElementById('prod-categoria').value = id_categoria;
  document.getElementById('prod-permite-docena').checked = permiteDocena;
  document.getElementById('modal-producto-title').innerText = 'Editar Producto';
  $('#modal-producto').modal('show');
}

// 5. GUARDAR (Crear o Actualizar)
async function guardarProducto(event) {
  event.preventDefault();

  const id = document.getElementById('prod-id').value;
  const nombre = document.getElementById('prod-nombre').value;
  const id_categoria = document.getElementById('prod-categoria').value;
  const m_permite_docena = document.getElementById('prod-permite-docena').checked;

  const payload = {
    nombre,
    id_categoria,
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
    .eq('id_lista_precio', idLista);

  // Renderizar Categorías
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

  // Renderizar Excepciones de Productos (Overrides)
  const tbodyProd = document.getElementById('tabla-precios-productos-body');
  const preciosProd = preciosExistentes.filter(x => x.id_producto !== null);

  if (preciosProd.length === 0) {
    tbodyProd.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No hay precios especiales asignados.</td></tr>`;
    return;
  }

  // Traer nombres de productos para los que tienen precio especial
  const idsProds = preciosProd.map(x => x.id_producto);
  const { data: productos } = await supabaseClient
    .from('TB_BPRODUCTOS')
    .select('id, nombre')
    .in('id', idsProds);

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

// 3. GUARDAR / ACTUALIZAR PRECIO BASE DE CATEGORÍA
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

// --- ESTADO GLOBAL DEL POS ---
let carrito = {}; // { idProducto: cantidad }
let cacheProductos = [];
let cachePrecios = [];
let cacheCategorias = [];

// 1. INICIALIZAR EL MÓDULO DE TOMA DE PEDIDOS
async function inicializarPOS() {
  await cargarSelectsPOS();
  await cargarPOS();
}

// Cargar Clientes, Listas y Medios de Pago
async function cargarSelectsPOS() {
  const { data: clientes } = await supabaseClient.from('TB_BCLIENTES').select('*').order('nombre');
  const { data: listas } = await supabaseClient.from('TB_TLISTA_PRECIOS').select('*');
  const { data: medios } = await supabaseClient.from('TB_BMEDIO_PAGO').select('*');

  // Select Clientes
  const selectCli = document.getElementById('select-cliente-pedido');
  if (selectCli && clientes) {
    selectCli.innerHTML = clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  }

  // Select Listas
  const selectLis = document.getElementById('select-lista-pedido');
  if (selectLis && listas) {
    selectLis.innerHTML = listas.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
  }

  // Select Medios Pago
  const selectMed = document.getElementById('select-medio-pago');
  if (selectMed && medios) {
    selectMed.innerHTML = medios.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
  }

  await alCambiarCliente();
}

// Sugerir la lista según el cliente seleccionado
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

// Carga de datos desde Supabase (Petición a Servidor)
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

// Dibuja las tarjetas HTML usando los datos en caché
// Dibuja las tarjetas HTML usando los datos en caché
function renderizarGrillaPOS() {
  const contenedor = document.getElementById('contenedor-menu-productos');
  if (!contenedor) return;

  // Control de seguridad por si las cachés aún no se cargaron
  if (!Array.isArray(cacheCategorias) || !Array.isArray(cacheProductos)) {
    contenedor.innerHTML = '<p class="text-muted text-center my-3">Cargando menú...</p>';
    return;
  }

  // Paleta de colores fija para las categorías (Bootstrap)
  const paletaColores = ['primary', 'success', 'warning', 'danger', 'info', 'secondary'];
  
  // 1. Acumulador único para evitar reconstrucciones parciales del DOM
  let htmlCompleto = '';

  cacheCategorias.forEach((cat, index) => {
    const prodsCat = cacheProductos.filter(p => Number(p.id_categoria || p.idCategoria) === Number(cat.id));
    if (prodsCat.length === 0) return;

    // Asignación consistente de color según el índice de la categoría
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

  // 2. Inyección única en el DOM
  contenedor.innerHTML = htmlCompleto;

  actualizarResumenCarrito();
}

// Obtener precio aplicando la jerarquía (Retorna { unidad, docena })
function obtenerPrecioProducto(idProd, idCat, idLista = null) {
  if (!cachePrecios || cachePrecios.length === 0) return { unidad: 0, docena: 0 };

  const idP = Number(idProd);
  const idC = Number(idCat);
  
  // Si no se pasa idLista, intentamos leer la lista seleccionada en el select del pedido
  const idL = idLista ? Number(idLista) : Number(document.getElementById('select-lista-pedido')?.value || 0);

  // Filtrar cachePrecios por la lista activa seleccionada (si se usa id_lista_precio)
  const preciosFiltrados = cachePrecios.filter(p => !idL || Number(p.id_lista_precio || p.id_lista) === idL);
  const listaABuscar = preciosFiltrados.length > 0 ? preciosFiltrados : cachePrecios;

  // 1. Excepción por Producto
  const pProd = listaABuscar.find(p => p.id_producto !== null && Number(p.id_producto) === idP);
  if (pProd) {
    const un = Number(pProd.precio_unidad ?? pProd.precio ?? 0);
    const doc = pProd.precio_docena ? Number(pProd.precio_docena) : (un * 12); // Fallback: 12 unidades
    return { unidad: un, docena: doc };
  }

  // 2. Base por Categoría
  const pCat = listaABuscar.find(p => Number(p.id_categoria) === idC && (p.id_producto === null || p.id_producto === undefined));
  if (pCat) {
    const un = Number(pCat.precio_unidad ?? pCat.precio ?? 0);
    const doc = pCat.precio_docena ? Number(pCat.precio_docena) : (un * 12); // Fallback: 12 unidades
    return { unidad: un, docena: doc };
  }

  return { unidad: 0, docena: 0 };
}

// Función auxiliar para calcular docenas + sueltas
function calcularSubtotalItem(cantidad, precios, permiteDocena = true) {
  if (!permiteDocena || !precios.docena) {
    return cantidad * precios.unidad;
  }

  const docenas = Math.floor(cantidad / 12);
  const sueltas = cantidad % 12;

  return (docenas * precios.docena) + (sueltas * precios.unidad);
}

// Alterar cantidad del carrito (+1, -1, +12, -12) sin reconsultar Supabase
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
      if (nueva > 0) {
        tarjeta.classList.add('pos-card-activa');
      } else {
        tarjeta.classList.remove('pos-card-activa');
      }
    }

  } else {
    renderizarGrillaPOS();
  }

  actualizarResumenCarrito();
}

// Actualizar resumen visual del carrito y cálculos
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
    const cant = carrito[idProd];
    const idCatProd = p.id_categoria;
    const cat = typeof cacheCategorias !== 'undefined' ? cacheCategorias.find(c => Number(idCatProd) === Number(c.id)) : null;
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

// Resetear carrito
function resetearPedido() {
  carrito = {};
  cargarPOS();
}

// Guardar el pedido en Supabase
async function guardarPedido(estadoInicial) {
  const keys = Object.keys(carrito);
  if (keys.length === 0) {
    alert('Agregá al menos un producto al carrito.');
    return;
  }

  const idCliente = document.getElementById('select-cliente-pedido').value;
  const idLista = document.getElementById('select-lista-pedido').value;
  const idMedio = document.getElementById('select-medio-pago').value;

  let montoTotal = 0;
  const detalles = [];

  keys.forEach(idProd => {
    const p = cacheProductos.find(x => Number(x.id) === Number(idProd));
    if (!p) return;

    const cantidadTotal = Number(carrito[idProd]) || 0;
    if (cantidadTotal <= 0) return;

    // 1. Obtenemos el objeto { unidad, docena }
    const precios = obtenerPrecioProducto(p.id, p.id_categoria || p.idCategoria, idLista);

    const precioUnidad = precios.unidad || 0;
    const precioDocena = precios.docena || (precioUnidad * 12);

    // 2. Evaluamos m_permite_docena 
    const permiteDocena = Boolean(p.m_permite_docena);

    if (permiteDocena && cantidadTotal >= 12) {
      const cantDocenas = Math.floor(cantidadTotal / 12);
      const unidadesSueltas = cantidadTotal % 12;

      // Fila por las Docenas
      detalles.push({
        id_pedido: null,
        id_producto: p.id,
        cantidad: cantDocenas*12,
        precio: precioDocena*cantDocenas
      });
      montoTotal += cantDocenas * precioDocena;

      // Fila por las Unidades sueltas remanentes
      if (unidadesSueltas > 0) {
        detalles.push({
          id_pedido: null,
          id_producto: p.id,
          cantidad: unidadesSueltas,
          precio: precioUnidad*unidadesSueltas
        });
        montoTotal += unidadesSueltas * precioUnidad;
      }
    } else {
      // Venta por unidades sueltas
      detalles.push({
        id_pedido: null,
        id_producto: p.id,
        cantidad: cantidadTotal,
        precio: precioUnidad
      });
      montoTotal += cantidadTotal * precioUnidad;
    }
  });

  // 3. Insertar Cabecera de Pedido
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

  // 4. Asignar ID de pedido generado e Insertar Detalle
  detalles.forEach(d => d.id_pedido = pedido.id);

  const { error: errorDetalle } = await supabaseClient
    .from('TB_DPEDIDOS')
    .insert(detalles);

  if (errorDetalle) {
    mostrarNotificacion('Error al guardar el detalle del pedido: ' + errorDetalle.message, 'danger');
    return;
  }

  mostrarNotificacion(`¡Pedido #${pedido.id} registrado correctamente!`, 'success');
  resetearPedido();
}

// --- GESTIÓN DE PEDIDOS DEL DÍA / HISTÓRICO ---
async function cargarTablaPedidos() {
  const inputDesde = document.getElementById('filtro-fecha-desde');
  const inputHasta = document.getElementById('filtro-fecha-hasta');
  
  if (!inputDesde.value) {
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

  // Calculo de KPIs
  let totalCobrado = 0;
  let totalPendienteCobro = 0;
  let cantPreparacion = 0;
  let cantAnulados = 0;

  pedidos.forEach(p => {
    if (p.estado === 'COMPLETADO') totalCobrado += (p.importe_total || 0);
    if (p.estado === 'ENTREGADO_IMPAGO') totalPendienteCobro += (p.importe_total || 0);
    if (p.estado === 'PENDIENTE') cantPreparacion++;
    if (p.estado === 'ANULADO') cantAnulados++;
  });

  document.getElementById('kpi-total-cobrado').innerText = `$${totalCobrado.toLocaleString()}`;
  document.getElementById('kpi-total-pendiente-cobro').innerText = `$${totalPendienteCobro.toLocaleString()}`;
  document.getElementById('kpi-cant-preparacion').innerText = cantPreparacion;
  document.getElementById('kpi-cant-anulados').innerText = cantAnulados;

  // Renderizar Tabla
  const tbody = document.getElementById('tabla-pedidos-body');
  if (pedidos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">No hay pedidos registrados para estos filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = pedidos.map(p => {
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

    if (p.estado === 'PENDIENTE') { badgeClass = 'badge-info'; estadoTexto = '⏳ Pendiente'; }
    if (p.estado === 'ENTREGADO_IMPAGO') { badgeClass = 'badge-warning'; estadoTexto = '📦 Entregado (Impago)'; }
    if (p.estado === 'COMPLETADO') { badgeClass = 'badge-success'; estadoTexto = '✅ Completado'; }
    if (p.estado === 'ANULADO') { badgeClass = 'badge-danger'; estadoTexto = '🚫 Anulado'; }

    return `
      <tr>
        <td class="font-weight-bold">#${p.id}</td>
        <td>${fechaPedido} ${hora} hs</td>
        <td class="font-weight-bold">${clienteNombre}</td>
        <td><small class="badge badge-light border">${medioPago}</small></td>
        <td class="text-right font-weight-bold">$${p.importe_total   || 0}</td>
        <td class="text-center"><span class="badge ${badgeClass} p-2">${estadoTexto}</span></td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            ${p.estado !== 'COMPLETADO' && p.estado !== 'ANULADO' ? `
              <button class="btn btn-outline-success" title="Marcar como Cobrado" onclick="cambiarEstadoPedido(${p.id}, 'COMPLETADO')">
                <i class="fas fa-check"></i>
              </button>
            ` : ''}
            ${p.estado === 'PENDIENTE' ? `
              <button class="btn btn-outline-warning" title="Entregar sin Cobrar" onclick="cambiarEstadoPedido(${p.id}, 'ENTREGADO_IMPAGO')">
                <i class="fas fa-truck"></i>
              </button>
            ` : ''}
            ${p.estado !== 'ANULADO' ? `
              <button class="btn btn-outline-danger" title="Anular Pedido" onclick="cambiarEstadoPedido(${p.id}, 'ANULADO')">
                <i class="fas fa-ban"></i>
              </button>
            ` : ''}
            
              <button class="btn btn-sm btn-outline-primary" onclick="verDetallePedido(${p.id})" title="Ver detalle">
                <i class="fas fa-eye"></i>
              </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Transición de estados en Supabase
async function cambiarEstadoPedido(idPedido, nuevoEstado) {
  if (nuevoEstado === 'ANULADO' && !confirm('¿Seguro que deseas anular este pedido? Se excluirá del cierre de caja.')) {
    return;
  }

  const { error } = await supabaseClient
    .from('TB_TPEDIDOS')
    .update({ estado: nuevoEstado })
    .eq('id', idPedido);

  if (error) {
    alert('Error al cambiar el estado: ' + error.message);
  } else {
    cargarTablaPedidos();
  }
}

// --- CRUD TB_ACLIENTE_LISTA_PRECIOS ---

async function inicializarCrudClienteLista() {
  await cargarSelectsAsociacion();
  await listarAsociacionesClienteLista();
}

// 1. Cargar desplegables de Clientes y Listas
async function cargarSelectsAsociacion() {
  const { data: clientes } = await supabaseClient.from('TB_BCLIENTES').select('id, nombre').order('nombre');
  const { data: listas } = await supabaseClient.from('TB_TLISTA_PRECIOS').select('id, nombre');

  const selectCli = document.getElementById('asoc-select-cliente');
  const selectLis = document.getElementById('asoc-select-lista');

  if (selectCli && clientes) {
    selectCli.innerHTML = clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  }
  if (selectLis && listas) {
    selectLis.innerHTML = listas.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
  }
}

// 2. READ: Listar asociaciones con Relational Queries de Supabase
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

// 3. CREATE / UPDATE: Guardar relación asegurando única predeterminada por cliente
async function guardarAsociacionClienteLista(event) {
  event.preventDefault();

  const id = document.getElementById('asoc-id').value;
  const idCliente = parseInt(document.getElementById('asoc-select-cliente').value);
  const idLista = parseInt(document.getElementById('asoc-select-lista').value);
  const esPredeterminada = document.getElementById('asoc-predeterminada').checked;

  // Si se marca como predeterminada, desmarcamos las demás del mismo cliente
  if (esPredeterminada) {
    await supabaseClient
      .from('TB_ACLIENTE_LISTA_PRECIOS')
      .update({ m_predeterminada: false })
      .eq('id_cliente', idCliente);
  }

  const payload = {
    id_cliente: idCliente,
    id_lista_precio: idLista,
    m_predeterminada: esPredeterminada
  };

  let res;
  if (id) {
    res = await supabaseClient.from('TB_ACLIENTE_LISTA_PRECIOS').update(payload).eq('id', id);
  } else {
    res = await supabaseClient.from('TB_ACLIENTE_LISTA_PRECIOS').insert([payload]);
  }

  if (res.error) {
    alert('Error al guardar: ' + res.error.message);
  } else {
    resetearFormAsociacion();
    await listarAsociacionesClienteLista();
  }
}

// 4. Cargar datos en el formulario para Editar
function editarAsociacion(id, idCliente, idLista, esPredeterminada) {
  document.getElementById('asoc-id').value = id;
  document.getElementById('asoc-select-cliente').value = idCliente;
  document.getElementById('asoc-select-lista').value = idLista;
  document.getElementById('asoc-predeterminada').checked = esPredeterminada;
}

// 5. DELETE: Eliminar asociación
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

// Cierra el menú desplegable al hacer clic en cualquier sección
document.querySelectorAll('.main-sidebar .nav-link').forEach(link => {
  link.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
    document.body.classList.add('sidebar-collapse');
  });
});

// --- VER DETALLE DEL PEDIDO ---
async function verDetallePedido(idPedido) {
  try {
    // Consulta a Supabase adaptada a tu esquema
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

    // Helper para dar formato 99.999,99
    const formatearMoneda = (val) => Number(val || 0).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    // Asignación de datos del cabezal
    document.getElementById('detalle-id-pedido').innerText = pedido.id;
    document.getElementById('detalle-cliente').innerText = pedido.TB_BCLIENTES?.nombre || 'Consumidor Final';
    document.getElementById('detalle-medio-pago').innerText = pedido.TB_BMEDIO_PAGO?.nombre || 'Sin especificar';
    document.getElementById('detalle-monto-total').innerText = `$${formatearMoneda(pedido.importe_total)}`;

    // Mapeo de productos del pedido
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

    // Mostrar modal con jQuery / Bootstrap 4
    $('#modalDetallePedido').modal('show');

  } catch (err) {
    console.error('Error al cargar detalle del pedido:', err);
    alert('Ocurrió un error al cargar el detalle.');
  }
}

function mostrarNotificacion(mensaje, tipo = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const idToast = 'toast-' + Date.now();
  
  // Iconos y colores según el tipo (success, danger, warning, info)
  const bgClass = tipo === 'success' ? 'bg-success' : tipo === 'danger' ? 'bg-danger' : 'bg-info';
  
  const toastHTML = `
    <div id="${idToast}" class="toast align-items-center text-white ${bgClass} border-0 show mb-2" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex p-2">
        <div class="toast-body font-weight-bold">
          ${mensaje}
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHTML);

  // Se auto-elimina suavemente a los 2.5 segundos sin requerir acción del usuario
  setTimeout(() => {
    const el = document.getElementById(idToast);
    if (el) el.remove();
  }, 2500);
}