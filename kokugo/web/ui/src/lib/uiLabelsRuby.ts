/**
 * UI copy as kanji with <ruby> readings for elementary readers.
 * Render with <RubyHtml html={…} /> (see components/RubyHtml.tsx).
 */

/** Super-app shell (home + shared chrome). */
export const superAppTitle = `<ruby>学習<rt>がくしゅう</rt></ruby>スタジオ`;

export const authChecking = `<ruby>確認中<rt>かくにんちゅう</rt></ruby>…`;
export const loginTitle = `<ruby>ログイン<rt>ろぐいん</rt></ruby>`;
export const loginEmailLabel = `メール`;
export const loginPasswordLabel = `<ruby>パスワード<rt>ぱすわーど</rt></ruby>`;
export const loginSubmit = `<ruby>入<rt>はい</rt></ruby>る`;
export const loginLead = `<ruby>国語<rt>こくご</rt></ruby>・<ruby>算数<rt>さんすう</rt></ruby>の<ruby>学習<rt>がくしゅう</rt></ruby>には、おうちの<ruby>人<rt>ひと</rt></ruby>からもらったアカウントで<ruby>入<rt>はい</rt></ruby>ってください。`;
export const navLogout = `<ruby>ログアウト<rt>ろぐあうと</rt></ruby>`;
export const superAppLead = `<ruby>科目<rt>かもく</rt></ruby>を<ruby>選<rt>えら</rt></ruby>んで<ruby>始<rt>はじ</rt></ruby>めましょう`;
export const soonBadge = `<ruby>準備中<rt>じゅんびちゅう</rt></ruby>`;
export const backToAppHub = `← <ruby>科目<rt>かもく</rt></ruby>の<ruby>一覧<rt>いちらん</rt></ruby>`;
export const navAppHub = `<ruby>科目<rt>かもく</rt></ruby><ruby>一覧<rt>いちらん</rt></ruby>`;
export const sansuPageTitle = `<ruby>算数<rt>さんすう</rt></ruby>`;
export const sansuPageLead = `<ruby>写真<rt>しゃしん</rt></ruby>で<ruby>算数<rt>さんすう</rt></ruby>の<ruby>問題<rt>もんだい</rt></ruby>をよみとって、<ruby>解<rt>と</rt></ruby>くコツをやさしくまとめます。`;
export const sansuSidebarHint = `これからもっと<ruby>楽<rt>たの</rt></ruby>しいが<ruby>増<rt>ふ</rt></ruby>えるよ！`;
export const sansuUploadLabel = `<ruby>算数<rt>さんすう</rt></ruby>の<ruby>問題<rt>もんだい</rt></ruby><ruby>画像<rt>がぞう</rt></ruby>をえらぶ`;
export const sansuAnalyze = `AIでコツをまとめる`;
export const sansuAnalyzing = `まとめ<ruby>中<rt>ちゅう</rt></ruby>…`;
export const sansuMainIdeaHead = `<ruby>問題<rt>もんだい</rt></ruby>の<ruby>中心<rt>ちゅうしん</rt></ruby>アイデア`;
export const sansuPatternHead = `この<ruby>問題<rt>もんだい</rt></ruby>のパターン`;
export const sansuCareHead = `にた<ruby>問題<rt>もんだい</rt></ruby>で<ruby>気<rt>き</rt></ruby>をつけること`;
export const sansuStep1Head = `ステップ1: <ruby>算数<rt>さんすう</rt></ruby>のプリントをとる`;
export const sansuStep1Body = `カメラかアルバムから、1<ruby>枚<rt>まい</rt></ruby>えらんでください。`;
export const sansuStep2Head = `ステップ2: AIでコツをつくる`;
export const sansuNeedOnePage = `まずは1<ruby>枚<rt>まい</rt></ruby>えらんでね。`;
export const sansuUploadOk = `<ruby>画像<rt>がぞう</rt></ruby>をセットしました！`;
export const sansuImageRemoved = `<ruby>画像<rt>がぞう</rt></ruby>をけしました。`;
export const sansuThumbLabel = `えらんだ<ruby>画像<rt>がぞう</rt></ruby>`;
export const sansuPrintsHeroTitle = `<ruby>算数<rt>さんすう</rt></ruby>プリント`;
export const sansuPrintsHeroLead = `<ruby>新<rt>あたら</rt></ruby>しいプリントをつくって、<ruby>画像<rt>がぞう</rt></ruby>をスキャンしよう。`;
export const sansuNewPrintCta = `<ruby>新<rt>あたら</rt></ruby>しい<ruby>算数<rt>さんすう</rt></ruby>プリント`;
export const sansuPastPrintsHead = `いままでの<ruby>算数<rt>さんすう</rt></ruby>プリント`;
export const sansuNewPrintHead = `<ruby>新<rt>あたら</rt></ruby>しい<ruby>算数<rt>さんすう</rt></ruby>プリント`;
export const sansuNewPrintLead = `<ruby>名前<rt>なまえ</rt></ruby>をいれて<ruby>保存<rt>ほぞん</rt></ruby>すると、スキャンページにすすみます。`;
export const sansuPrintNameLabel = `<ruby>算数<rt>さんすう</rt></ruby>プリントの<ruby>名前<rt>なまえ</rt></ruby>`;
export const sansuCreatePrint = `<ruby>保存<rt>ほぞん</rt></ruby>してスキャンへ`;
export const sansuVisualHead = `考え方を<ruby>図<rt>ず</rt></ruby>で`;
export const sansuVizSanitizeBlocked = `<ruby>図<rt>ず</rt></ruby>のHTMLはとどきましたが、<ruby>安全<rt>あんぜん</rt></ruby>チェックではずされました。もういちど「AIでコツをまとめる」をためしてください。`;
export const sansuVisualIdeasLead = `この<ruby>問題<rt>もんだい</rt></ruby>を<ruby>図<rt>ず</rt></ruby>にすると、たとえば次のようなイメージです。`;
export const sansuVisualNone = `このまとめには<ruby>図<rt>ず</rt></ruby>のHTMLがありません。いちど「AIでコツをまとめる」をもう一度おして、あたらしくまとめてください（むかしのデータにはHTMLがないことがあります）。`;

