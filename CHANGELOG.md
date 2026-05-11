# Changelog

本ドキュメントはGenspark API Client Libraryの変更履歴を記録します。

## [0.4.0] - 2026-05-11

### メディア解析機能の追加

**新規機能:**

- `analyzeMultimedia(urls, instruction)` — オンラインメディア（動画/音声）の解析
- `analyzeLocalMultimedia(media, instruction)` — ローカルメディアの解析（自動アップロード対応）


---

## [0.3.0] - 2026-05-08

### 便利メソッドの追加とAPI設計の改善

**破壊的変更:**

- `uploadToDrive()` → `driveUploadFile()` にリネーム（AI Drive系メソッドの命名統一）
- 便利メソッドの `options` から `outputFormat` デフォルト値を削除
  - `outputFormat` は `GensparkClient` コンストラクタでのみ設定するように統一

**バグ修正:**

- `webSearch()` 内で `client.executeTool` を呼んでいたバグを `this._executeToolRaw` に修正
- `driveGetFile()` で `readable_url` が `undefined` の場合に `url != ""` が `true` になるバグを修正（`if (url)` に変更）
- 便利メソッド全体を `executeTool` → `_executeToolRaw` に変更
  - `outputFormat: 'text'` 設定時でも便利メソッドが正しくJSONフィールドを抽出できるように

**新規機能（検索・解析）:**

- `webSearch(query)` — Web検索
- `imageSearch(query)` — 画像検索
- `summarizeWeb(url, question)` — Webページ要約
- `analyzeImage(urls, instruction)` — オンライン画像の解析
- `analyzeLocalImage(image, instruction)` — ローカル画像の解析（自動アップロード対応）
- `transcribeAudio(urls)` — 音声文字起こし
- `transcribeLocalAudio(audios)` — ローカル音声の文字起こし（自動アップロード対応）

**新規機能（AI Drive）:**

- `driveList(path)` — ファイル一覧取得
- `driveMkdir(path)` — ディレクトリ作成
- `driveMoveFile(sourcePath, targetPath)` — ファイル移動
- `driveGetFile(path, filetype)` — ファイル内容取得（text/json/buffer/blob/stream）
- `driveDownloadFile(url, targetPath)` — オンラインファイルをDriveに保存
- `driveDownloadVideo(url, targetPath)` — オンライン動画をDriveに保存

**新規機能（メディア生成）:**

- `imageGeneration(query, args, chunkSize)` — 画像生成
- `videoGeneration(query, model, args, chunkSize)` — 動画生成
- `audioGeneration(query, model, args, chunkSize)` — 音声生成
- `generateMediaStream` の `searchKeys` に `generated_videos.0.video_urls.0` と `generated_audios.0.audio_urls.0` を追加

**設計改善:**

- `executeDrive` を `_executeToolRaw` ベースに変更（`outputFormat` の影響を受けない）
- ソースコードにセクションコメント（検索・解析 / 汎用ファイル操作 / AIドライブ操作 / メディア生成）を追加


## [0.2.0] - 2026-05-08

### アップロード機能の刷新

**破壊的変更:**

- `uploadFile()` のインターフェースを変更
  - 旧: `uploadFile({ buffer, contentType, name })`
  - 新: `uploadFile(file, options)` — `File` または `Blob` を直接受け取る形式に変更
  - テキストデータも `new Blob([text], { type: 'text/plain' })` でBlob化して渡す仕様

**新規機能:**

- `uploadToDrive(file, uploadPath, options)` — AI Drive直接アップロード（`gsk drive upload` 相当）
  - `executeDrive` から分離した専用メソッド
  - AI Driveの指定パスにファイルを直接POSTする
  - 上書きオプション (`override`) 対応
  - レスポンスJSONをそのまま返す（加工なし）
- `uploadFile` に Azure Blob Storage 用の `x-ms-blob-type: BlockBlob` ヘッダーを追加

**その他:**

- `executeDrive` のドキュメントからアップロード操作の言及を削除（`uploadToDrive` を案内）

## [0.1.0] - 2026-05-08

### 初回リリース

**新規機能:**

- `GensparkClient` クラスの実装
  - `executeTool(toolName, args)` — 任意のツール実行（JSON/テキスト形式対応）
  - `executeTaskStream(taskType, message, options)` — タスクエージェントのNDJSONストリーミング
  - `uploadFile({ buffer, contentType, name })` — メモリバッファからのファイルアップロード
  - `downloadFile(fileWrapperUrl)` — ファイルダウンロード（`gsk download` 相当）
  - `executeDrive(action, params)` — AI Drive操作（`gsk drive` 相当）
  - `generateMediaStream(toolName, args, chunkSize)` — メディア生成＋Base64ストリーミング

**設計上の特徴:**

- 1ファイル完結（`genspark_api.js`）、外部依存なし
- ESM形式（`import/export`）
- `outputFormat` オプションによるJSON/テキスト出力切替
- Base64ストリーミングはアプローチA（省メモリ実装）を採用
  - ダウンロードストリームから3の倍数バイトずつBase64変換
  - 指定チャンクサイズ（デフォルト2048文字）で分割して `yield`
  - 全チャンクを単純結合するだけで正しいBase64が復元される設計
- `generateMediaStream` の戻り値は `{ result, stream }` 形式
  - `result` にツール実行結果のJSONオブジェクト（URL等の確認用）
  - `stream` にBase64チャンクのAsyncGenerator
- ネストされたレスポンスからのURL探索にドット記法対応（CLIの `extractFileUrl` 相当）

**テスト:**

- `test_genspark_api.js` で以下の動作を確認済み
  - Web検索（JSON/テキスト形式）
  - AI Driveのファイル一覧取得
  - 画像生成とBase64チャンク受信 → デコードしてJPEGファイルとして正常に復元できることを確認
