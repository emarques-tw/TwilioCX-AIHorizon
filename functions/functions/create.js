// POST (form) { passcode, fields: JSON string } -> { record }
// Creates a contact in Airtable. Only whitelisted fields are accepted.
const lib = require(Runtime.getFunctions()['lib'].path);

const EDITABLE = [
  'Nombre y Apellido', 'Empresa', 'Cargo', 'Mail corporativo', 'WhatsApp',
  'País', 'Autoriza datos', 'Estado asistencia',
];

// Same text format as the existing rows: "YYYY-MM-DD HH:MM:SS" (UTC)
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

exports.handler = async (context, event, callback) => {
  const respond = (status, body) => callback(null, lib.response(context, event, status, body));
  if (!lib.checkPasscode(context, event)) return respond(401, { error: 'Unauthorized' });

  let input;
  try {
    input = JSON.parse(event.fields || '{}');
  } catch {
    return respond(400, { error: 'fields must be JSON' });
  }

  const fields = {};
  for (const k of EDITABLE) {
    const v = typeof input[k] === 'string' ? input[k].trim() : input[k];
    if (v !== undefined && v !== '') fields[k] = v;
  }
  if (!fields['Nombre y Apellido']) return respond(400, { error: 'Nombre y Apellido es obligatorio' });

  const phone = lib.toE164(fields.WhatsApp, context.DEFAULT_COUNTRY_CODE);
  if (!phone) return respond(400, { error: 'WhatsApp inválido: usá formato internacional, ej. +5491112345678' });
  fields.WhatsApp = phone;

  try {
    const existing = await lib.listRecords(context);
    const dup = existing.find((r) => lib.toE164(r.fields.WhatsApp, context.DEFAULT_COUNTRY_CODE) === phone);
    if (dup) return respond(409, { error: `Ya existe un contacto con ese WhatsApp (${dup.fields['Nombre y Apellido'] || dup.id})` });

    fields['Fecha de registro'] = now();
    fields[lib.F.estado] = lib.STATUS.PENDIENTE;

    const res = await fetch(`https://api.airtable.com/v0/${context.AIRTABLE_BASE_ID}/${encodeURIComponent(context.AIRTABLE_TABLE)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${context.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, typecast: true }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${JSON.stringify(json.error || json)}`);
    return respond(200, { record: { id: json.id, createdTime: json.createdTime, fields: json.fields } });
  } catch (err) {
    console.error(err);
    return respond(500, { error: err.message });
  }
};
