import { useUID } from '@twilio-paste/core/uid-library';
import {
  Modal, ModalHeader, ModalHeading, ModalBody, ModalFooter, ModalFooterActions,
} from '@twilio-paste/core/modal';
import { Button } from '@twilio-paste/core/button';
import { Paragraph } from '@twilio-paste/core/paragraph';
import { Callout, CalloutHeading, CalloutText } from '@twilio-paste/core/callout';
import { ContactRecord, F, eligibility, estadoOf, str } from '../api';

interface Props {
  targets: ContactRecord[] | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (ids: string[], force: boolean) => void;
}

export function LaunchModal({ targets, loading, onClose, onConfirm }: Props) {
  const headingId = useUID();
  const list = targets || [];
  const relaunch = list.filter((r) => eligibility(r).needsForce);

  return (
    <Modal ariaLabelledby={headingId} isOpen={Boolean(targets)} onDismiss={onClose} size="default">
      <ModalHeader>
        <ModalHeading as="h3" id={headingId}>Lanzar Studio Flow</ModalHeading>
      </ModalHeader>
      <ModalBody>
        <Paragraph>
          Se enviará el mensaje inicial de WhatsApp a <strong>{list.length}</strong> contacto(s)
          {list.length === 1 && <> ({str(list[0].fields[F.nombre])})</>}.
        </Paragraph>
        {relaunch.length > 0 && (
          <Callout variant="warning">
            <CalloutHeading as="h4">Relanzamiento</CalloutHeading>
            <CalloutText>
              {relaunch.length} contacto(s) ya recibieron el flujo (
              {relaunch.map((r) => `${str(r.fields[F.nombre])}: ${estadoOf(r)}`).join('; ')}).
              Se les enviará nuevamente.
            </CalloutText>
          </Callout>
        )}
      </ModalBody>
      <ModalFooter>
        <ModalFooterActions>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" loading={loading}
            onClick={() => onConfirm(list.map((r) => r.id), relaunch.length > 0)}>
            Enviar
          </Button>
        </ModalFooterActions>
      </ModalFooter>
    </Modal>
  );
}
