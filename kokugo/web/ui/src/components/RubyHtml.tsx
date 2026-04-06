import { sanitizeRubyHtml } from "../lib/ruby";

type Props = { html: string; className?: string; as?: "span" | "div" | "p" | "h1" | "h2" };

/**
 * Renders Japanese text that may include HTML ruby markup from the API.
 */
export default function RubyHtml({ html, className, as: Tag = "span" }: Props) {
  const clean = sanitizeRubyHtml(html);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}

/** Passage with paragraph breaks. */
export function PassageRuby({ text }: { text: string }) {
  const paras = text.split(/\n+/).filter(Boolean);
  return (
    <div className="passage-ruby">
      {paras.map((line, i) => (
        <p key={i}>
          <RubyHtml html={line} />
        </p>
      ))}
    </div>
  );
}
