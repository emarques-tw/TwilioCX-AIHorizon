import { Badge } from '@twilio-paste/core/badge';
import type { BadgeProps } from '@twilio-paste/core/badge';

const VARIANT: Record<string, BadgeProps['variant']> = {
  Pendiente: 'neutral',
  Enviando: 'info',
  'En curso': 'new',
  Completado: 'success',
  'Sin respuesta': 'warning',
  Fallido: 'error',
  Excluido: 'default',
};

export function StatusBadge({ estado }: { estado: string }) {
  return <Badge as="span" variant={VARIANT[estado] || 'neutral'}>{estado}</Badge>;
}
