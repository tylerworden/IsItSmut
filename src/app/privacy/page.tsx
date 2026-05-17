export default function PrivacyPage() {
  return (
    <article className="prose prose-sm max-w-none text-[color:var(--color-ink)]">
      <h1 className="text-2xl font-bold text-[color:var(--color-brand)]">Privacy Policy</h1>
      <p>We collect as little as possible:</p>
      <ul>
        <li><strong>Page views</strong> via PostHog (which page you visited, anonymized).</li>
        <li><strong>Search queries</strong> are sent to our AI provider (Anthropic) to generate the rating. We don&apos;t tie queries to your identity.</li>
        <li><strong>Rate-limit counters</strong> use a salted hash of your IP address. We never store the raw IP.</li>
        <li><strong>Cookies:</strong> only a short-lived captcha bypass cookie if you&apos;ve solved a captcha recently.</li>
      </ul>
      <p>We don&apos;t sell or share your data. We don&apos;t use ads (yet).</p>
      <p>Questions? Email tworden1993@gmail.com.</p>
      <p>Last updated: 2026-05-17.</p>
    </article>
  );
}
