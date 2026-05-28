import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

// ── Caja ─────────────────────────────────────────────────────────────────────
export const cajaAPI = {
  actual: () => api.get("/caja/actual"),
  abrir: (data) => api.post("/caja/abrir", data),
  cerrar: (id, data) => api.post(`/caja/${id}/cerrar`, data),
  historial: () => api.get("/caja/historial"),
  resumen: (id) => api.get(`/caja/${id}/resumen`),
};

// ── Ventas ───────────────────────────────────────────────────────────────────
export const ventasAPI = {
  listar: (params) => api.get("/ventas/", { params }),
  crear: (data) => api.post("/ventas/", data),
  anular: (id) => api.delete(`/ventas/${id}`),
  crearGasto: (data) => api.post("/ventas/gastos", data),
  listarGastos: (params) => api.get("/ventas/gastos", { params }),
  eliminarGasto: (id) => api.delete(`/ventas/gastos/${id}`),
};

// ── Stock ─────────────────────────────────────────────────────────────────────
export const stockAPI = {
  categorias: () => api.get("/stock/categorias"),
  crearCategoria: (data) => api.post("/stock/categorias", data),
  eliminarCategoria: (id) => api.delete(`/stock/categorias/${id}`),
  productos: (params) => api.get("/stock/productos", { params }),
  crearProducto: (data) => api.post("/stock/productos", data),
  actualizarProducto: (id, data) => api.put(`/stock/productos/${id}`, data),
  eliminarProducto: (id) => api.delete(`/stock/productos/${id}`),
  obtenerPorSku: (sku) => api.get(`/stock/productos/sku/${encodeURIComponent(sku)}`),
  ajustarStock: (id, data) => api.patch(`/stock/productos/${id}/ajuste`, data),
  alertas: () => api.get("/stock/alertas"),
};

// ── Clientes ──────────────────────────────────────────────────────────────────
export const clientesAPI = {
  listar: (params) => api.get("/clientes/", { params }),
  crear: (data) => api.post("/clientes/", data),
  obtener: (id) => api.get(`/clientes/${id}`),
  actualizar: (id, data) => api.put(`/clientes/${id}`, data),
  eliminar: (id) => api.delete(`/clientes/${id}`),
  registrarPago: (id, data) => api.post(`/clientes/${id}/pagos`, data),
  historialPagos: (id) => api.get(`/clientes/${id}/pagos`),
};

// ── Proveedores ───────────────────────────────────────────────────────────────
export const proveedoresAPI = {
  listar: () => api.get("/proveedores/"),
  crear: (data) => api.post("/proveedores/", data),
  actualizar: (id, data) => api.put(`/proveedores/${id}`, data),
  eliminar: (id) => api.delete(`/proveedores/${id}`),
  registrarPago: (id, data) => api.post(`/proveedores/${id}/pago`, data),
  registrarCompra: (data) => api.post("/proveedores/compras", data),
  listarCompras: (params) => api.get("/proveedores/compras", { params }),
};

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (formData) => api.post("/auth/login", formData, { headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
  me: () => api.get("/auth/me"),
  crearUsuario: (data) => api.post("/auth/usuarios", data),
  listarUsuarios: () => api.get("/auth/usuarios"),
  desactivarUsuario: (id) => api.delete(`/auth/usuarios/${id}`),
  cambiarPassword: (data) => api.post("/auth/cambiar-password", data),
};

// ── Presupuestos ───────────────────────────────────────────────────────────────
export const presupuestosAPI = {
  listar: (params) => api.get("/presupuestos/", { params }),
  crear: (data) => api.post("/presupuestos/", data),
  actualizarEstado: (id, estado) => api.put(`/presupuestos/${id}/estado`, null, { params: { estado } }),
  convertir: (id, caja_id) => api.post(`/presupuestos/${id}/convertir`, null, { params: caja_id ? { caja_id } : {} }),
  eliminar: (id) => api.delete(`/presupuestos/${id}`),
};

// ── Promos ────────────────────────────────────────────────────────────────────
export const promosAPI = {
  listar: (params) => api.get("/promos/", { params }),
  crear: (data) => api.post("/promos/", data),
  obtener: (id) => api.get(`/promos/${id}`),
  actualizar: (id, data) => api.put(`/promos/${id}`, data),
  desactivar: (id) => api.delete(`/promos/${id}`),
};

// ── Facturas ──────────────────────────────────────────────────────────────────
export const facturasAPI = {
  listar: (params) => api.get("/facturas/", { params }),
  crear: (data) => api.post("/facturas/", data),
  obtener: (id) => api.get(`/facturas/${id}`),
  anular: (id) => api.delete(`/facturas/${id}`),
  siguienteNumero: (tipo) => api.get(`/facturas/siguiente-numero/${tipo}`),
};

// ── Devoluciones ───────────────────────────────────────────────────────────────
export const devolucionesAPI = {
  listar: () => api.get("/devoluciones/"),
  crear: (data) => api.post("/devoluciones/", data),
};

// ── Movimientos ───────────────────────────────────────────────────────────────
export const movimientosAPI = {
  listar: (params) => api.get("/movimientos/", { params }),
};

// ── Estadísticas ──────────────────────────────────────────────────────────────
export const estadisticasAPI = {
  resumen: (params) => api.get("/estadisticas/resumen", { params }),
  ventasPorDia: (params) => api.get("/estadisticas/ventas-por-dia", { params }),
  productosMasVendidos: (params) =>
    api.get("/estadisticas/productos-mas-vendidos", { params }),
};

export default api;
