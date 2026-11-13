import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box } from '@twilio-paste/core/box';
import { Heading } from '@twilio-paste/core/heading';
import { Button } from '@twilio-paste/core/button';
import { Stack } from '@twilio-paste/core/stack';
import { Input } from '@twilio-paste/core/input';
import { Select, Option } from '@twilio-paste/core/select';
import { Label } from '@twilio-paste/core/label';
import { Spinner } from '@twilio-paste/core/spinner';
import { Text } from '@twilio-paste/core/text';
import { Toaster, useToaster } from '@twilio-paste/core/toast';
import { RefreshIcon } from '@twilio-paste/icons/esm/RefreshIcon';
import { SendIcon } from '@twilio-paste/icons/esm/SendIcon';
import {
  ACTIVE, ContactRecord, F, UnauthorizedError, clearPasscode, eligibility, estadoOf,
  fetchContacts, getPasscode, launchFlow, setPasscode, str,
} from './api';
import { PasscodeGate } from './components/PasscodeGate';
import { ContactsTable } from './components/ContactsTable';
import { LaunchModal } from './components/LaunchModal';
import { ContactDetail } from './components/ContactDetail';
import { AddContactModal } from './components/AddContactModal';
import { PlusIcon } from '@twilio-paste/icons/esm/PlusIcon';

const ESTADOS = ['Pendiente', 'Enviando', 'En curso', 'Completado', 'Sin respuesta', 'Fallido', 'Excluido'];

