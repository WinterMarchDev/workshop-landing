"use client";

import { useState } from "react";
import Link from "next/link";

interface PasswordProtectedLinkProps {
  href: string;
  projectName: string;
}

const PROJECT_PASSWORDS: Record<string, string> = {
  "Jeremy Prime": "workshop2025",
  "Front Runner": "workshop2025",
  "PPWR Compliance": "workshop2025",
  "Gamified Invoice Factoring": "WinterMarch"
};

export function PasswordProtectedLink({ href, projectName }: PasswordProtectedLinkProps) {
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PROJECT_PASSWORDS[projectName]) {
      window.location.href = href;
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };
  
  const isProtected = projectName in PROJECT_PASSWORDS;
  
  if (!isProtected) {
    return (
      <Link href={href} className="rounded-xl bg-black px-3 py-1.5 text-sm text-white">
        Open
      </Link>
    );
  }
  
  return (
    <>
      <button
        onClick={() => setShowPasswordPrompt(true)}
        className="rounded-xl bg-black px-3 py-1.5 text-sm text-white"
      >
        Open
      </button>
      
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative rounded-2xl bg-white p-6 shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Password Required</h3>
            <p className="text-sm text-black/70 mb-4">
              This project requires a password to access.
            </p>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  error ? "border-red-500" : "border-black/20"
                }`}
                autoFocus
              />
              {error && (
                <p className="text-red-500 text-xs mt-1">Incorrect password</p>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-black px-3 py-1.5 text-sm text-white"
                >
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setPassword("");
                    setError(false);
                  }}
                  className="flex-1 rounded-xl border border-black/20 bg-white px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}