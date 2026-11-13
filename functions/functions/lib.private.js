// Shared helpers: CORS, passcode auth, Airtable REST, phone normalization.

const F = {
  nombre: 'Nombre y Apellido',
  empresa: 'Empresa',
  whatsapp: 'WhatsApp',
  autoriza: 'Autoriza datos',
  estado: 'Estado envío',
  fechaEnvio: 'Fecha envío',
  intentos: 'Intentos',
  executionSid: 'Execution SID',
  ultimaInteraccion: 'Última interacción',
  fechaRespuesta: 'Fecha respuesta',
  error: 'Error',
  optOut: 'Opt-out',
  q1: 'arrancarManana',
  q2: 'arrancarMananaDetail',
};

const STATUS = {
  PENDIENTE: 'Pendiente',
  ENVIANDO: 'Enviando',
  EN_CURSO: 'En curso',
  COMPLETADO: 'Completado',
  SIN_RESPUESTA: 'Sin respuesta',
  FALLIDO: 'Fallido',
  EXCLUIDO: 'Excluido',
};

const ACTIVE = [STATUS.ENVIANDO, STATUS.EN_CURSO];
const RELAUNCHABLE = [STATUS.SIN_RESPUESTA, STATUS.FALLIDO];

// ALLOWED_ORIGIN: comma-separated list, e.g. "https://user.github.io,http://localhost:5173", or "*".
function allowedOrigin(context, event) {
  const allowed = (context.ALLOWED_ORIGIN || '*').split(',').map((o) => o.trim()).filter(Boolean);
  if (allowed.includes('*')) return '*';
  const origin = event && event.request && event.request.headers && event.request.headers.origin;
  return origin && allowed.includes(origin) ? origin : allowed[0];
}

function response(context, event, status, body) {
  const res = new Twilio.Response();
  res.setStatusCode(status);
  res.appendHeader('Access-Control-Allow-Origin', allowedOrigin(context, event));
  res.appendHeader('Vary', 'Origin');
  res.appendHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.appendHeader('Content-Type', 'application/json');
  res.setBody(body);
  return res;
}

// The passcode is sent as a form field, so the browser makes a "simple" CORS
// request and never sends a preflight.
function checkPasscode(context, event) {
  return Boolean(context.APP_PASSCODE) && event.passcode === context.APP_PASSCODE;
}

function airtableUrl(context, suffix = '') {
  const table = encodeURIComponent(context.AIRTABLE_TABLE);
  return `https://api.airtable.com/v0/${context.AIRTABLE_BASE_ID}/${table}${suffix}`;
}

async function airtable(context, method, suffix, body) {
  const res = await fetch(airtableUrl(context, suffix), {
    method,
    headers: {
      Authorization: `Bearer ${context.AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

async function listRecords(context) {
  const records = [];
  let offset;
  do {
    const qs = new URLSearchParams({ pageSize: '100' });
    if (offset) qs.set('offset', offset);
    const page = await airtable(context, 'GET', `?${qs}`);
    records.push(...page.records);
    offset = page.offset;
  } while (offset);
  return records;
}

const getRecord = (context, id) => airtable(context, 'GET', `/${id}`);

const updateRecord = (context, id, fields) =>
  airtable(context, 'PATCH', `/${id}`, { fields, typecast: true });

// Accepts "+54 9 11 1234-5678", "0054...", "whatsapp:+54...".
// Numbers without a country code get DEFAULT_COUNTRY_CODE (e.g. "54") if set.
function toE164(raw, defaultCc) {
  if (!raw) return null;
  let s = String(raw).replace(/^whatsapp:/i, '').trim();
  const hasPlus = s.startsWith('+');
  s = s.replace(/\D/g, '');
  if (!hasPlus) {
    if (s.startsWith('00')) s = s.slice(2);
    else if (defaultCc && !s.startsWith(defaultCc)) s = defaultCc + s.replace(/^0/, '');
  }
  return /^\d{8,15}$/.test(s) ? `+${s}` : null;
}

// "Autoriza datos" may be a checkbox (true) or a text/select ("Sí", "Si", "Yes").
function isAuthorized(value) {
  if (value === true) return true;
  if (typeof value === 'string') return /^(s[ií]|yes|true|1)$/i.test(value.trim());
  return false;
}

module.exports = {
  F, STATUS, ACTIVE, RELAUNCHABLE,
  response, checkPasscode, listRecords, getRecord, updateRecord, toE164, isAuthorized,
};