export function App() {
  const toaster = useToaster();
  const [authed, setAuthed] = useState(Boolean(getPasscode()));
  const [authError, setAuthError] = useState<string>();
  const [records, setRecords] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [launchTargets, setLaunchTargets] = useState<ContactRecord[] | null>(null);
  const [launching, setLaunching] = useState(false);
  const [detail, setDetail] = useState<ContactRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [paisFilter, setPaisFilter] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const recs = await fetchContacts();
      setRecords(recs);
      setAuthed(true);
      setAuthError(undefined);
      // Drop selections that are no longer eligible
      setSelected((prev) => new Set([...prev].filter((id) => {
        const r = recs.find((x) => x.id === id);
        return r && eligibility(r).canLaunch;
      })));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearPasscode();
        setAuthed(false);
        setAuthError('Passcode inválido');
      } else if (!silent) {
        toaster.push({ message: `Error al cargar: ${(err as Error).message}`, variant: 'error' });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toaster]);

  useEffect(() => { if (authed) load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh while there are flows in progress
  const hasActive = records.some((r) => ACTIVE.includes(estadoOf(r)));
  useEffect(() => {
    if (!authed || !hasActive) return;
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [authed, hasActive, load]);

  const paises = useMemo(
    () => [...new Set(records.map((r) => str(r.fields[F.pais])).filter(Boolean))].sort(),
    [records]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (estadoFilter && estadoOf(r) !== estadoFilter) return false;
      if (paisFilter && str(r.fields[F.pais]) !== paisFilter) return false;
      if (!q) return true;
      return [F.nombre, F.empresa, F.mail, F.whatsapp, F.cargo].some((k) => str(r.fields[k]).toLowerCase().includes(q));
    });
  }, [records, search, estadoFilter, paisFilter]);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = (ids: string[], checked: boolean) => setSelected((prev) => {
    const next = new Set(prev);
    ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
    return next;
  });

  const confirmLaunch = async (ids: string[], force: boolean) => {
    setLaunching(true);
    try {
      const results = await launchFlow(ids, force);
      const ok = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      if (ok) toaster.push({ message: `Flujo lanzado para ${ok} contacto(s)`, variant: 'success', dismissAfter: 5000 });
      if (failed.length) {
        const names = failed.map((f) => {
          const rec = records.find((r) => r.id === f.id);
          return `${rec ? str(rec.fields[F.nombre]) : f.id}: ${f.reason}`;
        });
        toaster.push({ message: `No enviados (${failed.length}): ${names.join(' · ')}`, variant: 'warning' });
      }
      setSelected(new Set());
      setLaunchTargets(null);
      await load(true);
    } catch (err) {
      if (err instanceof UnauthorizedError) { setAuthed(false); setAuthError('Sesión expirada'); }
      toaster.push({ message: `Error: ${(err as Error).message}`, variant: 'error' });
    } finally {
      setLaunching(false);
    }
  };

  if (!authed) {
    return (
      <PasscodeGate error={authError} onSubmit={(p) => { setPasscode(p); load(); }} />
    );
  }

  const selectedRecords = records.filter((r) => selected.has(r.id));
  const counts = ESTADOS.map((e) => [e, records.filter((r) => estadoOf(r) === e).length] as const).filter(([, n]) => n);

  return (
    <Box padding="space80">
      <Toaster {...toaster} />
      <Stack orientation="vertical" spacing="space60">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Heading as="h1" variant="heading20" marginBottom="space0">WhatsApp Activation Console</Heading>
          <Stack orientation="horizontal" spacing="space40">
            <Button variant="secondary" onClick={() => setAdding(true)}>
              <PlusIcon decorative /> Agregar contacto
            </Button>
            <Button variant="secondary" onClick={() => load()} loading={loading}>
              <RefreshIcon decorative /> Actualizar
            </Button>
            <Button variant="primary" disabled={selected.size === 0}
              onClick={() => setLaunchTargets(selectedRecords)}>
              <SendIcon decorative /> Lanzar para {selected.size} seleccionado(s)
            </Button>
            <Button variant="link" onClick={() => { clearPasscode(); setAuthed(false); }}>Salir</Button>
          </Stack>
        </Box>

        <Text as="p" color="colorTextWeak">
          {records.length} contactos · {counts.map(([e, n]) => `${e}: ${n}`).join(' · ')}
          {hasActive && ' · actualizando cada 15s'}
        </Text>

        <Box display="flex" columnGap="space60" alignItems="flex-end" flexWrap="wrap">
          <Box minWidth="size30">
            <Label htmlFor="search">Buscar</Label>
            <Input id="search" type="search" placeholder="Nombre, empresa, mail, teléfono"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </Box>
          <Box minWidth="size20">
            <Label htmlFor="estado">Estado envío</Label>
            <Select id="estado" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
              <Option value="">Todos</Option>
              {ESTADOS.map((e) => <Option key={e} value={e}>{e}</Option>)}
            </Select>
          </Box>
          <Box minWidth="size20">
            <Label htmlFor="pais">País</Label>
            <Select id="pais" value={paisFilter} onChange={(e) => setPaisFilter(e.target.value)}>
              <Option value="">Todos</Option>
              {paises.map((p) => <Option key={p} value={p}>{p}</Option>)}
            </Select>
          </Box>
        </Box>

        {loading && records.length === 0 ? (
          <Box display="flex" justifyContent="center" padding="space100">
            <Spinner decorative={false} title="Cargando" size="sizeIcon70" />
          </Box>
        ) : (
          <ContactsTable records={filtered} selected={selected} onToggle={toggle} onToggleAll={toggleAll}
            onOpen={setDetail} onLaunchOne={(r) => setLaunchTargets([r])} />
        )}
      </Stack>

      <LaunchModal targets={launchTargets} loading={launching}
        onClose={() => setLaunchTargets(null)} onConfirm={confirmLaunch} />
      <ContactDetail record={detail} onClose={() => setDetail(null)} />
      <AddContactModal isOpen={adding} paises={paises} onClose={() => setAdding(false)}
        onCreated={(rec) => {
          setAdding(false);
          setRecords((prev) => [...prev, rec]);
          toaster.push({ message: `Contacto agregado: ${str(rec.fields[F.nombre])}`, variant: 'success', dismissAfter: 4000 });
        }} />
    </Box>
  );
}
