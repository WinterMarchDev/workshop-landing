import Link from "next/link";
import { FeedbackPanel } from "./server/feedback";
import { logout } from "./server/auth";

const projects = [
  { slug:"vendor-advance", name:"Vendor Cash Advance Proposal", summary:"Interactive presentation on vendor financing partnership model.", href:"/vendor-advance-slides.html" },
  { slug:"example-1", name:"Example Prototype A", summary:"Small demo to validate UI interactions.", href:"#" },
  { slug:"example-2", name:"Example Prototype B", summary:"Early model for internal logic.", href:"#" },
];

export default async function Home(){
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Welcome to the Workshop</h2>
          <p className="text-black/70">A private space to trial concepts, collect feedback, and iterate quickly.</p>
        </div>
        <form action={logout}><button className="rounded-xl border border-black/20 bg-white/70 px-4 py-2 text-sm">Sign out</button></form>
      </div>

      <section>
        <h3 className="mb-4 text-lg font-semibold">Projects</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(p => (
            <article key={p.slug} className="rounded-2xl border border-black/10 bg-white/70 p-5 backdrop-blur">
              <h4 className="text-base font-semibold">{p.name}</h4>
              <p className="mt-1 text-sm text-black/70">{p.summary}</p>
              <div className="mt-4 flex gap-3">
                <Link href={p.href} className="rounded-xl bg-black px-3 py-1.5 text-sm text-white">Open</Link>
                <FeedbackPanel project={p.name} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}