/** Multi-page scan: 1-based page label (render with RubyHtml). */
export function sansuKotsuPageTitle(page1: number): string {
  return `<ruby>ページ<rt>ぺーじ</rt></ruby> ${page1}`;
}

/** Kokugo mini-app name in sidebar (under super-app home link). */
export const brandTitle = `<ruby>国語<rt>こくご</rt></ruby>アトリエ`;

export const navPrint = `プリント`;
export const navWeeklyDigest = `<ruby>週刊<rt>しゅうかん</rt></ruby>よみもの`;
export const navMonthlyReview = `<ruby>毎月<rt>まいつき</rt></ruby>おさらい`;
export const navSettings = `<ruby>設定<rt>せってい</rt></ruby>`;
export const navParentOnly = `おうちの<ruby>人<rt>ひと</rt></ruby>むけ`;

export const titleNewPrint = `<ruby>新<rt>あたら</rt></ruby>しいプリント`;
export const titleScan = `スキャン`;
export const titlePrint = `プリント`;
export const titleExercise = `<ruby>練習<rt>れんしゅう</rt></ruby>`;
export const titleResult = `<ruby>結果<rt>けっか</rt></ruby>`;
export const titleRemind = `<ruby>毎月<rt>まいつき</rt></ruby>おさらい`;
export const titleSettings = `<ruby>設定<rt>せってい</rt></ruby>`;
export const titleProgress = `これまでのきろく`;
export const titleDigest = `<ruby>週刊<rt>しゅうかん</rt></ruby>よみもの`;

export const badgeAiWaiting = `AI: <ruby>接続待<rt>せつぞくま</rt></ruby>ち`;
export const badgeAiOk = `Sensei AI: <ruby>接続<rt>せつぞく</rt></ruby>OK`;
export const badgeAiKey = `AI: キーを<ruby>設定<rt>せってい</rt></ruby>してね`;
/** 設定ページだけ：子ども向け（APIキーという語を避ける） */
export const badgeParentGeminiHint = `おうちの<ruby>人<rt>ひと</rt></ruby>にセットしてもらってね（AI）`;
export const badgeApiDown = `API: <ruby>続<rt>つづ</rt></ruby>かない`;
export const badgeApiDownParent = `<ruby>接続<rt>せつぞく</rt></ruby>が<ruby>不安定<rt>ふあんてい</rt></ruby>です。あとでまたためしてね。`;

export const profileCheer = `<ruby>頑張<rt>がんば</rt></ruby>っているよ`;
export const defaultStudentName = `<ruby>学生<rt>がくせい</rt></ruby>`;

export const ariaMainMenu = `メインメニュー`;
export const ariaCollapseSidebar = `左のメニューを<ruby>閉<rt>し</rt></ruby>める（<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>みのスペースを<ruby>広<rt>ひろ</rt></ruby>げる）`;
export const ariaExpandSidebar = `メニューを<ruby>開<rt>ひら</rt></ruby>く`;

export const backPrintList = `← プリント<ruby>一覧<rt>いちらん</rt></ruby>`;
export const toPrintList = `プリント<ruby>一覧<rt>いちらん</rt></ruby>へ`;

export const printsHeroTitle = `プリント`;
export const printsHeroLead = `<ruby>一覧<rt>いちらん</rt></ruby>から<ruby>開<rt>ひら</rt></ruby>くか、<ruby>名前<rt>なまえ</rt></ruby>をつけて<ruby>新<rt>あたら</rt></ruby>しいプリントを<ruby>保存<rt>ほぞん</rt></ruby>してください。`;
export const printsNewCta = `<ruby>新<rt>あたら</rt></ruby>しいプリントをつくる`;
export const printsPastHead = `いままでのプリント`;
export const printsEmpty = `まだありません`;

export const newPrintHead = `<ruby>新<rt>あたら</rt></ruby>しいプリント`;
export const newPrintLead = `<ruby>名前<rt>なまえ</rt></ruby>をいれて<strong><ruby>保存<rt>ほぞん</rt></ruby></strong>すると、プリントがつくられます（あとからスキャンできます）。`;
export const newPrintLabel = `プリントの<ruby>名前<rt>なまえ</rt></ruby> <span class="print-new-required">（<ruby>必須<rt>ひっすう</rt></ruby>）</span>`;
export const newPrintSaving = `<ruby>保存<rt>ほぞん</rt></ruby><ruby>中<rt>ちゅう</rt></ruby>…`;
export const newPrintSaveBtn = `<ruby>保存<rt>ほぞん</rt></ruby>してつくる`;
export const cancelJa = `キャンセル`;

