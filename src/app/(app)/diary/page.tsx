import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DiaryClient from "./DiaryClient";

export default async function DiaryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return <DiaryClient />;
}
