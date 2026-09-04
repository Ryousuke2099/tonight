import WoolinkHeader from "@/components/WoolinkHeader";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <WoolinkHeader />
      {children}
    </>
  );
}