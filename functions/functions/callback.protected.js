// Called by the Studio "Run Function" widget. Protected: Twilio validates the
// request signature, so only your own account (Studio) can call it.
//
// Params: recordId, step (started|q1|q2|timeout|failed), answer?, error?
// recordId comes from the console launch (REST trigger -> flow.data.recordId).
const lib = require(Runtime.getFunctions()['lib'].path);
const { F, STATUS } = lib;

const OPT_OUT = /^\s*(stop|baja|unsubscribe|cancelar)\s*$/i;

exports.handler = async (context, event, callback) => {
  const { recordId, step } = event;
  const answer = (event.answer || '').trim();
  if (!recordId || !step) return callback(null, { ok: false, error: 'recordId and step required' });

  const now = new Date().toISOString();
  const fields = { [F.ultimaInteraccion]: now };
  let optOut = false;

  if ((step === 'q1' || step === 'q2') && OPT_OUT.test(answer)) {
    optOut = true;
    Object.assign(fields, { [F.optOut]: true, [F.estado]: STATUS.EXCLUIDO });
  } else {
    switch (step) {
      case 'started':
        fields[F.estado] = STATUS.EN_CURSO;
        break;
      case 'q1':
        fields[F.estado] = STATUS.EN_CURSO;
        fields[F.q1] = answer;
        break;
      case 'q2':
        fields[F.q2] = answer;
        fields[F.estado] = STATUS.COMPLETADO;
        fields[F.fechaRespuesta] = now;
        break;
      case 'timeout':
        fields[F.estado] = STATUS.SIN_RESPUESTA;
        break;
      case 'failed':
        fields[F.estado] = STATUS.FALLIDO;
        fields[F.error] = event.error || 'Fallo de entrega en Studio';
        break;
      default:
        return callback(null, { ok: false, error: `Unknown step ${step}` });
    }
  }

  try {
    await lib.updateRecord(context, recordId, fields);
    return callback(null, { ok: true, optOut });
  } catch (err) {
    console.error(err);
    // Return 200 so the flow keeps going; the error is in the Function logs.
    return callback(null, { ok: false, optOut, error: err.message });
  }
};