export const statusNotScannedYet = `<ruby>未<rt>ま</rt></ruby>だスキャンしていません`;
export const statusBeforeParse = `スキャン・<ruby>読取<rt>よみと</rt></ruby>り<ruby>前<rt>まえ</rt></ruby>`;
export const statusAllDone = `すべて<ruby>終<rt>お</rt></ruby>わり`;
export const exerciseDefaultTitle = `（<ruby>題目<rt>だいもく</rt></ruby>なし）`;

export const remindEmpty = `おさらいのカードがまだありません。プリントの「AIでまとめ」でことばカードがつくられます（<ruby>練習<rt>れんしゅう</rt></ruby>のあとでもOK）。`;
export const remindFlip = `<ruby>裏側<rt>うらがわ</rt></ruby>を<ruby>見<rt>み</rt></ruby>る`;
export const remindGotIt = `<ruby>覚<rt>おぼ</rt></ruby>えた！`;
export const remindNotYet = `まだ`;
export const remindDontKnow = `<ruby>分<rt>わ</rt></ruby>からない`;
export const remindNext = `<ruby>次<rt>つぎ</rt></ruby>へ`;
export const remindShuffle = `ばらばらにする`;
export const remindDoneToday = `きょうはここまで`;
export const remindProgressHint = (n: number) =>
  `あと ${n} <ruby>枚<rt>まい</rt></ruby>くらい（おわったらホームにもどってね）`;
export const parentGateTitle = `おうちの<ruby>人<rt>ひと</rt></ruby>むけ`;
export const parentGateLead = `ここはパパ・ママがつかう<ruby>画面<rt>がめん</rt></ruby>です。PINをいれてください。`;
export const parentGateKeyHint = `AIのキーはおうちの<ruby>大人<rt>おとな</rt></ruby>がセットします。`;
export const parentGateLongPress = `PINを<ruby>知<rt>し</rt></ruby>らないときは、したのボタンを<strong>2びょう</strong>おさえわ。`;
export const parentGateBack = `← プリントにもどる`;
export const progressPageTitle = `これまでのきろく`;
export const progressPageLead = `いままでのプリントのかずです。`;
export const progressPrintCount = (n: number) => `プリント ${n} <ruby>枚<rt>まい</rt></ruby>`;
export const backHomeKid = `← <ruby>ホーム<rt>ほーむ</rt></ruby>にもどる`;
export const digestLead = `<ruby>好<rt>す</rt></ruby>きなテーマで<ruby>毎週<rt>まいしゅう</rt></ruby>よめるおはなしです。`;
export const digestTopicLabel = `いまのテーマ`;
export const digestTopicInputLabel = `テーマをいれてね`;
export const digestTopicPlaceholder = `れきし、うちゅう、むし、どうぶつ など`;
export const digestSaveTopic = `テーマを<ruby>保存<rt>ほぞん</rt></ruby>`;
export const digestChangeTopic = `テーマを<ruby>変<rt>か</rt></ruby>える`;
export const digestCancelEdit = `やめる`;
export const digestGenerateStock = `よみものをつくる`;
export const digestEmptyStock = `よみもののストックがありません。`;
export const digestDoneRead = `よみおわった！`;
export const digestOpen = `<ruby>読<rt>よ</rt></ruby>む`;
export const digestClose = `<ruby>閉<rt>と</rt></ruby>じる`;
export const digestSubTopic = `<ruby>小<rt>しょう</rt></ruby>テーマ`;
export const digestStockCount = (n: number) => `ストック ${n} <ruby>本<rt>ほん</rt></ruby>`;
export const digestAutoGeneratedNotice =
  `<ruby>開<rt>ひら</rt></ruby>いたときにストックがなかったので、<ruby>自動<rt>じどう</rt></ruby>で1つつくりました。`;

export const resultHead = `<ruby>結果<rt>けっか</rt></ruby>`;
export const resultScoreLine = (pct: number, correct: number, total: number) =>
  `${pct}%（${correct}/${total} <ruby>正解<rt>せいかい</rt></ruby>）`;
export const resultByQuestion = `<ruby>問番号<rt>もんばんごう</rt></ruby>ごとのコメント`;
export const correctJa = `<ruby>正解<rt>せいかい</rt></ruby>`;
export const wrongJa = `<ruby>残念<rt>ざんねん</rt></ruby>`;
export const yourAnswer = `あなたの<ruby>答<rt>こた</rt></ruby>え:`;
export const resultNoData = `<ruby>結果<rt>けっか</rt></ruby>データがありません（<ruby>記録<rt>きろく</rt></ruby>から<ruby>開<rt>ひら</rt></ruby>いたときなど）`;
export const backToQuestions = `<ruby>問題<rt>もんだい</rt></ruby>にもどる`;
export const nextSectionPractice = (n: number) =>
  `<ruby>次<rt>つぎ</rt></ruby>の<ruby>大問<rt>だい</rt></ruby>（${n}）の<ruby>練習<rt>れんしゅう</rt></ruby>へ →`;
