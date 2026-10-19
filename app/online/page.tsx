"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang, t } from "../i18n/useLang";
import type { OnlineWorld } from "../lib/onlineWorlds";

export default function OnlineWorldsPage() {
  const lang = useLang();
  const router = useRouter();
  const [worlds, setWorlds] = useState<OnlineWorld[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState("");

  useEffect(() => {
    fetch("/api/online/worlds")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setWorlds(data.worlds);
      })
      .catch((reason) => setError(reason.message ?? "Unable to load worlds."))
      .finally(() => setLoading(false));
  }, []);

  async function join(worldId: string) {
    setJoining(worldId); setError("");
    const response = await fetch(`/api/online/worlds/${worldId}/join`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) { setError(data.error); setJoining(""); return; }
    router.push(`/online/${worldId}/characters`);
  }

  return <main className="min-h-screen p-5 text-white" style={{ background: "radial-gradient(circle at top, rgb(var(--cyan-rgb)/.12), transparent 40%), var(--bg)" }}>
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-bold tracking-[.28em] text-cyan-300">MY MANDAT // ONLINE</p><h1 className="text-3xl font-black">{t(lang, "Dunia Politik", "Political Worlds")}</h1><p className="mt-2 text-sm text-text-muted">{t(lang, "Pilih dunia (maksimum 100 pemain setiap dunia) sebelum mencipta watak politik anda. Dunia baharu dibuka apabila semuanya penuh.", "Pick a world (up to 100 players each) before creating your political character. A new world opens when all are full.")}</p></div>
      </div>
      {error && <p className="mb-4 border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
      <section className="mb-6 grid gap-3 md:grid-cols-2">
        {loading ? <p className="text-text-muted">{t(lang, "Memuatkan dunia…", "Loading worlds…")}</p> : worlds.length === 0 ? <p className="border border-cyan-900 p-5 text-text-muted">{t(lang, "Tiada dunia tersedia buat masa ini.", "No worlds available right now.")}</p> : worlds.map((world) => { const full = !world.is_member && (world.member_count ?? 0) >= world.capacity; return <article key={world.id} className="border border-cyan-900 bg-slate-950/60 p-4">
          <div className="flex justify-between gap-2"><h2 className="font-bold text-cyan-200">{world.name}</h2><span className="text-[10px] text-gold">{world.lifecycle_status.toUpperCase()}</span></div>
          <p className="my-3 min-h-10 text-sm text-text-muted">{world.description || t(lang, "Dunia politik Malaysia fiksyen.", "A fictional Malaysian political world.")}</p>
          <div className="flex items-center justify-between gap-3 text-xs text-text-muted"><span>{t(lang, `Malaysia · awam · ${world.member_count ?? 0}/${world.capacity} ahli`, `Malaysia · public · ${world.member_count ?? 0}/${world.capacity} members`)}</span><button disabled={joining === world.id || full || world.lifecycle_status !== "open"} onClick={() => world.is_member ? router.push(`/online/${world.id}/characters`) : join(world.id)} className="border border-cyan-500 px-3 py-2 font-bold text-cyan-200 disabled:opacity-40">{joining === world.id ? t(lang, "MENYERTAI…", "JOINING…") : world.is_member ? t(lang, "MASUK", "ENTER") : full ? t(lang, "PENUH", "FULL") : t(lang, "SERTAI", "JOIN")}</button></div>
        </article>; })}
      </section>
    </div>
  </main>;
}
