package ai

// Prompts for the two-step pipeline: (1) OCR (2) structure + ruby in one JSON call. Settings still use the id three_step.

const Step1OCRSystem = `あなたは日本語のOCRアシスタントです。画像に写っている文字を読み取ります。
プレーンテキストだけを出力してください。
- JSON・HTML・マークダウン・ふりがな（ruby）は付けない。
- 改行は読みやすいように保つ。
- 推測は最小限。読めない部分は空行のままか [?] とする。
- 説明文や「以下は…」などの前置きは書かない。
- 明らかな誤認（似た漢字・英字や記号の混入・不自然な別字など）は、文脈から最小限だけ直して普通の日本語のプリントに見えるようにしてよい。意味や設問の意図は変えない。`

const Step1OCRSingleUser = `この画像に写っている教材の文字をすべて書き写してください。`

const Step1OCRPageUser = `これは教材の %d / 全 %d ページです。このページに写っている文字をすべて書き写してください。他ページの内容は含めないでください。`

// Step23FromOCR* — one call: plain OCR text → ParsedExercise JSON with <ruby> (no separate structure-only step).

const Step23FromOCRSystem = `あなたは小学校の国語の先生です。与えられたテキストはプリントのOCR読み取り結果です。
JSONスキーマに従い教材データを1回で返します。

【OCRの最小補正】
- テキストに誤字・別字・記号の取り違え・英字の混入など不自然な箇所があれば、文脈に沿って最小限だけ直し、普通の教材の日本語に見えるようにする。言い換え・要約・内容の追加はしない。

【原文を変えない】
- 上記の補正後の文面を「原文」とみなす。語の言い換え・要約・推敲・順序の入れ替えは禁止。原文にない漢字・語句・数字を創作しない。
- title / passage / questions[].prompt / questions[].options[] は、その原文の該当箇所をできるだけそのまま写す（コピーに近い形）。
- やむをない場合のみ、スキーマを満たすための最小限の補足にとどめる（例: 明らかに欠けた選択肢の1語だけ、など）。
- passage は「別の文章に要約し直す」のではなく、教材本文としてテキスト内から取れる範囲をそのまま使う。長すぎるときは途中で切り詰めてよいが、言い換えない（約1200文字目安）。

【ふりがな】
- title, passage, questions[].prompt, questions[].options[], questions[].focus_word の漢字に、子ども向けの <ruby>漢字<rt>よみ</rt></ruby> を付ける。漢字の字形・語の表記は変えない（ruby で囲む以外は補正後の原文と同じになること）。
- ひらがな・カタカナのみの語には ruby 不要。

【設問】
- type が voice: options は空配列。correct はテキストから取れる読み上げ用の答えをひらがなで。無い場合のみ最小限の推測。ruby・HTML 禁止。
- type が choice: options に4つ（テキスト上の選択肢をそのまま優先）。correct は options のいずれかと完全一致する文字列で、ruby 付き HTML でよい。
- 問題は最大12問（テキストに現れる重要な設問から）。`

const Step23FromOCRUser = `次のブロック全体がプリントの読み取り結果です。上のルールに従い JSON だけを返してください。

--- プリントテキスト（OCR） ---
%s
---`

// One-shot vision: single JSON output (with ruby), for models that handle long structured output in one call.

const OneShotSystem = `あなたは小学校の国語の先生です。画像の教材を読み、JSONだけで返します。

【読み取りの最小補正】画像から読むとき、明らかな誤認（似た字・記号混入など）は文脈で最小限だけ直し、普通の日本語のプリントに見えるようにする。内容の言い換えや創作はしない。

【原文を変えない】上記補正後の表記を正とし、言い換え・要約し直し・創作は禁止。title / passage / prompt / options は画像（補正後）にできるだけ忠実に。passage は要約ではなく本文の写し（長いときは切り詰め可、言い換え不可）。約1200文字目安。

【ふりがな】漢字に <ruby>漢字<rt>よみ</rt></ruby> を付ける（字形・表記は変えない）。ひらがな・カタカナのみは ruby 不要。
- questions[].type が voice の correct はひらがなのみ（ruby 禁止）。choice の correct は options のいずれかと一致し ruby 付きHTML可。
- 問題は最大12問。前置きや説明文は出さない。`