export const printPointsHead = `このプリントのポイント`;
export const printPointsLeadP1 = `まとめは<strong>プリント<ruby>全体<rt>ぜんたい</rt></ruby></strong>（すべての<ruby>大問<rt>だい</rt></ruby>）を<ruby>対象<rt>たいしょう</rt></ruby>にします。<ruby>詳<rt>くわ</rt></ruby>しくは`;
export const printPointsLink = `プリントページ`;
export const printPointsLeadP2 = `でも<ruby>見<rt>み</rt></ruby>られます。`;
export const noPrintIdSummary = `この<ruby>問題<rt>もんだい</rt></ruby>にはプリントIDがないため、ここではまとめをつくれません。`;
export const aiMakeSummary = `AIでまとめをつくる`;
export const makingSummary = `つくっている…`;
export const regenSummaryBusy = `つくり<ruby>直<rt>なお</rt></ruby>し<ruby>中<rt>ちゅう</rt></ruby>…`;
export const regenSummary = `まとめをつくりなおす`;
export const wordsPoints = `ことば・ポイント（<ruby>最大<rt>さいだい</rt></ruby>10）`;

export const speedReadToggleOn = `<ruby>速読<rt>そくどく</rt></ruby>モード`;
export const speedReadToggleOff = `<ruby>速読<rt>そくどく</rt></ruby>を<ruby>閉<rt>と</rt></ruby>じる`;
export const explainModeToggleOn = `<ruby>説明<rt>せつめい</rt></ruby>モード`;
export const explainModeToggleOff = `<ruby>説明<rt>せつめい</rt></ruby>を<ruby>閉<rt>と</rt></ruby>じる`;
export const explainModeHint =
  `スマホはなぞってから<ruby>指<rt>ゆび</rt></ruby>を<ruby>離<rt>はな</rt></ruby>すと<ruby>黄色<rt>きいろ</rt></ruby>の<ruby>印<rt>しるし</rt></ruby>がつきます。そのあと「<ruby>説明<rt>せつめい</rt></ruby>する」をおす（PCも<ruby>同<rt>おな</rt></ruby>じ）`;
export const explainModeButton = `<ruby>説明<rt>せつめい</rt></ruby>する`;
export const explainModeBusy = `<ruby>説明<rt>せつめい</rt></ruby>をつくっている…`;
export const explainModeKeywords = `<ruby>大事<rt>だいじ</rt></ruby>なことば`;
export const explainModeMeaning = `<ruby>意味<rt>いみ</rt></ruby>（やく）`;
export const explainModeDetail = `くわしい<ruby>説明<rt>せつめい</rt></ruby>`;
export const explainModeAriaPanel = `<ruby>説明<rt>せつめい</rt></ruby>モード`;
export const speedReadStart = `<ruby>開始<rt>かいし</rt></ruby>`;
export const speedReadPause = `<ruby>一時停止<rt>いちじていし</rt></ruby>`;
export const speedReadReset = `<ruby>最初<rt>さいしょ</rt></ruby>にもどす`;
export const speedReadSpeed = `<ruby>速<rt>はや</rt></ruby>さ`;
export const speedReadSpeedUnit = `<ruby>文節<rt>ぶんせつ</rt></ruby>/分`;
export const speedReadAriaSlider = `<ruby>速読<rt>そくどく</rt></ruby>の<ruby>速<rt>はや</rt></ruby>さ`;
export const speedReadBunsetsuLoading = `<ruby>文節<rt>ぶんせつ</rt></ruby>を<ruby>準備<rt>じゅんび</rt></ruby>しています…`;
export const speedReadBunsetsuHint =
  `「<ruby>文節<rt>ぶんせつ</rt></ruby>を<ruby>作<rt>つく</rt></ruby>る」で<ruby>速読<rt>そくどく</rt></ruby>の<ruby>単位<rt>たんい</rt></ruby>をつくります。<ruby>一度<rt>いちど</rt></ruby>つくると<ruby>保存<rt>ほぞん</rt></ruby>され、つぎからはそのまま<ruby>使<rt>つか</rt></ruby>えます。`;
export const speedReadBunsetsuGenerate = `<ruby>文節<rt>ぶんせつ</rt></ruby>を<ruby>作<rt>つく</rt></ruby>る`;
export const speedReadBunsetsuRetry = `もう<ruby>一度<rt>いちど</rt></ruby>ためす`;
export const scanPagesLabel = (n: number) =>
  `${n} <ruby>枚<rt>まい</rt></ruby>のプリント（サムネをタップで<ruby>大<rt>おお</rt></ruby>きく<ruby>見<rt>み</rt></ruby>る）`;
export const ariaEnlargePage = (i: number) =>
  `ページ ${i + 1} を<ruby>大<rt>おお</rt></ruby>きく<ruby>表示<rt>ひょうじ</rt></ruby>`;
export const ariaQuestionPanelClose = `<ruby>問題<rt>もんだい</rt></ruby>パネルを<ruby>閉<rt>し</rt></ruby>める（<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>みを<ruby>広<rt>ひろ</rt></ruby>げる）`;
export const ariaQuestionPanelOpen = `<ruby>問題<rt>もんだい</rt></ruby>パネルを<ruby>開<rt>ひら</rt></ruby>く`;
export const panelClose = `<ruby>閉<rt>し</rt></ruby>める`;
export const panelCollapsedTitle = `<ruby>問題<rt>もんだい</rt></ruby>`;
export const noQuestionsRescan = `<ruby>問題<rt>もんだい</rt></ruby>がありません。スキャンをやり<ruby>直<rt>なお</rt></ruby>してください。`;
export const questionProgress = (cur: number, total: number) =>
  `<ruby>問題<rt>もんだい</rt></ruby> ${cur} / ${total}`;
