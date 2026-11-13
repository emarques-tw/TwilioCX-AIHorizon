import { useUID } from '@twilio-paste/core/uid-library';
import { Modal, ModalHeader, ModalHeading, ModalBody } from '@twilio-paste/core/modal';
import { DescriptionList, DescriptionListSet, DescriptionListTerm, DescriptionListDetails } from '@twilio-paste/core/description-list';
import { ContactRecord, F, estadoOf, fmtDate, str } from '../api';
import { StatusBadge } from './StatusBadge';

const DATE_FIELDS: string[] = [F.fechaRegistro, F.fechaEnvio, F.ultimaInteraccion, F.fechaRespuesta];
const ROWS: string[] = [
  F.empresa, F.cargo, F.mail, F.whatsapp, F.pais, F.autoriza, F.asistencia, F.fechaRegistro,
  F.q1, F.q2, F.fechaEnvio, F.ultimaInteraccion, F.fechaRespuesta, F.intentos, F.executionSid, F.optOut, F.error,
];

export function ContactDetail({ record, onClose }: { record: ContactRecord | null; onClose: () => void }) {
  const headingId = useUID();
  return (
    <Modal ariaLabelledby={headingId} isOpen={Boolean(record)} onDismiss={onClose} size="wide">
      <ModalHeader>
        <ModalHeading as="h3" id={headingId}>{record ? str(record.fields[F.nombre]) : ''}</ModalHeading>
      </ModalHeader>
      <ModalBody>
        {record ? (
          <DescriptionList>
            <DescriptionListSet>
              <DescriptionListTerm>Estado envío</DescriptionListTerm>
              <DescriptionListDetails><StatusBadge estado={estadoOf(record)} /></DescriptionListDetails>
            </DescriptionListSet>
            {ROWS.map((k) => {
              const v = record.fields[k];
              const shown = DATE_FIELDS.includes(k) ? fmtDate(v) : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : str(v) || '—';
              return (
                <DescriptionListSet key={k}>
                  <DescriptionListTerm>{k}</DescriptionListTerm>
                  <DescriptionListDetails>{shown}</DescriptionListDetails>
                </DescriptionListSet>
              );
            })}
          </DescriptionList>
        ) : <></>}
      </ModalBody>
    </Modal>
  );
}
