"use client";

// Multiplayer city hub: the 3D city for one online world, with every
// player who is in the hub right now walking around as an avatar with a
// name tag. Tap a road to walk there. Political actions stay on the
// server-validated world office page (/play).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang, t } from "../../../i18n/useLang";
import { DEFAULT_TRAITS, makeDemoZones, kawasanDevelopedCount, kawasanGridSize } from "../../../kawasan-3d/cityData";
import type { OnlineCharacter, OnlineWorld } from "../../../lib/onlineWorlds";
import { restoreOnlineSession, useOnlineSessionStore } from "../../../store/onlineSessionStore";
import { buildRoadGrid, roadPath, spawnPoint, type Vec2 } from "../../lib/hubRoads";
import { useWorldPresence, type HubIdentity, type HubPeer, type MoveOrder } from "../../lib/useWorldPresence";

const City3DMapGL = dynamic(() => import("../../../kawasan-3d/City3DMapGL"), { ssr: false, loading: () => <CityLoading /> });
const HubAvatars = dynamic(() => import("../../components/HubAvatars"), { ssr: false });

// Every player in every world sees the same city, so the layout is fixed rather than per-save.
const HUB_DENSITY = 0.45;
const HUB_GRID = kawasanGridSize(HUB_DENSITY);
const HUB_SEED = "mymandat-online-hub-v1";
const HUB_CAMERA_DISTANCE = 820;
// Closer to top-down than the solo default (57°) so towers hide fewer avatars.
const HUB_CAMERA_PITCH = 44;

function CityLoading() {
  return <div className="grid h-full place-items-center text-xs tracking-[.2em] text-cyan">LOADING CITY…</div>;
}

export default function HubPage() {
  return <Suspense fallback={<main className="min-h-screen" style={{ background: "var(--bg)" }} />}><Hub /></Suspense>;
}