export const httpsMicNeeded = `マイクには https が<ruby>必要<rt>ひつよう</rt></ruby>です`;
export const httpsMicBody = `いま <code>http://</code> なので<ruby>録音<rt>ろくおん</rt></ruby>できません。アプリのPCで<ruby>次<rt>つぎ</rt></ruby>を<ruby>実行<rt>じっこう</rt></ruby>し、<ruby>表示<rt>ひょうじ</rt></ruby>された <code>https://…ts.net</code> で<ruby>開<rt>ひら</rt></ruby>き<ruby>直<rt>なお</rt></ruby>してください。`;
export const httpsMicReadmeHint = `<ruby>詳<rt>くわ</rt></ruby>しくは README の「iPadでマイク（HTTPS）」`;
export const micAriaBrowser = `マイク`;
export const micAriaRecording = `<ruby>録音<rt>ろくおん</rt></ruby><ruby>中<rt>ちゅう</rt></ruby>（はなすと<ruby>終<rt>お</rt></ruby>わる）`;
export const micAriaHold = `マイクをおさえて<ruby>録音<rt>ろくおん</rt></ruby>`;
export const micHintBrowser = `マイクをおす（ブラウザの<ruby>音声<rt>おんせい</rt></ruby><ruby>入力<rt>にゅうりょく</rt></ruby>）`;
export const micHintRelease = `ゆびをはなすと<ruby>終<rt>お</rt></ruby>わります（<ruby>最長<rt>さいちょう</rt></ruby> 10 <ruby>秒<rt>びょう</rt></ruby>）`;
export const transcribing = `<ruby>文字<rt>もじ</rt></ruby>おこし<ruby>中<rt>ちゅう</rt></ruby>…`;
export const micHintHold = `マイクをおさえっぱなしで<ruby>録音<rt>ろくおん</rt></ruby>、はなすと<ruby>終<rt>お</rt></ruby>わり（<ruby>最長<rt>さいちょう</rt></ruby> 10 <ruby>秒<rt>びょう</rt></ruby>）`;
export const micHintIos = `iPad/iPhone ではブラウザの<ruby>音声<rt>おんせい</rt></ruby><ruby>入力<rt>にゅうりょく</rt></ruby>がつかえないことが多いので、<ruby>録音<rt>ろくおん</rt></ruby>したあとサーバー（Gemini）が<ruby>文字<rt>もじ</rt></ruby>におこします。`;
export const checkAnswerBusy = `<ruby>確認<rt>かくにん</rt></ruby><ruby>中<rt>ちゅう</rt></ruby>…`;
export const checkAnswer = `<ruby>答<rt>こた</rt></ruby>えを<ruby>確認<rt>かくにん</rt></ruby>`;
export const checkHint = `<ruby>正解<rt>せいかい</rt></ruby>かどうと、コメントがでます`;
export const revealBusy = `<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>…`;
export const revealAnswer = `<ruby>正解<rt>せいかい</rt></ruby>を<ruby>見<rt>み</rt></ruby>る`;
export const ariaRevealRegion = `<ruby>正解<rt>せいかい</rt></ruby>の<ruby>例<rt>れい</rt></ruby>`;
/** Plain text for aria-label (check / reveal action column). */
export const ariaQuestionActions = "答えを確認し、正解を見る";
export const revealLabel = `<ruby>正解<rt>せいかい</rt></ruby>の<ruby>例<rt>れい</rt></ruby>`;
export const hideJa = `<ruby>隠<rt>かく</rt></ruby>す`;
export const skipAutoScore = `<ruby>自動採点<rt>じどうさいてん</rt></ruby>の<ruby>対象外<rt>たいしょうがい</rt></ruby>です。<ruby>次<rt>つぎ</rt></ruby>へすすんでOKです。`;
export const prevJa = `<ruby>前<rt>まえ</rt></ruby>`;
export const nextJa = `<ruby>次<rt>つぎ</rt></ruby>`;
export const submitAll = `すべての<ruby>答<rt>こた</rt></ruby>えをおくる`;

export const backToThisPrint = `← このプリントにもどる`;
export const ariaSiblingSections = `このプリントのほかの<ruby>大問<rt>だい</rt></ruby>`;
export const switchSectionLabel = `このプリントの<ruby>大問<rt>だい</rt></ruby>をきりかえ`;

export const printDetailTitleLabel = `このプリントの<ruby>名前<rt>なまえ</rt></ruby>（わかりやすく）`;
export const printTitleSaving = `<ruby>保存<rt>ほぞん</rt></ruby><ruby>中<rt>ちゅう</rt></ruby>…`;
export const emptyNamePreviewLabel = `<ruby>名前<rt>なまえ</rt></ruby>を<ruby>空<rt>あ</rt></ruby>けたときの<ruby>表示<rt>ひょうじ</rt></ruby>:`;
export const metaJustCreated = `つくったばかり · まだ<ruby>問題<rt>もんだい</rt></ruby>はありません`;
export const metaSectionCount = (n: number) => `${n} <ruby>大問<rt>だい</rt></ruby>`;
export const metaPracticeProgress = (done: number, total: number) =>
  ` · <ruby>練習<rt>れんしゅう</rt></ruby> ${done}/${total} <ruby>終<rt>お</rt></ruby>わり`;