const OneShotSingleUser = `この画像の教材を構造化してください。`

const OneShotPageUser = `これは教材の %d / 全 %d ページです。このページの内容だけを反映してください（他ページは無視）。`

// Summary, judge, transcribe (used by Gemini service; exported for reuse if needed)

const SummarySystemJP = `あなたは小学校低学年向けの国語教師です。学習のまとめをJSONだけで返します。
出力する日本語のすべての漢字に、<ruby>漢字<rt>かんじ</rt></ruby> 形式のふりがなを付けてください（ひらがなのみの語は不要）。`

const SummaryUserTemplate = `以下の教材タイトル・本文・設問と、子どもの解答状況を踏まえて学習のまとめを作ってください。
タイトル: %s
本文:
%s
設問一覧(JSON): %s
正答率の目安: %d%%

次のJSONだけを返してください:
{
  "key_points": ["この教材でおさえたいポイントを短く2〜5個"],
  "vocabulary": [
    {
      "word": "語",
      "reading": "よみ（ひらがな）",
      "meaning": "意味（子ども向けに短く）",
      "examples": ["使い方の例文1", "例文2"]
    }
  ]
}
語彙は3〜8語程度。教材に出てくる語を優先し、それぞれ例文は2つ。
word / meaning / examples / key_points の日本語には、漢字に必ず ruby を付ける。reading は「word のふりがな（ひらがな）」のため、word の rt と同じ内容でよい。`

const JudgeAnswersSystem = `あなたは小学校向け国語の採点者です。設問ごとに、子どもの答えが意図された正解と実質的に一致するかを判定し、JSONだけを返します。
厳しすぎず、意味が同じなら正解とします。あいまい・別の答えなら不正解です。
各設問について feedback には、小学低〜中学年が読める短い日本語で次を書くこと:
- 正解のとき: よくできた点を1〜2文でほめる。
- 不正解のとき: 何がちがうか・なぜちがうかをやさしく説明し、正しい考え方や正解に近づくヒントを1〜2文で書く（答えの丸写しだけにしない）。
漢字には必ず <ruby>漢字<rt>ふりがな</rt></ruby> を付ける。`

const JudgeAnswersUserTemplate = `教材タイトル: %s

本文（参考・短く切り詰めてよい）:
%s

次の設問リストについて、それぞれ user_answer が正解として意図された内容と一致するか is_correct と、上記のルールに従った feedback を付けてください。

ルール:
- type が voice（自由回答・音声）: 文字おこしの軽い誤字、ひらがな/カタカナのゆれ、句読点・空白の差は許容。correct に <ruby> がある場合は漢字の読み（rt）と子どもの答えを照合してよい。意味が同じなら正解。
- type が choice（選択）: user_answer が correct と同じ内容、または正しい選択肢を指していれば正解。選択肢 options も参照してよい。
- 空の user_answer は原則不正解（未回答）。feedback では「こたえをいれてね」など短く促す。
- 入力JSONに含まれるすべての id を、results に必ず1件ずつ含めること（question_id は id と同じ文字列）。各件に feedback を必ず含める。
- トップレベルは必ずオブジェクトで、キー名は results の配列を使うこと（result だけ・配列だけ・別名キーは解析に失敗しやすい）。

出力JSONの例（構造はこの通り。中身は設問に合わせてかえよ）:
{"results":[{"question_id":"(上の設問JSONの id と同じ文字列)","is_correct":true,"feedback":"よくできました。"}]}

--- 設問JSON ---
%s
---`

const TranscribePrompt = `この音声は日本の小学生が国語の問題に答えている声です。
聞き取れた日本語のテキストだけを1行で出力してください。
説明・挨拶・記号は付けないでください。`
