// Servicio de grupos colaborativos: creación, unión por código, edición
// (permisos + lista blanca + expulsión) y borrado. Expone helpers de acceso
// (esMiembro, puedeEditar) que también usa el dominio de contenido.
import { database } from '../db/index.js'
import { gruposRepo } from '../repositories/gruposRepo.js'
import { amigosRepo } from '../repositories/amigosRepo.js'
import { fallo } from './ApiError.js'

const PERMISOS = ['todos', 'solo_propietario', 'selectivo']

// ¿El usuario puede modificar el contenido del grupo?
// personal (sin grupo) => siempre; 'solo_propietario' => solo el dueño;
// 'todos' y 'selectivo' => cualquier miembro (en 'selectivo' la membresía ya
// está restringida a la lista blanca).
export async function puedeEditarGrupo(grupoId, usuarioId) {
  if (!grupoId) return true
  const p = await gruposRepo.cabecera(grupoId)
  if (!p) return false
  if (p.permiso_edicion === 'solo_propietario') return p.propietario_id === usuarioId
  return true
}

export function esMiembro(grupoId, usuarioId) {
  return gruposRepo.esMiembro(grupoId, usuarioId)
}

// puedeEditar a partir de la fila ya cargada (sin consulta extra). Equivale a
// puedeEditarGrupo para un grupo existente.
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

