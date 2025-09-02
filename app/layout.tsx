import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workshop",
  description: "Private beta projects and experiments",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-wmBg text-wmText antialiased">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <header className="flex items-center justify-between border-b border-black/10 pb-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-black/80" />
              <h1 className="text-xl font-semibold tracking-tight">Workshop</h1>
            </div>
            <p className="text-sm/6 text-black/60">Private beta access</p>
          </header>
          <main className="py-10">{children}</main>
          <footer className="mt-16 border-t border-black/10 pt-6 text-center text-xs text-black/50">
            © {new Date().getFullYear()} Jeremy Jones — All rights reserved.
          </footer>
        </div>
      </body>
    </html>
  );
}