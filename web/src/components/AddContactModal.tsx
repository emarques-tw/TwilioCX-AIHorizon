import { useState } from 'react';
import { useUID } from '@twilio-paste/core/uid-library';
import {
  Modal, ModalHeader, ModalHeading, ModalBody, ModalFooter, ModalFooterActions,
} from '@twilio-paste/core/modal';
import { Button } from '@twilio-paste/core/button';
import { Label } from '@twilio-paste/core/label';
import { Input } from '@twilio-paste/core/input';
import { Select, Option } from '@twilio-paste/core/select';
import { HelpText } from '@twilio-paste/core/help-text';
import { Stack } from '@twilio-paste/core/stack';
import { Box } from '@twilio-paste/core/box';
import { Callout, CalloutText } from '@twilio-paste/core/callout';
import { ContactRecord, F, createContact } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (r: ContactRecord) => void;
  paises: string[];
}

const EMPTY = {
  [F.nombre]: '', [F.empresa]: '', [F.cargo]: '', [F.mail]: '', [F.whatsapp]: '',
  [F.pais]: '', [F.autoriza]: 'Sí', [F.asistencia]: 'Por validar',
};

export function AddContactModal({ isOpen, onClose, onCreated, paises }: Props) {
  const headingId = useUID();
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const close = () => { setForm(EMPTY); setError(undefined); onClose(); };

  const phoneOk = /^\+\d{8,15}$/.test(form[F.whatsapp].replace(/[\s-()]/g, ''));
  const canSave = form[F.nombre].trim() !== '' && phoneOk;

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const rec = await createContact(form);
      setForm(EMPTY);
      onCreated(rec);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const text = (k: string, label: string, opts: { required?: boolean; type?: string; placeholder?: string; help?: string } = {}) => (
    <Box>
      <Label htmlFor={`add-${k}`} required={opts.required}>{label}</Label>
      <Input id={`add-${k}`} type={(opts.type as 'text') || 'text'} value={form[k]} onChange={set(k)}
        placeholder={opts.placeholder} list={k === F.pais ? 'paises' : undefined} />
      {opts.help && <HelpText>{opts.help}</HelpText>}
    </Box>
  );

  return (
    <Modal ariaLabelledby={headingId} isOpen={isOpen} onDismiss={close} size="default">
      <ModalHeader>
        <ModalHeading as="h3" id={headingId}>Agregar contacto</ModalHeading>
      </ModalHeader>
      <ModalBody>
        <form id="add-contact" onSubmit={(e) => { e.preventDefault(); if (canSave) save(); }}>
          <Stack orientation="vertical" spacing="space50">
            {error && <Callout variant="error"><CalloutText>{error}</CalloutText></Callout>}
            {text(F.nombre, 'Nombre y Apellido', { required: true })}
            {text(F.whatsapp, 'WhatsApp', { required: true, type: 'tel', placeholder: '+5491112345678', help: 'Formato internacional, con + y código de país' })}
            {text(F.mail, 'Mail corporativo', { type: 'email' })}
            {text(F.empresa, 'Empresa')}
            {text(F.cargo, 'Cargo')}
            {text(F.pais, 'País')}
            <datalist id="paises">{paises.map((p) => <option key={p} value={p} />)}</datalist>
            <Box>
              <Label htmlFor="add-autoriza">Autoriza datos</Label>
              <Select id="add-autoriza" value={form[F.autoriza]} onChange={set(F.autoriza)}>
                <Option value="Sí">Sí</Option>
                <Option value="No">No</Option>
              </Select>
              <HelpText>Solo se puede lanzar el flujo a contactos que autorizan.</HelpText>
            </Box>
            {text(F.asistencia, 'Estado asistencia')}
          </Stack>
        </form>
      </ModalBody>
      <ModalFooter>
        <ModalFooterActions>
          <Button variant="secondary" onClick={close} disabled={saving}>Cancelar</Button>
          <Button variant="primary" type="submit" form="add-contact" loading={saving} disabled={!canSave}>Guardar</Button>
        </ModalFooterActions>
      </ModalFooter>
    </Modal>
  );
}
