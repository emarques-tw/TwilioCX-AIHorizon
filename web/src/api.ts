// All calls are form-encoded POSTs ("simple" CORS requests, so no preflight).
const BASE = import.meta.env.VITE_API_BASE as string;
const KEY = 'activation-passcode';

export const F = {
  fechaRegistro: 'Fecha de registro',
  empresa: 'Empresa',
  nombre: 'Nombre y Apellido',
  cargo: 'Cargo',
  mail: 'Mail corporativo',
  whatsapp: 'WhatsApp',
  pais: 'País',
  autoriza: 'Autoriza datos',
  asistencia: 'Estado asistencia',
  q1: 'arrancarManana',
  q2: 'arrancarMananaDetail',
  estado: 'Estado envío',
  fechaEnvio: 'Fecha envío',
  intentos: 'Intentos',
  executionSid: 'Execution SID',
  ultimaInteraccion: 'Última interacción',
  fechaRespuesta: 'Fecha respuesta',
  error: 'Error',
  optOut: 'Opt-out',
} as const;

export type Fields = Record<string, unknown>;
export interface ContactRecord { id: string; createdTime: string; fields: Fields }
export interface LaunchResult { id: string; ok: boolean; skipped?: boolean; reason?: string; executionSid?: string }

export class UnauthorizedError extends Error {}

export const getPasscode = () => sessionStorage.getItem(KEY) || '';
export const setPasscode = (p: string) => sessionStorage.setItem(KEY, p);
export const clearPasscode = () => sessionStorage.removeItem(KEY);

async function post<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!BASE) throw new Error('VITE_API_BASE no está configurado');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ passcode: getPasscode(), ...params }),
  });
  if (res.status === 401) throw new UnauthorizedError('Passcode inválido');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as T;
}

export const fetchContacts = () =>
  post<{ records: ContactRecord[] }>('/contacts').then((r) => r.records);

export const launchFlow = (recordIds: string[], force = false) =>
  post<{ results: LaunchResult[] }>('/launch', {
    recordIds: JSON.stringify(recordIds),
    force: String(force),
  }).then((r) => r.results);

export const createContact = (fields: Record<string, string>) =>
  post<{ record: ContactRecord }>('/create', { fields: JSON.stringify(fields) }).then((r) => r.record);

// Shared eligibility logic (the server enforces the same rules).
export const ACTIVE = ['Enviando', 'En curso'];
export const RELAUNCHABLE = ['Sin respuesta', 'Fallido'];

export const str = (v: unknown) => (v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v));
export const estadoOf = (r: ContactRecord) => str(r.fields[F.estado]) || 'Pendiente';

export function isAuthorized(v: unknown) {
  if (v === true) return true;
  return typeof v === 'string' && /^(s[ií]|yes|true|1)$/i.test(v.trim());
}

export function eligibility(r: ContactRecord): { canLaunch: boolean; needsForce: boolean; reason?: string } {
  const estado = estadoOf(r);
  if (!isAuthorized(r.fields[F.autoriza])) return { canLaunch: false, needsForce: false, reason: 'No autoriza datos' };
  if (r.fields[F.optOut]) return { canLaunch: false, needsForce: false, reason: 'Opt-out' };
  if (!str(r.fields[F.whatsapp])) return { canLaunch: false, needsForce: false, reason: 'Sin WhatsApp' };
  if (ACTIVE.includes(estado)) return { canLaunch: false, needsForce: false, reason: 'Flujo activo' };
  if (estado === 'Completado' || RELAUNCHABLE.includes(estado)) return { canLaunch: true, needsForce: true };
  return { canLaunch: true, needsForce: false };
}

export const fmtDate = (v: unknown) => {
  const s = str(v);
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString();
};
