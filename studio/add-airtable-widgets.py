#!/usr/bin/env python3
"""Adds Airtable write-back (Run Function -> /callback) widgets to the existing
Twilio CX & AI Horizon Studio flow.

Usage:
  python3 -I add-airtable-widgets.py <flow.json from `twilio api:studio:v2:flows:fetch -o json`> \
      <service_sid> <environment_sid> <function_sid> <callback_url>  > new-definition.json

The script is idempotent: running it again replaces the widgets it added before.
"""
import json
import sys

src, service_sid, env_sid, fn_sid, url = sys.argv[1:6]
data = json.load(open(src))
flow = data[0] if isinstance(data, list) else data
definition = flow.get('definition', flow)
states = definition['states']

PREFIX = 'at_'  # all widgets added by this script start with this
states[:] = [s for s in states if not s['name'].startswith(PREFIX)]
by_name = {s['name']: s for s in states}

INICIO = 'twilio_cx_ai_horizon_00_inicio'
Q1 = 'twilio_cx_ai_horizon_01_arrancar_tu_manana'
DETAILS = ['twilio_cx_ai_horizon_02_cafe', 'twilio_cx_ai_horizon_03_aromatica', 'twilio_cx_ai_horizon_04_proteina']
LISTO = 'twilio_cx_ai_horizon_05_listo'
for n in [INICIO, Q1, *DETAILS, LISTO, 'Trigger', 'decision']:
    assert n in by_name, f'widget {n} not found in flow'


def offset(name, dx=0, dy=0):
    o = by_name[name]['properties'].get('offset', {'x': 0, 'y': 0})
    return {'x': o['x'] + dx, 'y': o['y'] + dy}


def run_fn(name, step, next_state, pos, extra=None):
    params = [
        {'key': 'recordId', 'value': '{{flow.data.recordId}}'},
        {'key': 'step', 'value': step},
    ] + (extra or [])
    return {
        'name': name,
        'type': 'run-function',
        # Continue the conversation even if the Airtable write fails.
        'transitions': [{'event': 'success', 'next': next_state}, {'event': 'fail', 'next': next_state}],
        'properties': {
            'service_sid': service_sid, 'environment_sid': env_sid, 'function_sid': fn_sid,
            'url': url, 'parameters': params, 'offset': pos,
        },
    }


def set_next(state_name, event, new_next):
    for t in by_name[state_name]['transitions']:
        if t['event'] == event:
            old = t.get('next')
            t['next'] = new_next
            return old
    raise KeyError(f'{state_name}.{event}')


new = []

# 1. Only the console (REST API) can start the flow: Trigger -> at_started -> inicio.
#    Incoming messages no longer start a new execution. Replies to an active
#    execution still reach it, because Studio routes those before the trigger.
set_next('Trigger', 'incomingRequest', 'at_started')
set_next('Trigger', 'incomingMessage', None)
new.append(run_fn('at_started', 'started', INICIO, offset('Trigger', 400, 0)))

# 2. Q1 answer -> at_save_q1 -> decision
set_next(Q1, 'incomingMessage', 'at_save_q1')
new.append(run_fn('at_save_q1', 'q1', 'decision', offset(Q1, 400, 100),
                  [{'key': 'answer', 'value': '{{widgets.%s.inbound.Body}}' % Q1}]))

# 3. Detail answer (whichever branch ran; the others are empty) -> at_save_q2 -> listo
detail_body = ''.join('{{widgets.%s.inbound.Body}}' % d for d in DETAILS)
for d in DETAILS:
    set_next(d, 'incomingMessage', 'at_save_q2')
new.append(run_fn('at_save_q2', 'q2', LISTO, offset(LISTO, 0, -200),
                  [{'key': 'answer', 'value': detail_body}]))

# 4. Timeouts / delivery failures on every wait widget -> status in Airtable
for s in [INICIO, Q1, *DETAILS]:
    set_next(s, 'timeout', 'at_timeout')
    set_next(s, 'deliveryFailure', 'at_failed')
new.append(run_fn('at_timeout', 'timeout', None, offset(INICIO, -500, 300)))
new.append(run_fn('at_failed', 'failed', None, offset(INICIO, -900, 300),
                  [{'key': 'error', 'value': 'Delivery failure'}]))

# Run-function widgets with no next: drop the "next" key entirely
for w in new:
    for t in w['transitions']:
        if t['next'] is None:
            del t['next']
for s in states:
    for t in s['transitions']:
        if 'next' in t and t['next'] is None:
            del t['next']

states.extend(new)
json.dump(definition, sys.stdout, ensure_ascii=False, indent=2)
