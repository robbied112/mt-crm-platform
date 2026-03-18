export default function EmailLink({ email }) {
  const normalizedEmail = email?.trim();

  if (!normalizedEmail) return <span>--</span>;

  return (
    <a className="acct-clickable" href={`mailto:${normalizedEmail}`}>
      {normalizedEmail}
    </a>
  );
}
