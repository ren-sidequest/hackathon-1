import React, { useState } from 'react';
import { Dialog } from '../api-ui';
import { baseBinding } from './client';
import type { Api4Controller } from './controller';
import type { Demo, RestartRequest } from '../api4-types';

export function RehearsalControls({ data, controller, close, done }: { data: Demo; controller: Api4Controller; close: () => void; done: () => void }) {
  const [checkpoint, setCheckpoint] = useState<'before_task' | 'ready_for_v1'>('ready_for_v1');
  const [confirmed, setConfirmed] = useState(false);
  const disabled = controller.busy || controller.analysisBusy || !!controller.pending || !!controller.analysisPending || !controller.fresh || data.analysis.status === 'running';
  const restart = async () => {
    if (disabled || !confirmed) return;
    const body: RestartRequest = { ...baseBinding(data), taskId: data.task.taskId, expectedRevision: data.revision, checkpoint };
    if (await controller.write('/rehearsal/restart', body)) done();
  };
  return <Dialog title={`Reset demo · ${data.candidate.name}`} close={close}><div className="rehearsal-controls">
    <p>Restart this shared synthetic candidate only. This affects everyone viewing {data.candidate.name}. Other candidates are unchanged.</p>
    <p>The current task, submissions, reviews, scores and retention decisions will be archived on the server, then replaced with the original application baseline. Old local drafts remain stored separately and will not load into the new task. Unsaved HR edits will be discarded.</p>
    <fieldset><legend>Start point</legend>
      <label className="eb-field"><span><input type="radio" name="checkpoint" checked={checkpoint === 'ready_for_v1'} onChange={() => setCheckpoint('ready_for_v1')}/> Ready for Candidate V1 (recommended)</span><small>A synthetic Business Problem Solving task is already sent. Start V1, then load the demo examples.</small></label>
      <label className="eb-field"><span><input type="radio" name="checkpoint" checked={checkpoint === 'before_task'} onChange={() => setCheckpoint('before_task')}/> Before HR sends a task</span><small>Use this to practise selecting the B3 gap and publishing a task.</small></label>
    </fieldset>
    <label className="eb-field"><span><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/> I understand this restarts the shared case for {data.candidate.name}.</span></label>
    {disabled && <p role="status">Wait for pending actions or analysis to finish, then refresh before resetting.</p>}
    {controller.error && <p role="alert">{controller.error.message}</p>}
    <div className="eb-actions"><button className="eb-action" disabled={controller.busy} onClick={close}>Cancel</button><button className="eb-action primary" disabled={disabled || !confirmed} onClick={() => void restart()}>{controller.busy ? 'Restarting…' : 'Archive and restart demo'}</button></div>
  </div></Dialog>;
}
