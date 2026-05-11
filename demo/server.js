import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GensparkClient } from '../genspark_api.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.DEVPORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/**
 * API Client instance. 
 * API Key will be taken from .env or request header (for flexibility in demo)
 */
let client = null;

function getClient(apiKey) {
    if (!client && !apiKey) {
        // Fallback to .env
        const envKey = process.env.GSK_API_KEY;
        if (!envKey) throw new Error("No API Key provided in request or .env file");
        client = new GensparkClient({ apiKey: envKey });
    } else if (apiKey) {
        // Use provided key for this request (useful for demo where user inputs key)
        return new GensparkClient({ apiKey });
    }
    return client;
}

// --- API Endpoints ---

app.post('/api/web-search', async (req, res) => {
    try {
        const { query, apiKey } = req.body;
        const instance = getClient(apiKey);
        const result = await instance.webSearch(query);
        res.json(result);
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

app.post('/api/image-search', async (req, res) => {
    try {
        const { query, apiKey, options } = req.body;
        const instance = getClient(apiKey);
        const result = await instance.imageSearch(query, options);
        res.json(result);
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

app.post('/api/crawler', async (req, res) => {
    try {
        const { url, apiKey, options } = req.body;
        const instance = getClient(apiKey);
        console.log(url);
        console.log(options);
        const result = await instance.crawler(url, options);
        res.json(result);
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

app.post('/api/summary', async (req, res) => {
    try {
        const { url, query, apiKey } = req.body;
        const instance = getClient(apiKey);
        const result = await instance.summarizeWeb(url, query);
        res.json(result);
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

app.post('/api/image-gen', async (req, res) => {
    try {
        const { query, model, aspect_ratio, image_size, apiKey } = req.body;
        const instance = getClient(apiKey);
        
        const { result, stream } = await instance.imageGeneration(query, {
            model,
            aspect_ratio,
            image_size
        });

        if (!stream) {
            return res.status(500).json({ status: 'error', message: 'No image stream returned' });
        }

        let fullBase64 = "";
        for await (const chunk of stream) {
            fullBase64 += chunk;
        }

        res.json({
            status: 'ok',
            base64: fullBase64,
            result: result
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

app.listen(PORT, () => {
    console.log("*** Genspark API Sample demo app ***");
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`Serving files from ${__dirname}`);
});