function Hub() {
  const { worldId } = useParams<{ worldId: string }>();
  const router = useRouter();
  const lang = useLang();
  const search = useSearchParams();
  // Local-only preview with simulated players, for developing the hub without a Supabase project.
  const devPreview = process.env.NODE_ENV !== "production" && search.get("preview") === "1";
  const devBots = devPreview ? Math.min(60, Number(search.get("bots") ?? 8) || 0) : 0;

  const [world, setWorld] = useState<OnlineWorld | null>(null);
  const [me, setMe] = useState<HubIdentity | null>(null);
  const [error, setError] = useState("");
  const [showRoster, setShowRoster] = useState(false);

  useEffect(() => { restoreOnlineSession(); }, []);
  useEffect(() => {
    if (devPreview) {
      setWorld({ id: worldId, name: "Malaysia 1" } as OnlineWorld);
      setMe({ characterId: "preview-me", name: "Anda", avatarRef: "leader-01.png", partyTag: "MANDAT", colour: "#00d4ff" });
      return;
    }
    (async () => {
      const response = await fetch(`/api/online/worlds/${worldId}/characters`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const character: OnlineCharacter | undefined = data.characters.find((item: OnlineCharacter) => item.id === useOnlineSessionStore.getState().characterId);
      if (!character) { router.replace(`/online/${worldId}/characters`); return; }
      const partyResponse = await fetch(`/api/online/worlds/${worldId}/parties`);
      const partyData = partyResponse.ok ? await partyResponse.json() : { parties: [], membership: null };
      const party = partyData.membership ? (partyData.parties ?? []).find((item: { id: string }) => item.id === partyData.membership.party_id) : null;
      setWorld(data.world);
      setMe({ characterId: character.id, name: character.name, avatarRef: character.avatar_ref, partyTag: party?.abbreviation ?? null, colour: party?.colour ?? "#7dd3fc" });
    })().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load world."));
  }, [worldId, router, devPreview]);

  const grid = useMemo(() => buildRoadGrid(HUB_GRID), []);
  const zones = useMemo(() => makeDemoZones(HUB_SEED, kawasanDevelopedCount(HUB_DENSITY, HUB_GRID)), []);
  // Taps walk the avatar; the hub never shows a selected-zone marker.
  const noZoneSelection = useCallback(() => {}, []);

  const spawn = useMemo<Vec2 | null>(() => (me ? spawnPoint(grid, me.characterId) : null), [grid, me]);
  const [myOrder, setMyOrder] = useState<MoveOrder | null>(null);
  const myStateRef = useRef<MoveOrder | null>(null);
  const cameraTargetRef = useRef<[number, number]>([0, 0]);
  useEffect(() => {
    if (!spawn || myOrder) return;
    const order = { from: spawn, to: spawn, at: Date.now() };
    myStateRef.current = order; cameraTargetRef.current = [spawn[0], spawn[1]];
    setMyOrder(order);
  }, [spawn, myOrder]);

  useEffect(() => { if (devPreview) (window as unknown as { __hubMe?: typeof myStateRef }).__hubMe = myStateRef; }, [devPreview]);
  const presence = useWorldPresence(worldId, devPreview ? null : me, myStateRef);
  const bots = useDevBots(devBots, grid);
  const peers: HubPeer[] = useMemo(() => [...Object.values(presence.peers), ...bots], [presence.peers, bots]);
  const status = devPreview ? "live" : presence.status;
  const { sendOrder } = presence;

  const walk = useCallback((destination: Vec2) => {
    const from = myStateRef.current?.from ?? spawn;
    if (!from) return;
    const order = { from, to: destination, at: Date.now() };
    myStateRef.current = order;
    setMyOrder(order);
    sendOrder(order);
  }, [spawn, sendOrder]);

  if (error) return <main className="min-h-screen p-8 text-white" style={{ background: "var(--bg)" }}>{error}</main>;
  if (!world || !me || !myOrder) return <main className="grid min-h-screen place-items-center text-xs tracking-[.2em] text-cyan" style={{ background: "var(--bg)" }}>{t(lang, "MEMASUKI BANDAR…", "ENTERING CITY…")}</main>;

  const onlineCount = peers.length + 1;
  return <main className="online-hub relative h-[100svh] overflow-hidden text-white" style={{ background: "var(--bg)" }}>
    <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-cyan-900/70 bg-[#050b13]/90 px-3 py-2 backdrop-blur">
      <Link href="/online" className="border border-cyan-800 px-2 py-1 text-[10px] font-bold text-cyan-200" aria-label={t(lang, "Kembali ke senarai dunia", "Back to worlds")}>←</Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[9px] font-bold tracking-[.24em] text-cyan-300">{t(lang, "HAB BANDAR", "CITY HUB")}</p>
        <h1 className="truncate text-sm font-black tracking-[.08em]">{world.name}</h1>
      </div>
      <button type="button" onClick={() => setShowRoster((open) => !open)} className="flex items-center gap-1.5 border border-cyan-800 px-2 py-1 text-[10px] font-bold" aria-expanded={showRoster}>
        <span className="h-2 w-2 rounded-full" style={{ background: status === "live" ? "var(--neon-green)" : status === "connecting" ? "var(--gold)" : "var(--neon-red)" }} />
        {status === "offline" ? t(lang, "LUAR TALIAN", "OFFLINE") : `${onlineCount} ${t(lang, "ONLINE", "ONLINE")}`}
      </button>
      <Link href={`/online/${worldId}/play`} className="border border-gold px-2 py-1 text-[10px] font-bold text-gold">{t(lang, "PEJABAT", "OFFICE")}</Link>
    </header>

    {showRoster && <aside className="absolute right-3 top-14 z-20 max-h-[50svh] w-56 overflow-y-auto border border-cyan-900 bg-[#050b13]/95 p-2 text-xs">
      <p className="mb-1 text-[9px] font-bold tracking-[.22em] text-cyan-300">{t(lang, "PEMAIN DALAM BANDAR", "PLAYERS IN THE CITY")}</p>
      {[me, ...peers].map((player) => <div key={player.characterId} className="flex items-center gap-2 py-1">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: player.colour }} />
        <span className="truncate font-bold">{player.name}{player.characterId === me.characterId ? ` (${t(lang, "anda", "you")})` : ""}</span>
        {player.partyTag && <span className="ml-auto text-[9px]" style={{ color: player.colour }}>{player.partyTag}</span>}
      </div>)}
    </aside>}

    {status === "offline" && <p className="absolute inset-x-3 top-14 z-20 border border-red-500/50 bg-red-950/80 p-2 text-[11px] text-red-100">
      {t(lang, "Sambungan langsung gagal. Anda masih boleh berjalan, tetapi pemain lain tidak kelihatan.", "Live connection failed. You can still walk around, but other players are not visible.")}
    </p>}

    <div className="absolute inset-x-0 bottom-0 top-[49px]">
      <City3DMapGL
        zones={zones} selectedZoneId="" setSelectedZoneId={noZoneSelection} lang={lang}
        gridSize={HUB_GRID} density={HUB_DENSITY} densityLabel={t(lang, "Bandar hab", "Hub city")} traits={DEFAULT_TRAITS}
        celebration={null} overall={70} height="100%" cameraTargetRef={cameraTargetRef} initialCameraDistance={HUB_CAMERA_DISTANCE} initialCameraPitch={HUB_CAMERA_PITCH}
      >
        <HubAvatars grid={grid} me={me} myOrder={myOrder} onWalk={walk} myStateRef={myStateRef} peers={peers} cameraTargetRef={cameraTargetRef} />
      </City3DMapGL>
    </div>
    <p className="pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border border-cyan-900/70 bg-[#050b13]/85 px-3 py-1 text-[10px] font-bold tracking-[.14em] text-cyan-200">
      {t(lang, "KETIK JALAN UNTUK BERJALAN", "TAP A ROAD TO WALK")}
    </p>
  </main>;
}

// Dev-only: simulated players that wander the roads, so the hub can be checked without other people online.
function useDevBots(count: number, grid: ReturnType<typeof buildRoadGrid>): HubPeer[] {
  const [bots, setBots] = useState<HubPeer[]>([]);
  useEffect(() => {
    if (!count) return;
    const colours = ["#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#14b8a6", "#ec4899"];
    const names = ["Aminah", "Raj Kumar", "Wei Ling", "Hafiz", "Siti Nur", "Daniel", "Kavitha", "Azlan", "Mei Chen", "Faizal"];
    const pick = (): Vec2 => [grid.xs[Math.floor(Math.random() * grid.xs.length)], grid.minZ + Math.random() * (grid.maxZ - grid.minZ)];
    const near = (): Vec2 => { const c = spawnPoint(grid, String(Math.random())); return c; };
    const initial = Array.from({ length: count }, (_, i) => {
      const from = near();
      return { characterId: `bot-${i}`, name: names[i % names.length], avatarRef: `leader-${String((i % 5) + 1).padStart(2, "0")}.png`, partyTag: i % 3 ? "PBR" : null, colour: colours[i % colours.length], order: { from, to: roadPath(grid, from, pick()).at(-1)!, at: Date.now() } };
    });
    setBots(initial);
    // Positions are only approximate for re-routing; HubAvatars reuses its displayed position when close.
    const timer = window.setInterval(() => setBots((current) => current.map((bot) => Math.random() < 0.25 ? { ...bot, order: { from: bot.order!.to, to: pick(), at: Date.now() } } : bot)), 4000);
    return () => window.clearInterval(timer);
  }, [count, grid]);
  return bots;
}
