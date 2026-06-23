// Repositorio de tokens de sesión. En la base solo se guarda el sha256 del
// token (nunca el token en claro); ese hashing lo hace el servicio de auth.
import { database } from '../db/index.js'

export const tokensRepo = {
  crear(tokenHash, usuarioId, creadoEnISO, expiraEnISO) {
    return database.run(
      'INSERT INTO tokens (token_hash, usuario_id, creado_en, expira_en) VALUES (?, ?, ?, ?)',
      [tokenHash, usuarioId, creadoEnISO, expiraEnISO],
    )
  },

  porHash(tokenHash) {
    return database.get('SELECT usuario_id, expira_en FROM tokens WHERE token_hash = ?', [tokenHash])
  },

  borrar(tokenHash) {
    return database.run('DELETE FROM tokens WHERE token_hash = ?', [tokenHash])
  },
}
