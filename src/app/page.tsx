"use client";

import { useState, useEffect } from "react";
import LoginForm from "@/components/LoginForm";
import UploadCard from "@/components/UploadCard";
import RecentUploads from "@/components/RecentUploads";

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => setAuthenticated(r.ok))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-400">Laden…</div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginForm onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">MediaHub</h1>
          <p className="text-sm text-gray-400">medien.dyai.cloud</p>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            setAuthenticated(false);
          }}
          className="text-sm text-gray-400 hover:text-white transition"
        >
          Abmelden
        </button>
      </header>

      <UploadCard />
      <RecentUploads />
    </main>
  );
}
