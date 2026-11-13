import { Table, THead, TBody, Tr, Th, Td } from '@twilio-paste/core/table';
import { Checkbox } from '@twilio-paste/core/checkbox';
import { Button } from '@twilio-paste/core/button';
import { Text } from '@twilio-paste/core/text';
import { Tooltip } from '@twilio-paste/core/tooltip';
import { ScreenReaderOnly } from '@twilio-paste/core/screen-reader-only';
import { ContactRecord, F, eligibility, estadoOf, fmtDate, str } from '../api';
import { StatusBadge } from './StatusBadge';

interface Props {
  records: ContactRecord[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onOpen: (r: ContactRecord) => void;
  onLaunchOne: (r: ContactRecord) => void;
}

export function ContactsTable({ records, selected, onToggle, onToggleAll, onOpen, onLaunchOne }: Props) {
  const selectable = records.filter((r) => eligibility(r).canLaunch).map((r) => r.id);
  const allChecked = selectable.length > 0 && selectable.every((id) => selected.has(id));
  const someChecked = selectable.some((id) => selected.has(id));

  return (
    <Table scrollHorizontally striped>
      <THead stickyHeader top={0}>
        <Tr>
          <Th width="size5">
            <Checkbox id="select-all" checked={allChecked} indeterminate={!allChecked && someChecked}
              onChange={(e) => onToggleAll(selectable, e.target.checked)}>
              <ScreenReaderOnly>Seleccionar todos</ScreenReaderOnly>
            </Checkbox>
          </Th>
          <Th>Nombre</Th>
          <Th>Empresa / Cargo</Th>
          <Th>WhatsApp</Th>
          <Th>País</Th>
          <Th>Estado envío</Th>
          <Th>arrancarManana</Th>
          <Th>arrancarMananaDetail</Th>
          <Th>Fecha envío</Th>
          <Th textAlign="right">Acciones</Th>
        </Tr>
      </THead>
      <TBody>
        {records.length === 0 && (
          <Tr><Td colSpan={10}><Text as="span" color="colorTextWeak">Sin registros</Text></Td></Tr>
        )}
        {records.map((r) => {
          const el = eligibility(r);
          const f = r.fields;
          return (
            <Tr key={r.id}>
              <Td>
                <Checkbox id={`sel-${r.id}`} checked={selected.has(r.id)} disabled={!el.canLaunch}
                  onChange={() => onToggle(r.id)}>
                  <ScreenReaderOnly>Seleccionar {str(f[F.nombre])}</ScreenReaderOnly>
                </Checkbox>
              </Td>
              <Td>
                <Button variant="link" onClick={() => onOpen(r)}>{str(f[F.nombre]) || '(sin nombre)'}</Button>
                <Text as="div" fontSize="fontSize20" color="colorTextWeak">{str(f[F.mail])}</Text>
              </Td>
              <Td>
                <Text as="div">{str(f[F.empresa])}</Text>
                <Text as="div" fontSize="fontSize20" color="colorTextWeak">{str(f[F.cargo])}</Text>
              </Td>
              <Td>{str(f[F.whatsapp])}</Td>
              <Td>{str(f[F.pais])}</Td>
              <Td><StatusBadge estado={estadoOf(r)} /></Td>
              <Td>{str(f[F.q1]) || '—'}</Td>
              <Td>{str(f[F.q2]) || '—'}</Td>
              <Td>{fmtDate(f[F.fechaEnvio])}</Td>
              <Td textAlign="right">
                {el.canLaunch ? (
                  <Button variant="secondary" size="small" onClick={() => onLaunchOne(r)}>
                    {el.needsForce ? 'Relanzar' : 'Lanzar'}
                  </Button>
                ) : (
                  <Tooltip text={el.reason || ''}>
                    <Button variant="secondary" size="small" disabled>Lanzar</Button>
                  </Tooltip>
                )}
              </Td>
            </Tr>
          );
        })}
      </TBody>
    </Table>
  );
}
