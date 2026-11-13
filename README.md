# WhatsApp Activation Console

A React + Twilio Paste UI (hosted on GitHub Pages) that lists contacts from Airtable and starts a Twilio Studio WhatsApp flow for the ones you select. The answers are written back to Airtable.

```
GitHub Pages (web/) ──passcode──▶ Twilio Functions (functions/) ──▶ Airtable REST
                                          └─▶ Studio Executions API
Studio Flow (existing, + at_* widgets) ──Run Function──▶ /callback ──▶ Airtable
```

The secrets (Airtable token, Twilio credentials) live only in Twilio Functions.

## 1. Airtable

Keep the existing fields and add these:

| Field | Type |
|---|---|
| Estado envío | Single select: Pendiente, Enviando, En curso, Completado, Sin respuesta, Fallido, Excluido |
| Fecha envío | Date (with time) |
| Intentos | Number |
| Execution SID | Single line text |
| Última interacción | Date (with time) |
| Fecha respuesta | Date (with time) |
| Error | Long text |
| Opt-out | Checkbox |

`arrancarManana` and `arrancarMananaDetail` receive the answers to Q1 and Q2. `Autoriza datos` can be either a checkbox or text ("Sí"/"Si"/"Yes"). `WhatsApp` must include the country code; otherwise set `DEFAULT_COUNTRY_CODE`.

Create a Personal Access Token with the scopes `data.records:read` and `data.records:write`, limited to this base.

## 2. Twilio Functions

```bash
cd functions
cp .env.example .env     # fill in values
npm install
twilio serverless:deploy --service-name activation-console --runtime node22
```

Deployed at `https://activation-console-6248-dev.twil.io`. The endpoints are:
- `POST /contacts`: lists the records (requires the passcode).
- `POST /launch`: starts the flow for `recordIds` (requires the passcode). It skips anyone who hasn't authorized data use, has opted out, already has an active flow, or needs relaunch confirmation.
- `/callback`: **protected**; only Studio can call it, because Twilio validates the request signature.

## 3. Studio Flow

This uses your existing flow (`FW0388c149d03a6246acb026ae8ff2b120`, "Twilio CX & AI Horizon"). [studio/add-airtable-widgets.py](studio/add-airtable-widgets.py) adds five Run Function widgets that call `/callback`, and leaves your widgets and templates unchanged:

| Widget | Placed | Writes |
|---|---|---|
| `at_started` | Trigger → `00_inicio` | Estado envío = En curso |
| `at_save_q1` | `01_arrancar_tu_manana` → `decision` | `arrancarManana` (STOP/BAJA → Opt-out, Excluido) |
| `at_save_q2` | `02_cafe` / `03_aromatica` / `04_proteina` → `05_listo` | `arrancarMananaDetail`, Completado |
| `at_timeout` | timeout of every wait widget | Sin respuesta |
| `at_failed` | deliveryFailure of every wait widget | Fallido |

The flow can only be started from the console (REST trigger, which passes `recordId`). Incoming messages do not start new executions; replies to an active execution still reach it.

To re-apply after editing the flow in the canvas (the script is idempotent and replaces its own `at_*` widgets):

```bash
twilio api:studio:v2:flows:fetch --sid FW0388c149d03a6246acb026ae8ff2b120 -o json > /tmp/flow.json
python3 -I studio/add-airtable-widgets.py /tmp/flow.json \
  ZSadb340918695423a5454413ac910e925 ZEe5f2fda013b9a2187e47d26b7f162c0f \
  ZH77a893a3a89db274b0f5c6cd3e718789 https://activation-console-6248-dev.twil.io/callback > /tmp/new.json
twilio api:studio:v2:flows:update --sid FW0388c149d03a6246acb026ae8ff2b120 \
  --status published --definition "$(cat /tmp/new.json)"
```

The SIDs are for the deployed `activation-console` service (dev). If you redeploy to a new service, update them. The previous flow (revision 170) is saved in `studio/backup-flow-before-airtable.json`.

## 4. Web (GitHub Pages)

Local:
```bash
cd web
cp .env.example .env.local   # VITE_API_BASE=https://activation-console-6248-dev.twil.io
npm install && npm run dev
```
For local testing, set `ALLOWED_ORIGIN=*` or `http://localhost:5173` in the Functions and redeploy.

Deploy:
1. Push the repo to GitHub on the `main` branch.
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Secrets and variables → Actions → **Variables** → add `VITE_API_BASE`.
4. Set `ALLOWED_ORIGIN=https://<user>.github.io` in the Functions and redeploy.

## Status lifecycle

`Pendiente → Enviando (launch) → En curso (flow started / Q1 answered) → Completado (Q2 answered)`

The other states are: `Sin respuesta` (timeout), `Fallido` (invalid number or delivery/API error, with details in `Error`), and `Excluido` (opt-out). Records that are *Sin respuesta*, *Fallido* or *Completado* can be relaunched, after a confirmation step.

## Security notes
- The passcode is a shared secret. Anyone who has it can send messages, so rotate `APP_PASSCODE` when needed.
- Data is only sent to contacts with `Autoriza datos`. Follow WhatsApp's opt-in policies.
