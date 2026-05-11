# Genspark API Client Demo App

This is a simple web-based playground to explore the features of the Genspark API Client library. It demonstrates web search, image search, web crawling, document summarization, and AI image generation.

## Features
- **Web Search**: Search the web and get results in a clean card format.
- **Image Search**: Search for images and browse them in a list.
- **Crawler**: Fetch the content of a web page and render it as Markdown.
- **Web Summary**: Get a concise summary of a web page based on a specific question.
- **Image Generation**: Generate high-quality images using various AI models.

## Quick Start

### 1. Prerequisites
- Node.js (LTS recommended)

### 2. Installation
Navigate to the `demo` directory and install the dependencies:
```bash
cd demo
npm install
```

### 3. API Key Configuration
The app requires a Genspark API Key. For security, the key is managed on the server side. You can set it in one of the following ways:

- **Environment Variable**:
  ```bash
  export GSK_API_KEY=your_api_key_here
  ```
- **.env File**:
  Create a file named `.env` in the `demo` directory:
  ```env
  GSK_API_KEY=your_api_key_here
  ```

### 4. Running the App
Start the Node.js proxy server:
```bash
node server.js
```
Or:
```bash
npm start
```
Now open your browser and visit:
`http://localhost:3000`

* The port number can be changed by setting the environment variable `DEVPORT` when running `npm start`.

## Project Structure
- `server.js`: Express server that acts as a CORS proxy and handles API requests.
- `index.html`: Single-page frontend UI.
- `../genspark_api.js`: The core API client library used by the server.
