export default function Avatar({
  src,
  name,
  size = 44,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const fallback = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(
    name
  )}&backgroundColor=1e2338`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || fallback}
      alt=""
      width={size}
      height={size}
      className="rounded-full bg-night-deep object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
