// Servicio de proyectos colaborativos: creación, unión por código, edición
// (permisos + lista blanca + expulsión) y borrado. Expone helpers de acceso
// (esMiembro, puedeEditar) que también usa el dominio de contenido.
import { database } from '../db/index.js'
import { proyectosRepo } from '../repositories/proyectosRepo.js'
import { amigosRepo } from '../repositories/amigosRepo.js'
import { fallo } from './ApiError.js'

const PERMISOS = ['todos', 'solo_propietario', 'selectivo']

// ¿El usuario puede modificar el contenido del proyecto?
// personal (sin proyecto) => siempre; 'solo_propietario' => solo el dueño;
// 'todos' y 'selectivo' => cualquier miembro (en 'selectivo' la membresía ya
// está restringida a la lista blanca).
export async function puedeEditarProyecto(proyectoId, usuarioId) {
  if (!proyectoId) return true
  const p = await proyectosRepo.cabecera(proyectoId)
  if (!p) return false
  if (p.permiso_edicion === 'solo_propietario') return p.propietario_id === usuarioId
  return true
}

export function esMiembro(proyectoId, usuarioId) {
  return proyectosRepo.esMiembro(proyectoId, usuarioId)
}

// puedeEditar a partir de la fila ya cargada (sin consulta extra). Equivale a
// puedeEditarProyecto para un proyecto existente.
function calcPuedeEditar(p, usuarioId) {
  if (p.permiso_edicion === 'solo_propietario') return p.propietario_id === usuarioId
  return true
}

// Arma la vista con acceso/miembros ya resueltos (permite reusar en el listado
// batch). `p` siempre existe aquí.
function armarVista(p, usuarioId, acceso, miembros) {
  return {
    id: p.id,
    nombre: p.nombre,
    codigo: p.codigo,
    permisoEdicion: p.permiso_edicion,
    propietarioId: p.propietario_id,
    esPropietario: p.propietario_id === usuarioId,
    puedeEditar: calcPuedeEditar(p, usuarioId),
    acceso,
    miembros,
  }
}

// Vista de un proyecto (camino de un solo proyecto: 2 consultas).
async function vista(p, usuarioId) {
  return armarVista(
    p,
    usuarioId,
    await proyectosRepo.accesoIds(p.id),
    await proyectosRepo.miembros(p.id),
  )
}

// Agrupa filas por una clave; `map` transforma cada fila al valor guardado.
function agruparPor(filas, clave, map) {
  const out = new Map()
  for (const f of filas) {
    if (!out.has(f[clave])) out.set(f[clave], [])
    out.get(f[clave]).push(map(f))
  }
  return out
}

// Código único de 6 dígitos (no choca con proyectos existentes).
async function generarCodigo(exec) {
  let codigo
  do {
    codigo = String(Math.floor(100000 + Math.random() * 900000))
  } while (await proyectosRepo.codigoExiste(codigo, exec))
  return codigo
}

const idsValidos = (acceso) =>
  Array.isArray(acceso) ? acceso.map(Number).filter(Number.isInteger) : []

