import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewDiaryClient from "./NewDiaryClient";

export default async function NewDiaryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return <NewDiaryClient />;
}