export const scanPrintCta = `プリントをスキャンする`;
export const scanAddPagesCta = `＋<ruby>大問<rt>だい</rt></ruby>をついか（スキャン）`;
export const scanNewSectionCta = `<ruby>画像<rt>がぞう</rt></ruby>をスキャン（<ruby>大問<rt>だい</rt></ruby>をつくる）`;
export const practiceThisPrint = `このプリントの<ruby>練習<rt>れんしゅう</rt></ruby>`;
export const deleteThisPrint = `このプリントを<ruby>削除<rt>さくじょ</rt></ruby>`;
export const printWholeSummaryHead = `プリント<ruby>全体<rt>ぜんたい</rt></ruby>のまとめ`;
export const printWholeSummaryLead = `すべての<ruby>大問<rt>だい</rt></ruby>をまとめて、おぼえておきたいことばやポイント（<ruby>最大<rt>さいだい</rt></ruby>10）をつくります。`;
export const printSummaryTodayHead = `きょうのめあて`;
export const printSummaryWordsHead = `だいじなことば`;
export const printSummaryPointsHead = `ポイント`;
export const confirmDeletePrint = `このプリントをほんとうに けす？\nもとに もどせません`;
export const confirmDeleteSection = `このだいもんをほんとうに けす？\nもとに もどせません`;
export const confirmDeleteScanPage = `このページのしゃしんをほんとうに けす？`;
export const dangerMenuOpen = `⋯ <ruby>他<rt>ほか</rt></ruby>の<ruby>操作<rt>そうさ</rt></ruby>`;
export const nextStepsHead = `<ruby>次<rt>つぎ</rt></ruby>のステップ`;
export const emptyPrintLead = `いまは<strong><ruby>問題<rt>もんだい</rt></ruby></strong>がまだありません。うえのボタンでプリントの<strong><ruby>写真<rt>しゃしん</rt></ruby></strong>をいれて、AIに<strong><ruby>読<rt>よ</rt></ruby>み<ruby>取<rt>と</rt></ruby>って</strong>もらうと、<strong><ruby>大問<rt>だい</rt></ruby></strong>がここに<ruby>並<rt>なら</rt></ruby>べられます。`;
export const sectionListHead = `<ruby>大問<rt>だい</rt></ruby>の<ruby>一覧<rt>いちらん</rt></ruby>`;
export const sectionListHint = `<ruby>練習<rt>れんしゅう</rt></ruby>は「このプリントの<ruby>練習<rt>れんしゅう</rt></ruby>」か、したの<strong><ruby>大問<rt>だい</rt></ruby></strong>からはじめられます。`;
export const sectionChip = (i: number) => `<ruby>大問<rt>だい</rt></ruby> ${i + 1}`;
export const ariaDeleteSection = `この<ruby>大問<rt>だい</rt></ruby>だけ<ruby>削除<rt>さくじょ</rt></ruby>`;
export const deleteKanji = `<ruby>削除<rt>さくじょ</rt></ruby>`;

export const scanBindErr = `このプリントにはスキャン<ruby>先<rt>さき</rt></ruby>がありません`;
export const scanReloadHint = `スキャン<ruby>先<rt>さき</rt></ruby>の<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>みをやり<ruby>直<rt>なお</rt></ruby>してください（ページを<ruby>更新<rt>こうしん</rt></ruby>）。`;
export const waitingForPrintLoad = `プリントの<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>みをまっています…`;
export const uploading = (cur: number, total: number) =>
  `アップロード<ruby>中<rt>ちゅう</rt></ruby>… (${cur}/${total})`;
export const uploadingSingle = `アップロード<ruby>中<rt>ちゅう</rt></ruby>…`;
export const uploadOk = `アップロードOK！`;
export const deletingPage = `ページをけしています…`;
export const draftCleared = `<ruby>下書<rt>したが</rt></ruby>きをけしました`;
export const pageRemoved = `ページをけしました`;
export const geminiParsing = `Gemini が<ruby>読取<rt>よみと</rt></ruby>っています…`;
export const parseNoteMulti = `（<ruby>複数<rt>ふくすう</rt></ruby>ページはひとつの<ruby>大問<rt>だい</rt></ruby>にまとめました）`;
export const parseDoneSplit = (n: number, pageNote: string) =>
  `<ruby>読取<rt>よみと</rt></ruby>りました！${n}つの<ruby>大問<rt>だい</rt></ruby>にわけました。${pageNote}プリントのページにもどります。`.trim();
export const parseDoneSingle = (pageNote: string) =>
  `<ruby>読取<rt>よみと</rt></ruby>りました！${pageNote}プリントのページへいきます。`.trim();
export const step1Head = `ステップ1: プリントをとる`;
export const step1Body = `タブレットでは「カメラでとる」がおすすめ。PCでは「がめんうえでシャッター」かファイルをえらぶ。<ruby>複数<rt>ふくすう</rt></ruby><ruby>枚<rt>まい</rt></ruby>は<ruby>同<rt>おな</rt></ruby>じプリントのつづきとしてアルバムでまとめてえらぶか、Ctrl+V / ⌘V でいちどに<ruby>追加<rt>ついか</rt></ruby>します（<ruby>読取<rt>よみと</rt></ruby>るときはまとめてひとつの<ruby>大問<rt>だい</rt></ruby>になります）。Tailscale のアドレスだけ（https ではない）でつないでいるとき、ブラウザによってはシャッターがつかえません。`;
export const ariaCameraCapture = `カメラで<ruby>撮影<rt>さつえい</rt></ruby>`;
export const btnCameraTake = `📷 カメラでとる`;
/** 算数など：子ども向け短いラベル */
export const btnPhotoTakeKid = `📷 しゃしんをとる`;
export const btnScreenShutter = `がめんうえでシャッター`;
export const ariaPickFiles = `アルバムやファイルから<ruby>選<rt>えら</rt></ruby>ぶ`;
export const btnAlbumPick = `アルバム／ファイルからえらぶ`;
export const btnAlbumPickKid = `📁 アルバムからえらぶ`;
export const ariaUploadedPages = `アップロードしたページ`;
export const scanPageStripHint = (n: number) =>
  `${n} <ruby>枚<rt>まい</rt></ruby>のページ（つづきがあれば、もういちど「カメラ」や「アルバム」から<ruby>追加<rt>ついか</rt></ruby>）`;
