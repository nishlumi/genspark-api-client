# Genspark API Client Library

Genspark APIを外部のウェブアプリやバックエンドから直接呼び出すための有志による非公式JavaScriptライブラリです。  
依存パッケージなし・1ファイル完結のESモジュールとして設計されています。

## 特徴

- **1ファイル完結** — `genspark_api.js` をコピーするだけですぐに利用可能
- **外部依存なし** — Node.js 18+ 標準の `fetch` のみを使用
- **ESM形式** — `import { GensparkClient } from './genspark_api.js'` で利用
- **便利メソッド** — Web検索、画像解析、AI Drive操作などを簡潔に呼び出せる
- **メディアBase64ストリーム** — 画像・動画・音声を省メモリでBase64チャンクに変換して返却
- **出力フォーマット切替** — `executeTool` ではJSON / テキスト（CLIの `--output text` 相当）を選択可能

## クイックスタート

```javascript
import { GensparkClient } from './genspark_api.js';

const client = new GensparkClient({
  apiKey: 'gsk_xxxxxxx',
});

// Web検索（便利メソッド）
const { results } = await client.webSearch('AIニュース');
console.log(results);

// 汎用ツール実行
const result = await client.executeTool('web_search', { q: 'AIニュース' });
console.log(result.data.organic_results);
```

### APIキーの準備

Gensparkの公式サイトから、APIキーを取得してください。

1. https://gensparks.ai にアクセス
2. 左下のアイコンをクリック
3. 設定をクリック
4. APIキーをクリック
5. 新しいキーを作成ボタンをクリック
6. 表示されたAPIキーをコピー

APIキーは、OSの環境変数 `GSK_API_KEY` に設定するか、`GensparkClient` のコンストラクタで渡してください。

APIキーの漏洩に注意して保管してください。



## API リファレンス

### `new GensparkClient(options)`

クライアントの初期化。

| オプション | 型 | デフォルト | 説明 |
|---|---|---|---|
| `apiKey` | `string` | **(必須)** | Genspark APIキー |
| `baseUrl` | `string` | `https://www.genspark.ai` | APIのベースURL |
| `projectId` | `string` | — | プロジェクトID |
| `timeout` | `number` | `300000` | タイムアウト（ミリ秒） |
| `outputFormat` | `string` | `"json"` | `"json"` または `"text"`（`executeTool` のみに影響） |
| `debug` | `boolean` | `false` | デバッグモード |

> **Note:** `outputFormat` は `executeTool()` の戻り値にのみ影響します。  
> 便利メソッド（`webSearch` 等）は内部で常にJSONとして処理するため、`outputFormat` の設定に関係なく正しく動作します。

---

## 汎用メソッド

### `executeTool(toolName, args)`

任意のツールを実行し、結果をJSON（またはテキスト）で返します。

```javascript
const result = await client.executeTool('web_search', { q: '検索クエリ' });
const stock = await client.executeTool('stock', { symbol: 'AAPL' });
```

**引数:**
- `toolName` (`string`) — ツール名（例: `web_search`, `stock`, `image_generation`）
- `args` (`Object`) — ツールごとのパラメータ

**戻り値:** `Promise<Object|string>` — `outputFormat` が `"text"` の場合は整形済み文字列

---

### `executeTaskStream(taskType, message, options)`

タスクエージェント（ドキュメント生成、スライド作成など）をストリーミングで実行します。  
NDJSON形式の途中経過イベントをAsync Generatorで順次返します。

```javascript
for await (const event of client.executeTaskStream('docs', 'READMEを書いて')) {
  console.log(event); // heartbeat, tool_call 等のイベント
}
```

**引数:**
- `taskType` (`string`) — タスクの種類（`docs`, `slides` 等）
- `message` (`string`) — ユーザーからのプロンプト
- `options` (`Object`) — 追加オプション

**戻り値:** `AsyncGenerator<Object>` — 最終結果は `return` 値として取得可能

---

## 検索・解析メソッド

### `webSearch(query, options)`

Web検索を実行します。

```javascript
const { results, status } = await client.webSearch('AIニュース');
console.log(results); // organic_results の配列
```

**戻り値:** `{ raw, results, status, message }`

---

### `imageSearch(query, options)`

画像検索を実行します。

```javascript
const { sites, images } = await client.imageSearch('猫 駅長');
```

**戻り値:** `{ raw, sites, images, status, message }`

---

### `summarizeWeb(url, question, options)`

Webページを要約します。

```javascript
const { summary } = await client.summarizeWeb('https://example.com/article', '要点は？');
```

**戻り値:** `{ raw, summary, info, status, message }`

---

