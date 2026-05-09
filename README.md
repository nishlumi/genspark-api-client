# Genspark API Client Library

This is an unofficial, volunteer-created JavaScript library for calling the Genspark API directly from external web applications and backends.
It is designed as a zero-dependency, single-file ES module.

## Features

- **Single-File Setup** — Ready to use just by copying `genspark_api.js`.
- **Zero Dependencies** — Uses only the standard `fetch` available in Node.js 18+.
- **ESM Format** — Use via `import { GensparkClient } from './genspark_api.js'`.
- **Convenience Methods** — Easily call Web Search, Image Analysis, AI Drive operations, etc.
- **Media Base64 Streaming** — Returns images, videos, and audio as Base64 chunks to save memory.
- **Output Format Switching** — Choose between JSON or text (equivalent to CLI `--output text`) in `executeTool`.

## Quick Start

```javascript
import { GensparkClient } from './genspark_api.js';

const client = new GensparkClient({
  apiKey: 'gsk_xxxxxxx',
});

// Web Search (Convenience Method)
const { results } = await client.webSearch('AI News');
console.log(results);

// Generic Tool Execution
const result = await client.executeTool('web_search', { q: 'AI News' });
console.log(result.data.organic_results);
```

### Getting an API Key

Please obtain an API key from the official Genspark website.

1. Go to https://gensparks.ai
2. Click the icon in the bottom left corner
3. Click "Settings"
4. Click "API Keys"
5. Click the "Create new key" button
6. Copy the displayed API key

You can either set the API key in the OS environment variable `GSK_API_KEY` or pass it directly to the `GensparkClient` constructor.

Please keep your API key secure and prevent it from leaking.

## API Reference

### `new GensparkClient(options)`

Initializes the client.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | **(Required)** | Genspark API Key |
| `baseUrl` | `string` | `https://www.genspark.ai` | Base URL of the API |
| `projectId` | `string` | — | Project ID |
| `timeout` | `number` | `300000` | Timeout in milliseconds |
| `outputFormat` | `string` | `"json"` | `"json"` or `"text"` (affects only `executeTool`) |
| `debug` | `boolean` | `false` | Debug mode |

> **Note:** `outputFormat` only affects the return value of `executeTool()`.
> Convenience methods (like `webSearch`) internally process data as JSON, so they work correctly regardless of the `outputFormat` setting.

---

## Generic Methods

### `executeTool(toolName, args)`

Executes a specified tool and returns the result as JSON (or text).

```javascript
const result = await client.executeTool('web_search', { q: 'Search query' });
const stock = await client.executeTool('stock', { symbol: 'AAPL' });
const result = await client.executeTool('social_twitter', {
    action: "search_posts",  // Example: action name
    query: "Genspark",       // Other parameters
});
```

**Arguments:**
- `toolName` (`string`) — The name of the tool (e.g., `web_search`, `stock`, `image_generation`).
- `args` (`Object`) — Parameters specific to the tool.

**Returns:** `Promise<Object|string>` — If `outputFormat` is `"text"`, returns a formatted string.

---

### `executeTaskStream(taskType, message, options)`

Executes a task agent (such as document generation or slide creation) via streaming.
It sequentially yields intermediate progress events in NDJSON format using an Async Generator.

```javascript
for await (const event of client.executeTaskStream('docs', 'Write a README')) {
  console.log(event); // Events like heartbeat, tool_call, etc.
}
```

**Arguments:**
- `taskType` (`string`) — The type of task (e.g., `docs`, `slides`).
- `message` (`string`) — The user prompt.
- `options` (`Object`) — Additional options.

**Returns:** `AsyncGenerator<Object>` — The final result can be obtained as the `return` value.

---

## Search & Analysis Methods

### `webSearch(query, options)`

Performs a web search.

```javascript
const { results, status } = await client.webSearch('AI News');
console.log(results); // Array of organic_results
```

**Returns:** `{ raw, results, status, message }`

---

### `imageSearch(query, options)`

Performs an image search.

```javascript
const { sites, images } = await client.imageSearch('Cat Stationmaster');
```

**Returns:** `{ raw, sites, images, status, message }`

---

### `summarizeWeb(url, question, options)`

Summarizes a web page.

```javascript
const { summary } = await client.summarizeWeb('https://example.com/article', 'What is the main point?');
```