export const ariaRemovePage = (i: number) => `ページ ${i + 1} を<ruby>削除<rt>さくじょ</rt></ruby>`;
export const step2Head = `ステップ2: AIで<ruby>読取<rt>よみと</rt></ruby>る`;
export const parseBtnMulti = (pageCount: number) =>
  `${pageCount}ページをまとめて<ruby>読取<rt>よみと</rt></ruby>る（ひとつの<ruby>大問<rt>だい</rt></ruby>）（Gemini）`;
export const parseBtnSingle = `<ruby>読取<rt>よみと</rt></ruby>る（1<ruby>枚<rt>まい</rt></ruby>のなかに<ruby>複数<rt>ふくすう</rt></ruby><ruby>大問<rt>だい</rt></ruby>があればわける）（Gemini）`;
export const needOnePage = `ページが1<ruby>枚<rt>まい</rt></ruby>はいってから<ruby>読取<rt>よみと</rt></ruby>れます。`;

export const settingsHead = `<ruby>設定<rt>せってい</rt></ruby>（このパソコンに<ruby>保存<rt>ほぞん</rt></ruby>）`;
export const settingsIntro = `プリントの<ruby>読取<rt>よみと</rt></ruby>りは <strong>Gemini 3</strong>（<ruby>既定<rt>きてい</rt></ruby>モデル <code>gemini-3-flash-preview</code>）のワンショット<ruby>解析<rt>かいせき</rt></ruby>です。まとめ・<ruby>採点<rt>さいてん</rt></ruby>は Gemini か Ollama を<ruby>別々<rt>べつべつ</rt></ruby>に<ruby>選<rt>えら</rt></ruby>べます。Gemini の API キーはこのアカウントの<ruby>設定<rt>せってい</rt></ruby>にだけ<ruby>保存<rt>ほぞん</rt></ruby>します。`;
export const labelOllamaServer = `Ollama サーバー（URL）`;
export const btnConnectionCheck = `<ruby>接続<rt>せつぞく</rt></ruby><ruby>確認<rt>かくにん</rt></ruby>`;
export const checkingBusy = `<ruby>確認<rt>かくにん</rt></ruby><ruby>中<rt>ちゅう</rt></ruby>…`;
export const ollamaFetchingModels = `Ollama（/api/tags）からモデル<ruby>一覧<rt>いちらん</rt></ruby>を<ruby>取得<rt>しゅとく</rt></ruby>しています…`;
export const envDefaultLabel = `<ruby>環境変数<rt>かんきょうへんすう</rt></ruby>の<ruby>既定<rt>きてい</rt></ruby>:`;
export const labelChatModel = `チャット<ruby>用<rt>よう</rt></ruby>モデル（まとめ・<ruby>採点<rt>さいてん</rt></ruby>で ollama を<ruby>選<rt>えら</rt></ruby>んだとき）`;
export const labelSummaryBackend = `まとめ・<ruby>音声<rt>おんせい</rt></ruby>の<ruby>文字起<rt>もじお</rt></ruby>こし`;
export const labelJudgeBackend = `<ruby>解答<rt>かいとう</rt></ruby>の<ruby>採点<rt>さいてん</rt></ruby>`;
export const labelGeminiKey = `Google Gemini API キー`;
export const placeholderKeySaved = `（<ruby>保存<rt>ほぞん</rt></ruby><ruby>済<rt>ず</rt></ruby>み・<ruby>新<rt>あたら</rt></ruby>しいキーで<ruby>上書<rt>うわが</rt></ruby>き）`;
export const placeholderKeyNeeded = `プリント<ruby>読取<rt>よみと</rt></ruby>り・Gemini <ruby>利用<rt>りよう</rt></ruby>に<ruby>必要<rt>ひつよう</rt></ruby>`;
export const placeholderKeySavedPlain = "（保存済み・新しいキーで上書き）";
export const placeholderKeyNeededPlain = "プリント読み取り・Gemini 利用に必要";
export const clearSavedKey = `<ruby>保存<rt>ほぞん</rt></ruby>したキーをけす`;
export const saveApply = `<ruby>保存<rt>ほぞん</rt></ruby>して<ruby>反映<rt>はんえい</rt></ruby>`;
export const savedOk = `✓ <ruby>反映<rt>はんえい</rt></ruby>しました`;
export const effectiveModelHint = `いまの<ruby>有効<rt>ゆうこう</rt></ruby>モデル<ruby>名<rt>めい</rt></ruby>:`;
export const unsetParen = `（<ruby>未設定<rt>みせってい</rt></ruby>）`;
export const openOllamaListHint = `。<ruby>開<rt>ひら</rt></ruby>いたときに Ollama から<ruby>一覧<rt>いちらん</rt></ruby>を<ruby>取<rt>と</rt></ruby>ります。URL を<ruby>変<rt>か</rt></ruby>えたあとは「<ruby>接続<rt>せつぞく</rt></ruby><ruby>確認<rt>かくにん</rt></ruby>」で<ruby>取<rt>と</rt></ruby>り<ruby>直<rt>なお</rt></ruby>せます。`;
export const effectiveValueHint = `いまの<ruby>有効<rt>ゆうこう</rt></ruby><ruby>値<rt>あたい</rt></ruby>:`;
export const transcribeGeminiOnly = `（<ruby>文字起<rt>もじお</rt></ruby>こしは Gemini のときだけ<ruby>可<rt>か</rt></ruby>）`;
export const dbHasKey = `データベースにキーが<ruby>保存<rt>ほぞん</rt></ruby>されています（<ruby>内容<rt>ないよう</rt></ruby>は<ruby>表示<rt>ひょうじ</rt></ruby>しません）。`;
export const dbNoKey = `このアカウントに<ruby>保存<rt>ほぞん</rt></ruby>した Gemini キーはまだありません。`;
export const geminiKeyAvailable = ` いまの<ruby>設定<rt>せってい</rt></ruby>では Gemini <ruby>用<rt>よう</rt></ruby>のキーが<ruby>利用<rt>りよう</rt></ruby><ruby>可能<rt>かのう</rt></ruby>です。`;
export const geminiKeyMissing = ` いまの<ruby>設定<rt>せってい</rt></ruby>では Gemini <ruby>用<rt>よう</rt></ruby>のキーがありません。`;