### `analyzeImage(urls, instruction, options)`

オンラインの画像を解析します。

```javascript
const { results, summary } = await client.analyzeImage(
  ['https://example.com/photo.jpg'],
  'この画像の服装を教えて'
);
```

**引数:**
- `urls` (`string[]`) — 画像URLの配列
- `instruction` (`string`) — 解析の指示

**戻り値:** `{ raw, results, summary, info, status, message }`

---

### `analyzeLocalImage(image, instruction, options)`

ローカルの画像を解析します（内部でアップロード → 解析）。

```javascript
import fs from 'fs';
const blob = new Blob([fs.readFileSync('photo.jpg')], { type: 'image/jpeg' });
const { summary } = await client.analyzeLocalImage(blob, 'この画像を説明して');
```

**引数:**
- `image` (`File|Blob`) — 画像データ
- `instruction` (`string`) — 解析の指示

**戻り値:** `{ raw, results, summary, info, status, message }`

---

### `transcribeAudio(urls, options)`

オンラインの音声ファイルを文字起こしします。

```javascript
const { results } = await client.transcribeAudio(['https://example.com/audio.mp3']);
```

**戻り値:** `{ raw, results, status, message }`

---

### `transcribeLocalAudio(audios, options)`

ローカルの音声ファイルを文字起こしします（内部でアップロード → 文字起こし）。

```javascript
const blob = new Blob([fs.readFileSync('voice.mp3')], { type: 'audio/mp3' });
const { results } = await client.transcribeLocalAudio([blob]);
```

**引数:**
- `audios` (`Blob[]`) — 音声データの配列

**戻り値:** `{ raw, results, status, message }`

---

## ファイル操作メソッド

### `uploadFile(file, options)`

ファイルをGensparkサーバーにアップロードし、他のコマンドで使えるfile_wrapper_urlを取得します。  
CLIの `gsk upload` に相当します。

```javascript
// ブラウザ: input[type=file] から取得したFile
const info = await client.uploadFile(fileInput.files[0]);
console.log(info.data.file_wrapper_url);

// Node.js: Blobとして渡す
const blob = new Blob([fs.readFileSync('photo.png')], { type: 'image/png' });
const info = await client.uploadFile(blob, { name: 'photo.png' });

// テキストデータもBlob化して渡す
const textBlob = new Blob(['Hello, World!'], { type: 'text/plain' });
await client.uploadFile(textBlob, { name: 'hello.txt' });
```

**引数:**
- `file` (`File|Blob`) — アップロードするファイル
- `options.name` (`string`) — ファイル名（Fileオブジェクトの場合は自動取得）
- `options.contentType` (`string`) — MIMEタイプ（省略時はfileのtype）

**戻り値:** `Promise<Object>` — `{ status, data: { file_wrapper_url, file_name, content_type, size_bytes } }`

---

### `downloadFile(fileWrapperUrl)`

Gensparkのファイル（`/api/files/s/...` 形式のURL）をダウンロードします。  
CLIの `gsk download` に相当します。

```javascript
const response = await client.downloadFile('https://www.genspark.ai/api/files/s/xxxxx');
const arrayBuffer = await response.arrayBuffer();
```

**戻り値:** `Promise<Response>` — fetchのResponseオブジェクト

---

## AI Drive メソッド

### `executeDrive(action, params)`

AI Driveの汎用操作メソッドです。下記の便利メソッドでカバーされない操作に使います。

**引数:**
- `action` (`string`) — アクション名（`ls`, `mkdir`, `move`, `get_readable_url` 等）
- `params` (`Object`) — アクションごとのパラメータ

---

### `driveList(path, options)`

ファイル一覧を取得します。

```javascript
const { files } = await client.driveList('/');
files.forEach(f => console.log(f.name, f.type, f.size));
```

**戻り値:** `{ raw, files, status, message }`

---

### `driveMkdir(path, options)`

ディレクトリを作成します。

```javascript
const { path } = await client.driveMkdir('/my-folder');
```

**戻り値:** `{ raw, path, status, message }`

---

### `driveMoveFile(sourcePath, targetPath, options)`

ファイルを移動します。

```javascript
await client.driveMoveFile('/old/file.txt', '/new/file.txt');
```

**戻り値:** `{ raw, status, source_path, target_path, message }`

---

### `driveGetFile(path, filetype)`

AI Driveからファイルの内容を取得します。

