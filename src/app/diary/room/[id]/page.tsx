import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RoomClient from "./RoomClient";

export default async function DiaryRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <RoomClient roomId={id} meId={user.id} />;
}
