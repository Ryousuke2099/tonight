import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QueueClient from "./QueueClient";

export default async function QueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <QueueClient />;
}
