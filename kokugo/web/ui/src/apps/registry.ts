import { paths } from "../lib/paths";

export type MiniAppId = "kokugo" | "sansu";

export type MiniApp = {
  id: MiniAppId;
  href: string;
  /** Short label HTML for ruby rendering */
  titleHtml: string;
  descriptionHtml: string;
  /** Emoji or single char for the hub card */
  icon: string;
  /** Show “準備中” on the hub card; route may still open a placeholder. */
  comingSoon?: boolean;
};

export const miniApps: MiniApp[] = [
  {
    id: "kokugo",
    href: paths.kokugo.prints,
    titleHtml: `<ruby>国語<rt>こくご</rt></ruby>`,
    descriptionHtml: `プリントと<ruby>練習<rt>れんしゅう</rt></ruby>（<ruby>読取<rt>よみと</rt></ruby>り・AI）`,
    icon: "📖",
  },
  {
    id: "sansu",
    href: paths.sansu,
    titleHtml: `<ruby>算数<rt>さんすう</rt></ruby>`,
    descriptionHtml: `まもなく<ruby>使<rt>つか</rt></ruby>えるように<ruby>準備<rt>じゅんび</rt></ruby><ruby>中<rt>ちゅう</rt></ruby>です`,
    icon: "🔢",
    comingSoon: true,
  },
];
