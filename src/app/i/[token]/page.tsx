import GuestClient from "./GuestClient";

export default async function GuestInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <GuestClient token={token} />;
}
