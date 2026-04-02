# こくごアトリエ (Kokugo)

小学校向け国語プリントをスキャンし、Gemini で問題化して練習するアプリです。

## 必要なもの

- Go 1.23+
- Node.js 20+（フロントのビルド・開発用）
- `GOOGLE_API_KEY`（スキャン解析・音声文字起こし・まとめ生成）

## セットアップ

```bash
cp .env.example .env
# .env に GOOGLE_API_KEY を設定
```

## フロントをビルドしてサーバを起動

```bash
cd web/ui && npm install && npm run build
cd ../..
go run ./cmd/server
```

ブラウザで `http://127.0.0.1:8787`（`PORT` で変更可）。

## 開発（Vite + API プロキシ）

ターミナル1: `go run ./cmd/server`  
ターミナル2: `cd web/ui && npm run dev` → `http://127.0.0.1:5173`（`/api` は 8787 にプロキシ）

## 主な機能

- **複数ページのプリント**: 1 枚目をアップロード後、同じ下書きに続けてページ追加（最大 12 枚）、まとめて解析
- **音声回答**: デスクトップは Web Speech API、iPad 等は録音 → `/api/transcribe`（Gemini）。録音には **HTTPS**（例: Tailscale Serve）が必要な場合があります
- **学習まとめ・単語カード**: 結果画面から AI まとめ生成、おさらいページでフラッシュカード
- **新しいスキャン**: ホームの「プリントをスキャン」またはサイドバー「スキャン」で下書き ID をクリアしてやり直し

## 環境変数

| 変数 | 説明 |
|------|------|
| `PORT` | 待ち受けポート（既定 8787） |
| `KOKUGO_DB` | SQLite パス |
| `KOKUGO_UPLOADS` | 画像保存ディレクトリ |
| `GOOGLE_API_KEY` | Gemini API キー |
| `GEMINI_MODEL` | 既定 `gemini-2.5-flash` |
| `CHILD_NAME` | ホームのあいさつ名 |
