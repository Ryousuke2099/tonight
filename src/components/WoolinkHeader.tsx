"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function WoolinkHeader() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // メニュー外をクリックしたら閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("ログアウトエラー:", error.message);
      return;
    }
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <header className="woolink-header">
        <div className="woolink-header-brand">
          <Image
            src="/woolink-logo.svg"
            alt="Woolink"
            width={120}
            height={40}
            priority
          />
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className={`woolink-menu-btn ${menuOpen ? "open" : ""}`}
          aria-label="メニューを開く"
          aria-expanded={menuOpen}
          aria-controls="woolink-menu"
          onClick={() => setMenuOpen((previous) => !previous)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {menuOpen && (
        <nav ref={menuRef} id="woolink-menu" className="woolink-menu-panel">
          {[
            { href: "/home", label: "ホーム" },
            { href: "/diary", label: "交換日記" },
            { href: "/profile", label: "プロフィール" },
            { href: "/notifications", label: "お知らせ" },
            { href: "/settings", label: "設定" },
            { href: "/help", label: "ヘルプ" },
          ].map((item) => (
            <Link
              key={item.href}
              className="woolink-menu-item"
              href={item.href}
              onClick={() => setMenuOpen(false)}
            >
              <span>{item.label}</span>
              <ArrowIcon />
            </Link>
          ))}

          <button type="button" className="woolink-menu-item" onClick={handleLogout}>
            <span>ログアウト</span>
            <ArrowIcon />
          </button>
        </nav>
      )}
    </>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
