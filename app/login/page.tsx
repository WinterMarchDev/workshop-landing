"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { login } from "../server/auth";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="rounded-xl bg-black px-5 py-2.5 text-white disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(login, { ok: false, error: "" });
  const sp = useSearchParams();
  const next = sp.get("next") || "/";

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-2 text-2xl font-semibold tracking-tight">Private access</h2>
      <p className="mb-8 text-sm text-black/70">Enter your credentials to proceed.</p>
      <form action={formAction} className="space-y-4 rounded-2xl border border-black/10 bg-white/60 p-6 backdrop-blur">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium">Username</label>
          <input id="username" name="username" autoComplete="username" required className="w-full rounded-xl border border-black/20 bg-white/80 px-3 py-2" placeholder="Username" />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full rounded-xl border border-black/20 bg-white/80 px-3 py-2" placeholder="Password" />
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <SubmitBtn />
      </form>
      <p className="mt-6 text-xs text-black/60">Problems? Contact the owner.</p>
    </div>
  );
}