```javascript
// テキストファイル
const { content } = await client.driveGetFile('/path/to/file.txt', 'text');

// JSONファイル
const { content } = await client.driveGetFile('/path/to/data.json', 'json');

// バイナリ（ArrayBuffer）
const { content } = await client.driveGetFile('/path/to/image.jpg', 'buffer');

// Blob
const { content } = await client.driveGetFile('/path/to/file.pdf', 'blob');

// ReadableStream
const { content } = await client.driveGetFile('/path/to/large.zip', 'stream');
```

**引数:**
- `path` (`string`) — AI Drive上のファイルパス
- `filetype` (`string`) — `"text"`, `"json"`, `"buffer"`, `"blob"`, `"stream"`

**戻り値:** `{ content, msg }`

---

### `driveDownloadFile(url, targetPath, options)`

オンラインのファイルをダウンロードしてAI Driveに保存します。

```javascript
await client.driveDownloadFile('https://example.com/data.csv', '/downloads');
```

**戻り値:** `{ raw, fileinfo, status, message }`

---

### `driveDownloadVideo(url, targetPath, options)`

オンラインの動画をダウンロードしてAI Driveに保存します。

```javascript
await client.driveDownloadVideo('https://example.com/video.mp4', '/videos');
```

**戻り値:** `{ raw, fileinfo, status, message }`

---

### `driveUploadFile(file, uploadPath, options)`

AI Driveの指定パスにファイルを直接アップロードします。  
CLIの `gsk drive upload` に相当します。

```javascript
const blob = new Blob([imageBuffer], { type: 'image/png' });
const result = await client.driveUploadFile(blob, '/images/photo.png');

// 上書きオプション
await client.driveUploadFile(blob, '/images/photo.png', { override: true });
```

**引数:**
- `file` (`File|Blob`) — アップロードするファイル
- `uploadPath` (`string`) — AI Drive上のパス
- `options.contentType` (`string`) — MIMEタイプ（省略時はfileのtype）
- `options.override` (`boolean`) — 同名ファイルの上書き（デフォルト: `false`）

**戻り値:** `Promise<Object>` — APIのレスポンスJSONをそのまま返す

---

## メディア生成メソッド

### `imageGeneration(query, args, chunkSize)`

画像を生成し、Base64ストリームとして返します。

```javascript
const { result, stream } = await client.imageGeneration(
  'A red apple on white background',
  { aspect_ratio: '1:1' }
);

let base64 = '';
for await (const chunk of stream) {
  base64 += chunk;
}
fs.writeFileSync('apple.jpg', Buffer.from(base64, 'base64'));
```

**引数:**
- `query` (`string`) — プロンプト
- `args` (`Object`) — `model`, `aspect_ratio`(`1:1`, `4:3`, `16:9` 等), `image_size`(`auto`, `1k`, `2k` 等)
- `chunkSize` (`number`, デフォルト: `2048`)

**戻り値:** `{ result, stream }`

---

### `videoGeneration(query, model, args, chunkSize)`

動画を生成し、Base64ストリームとして返します。

```javascript
const { result, stream } = await client.videoGeneration(
  'A cat walking on the beach',
  'kling',
  { duration: 5 }
);
```

**戻り値:** `{ result, stream }`

---

### `audioGeneration(query, model, args, chunkSize)`

音声を生成し、Base64ストリームとして返します。

```javascript
const { result, stream } = await client.audioGeneration(
  '穏やかなピアノ曲',
  'minimax-music',
  {}
);
```

**戻り値:** `{ result, stream }`

---

### `generateMediaStream(toolName, args, chunkSize)`

メディア生成の汎用メソッド。上記の `imageGeneration` 等が内部で使用しています。

**引数:**
- `toolName` (`string`) — `image_generation`, `video_generation`, `audio_generation` 等
- `args` (`Object`) — ツールごとのパラメータ
- `chunkSize` (`number`, デフォルト: `2048`) — 1チャンクあたりのBase64文字数の目安

**戻り値:** `Promise<{ result: Object, stream: AsyncGenerator<string> | null }>`

> **Note:** チャンクは内部で3の倍数バイトずつBase64に変換されるため、  
> 全チャンクを単純に文字列結合するだけで正しいBase64文字列が復元されます。

---

## 出力フォーマット

`executeTool()` の戻り値は `outputFormat` で切り替えできます。

```javascript
const textClient = new GensparkClient({ apiKey, outputFormat: 'text' });
const text = await textClient.executeTool('web_search', { q: 'AI' });
console.log(text); // Markdown風の整形済みテキスト
```

> **Note:** 便利メソッド（`webSearch`, `analyzeImage` 等）は常にJSONとして処理するため、  
> `outputFormat: 'text'` を設定していても正しく動作します。

## 動作環境

- Node.js 18 以上
- Deno（`fetch` が標準で利用可能な環境）

## ライセンス

MIT


