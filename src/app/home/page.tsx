import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return <HomeClient me={{ id: user.id, name: profile?.name ?? "you", avatar_url: profile?.avatar_url ?? null }} />;
}
