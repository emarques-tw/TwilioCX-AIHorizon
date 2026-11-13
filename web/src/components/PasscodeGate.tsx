import { useState } from 'react';
import { Box } from '@twilio-paste/core/box';
import { Card } from '@twilio-paste/core/card';
import { Heading } from '@twilio-paste/core/heading';
import { Label } from '@twilio-paste/core/label';
import { Input } from '@twilio-paste/core/input';
import { Button } from '@twilio-paste/core/button';
import { HelpText } from '@twilio-paste/core/help-text';
import { Stack } from '@twilio-paste/core/stack';

export function PasscodeGate({ onSubmit, error }: { onSubmit: (p: string) => void; error?: string }) {
  const [value, setValue] = useState('');
  return (
    <Box display="flex" justifyContent="center" paddingTop="space200">
      <Box width="size40">
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}>
            <Stack orientation="vertical" spacing="space60">
              <Heading as="h1" variant="heading30">WhatsApp Activation Console</Heading>
              <Box>
                <Label htmlFor="passcode" required>Passcode</Label>
                <Input id="passcode" type="password" value={value} onChange={(e) => setValue(e.target.value)}
                  hasError={Boolean(error)} aria-describedby="passcode-help" />
                {error && <HelpText id="passcode-help" variant="error">{error}</HelpText>}
              </Box>
              <Button variant="primary" type="submit" disabled={!value}>Ingresar</Button>
            </Stack>
          </form>
        </Card>
      </Box>
    </Box>
  );
}