// Vista de un grupo (camino de un solo grupo: 2 consultas).
async function vista(p, usuarioId) {
  return armarVista(
    p,
    usuarioId,
    await gruposRepo.accesoIds(p.id),
    await gruposRepo.miembros(p.id),
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

// Código único de 6 dígitos (no choca con grupos existentes).
async function generarCodigo(exec) {
  let codigo
  do {
    codigo = String(Math.floor(100000 + Math.random() * 900000))
  } while (await gruposRepo.codigoExiste(codigo, exec))
  return codigo
}

const idsValidos = (acceso) =>
  Array.isArray(acceso) ? acceso.map(Number).filter(Number.isInteger) : []

export const gruposService = {
  vista,

  // Listado: acceso y miembros de TODOS los grupos en 2 consultas (sin N+1).
  async listar(usuarioId) {
    const filas = await gruposRepo.listarDeUsuario(usuarioId)
    if (filas.length === 0) return []
    const pids = filas.map((p) => p.id)
    const accesoMap = agruparPor(await gruposRepo.accesoDeGrupos(pids), 'grupo_id', (r) => r.usuario_id)
    const miembrosMap = agruparPor(await gruposRepo.miembrosDeGrupos(pids), 'grupo_id', (r) => ({
      id: r.id,
      nombreUsuario: r.nombreUsuario,
      email: r.email,
      foto: r.foto,
    }))
    return filas.map((p) =>
      armarVista(p, usuarioId, accesoMap.get(p.id) || [], miembrosMap.get(p.id) || []),
    )
  },

  // Crea un grupo. Nadie queda agregado salvo el creador; los demás entran
  // por código. En modo 'selectivo' se define una lista blanca (solo amigos).
  async crear(usuarioId, { nombre: nombreRaw, permisoEdicion, acceso }) {
    const nombre = String(nombreRaw || '').trim()
    if (!nombre) throw fallo(400, 'El nombre es obligatorio')
    const permiso = PERMISOS.includes(permisoEdicion) ? permisoEdicion : 'todos'
    const ids = idsValidos(acceso)

    const pid = await database.withTransaction(async (tx) => {
      const codigo = await generarCodigo(tx)
      const id = await gruposRepo.insertar(nombre, usuarioId, codigo, permiso, tx)
      await gruposRepo.agregarMiembro(id, usuarioId, tx)
      if (permiso === 'selectivo') {
        for (const aid of ids) {
          if (aid !== usuarioId && (await amigosRepo.sonAmigos(usuarioId, aid)))
            await gruposRepo.agregarAcceso(id, aid, tx)
        }
      }
      return id
    })
    return vista(await gruposRepo.porId(pid), usuarioId)
  },

  async unirse(usuarioId, codigoRaw) {
    const codigo = String(codigoRaw || '').trim()
    if (!/^\d{6}$/.test(codigo)) throw fallo(400, 'El código debe tener 6 dígitos')
    const p = await gruposRepo.porCodigo(codigo)
    if (!p) throw fallo(404, 'No existe un grupo con ese código')
    // En modo selectivo con lista blanca no vacía, solo entran los permitidos.
    if (p.permiso_edicion === 'selectivo' && p.propietario_id !== usuarioId) {
      const permitidos = await gruposRepo.accesoIds(p.id)
      if (permitidos.length > 0 && !permitidos.includes(usuarioId))
        throw fallo(403, 'El propietario restringió el acceso a este grupo')
    }
    await gruposRepo.agregarMiembro(p.id, usuarioId)
    return vista(p, usuarioId)
  },

  async detalle(usuarioId, pid) {
    if (!(await gruposRepo.esMiembro(pid, usuarioId))) throw fallo(404, 'No existe')
    return vista(await gruposRepo.porId(pid), usuarioId)
  },

  // Editar (solo el propietario): nombre, permiso y lista blanca.
  async editar(usuarioId, pid, body) {
    const p = await gruposRepo.cabecera(pid)
    if (!p) throw fallo(404, 'No existe')
    if (p.propietario_id !== usuarioId) throw fallo(403, 'Solo el propietario puede editar el grupo')

    await database.withTransaction(async (tx) => {
      if (body?.nombre !== undefined) {
        const nombre = String(body.nombre).trim()
        if (!nombre) throw fallo(400, 'El nombre es obligatorio')
        await gruposRepo.actualizarNombre(pid, nombre, tx)
      }
      if (body?.permisoEdicion !== undefined) {
        const permiso = PERMISOS.includes(body.permisoEdicion) ? body.permisoEdicion : 'todos'
        await gruposRepo.actualizarPermiso(pid, permiso, tx)
      }
      const permisoFinal = await gruposRepo.permisoEdicion(pid, tx)

      // Lista blanca: se reemplaza si llega 'acceso'; se limpia si no es selectivo.
      if (permisoFinal !== 'selectivo') {
        await gruposRepo.limpiarAcceso(pid, tx)
      } else if (Array.isArray(body?.acceso)) {
        const ids = idsValidos(body.acceso)
        await gruposRepo.limpiarAcceso(pid, tx)
        for (const aid of ids) {
          // Se permite incluir a amigos o a miembros que ya se unieron.
          if (
            aid !== usuarioId &&
            ((await amigosRepo.sonAmigos(usuarioId, aid)) ||
              (await gruposRepo.esMiembro(pid, aid, tx)))
          ) {
            await gruposRepo.agregarAcceso(pid, aid, tx)
          }
        }
      }

      // Si queda selectivo con lista no vacía, expulsa a los no permitidos.
      if (permisoFinal === 'selectivo') {
        const permitidos = await gruposRepo.accesoIds(pid, tx)
        if (permitidos.length > 0)
          await gruposRepo.expulsarNoPermitidos(pid, p.propietario_id, permitidos, tx)
      }
    })

    return vista(await gruposRepo.porId(pid), usuarioId)
  },

  async quitarMiembro(usuarioId, pid, uid) {
    const p = await gruposRepo.cabecera(pid)
    if (!p) throw fallo(404, 'No existe')
    if (p.propietario_id !== usuarioId) throw fallo(403, 'Solo el propietario puede quitar miembros')
    if (uid === p.propietario_id) throw fallo(400, 'El propietario no puede quitarse a sí mismo')
    await gruposRepo.quitarMiembro(pid, uid)
  },

  // Eliminar (solo el propietario). Borra su contenido compartido.
  async eliminar(usuarioId, pid) {
    const p = await gruposRepo.cabecera(pid)
    if (!p) throw fallo(404, 'No existe')
    if (p.propietario_id !== usuarioId) throw fallo(403, 'Solo el propietario puede eliminar el grupo')
    await database.withTransaction(async (tx) => {
      await gruposRepo.borrarMateriasDeGrupo(pid, tx)
      await gruposRepo.borrarCarpetasDeGrupo(pid, tx)
      await gruposRepo.borrarGrupo(pid, tx)
    })
  },

  async salir(usuarioId, pid) {
    const p = await gruposRepo.cabecera(pid)
    if (!p) throw fallo(404, 'No existe')
    if (p.propietario_id === usuarioId)
      throw fallo(400, 'El propietario no puede salir; elimina el grupo')
    await gruposRepo.quitarMiembro(pid, usuarioId)
  },

  // Estadísticas colectivas: preguntas respondidas y precisión promedio del
  // grupo, sobre las materias que el grupo comparte.
  async estadisticas(usuarioId, pid) {
    if (!(await gruposRepo.esMiembro(pid, usuarioId))) throw fallo(404, 'No existe')
    const { respondidas, correctas } = await gruposRepo.estadisticas(pid)
    const precision = respondidas > 0 ? Math.round((correctas / respondidas) * 100) : 0
    return { preguntasRespondidas: respondidas, precisionPromedio: precision }
  },

  // ----- Objetivos grupales (reto colectivo con progreso) -----
  async listarObjetivos(usuarioId, pid) {
    if (!(await gruposRepo.esMiembro(pid, usuarioId))) throw fallo(404, 'No existe')
    const objetivos = await gruposRepo.objetivosDeGrupo(pid)
    return Promise.all(
      objetivos.map(async (o) => ({
        id: o.id,
        descripcion: o.descripcion,
        materiaId: o.materia_id,
        meta: o.meta,
        avance: await gruposRepo.progresoObjetivo(o),
        creadoPor: o.creado_por,
        creadoEn: o.creado_en,
      })),
    )
  },

  async crearObjetivo(usuarioId, pid, { descripcion: descRaw, materiaId, meta: metaRaw }) {
    if (!(await gruposRepo.esMiembro(pid, usuarioId))) throw fallo(404, 'No existe')
    const descripcion = String(descRaw || '').trim()
    if (!descripcion) throw fallo(400, 'Falta la descripción del objetivo')
    const meta = Number(metaRaw)
    if (!Number.isInteger(meta) || meta < 1) throw fallo(400, 'La meta debe ser un número mayor a 0')
    const info = await gruposRepo.crearObjetivo(pid, descripcion, materiaId || null, meta, usuarioId)
    return { id: Number(info.lastInsertRowid) }
  },

  async borrarObjetivo(usuarioId, pid, id) {
    const p = await gruposRepo.cabecera(pid)
    if (!p) throw fallo(404, 'No existe')
    const objetivo = await gruposRepo.objetivo(id)
    if (!objetivo || objetivo.grupo_id !== pid) throw fallo(404, 'No existe')
    if (objetivo.creado_por !== usuarioId && p.propietario_id !== usuarioId)
      throw fallo(403, 'Solo quien lo creó o el propietario del grupo puede borrarlo')
    await gruposRepo.borrarObjetivo(id, pid)
  },
}