export const proyectosService = {
  vista,

  // Listado: acceso y miembros de TODOS los proyectos en 2 consultas (sin N+1).
  async listar(usuarioId) {
    const filas = await proyectosRepo.listarDeUsuario(usuarioId)
    if (filas.length === 0) return []
    const pids = filas.map((p) => p.id)
    const accesoMap = agruparPor(await proyectosRepo.accesoDeProyectos(pids), 'proyecto_id', (r) => r.usuario_id)
    const miembrosMap = agruparPor(await proyectosRepo.miembrosDeProyectos(pids), 'proyecto_id', (r) => ({
      id: r.id,
      nombreUsuario: r.nombreUsuario,
      email: r.email,
      foto: r.foto,
    }))
    return filas.map((p) =>
      armarVista(p, usuarioId, accesoMap.get(p.id) || [], miembrosMap.get(p.id) || []),
    )
  },

  // Crea un proyecto. Nadie queda agregado salvo el creador; los demás entran
  // por código. En modo 'selectivo' se define una lista blanca (solo amigos).
  async crear(usuarioId, { nombre: nombreRaw, permisoEdicion, acceso }) {
    const nombre = String(nombreRaw || '').trim()
    if (!nombre) throw fallo(400, 'El nombre es obligatorio')
    const permiso = PERMISOS.includes(permisoEdicion) ? permisoEdicion : 'todos'
    const ids = idsValidos(acceso)

    const pid = await database.withTransaction(async (tx) => {
      const codigo = await generarCodigo(tx)
      const id = await proyectosRepo.insertar(nombre, usuarioId, codigo, permiso, tx)
      await proyectosRepo.agregarMiembro(id, usuarioId, tx)
      if (permiso === 'selectivo') {
        for (const aid of ids) {
          if (aid !== usuarioId && (await amigosRepo.sonAmigos(usuarioId, aid)))
            await proyectosRepo.agregarAcceso(id, aid, tx)
        }
      }
      return id
    })
    return vista(await proyectosRepo.porId(pid), usuarioId)
  },

  async unirse(usuarioId, codigoRaw) {
    const codigo = String(codigoRaw || '').trim()
    if (!/^\d{6}$/.test(codigo)) throw fallo(400, 'El código debe tener 6 dígitos')
    const p = await proyectosRepo.porCodigo(codigo)
    if (!p) throw fallo(404, 'No existe un proyecto con ese código')
    // En modo selectivo con lista blanca no vacía, solo entran los permitidos.
    if (p.permiso_edicion === 'selectivo' && p.propietario_id !== usuarioId) {
      const permitidos = await proyectosRepo.accesoIds(p.id)
      if (permitidos.length > 0 && !permitidos.includes(usuarioId))
        throw fallo(403, 'El propietario restringió el acceso a este proyecto')
    }
    await proyectosRepo.agregarMiembro(p.id, usuarioId)
    return vista(p, usuarioId)
  },

  async detalle(usuarioId, pid) {
    if (!(await proyectosRepo.esMiembro(pid, usuarioId))) throw fallo(404, 'No existe')
    return vista(await proyectosRepo.porId(pid), usuarioId)
  },

  // Editar (solo el propietario): nombre, permiso y lista blanca.
  async editar(usuarioId, pid, body) {
    const p = await proyectosRepo.cabecera(pid)
    if (!p) throw fallo(404, 'No existe')
    if (p.propietario_id !== usuarioId) throw fallo(403, 'Solo el propietario puede editar el proyecto')

    await database.withTransaction(async (tx) => {
      if (body?.nombre !== undefined) {
        const nombre = String(body.nombre).trim()
        if (!nombre) throw fallo(400, 'El nombre es obligatorio')
        await proyectosRepo.actualizarNombre(pid, nombre, tx)
      }
      if (body?.permisoEdicion !== undefined) {
        const permiso = PERMISOS.includes(body.permisoEdicion) ? body.permisoEdicion : 'todos'
        await proyectosRepo.actualizarPermiso(pid, permiso, tx)
      }
      const permisoFinal = await proyectosRepo.permisoEdicion(pid, tx)

      // Lista blanca: se reemplaza si llega 'acceso'; se limpia si no es selectivo.
      if (permisoFinal !== 'selectivo') {
        await proyectosRepo.limpiarAcceso(pid, tx)
      } else if (Array.isArray(body?.acceso)) {
        const ids = idsValidos(body.acceso)
        await proyectosRepo.limpiarAcceso(pid, tx)
        for (const aid of ids) {
          // Se permite incluir a amigos o a miembros que ya se unieron.
          if (
            aid !== usuarioId &&
            ((await amigosRepo.sonAmigos(usuarioId, aid)) ||
              (await proyectosRepo.esMiembro(pid, aid, tx)))
          ) {
            await proyectosRepo.agregarAcceso(pid, aid, tx)
          }
        }
      }

      // Si queda selectivo con lista no vacía, expulsa a los no permitidos.
      if (permisoFinal === 'selectivo') {
        const permitidos = await proyectosRepo.accesoIds(pid, tx)
        if (permitidos.length > 0)
          await proyectosRepo.expulsarNoPermitidos(pid, p.propietario_id, permitidos, tx)
      }
    })

    return vista(await proyectosRepo.porId(pid), usuarioId)
  },

  async quitarMiembro(usuarioId, pid, uid) {
    const p = await proyectosRepo.cabecera(pid)
    if (!p) throw fallo(404, 'No existe')
    if (p.propietario_id !== usuarioId) throw fallo(403, 'Solo el propietario puede quitar miembros')
    if (uid === p.propietario_id) throw fallo(400, 'El propietario no puede quitarse a sí mismo')
    await proyectosRepo.quitarMiembro(pid, uid)
  },

  // Eliminar (solo el propietario). Borra su contenido compartido.
  async eliminar(usuarioId, pid) {
    const p = await proyectosRepo.cabecera(pid)
    if (!p) throw fallo(404, 'No existe')
    if (p.propietario_id !== usuarioId) throw fallo(403, 'Solo el propietario puede eliminar el proyecto')
    await database.withTransaction(async (tx) => {
      await proyectosRepo.borrarMateriasDeProyecto(pid, tx)
      await proyectosRepo.borrarCarpetasDeProyecto(pid, tx)
      await proyectosRepo.borrarProyecto(pid, tx)
    })
  },

  async salir(usuarioId, pid) {
    const p = await proyectosRepo.cabecera(pid)
    if (!p) throw fallo(404, 'No existe')
    if (p.propietario_id === usuarioId)
      throw fallo(400, 'El propietario no puede salir; elimina el proyecto')
    await proyectosRepo.quitarMiembro(pid, usuarioId)
  },
}