export const cameraModalAria = `カメラ`;
export const cameraShootTitle = `プリントをうつす`;
export const closeJa = `<ruby>閉<rt>と</rt></ruby>じる`;
export const shutterPress = `シャッターをおす`;
export const cameraLoading = `カメラを<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>…`;
export const shutterBtn = `📷 シャッター`;
export const cameraErr = `カメラをつかえません。https:// または「カメラでとる」をためしてください。`;

export const scanModalAria = (i: number) => `スキャン ページ ${i + 1}`;
export const pageTitleModal = (i: number, total: number) =>
  `ページ ${i + 1}${total > 1 ? ` / ${total}` : ""}`;
export const ariaPrevPage = `<ruby>前<rt>まえ</rt></ruby>のページ`;
export const ariaNextPage = `<ruby>次<rt>つぎ</rt></ruby>のページ`;

export const invalidId = `IDが<ruby>不正<rt>ふせい</rt></ruby>です`;
export const loadingDots = `<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>み<ruby>中<rt>ちゅう</rt></ruby>…`;

/** exercise.status → HTML for list rows */
export const exerciseStatusHtml = (status: string): string => {
  switch (status) {
    case "draft":
      return `<ruby>下書<rt>したが</rt></ruby>き`;
    case "parsed":
      return `<ruby>読<rt>よ</rt></ruby>みとりずみ`;
    case "completed":
      return `<ruby>練習<rt>れんしゅう</rt></ruby><ruby>終<rt>お</rt></ruby>わり`;
    default:
      return status;
  }
};

export const exerciseRowFallbackNoScan = statusNotScannedYet;
export const exerciseRowFallbackBeforeParse = (pc: number) =>
  `<ruby>読取<rt>よみと</rt></ruby>り<ruby>前<rt>まえ</rt></ruby>（${pc}<ruby>枚<rt>まい</rt></ruby>）`;
export const exerciseRowNoTitle = `（<ruby>無題<rt>むだい</rt></ruby>）`;

/** `<option>` cannot contain HTML; use kanji without ruby. */
export const settingsBackendOptEnvPlain =
  "環境変数の既定（個別変数 → KOKUGO_CHAT_BACKEND、未設定時は gemini）";
export const settingsBackendOptGeminiPlain = "gemini（このアカウントの API キーが必要）";
export const settingsBackendOptOllamaPlain = "ollama（OLLAMA_CHAT_MODEL / OLLAMA_MODEL）";
export const settingsOptSavingPlain = (name: string) => `${name}（保存中・一覧に未反映）`;
export const settingsOptEnvOllamaPlain = (current?: string) =>
  `環境変数の既定（OLLAMA_CHAT_MODEL → OLLAMA_MODEL${current ? ` — いまは ${current}` : ""}）`;

/** Top bar title HTML by route (supports `/kokugo/...` and other mini-apps). */
export function titleHtmlForPath(pathname: string): string {
  const K = "/kokugo";
  if (pathname.startsWith(K)) {
    const rest = pathname.slice(K.length) || "/";
    return titleHtmlForKokugoPath(rest);
  }
  if (pathname === "/sansu" || pathname.startsWith("/sansu/")) return sansuPageTitle;
  return superAppTitle;
}

function titleHtmlForKokugoPath(rest: string): string {
  const path = rest.startsWith("/") ? rest : `/${rest}`;
  if (path.startsWith("/login")) return loginTitle;
  if (path === "/prints/new") return titleNewPrint;
  if (/\/prints\/[^/]+\/scan/.test(path)) return titleScan;
  if (path.startsWith("/prints/") && path !== "/prints") return titlePrint;
  if (path.startsWith("/exercise/")) return titleExercise;
  if (path.startsWith("/result/")) return titleResult;
  if (path.startsWith("/remind")) return titleRemind;
  if (path.startsWith("/settings")) return titleSettings;
  if (path.startsWith("/progress")) return titleProgress;
  if (path.startsWith("/digests")) return titleDigest;
  if (path === "/prints" || path === "/") return titlePrint;
  return brandTitle;
}
