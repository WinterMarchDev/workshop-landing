import { FeedbackPanel } from "./server/feedback";
import { logout } from "./server/auth";
import { PasswordProtectedLink } from "./components/PasswordProtectedLink";

const projects = [
  { slug:"vendor-advance", name:"Gamified Invoice Factoring", summary:"Interactive presentation on vendor financing partnership model.", href:"/slides/vendor-advance" },
  { slug:"example-1", name:"Jeremy Prime", summary:"Our 5-step method to digitally clone yourself for autonomous petty task completion.", href:"#" },
  { slug:"example-2", name:"Front Runner", summary:"Sub-mm Lidar + MTurk + HL VTOL = 92% accurate crop yield data ~120 days in advance.", href:"#" },
  { slug:"ppwr-compliance", name:"PPWR Compliance", summary:"Advanced AI guided material science models you can use to achieve compliance for your pack type.", href:"#" },
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
                <PasswordProtectedLink href={p.href} projectName={p.name} />
                <FeedbackPanel project={p.name} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}