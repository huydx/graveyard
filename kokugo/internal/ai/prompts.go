package ai

// Prompts for the three-step pipeline: (1) OCR (2) structure (3) ruby

const Step1OCRSystem = `あなたは日本語のOCRアシスタントです。画像に写っている文字を読み取ります。
プレーンテキストだけを出力してください。
- JSON・HTML・マークダウン・ふりがな（ruby）は付けない。
- 改行は読みやすいように保つ。
- 推測は最小限。読めない部分は空行のままか [?] とする。
- 説明文や「以下は…」などの前置きは書かない。`

const Step1OCRSingleUser = `この画像に写っている教材の文字をすべて書き写してください。`

const Step1OCRPageUser = `これは教材の %d / 全 %d ページです。このページに写っている文字をすべて書き写してください。他ページの内容は含めないでください。`

const Step2StructureSystem = `あなたは小学校の国語の先生です。与えられたプリントのテキストから教材データをJSONだけで返します。
漢字にはまだふりがなを付けない。プレーンテキストの日本語のみ。HTMLタグは禁止（voice の correct はひらがな中心のプレーンテキスト）。`

const Step2StructureUser = `次のテキストはプリントの読み取り結果です。JSONスキーマに従って構造化してください。

--- プリントテキスト ---
%s
---

ルール:
- type が voice のときは options は空配列。correct はひらがな中心のプレーンテキストのみ（タグ禁止）。
- type が choice のときは4択、options に4つ、correct は正解と同じ文字列（プレーン日本語、ruby なし）。
- 問題は最大12問まで（重要な設問から）。
- passage は約1200文字以内の要約。長文の注意書きは省いてよい。
- title / passage / prompt / options はすべてプレーン日本語（ruby 禁止）。`

const Step3RubySystem = `あなたは小学校向け国語教材の編集者です。与えられたJSONの日本語に、子ども向けのふりがな（HTMLの ruby）だけを追加してください。
JSONのキー名・構造・配列の順序・問題の個数は変えない。`

const Step3RubyUser = `次のJSONを、同じ構造のまま返してください。変更点は次のとおり:
- title, passage, questions[].prompt, questions[].options[], questions[].focus_word の日本語の漢字に <ruby>漢字<rt>よみ</rt></ruby> を付ける。
- ひらがな・カタカナのみの語には ruby 不要。
- questions[].type が voice の **correct** は読み上げ用のため、**ひらがなのまま**（ruby も HTML も付けない）。
- questions[].type が choice の **correct** は options のいずれかと同じ文字列にし、**ruby 付きHTML**でよい。
長い本文では文または短い節ごとに1つの ruby にまとめてよい。

--- 入力JSON ---
%s
---`

// One-shot vision: single JSON output (with ruby), for models that handle long structured output in one call.

const OneShotSystem = `あなたは小学校の国語の先生です。画像の教材を読み、JSONだけで返します。
- title, passage, questions[].prompt, questions[].options[], questions[].focus_word の漢字に <ruby>漢字<rt>よみ</rt></ruby> を付ける。
- questions[].type が voice の correct はひらがなのみ（ruby 禁止）。choice の correct は options のいずれかと一致し ruby 付きHTML可。
- 問題は最大12問。passage は約1200文字以内の要約。前置きや説明文は出さない。`

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
厳しすぎず、意味が同じなら正解とします。あいまい・別の答えなら不正解です。`

const JudgeAnswersUserTemplate = `教材タイトル: %s

本文（参考・短く切り詰めてよい）:
%s

次の設問リストについて、それぞれ user_answer が正解として意図された内容と一致するか is_correct を付けてください。

ルール:
- type が voice（自由回答・音声）: 文字おこしの軽い誤字、ひらがな/カタカナのゆれ、句読点・空白の差は許容。correct に <ruby> がある場合は漢字の読み（rt）と子どもの答えを照合してよい。意味が同じなら正解。
- type が choice（選択）: user_answer が correct と同じ内容、または正しい選択肢を指していれば正解。選択肢 options も参照してよい。
- 空の user_answer は原則不正解（未回答）。
- 入力JSONに含まれるすべての id を、results に必ず1件ずつ含めること（question_id は id と同じ文字列）。

--- 設問JSON ---
%s
---`

const TranscribePrompt = `この音声は日本の小学生が国語の問題に答えている声です。
聞き取れた日本語のテキストだけを1行で出力してください。
説明・挨拶・記号は付けないでください。`