**Returns:** `{ raw, summary, info, status, message }`

---

### `analyzeImage(urls, instruction, options)`

Analyzes online images.

```javascript
const { results, summary } = await client.analyzeImage(
  ['https://example.com/photo.jpg'],
  'Describe the outfit in this image'
);
```

**Arguments:**
- `urls` (`string[]`) — Array of image URLs.
- `instruction` (`string`) — Instructions for the analysis.

**Returns:** `{ raw, results, summary, info, status, message }`

---

### `analyzeLocalImage(image, instruction, options)`

Analyzes a local image (internally handles upload → analysis).

```javascript
import fs from 'fs';
const blob = new Blob([fs.readFileSync('photo.jpg')], { type: 'image/jpeg' });
const { summary } = await client.analyzeLocalImage(blob, 'Explain this image');
```

**Arguments:**
- `image` (`File|Blob`) — The image data.
- `instruction` (`string`) — Instructions for the analysis.

**Returns:** `{ raw, results, summary, info, status, message }`

---

### `transcribeAudio(urls, options)`

Transcribes an online audio file.

```javascript
const { results } = await client.transcribeAudio(['https://example.com/audio.mp3']);
```

**Returns:** `{ raw, results, status, message }`

---

### `transcribeLocalAudio(audios, options)`

Transcribes local audio files (internally handles upload → transcription).

```javascript
const blob = new Blob([fs.readFileSync('voice.mp3')], { type: 'audio/mp3' });
const { results } = await client.transcribeLocalAudio([blob]);
```

**Arguments:**
- `audios` (`Blob[]`) — Array of audio data.

**Returns:** `{ raw, results, status, message }`

---

## File Operation Methods

### `uploadFile(file, options)`

Uploads a file to the Genspark server and retrieves a `file_wrapper_url` that can be used with other commands.
Equivalent to the CLI `gsk upload` command.

```javascript
// Browser: File obtained from input[type=file]
const info = await client.uploadFile(fileInput.files[0]);
console.log(info.data.file_wrapper_url);

// Node.js: Passed as a Blob
const blob = new Blob([fs.readFileSync('photo.png')], { type: 'image/png' });
const info = await client.uploadFile(blob, { name: 'photo.png' });

// Text data can also be uploaded by converting to a Blob
const textBlob = new Blob(['Hello, World!'], { type: 'text/plain' });
await client.uploadFile(textBlob, { name: 'hello.txt' });
```

