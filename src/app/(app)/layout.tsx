import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WoolinkHeader from "@/components/WoolinkHeader";

// (app) 配下は全てログイン必須。ここで一括ガードするので、各ページでの
// 認証チェックは不要。
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <>
      <WoolinkHeader />
      {children}
    </>
  );
}
