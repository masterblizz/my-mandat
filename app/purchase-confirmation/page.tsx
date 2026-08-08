"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { useLang, t } from "../i18n/useLang";

type Status = "checking" | "pending" | "timeout" | "success" | "error";

// ~15s total: an immediate first check, then up to 7 more every 2s.
const MAX_POLL_ATTEMPTS = 7;
const POLL_INTERVAL_MS = 2000;

function ActionButton({ onClick, children, tone = "gold" }: { onClick: () => void; children: React.ReactNode; tone?: "gold" | "cyan" }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 px-5 py-2.5 text-[11px] font-black tracking-[0.2em] transition-all"
      style={
        tone === "gold"
          ? { background: "linear-gradient(90deg, #ffb42f, #f7a81f)", color: "#05080e", boxShadow: "0 0 24px rgb(var(--gold-rgb) / 0.28)" }
          : { border: "1px solid rgb(var(--cyan-rgb) / 0.35)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / 0.06)" }
      }
    >
      {children}
    </button>
  );
}

function PurchaseConfirmationContent() {
  const lang = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<Status>("checking");
  const [productName, setProductName] = useState<string | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      try {
        const res = await fetch(`/api/purchase-status?session_id=${encodeURIComponent(sessionId as string)}`);
        if (cancelled) return;

        if (!res.ok) {
          setStatus("error");
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.status === "completed") {
          setProductName(data.productName ?? null);
          setStatus("success");
          return;
        }
        if (data.status === "not_found") {
          setStatus("error");
          return;
        }

        // Still pending — the webhook hasn't finished yet.
        attemptsRef.current += 1;
        if (attemptsRef.current > MAX_POLL_ATTEMPTS) {
          setStatus("timeout");
          return;
        }
        setStatus("pending");
        timer = setTimeout(check, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "'Space Mono', monospace" }}>
      <Header />
      <StatusBar
        leftText={t(lang, "purchase_confirmation_page.purchaseConfirmation")}
        rightText={t(lang, "purchase_confirmation_page.stripeCheckout")}
      />

      <main className="flex min-h-screen items-center justify-center px-6 pt-[56px] pb-[52px]">
        <div className="w-full max-w-[440px]">
          <TacticalPanel
            title={t(lang, "purchase_confirmation_page.paymentStatus")}
            goldBorder={status === "success"}
          >
            {(status === "checking" || status === "pending") && (
              <div className="flex flex-col items-center gap-1 py-8 text-center">
                <LoadingSpinner
                  size={40}
                  label={
                    status === "checking"
                      ? t(lang, "purchase_confirmation_page.verifyingYourPayment")
                      : t(lang, "purchase_confirmation_page.processingYourPaymentPleaseWaitA")
                  }
                />
              </div>
            )}

            {status === "timeout" && (
              <div className="py-4 text-center">
                <div className="mb-4 text-[12px] leading-6" style={{ color: "var(--gold)" }}>
                  {t(lang, "purchase_confirmation_page.yourPaymentIsStillBeingProcessed")}
                </div>
                <ActionButton onClick={() => window.location.reload()} tone="cyan">
                  {t(lang, "purchase_confirmation_page.refresh")}
                </ActionButton>
              </div>
            )}

            {status === "success" && (
              <div className="py-4 text-center">
                <div className="mb-3 text-[36px] leading-none">✅</div>
                <div className="mb-2 text-[15px] font-black tracking-wider" style={{ color: "var(--neon-green)" }}>
                  {t(lang, "purchase_confirmation_page.purchaseSuccessful")}
                </div>
                <div className="mb-5 text-[12px] leading-5" style={{ color: "var(--text-muted)" }}>
                  {productName
                    ? t(lang, "purchase_confirmation_page.hasBeenUnlocked", { productName: productName })
                    : t(lang, "purchase_confirmation_page.yourPremiumFeatureHasBeenUnlocked")}
                </div>
                <ActionButton onClick={() => router.push("/setup")}>
                  {t(lang, "purchase_confirmation_page.backToGame")}
                </ActionButton>
              </div>
            )}

            {status === "error" && (
              <div className="py-4 text-center">
                <div className="mb-4 text-[12px] leading-6" style={{ color: "var(--neon-red)" }}>
                  {t(lang, "purchase_confirmation_page.thisPaymentSessionIsInvalidOr")}
                </div>
                <ActionButton onClick={() => router.push("/menu")} tone="cyan">
                  {t(lang, "purchase_confirmation_page.backToMenu")}
                </ActionButton>
              </div>
            )}
          </TacticalPanel>
        </div>
      </main>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary — this is the entire
// point of that boundary, not extra ceremony: Next.js needs somewhere to
// render while the search params (only available client-side / after
// streaming resolves) aren't ready yet.
export default function PurchaseConfirmationPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <PurchaseConfirmationContent />
    </Suspense>
  );
}