**Arguments:**
- `file` (`File|Blob`) — The file to upload.
- `options.name` (`string`) — File name (automatically retrieved for File objects).
- `options.contentType` (`string`) — MIME type (defaults to the file's type).

**Returns:** `Promise<Object>` — `{ status, data: { file_wrapper_url, file_name, content_type, size_bytes } }`

---

### `downloadFile(fileWrapperUrl)`

Downloads a file from Genspark (URLs in the format `/api/files/s/...`).
Equivalent to the CLI `gsk download` command.

```javascript
const response = await client.downloadFile('https://www.genspark.ai/api/files/s/xxxxx');
const arrayBuffer = await response.arrayBuffer();
```

**Returns:** `Promise<Response>` — fetch's Response object.

---

## AI Drive Methods

### `executeDrive(action, params)`

A generic operation method for AI Drive. Used for operations not covered by the convenience methods below.

**Arguments:**
- `action` (`string`) — The action name (e.g., `ls`, `mkdir`, `move`, `get_readable_url`).
- `params` (`Object`) — Parameters specific to the action.

---

### `driveList(path, options)`

Retrieves a list of files.

```javascript
const { files } = await client.driveList('/');
files.forEach(f => console.log(f.name, f.type, f.size));
```

**Returns:** `{ raw, files, status, message }`

---

### `driveMkdir(path, options)`

Creates a directory.

```javascript
const { path } = await client.driveMkdir('/my-folder');
```

**Returns:** `{ raw, path, status, message }`

---

### `driveMoveFile(sourcePath, targetPath, options)`

Moves a file.

```javascript
await client.driveMoveFile('/old/file.txt', '/new/file.txt');
```

**Returns:** `{ raw, status, source_path, target_path, message }`

---

### `driveGetFile(path, filetype)`

Retrieves file content from AI Drive.

```javascript
// Text file
const { content } = await client.driveGetFile('/path/to/file.txt', 'text');

// JSON file
const { content } = await client.driveGetFile('/path/to/data.json', 'json');

// Binary (ArrayBuffer)
const { content } = await client.driveGetFile('/path/to/image.jpg', 'buffer');

// Blob
const { content } = await client.driveGetFile('/path/to/file.pdf', 'blob');

// ReadableStream
const { content } = await client.driveGetFile('/path/to/large.zip', 'stream');
```

**Arguments:**
- `path` (`string`) — File path on AI Drive.
- `filetype` (`string`) — `"text"`, `"json"`, `"buffer"`, `"blob"`, `"stream"`.

**Returns:** `{ content, msg }`

---

### `driveDownloadFile(url, targetPath, options)`

Downloads an online file and saves it to AI Drive.

```javascript
await client.driveDownloadFile('https://example.com/data.csv', '/downloads');
```

**Returns:** `{ raw, fileinfo, status, message }`

---

### `driveDownloadVideo(url, targetPath, options)`

Downloads an online video and saves it to AI Drive.

```javascript
await client.driveDownloadVideo('https://example.com/video.mp4', '/videos');
```

**Returns:** `{ raw, fileinfo, status, message }`

---

### `driveUploadFile(file, uploadPath, options)`

Uploads a file directly to a specified path on AI Drive.
Equivalent to the CLI `gsk drive upload` command.

```javascript
const blob = new Blob([imageBuffer], { type: 'image/png' });
const result = await client.driveUploadFile(blob, '/images/photo.png');

// Override option
await client.driveUploadFile(blob, '/images/photo.png', { override: true });
```

**Arguments:**
- `file` (`File|Blob`) — The file to upload.
- `uploadPath` (`string`) — The destination path on AI Drive.
- `options.contentType` (`string`) — MIME type (defaults to the file's type).
- `options.override` (`boolean`) — Overwrite if a file with the same name exists (default: `false`).

**Returns:** `Promise<Object>` — Returns the raw API JSON response.

---

## Media Generation Methods

### `imageGeneration(query, args, chunkSize)`

Generates an image and returns it as a Base64 stream.

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

**Arguments:**
- `query` (`string`) — The prompt.
- `args` (`Object`) — e.g., `model`, `aspect_ratio` (`1:1`, `4:3`, `16:9`, etc.), `image_size` (`auto`, `1k`, `2k`, etc.).
- `chunkSize` (`number`, default: `2048`)

**Returns:** `{ result, stream }`

---

### `videoGeneration(query, model, args, chunkSize)`

Generates a video and returns it as a Base64 stream.

```javascript
const { result, stream } = await client.videoGeneration(
  'A cat walking on the beach',
  'kling',
  { duration: 5 }
);
```

**Returns:** `{ result, stream }`

---

### `audioGeneration(query, model, args, chunkSize)`

Generates audio and returns it as a Base64 stream.

```javascript
const { result, stream } = await client.audioGeneration(
  'Calm piano music',
  'minimax-music',
  {}
);
```

**Returns:** `{ result, stream }`

---

### `generateMediaStream(toolName, args, chunkSize)`

A generic method for media generation. Used internally by methods like `imageGeneration` above.

**Arguments:**
- `toolName` (`string`) — e.g., `image_generation`, `video_generation`, `audio_generation`.
- `args` (`Object`) — Parameters specific to the tool.
- `chunkSize` (`number`, default: `2048`) — Estimated number of Base64 characters per chunk.

**Returns:** `Promise<{ result: Object, stream: AsyncGenerator<string> | null }>`

> **Note:** Because chunks are internally converted to Base64 in multiples of 3 bytes,
> you can restore the correct Base64 string simply by concatenating all the chunk strings.

---

## Output Formats

The return value of `executeTool()` can be toggled using `outputFormat`.

```javascript
const textClient = new GensparkClient({ apiKey, outputFormat: 'text' });
const text = await textClient.executeTool('web_search', { q: 'AI' });
console.log(text); // Formatted Markdown-like text
```

> **Note:** Convenience methods (like `webSearch`, `analyzeImage`) always process data internally as JSON,
> so they work correctly even if `outputFormat: 'text'` is set.

## Supported Environments

- Node.js 18+
- Deno (Environments where `fetch` is natively available)

## License

MIT
