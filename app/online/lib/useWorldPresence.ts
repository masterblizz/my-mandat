"use client";

// Live "who is in the city" for one online world, over Supabase Realtime
// Presence (keyed by character id).
//
// Each player's presence entry carries their public identity (name,
// portrait, party tag/colour) plus their latest walk order: where the
// avatar was and where it is heading. Every client routes the same order
// along the same roads (hubRoads.roadPath), so a tap costs exactly one
// presence update — no per-frame positions and no heartbeat. Late joiners
// read everyone's latest order straight from the presence state.
//
// The channel is private: only active members of the world may read or
// write it (see supabase/migrations/20261101_world_hub_realtime.sql).

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "../../utils/supabase/client";
import type { Vec2 } from "./hubRoads";

export type HubIdentity = { characterId: string; name: string; avatarRef: string; partyTag: string | null; colour: string };
export type MoveOrder = { from: Vec2; to: Vec2; at: number };
export type HubPeer = HubIdentity & { order: MoveOrder | null };
export type HubStatus = "connecting" | "live" | "offline";

const MAX_NAME = 40;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isVec = (value: unknown): value is Vec2 => Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1]);
const isColour = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

function cleanIdentity(raw: Record<string, unknown>): HubIdentity | null {
  if (typeof raw.characterId !== "string" || typeof raw.name !== "string") return null;
  return {
    characterId: raw.characterId,
    name: raw.name.slice(0, MAX_NAME),
    avatarRef: typeof raw.avatarRef === "string" && /^[\w.-]+$/.test(raw.avatarRef) ? raw.avatarRef : "leader-01.png",
    partyTag: typeof raw.partyTag === "string" ? raw.partyTag.slice(0, 8) : null,
    colour: isColour(raw.colour) ? raw.colour : "#7dd3fc",
  };
}

/** Presence payload for me: identity + latest walk order. */
const payloadFor = (me: HubIdentity, order: MoveOrder | null) => ({ ...me, from: order?.from ?? null, to: order?.to ?? null, at: order?.at ?? 0 });

export function useWorldPresence(worldId: string, me: HubIdentity | null, myOrderRef: React.MutableRefObject<MoveOrder | null>) {
  const [peers, setPeers] = useState<Record<string, HubPeer>>({});
  const [status, setStatus] = useState<HubStatus>("connecting");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef(me);
  meRef.current = me;
  const meId = me?.characterId ?? null;

  useEffect(() => {
    const identity = meRef.current;
    if (!identity) return;
    let cancelled = false;
    const supabase = createClient();
    const channel = supabase.channel(`world-hub:${worldId}`, { config: { private: true, presence: { key: identity.characterId } } });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<Record<string, unknown>>();
      setPeers((current) => {
        const next: Record<string, HubPeer> = {};
        for (const [key, metas] of Object.entries(state)) {
          if (key === identity.characterId) continue;
          const meta = metas[metas.length - 1];
          const peer = meta && cleanIdentity(meta);
          if (!peer || peer.characterId !== key) continue;
          const at = finite(meta.at) ? meta.at : 0;
          const previous = current[key]?.order ?? null;
          // Keep the same order object unless the peer actually issued a new one, so their walk isn't restarted.
          const order = previous && previous.at === at ? previous : isVec(meta.from) && isVec(meta.to) ? { from: meta.from, to: meta.to, at } : previous;
          next[key] = { ...peer, order };
        }
        return next;
      });
    });

    (async () => {
      // Private channels authorise with the signed-in user's JWT.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel.subscribe(async (state) => {
        if (cancelled) return;
        if (state === "SUBSCRIBED") {
          setStatus("live");
          await channel.track(payloadFor(identity, myOrderRef.current));
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setStatus("offline");
        }
      });
    })();

    return () => {
      cancelled = true;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
    // Re-subscribe only when the world or the character changes; identity details ride along in meRef.
  }, [worldId, meId, myOrderRef]);

  const sendOrder = useCallback((order: MoveOrder) => {
    const channel = channelRef.current;
    const identity = meRef.current;
    if (!channel || !identity) return;
    channel.track(payloadFor(identity, order));
  }, []);

  return { peers, status, sendOrder };
}
