"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import IntroCarousel from "@/components/IntroCarousel";
import LoginScreen from "@/components/LoginScreen";
import "./welcome.css";

type Phase = "checking" | "intro" | "login";

export default function TopPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.replace("/onboarding");
        return;
      }
      setPhase("intro");
    })();
  }, [router, supabase]);

  if (phase === "checking") {
    return (
      <main className="welcome-page">
        <div className="welcome-phone">
          <div className="welcome-splash">
            <Image
              className="welcome-splash-logo"
              src="/woolink-logo.svg"
              alt="Woolink"
              width={380}
              height={126}
              priority
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="welcome-page">
      <div className="welcome-phone">
        {phase === "intro" ? (
          <IntroCarousel onFinish={() => setPhase("login")} />
        ) : (
          <LoginScreen />
        )}
      </div>
    </main>
  );
}
