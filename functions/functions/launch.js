// POST (form) { passcode, recordIds: JSON string array, force?: "true" }
// Starts one Studio execution per eligible record.
// Returns { results: [{ id, ok, skipped?, reason?, executionSid? }] }
const lib = require(Runtime.getFunctions()['lib'].path);
const { F, STATUS } = lib;

const CONCURRENCY = 5;

async function launchOne(context, client, id, force) {
  const rec = await lib.getRecord(context, id);
  const f = rec.fields;
  const estado = f[F.estado] || STATUS.PENDIENTE;

  if (!lib.isAuthorized(f[F.autoriza])) return { id, ok: false, skipped: true, reason: 'No autoriza datos' };
  if (f[F.optOut]) return { id, ok: false, skipped: true, reason: 'Opt-out' };
  if (lib.ACTIVE.includes(estado)) return { id, ok: false, skipped: true, reason: `Flujo activo (${estado})` };
  if (estado === STATUS.COMPLETADO && !force) return { id, ok: false, skipped: true, reason: 'Ya completado' };
  if (lib.RELAUNCHABLE.includes(estado) && !force) {
    return { id, ok: false, skipped: true, reason: `Requiere confirmar relanzamiento (${estado})` };
  }

  const to = lib.toE164(f[F.whatsapp], context.DEFAULT_COUNTRY_CODE);
  if (!to) {
    await lib.updateRecord(context, id, { [F.estado]: STATUS.FALLIDO, [F.error]: `Número inválido: ${f[F.whatsapp] || '(vacío)'}` });
    return { id, ok: false, reason: 'Número inválido' };
  }

  try {
    const execution = await client.studio.v2.flows(context.STUDIO_FLOW_SID).executions.create({
      to: `whatsapp:${to}`,
      from: context.WA_SENDER.startsWith('whatsapp:') ? context.WA_SENDER : `whatsapp:${context.WA_SENDER}`,
      parameters: {
        recordId: id,
        nombre: (f[F.nombre] || '').split(' ')[0],
        nombreCompleto: f[F.nombre] || '',
        empresa: f[F.empresa] || '',
      },
    });
    await lib.updateRecord(context, id, {
      [F.estado]: STATUS.ENVIANDO,
      [F.executionSid]: execution.sid,
      [F.fechaEnvio]: new Date().toISOString(),
      [F.intentos]: (Number(f[F.intentos]) || 0) + 1,
      [F.error]: '',
    });
    return { id, ok: true, executionSid: execution.sid };
  } catch (err) {
    await lib.updateRecord(context, id, { [F.estado]: STATUS.FALLIDO, [F.error]: `${err.code || ''} ${err.message}`.trim() });
    return { id, ok: false, reason: err.message };
  }
}

exports.handler = async (context, event, callback) => {
  if (!lib.checkPasscode(context, event)) {
    return callback(null, lib.response(context, event, 401, { error: 'Unauthorized' }));
  }
  let ids;
  try {
    ids = JSON.parse(event.recordIds || '[]');
    if (!Array.isArray(ids) || ids.length === 0) throw new Error();
  } catch {
    return callback(null, lib.response(context, event, 400, { error: 'recordIds must be a non-empty JSON array' }));
  }
  ids = [...new Set(ids)];
  const force = event.force === 'true';
  const client = context.getTwilioClient();

  const results = [];
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map((id) =>
      launchOne(context, client, id, force).catch((err) => ({ id, ok: false, reason: err.message }))
    ))));
  }
  return callback(null, lib.response(context, event, 200, { results }));
};
