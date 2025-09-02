"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitFeedback } from "./feedback_action";
import { useId, useState } from "react";

function Submit(){
  const { pending } = useFormStatus();
  return <button className="rounded-xl bg-black px-3 py-1.5 text-sm text-white disabled:opacity-60" disabled={pending}>{pending?"Sending…":"Send"}</button>;
}

export function FeedbackPanel({ project }: { project: string }){
  const [open, setOpen] = useState(false);
  const id = useId();
  const [state, formAction] = useActionState(submitFeedback, { ok:false, message:"", project });
  return (
    <>
      <button onClick={()=>setOpen(true)} className="rounded-xl border border-black/20 bg-white/70 px-3 py-1.5 text-sm">Feedback</button>
      {open && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={()=>setOpen(false)}>
          <form action={async (fd)=>{ await formAction(fd); }} onClick={e=>e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl border border-black/10 bg-white p-5">
            <h5 className="text-base font-semibold">Feedback — {project}</h5>
            {state.ok && (<p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>)}
            {!state.ok && state.message && (<p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>)}
            <input type="hidden" name="project" value={project} />
            <div className="space-y-1">
              <label htmlFor={`${id}-email`} className="text-sm">Email (optional)</label>
              <input id={`${id}-email`} name="email" type="email" className="w-full rounded-xl border border-black/20 bg-white px-3 py-2" placeholder="you@example.com" />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-msg`} className="text-sm">Message</label>
              <textarea id={`${id}-msg`} name="message" required rows={5} className="w-full rounded-xl border border-black/20 bg-white px-3 py-2" placeholder="What worked? What broke? What confused you?" />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" className="rounded-xl border border-black/20 bg-white px-3 py-1.5 text-sm" onClick={()=>setOpen(false)}>Close</button>
              <Submit />
            </div>
          </form>
        </div>
      )}
    </>
  );
}