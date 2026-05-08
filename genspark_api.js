/**
 * Genspark API Client Library
 * 
 * 外部のウェブアプリ・バックエンドからGensparkの機能を呼び出すためのライブラリです。
 * 依存パッケージなしで動作します。（Node.js / Deno 等を想定）
 */

export class GensparkClient {
    /**
     * クライアントの初期化
     * @param {Object} options 
     * @param {string} options.apiKey - GensparkのAPIキー (必須)
     * @param {string} [options.baseUrl="https://www.genspark.ai"] - ベースURL
     * @param {string} [options.projectId] - プロジェクトID (任意)
     * @param {number} [options.timeout=300000] - タイムアウト時間（ミリ秒）
     * @param {boolean} [options.debug=false] - デバッグモード
     * @param {string} [options.outputFormat="json"] - 出力フォーマット ("json" または "text")
     */
    constructor(options = {}) {
        if (!options.apiKey) {
            throw new Error("Genspark API Key is required.");
        }
        this.apiKey = options.apiKey;
        this.baseUrl = (options.baseUrl || 'https://www.genspark.ai').replace(/\/$/, '');
        this.projectId = options.projectId;
        this.timeout = options.timeout || 300000;
        this.debug = options.debug || false;
        this.outputFormat = options.outputFormat || 'json';
    }

    /**
     * 内部用リクエストヘルパー
     */
    async _request(endpoint, method = 'GET', body = null, signal = null) {
        const url = `${this.baseUrl}/api/tool_cli${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
        };
        if (this.projectId) headers['X-Project-ID'] = this.projectId;
        if (this.debug) headers['X-Debug'] = 'true';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        const reqSignal = signal || controller.signal;

        try {
            const response = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: reqSignal,
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * ツールの実行（テキスト・JSONなどの一括取得）
     * outputFormatが'text'の場合は人間が読みやすい文字列として返します。
     * @param {string} toolName - ツール名 (例: 'web_search')
     * @param {Object} args - ツールへ渡す引数
     * @returns {Promise<Object|string>} APIレスポンス
     */
    async executeTool(toolName, args) {
        const resultObj = await this._executeToolRaw(toolName, args);
        if (this.outputFormat === 'text') {
            return this._formatAsText(resultObj);
        }
        return resultObj;
    }

    /**
     * ツールの実行（内部用 - 常にJSONオブジェクトを返す）
     * NDJSONストリームをパースして最終結果を取得する。
     * @param {string} toolName - ツール名
     * @param {Object} args - ツールへ渡す引数
     * @returns {Promise<Object>} APIレスポンス（常にJSONオブジェクト）
     */
    async _executeToolRaw(toolName, args) {
        const response = await this._request(`/${toolName}`, 'POST', args);

        // ツールAPIはNDJSON（改行区切りのJSON）で返ることがあるため、
        // ストリームを読み取って最終結果（statusを含む行）を取得する
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult = null;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                let newlineIdx;

                while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.substring(0, newlineIdx).trim();
                    buffer = buffer.substring(newlineIdx + 1);

                    if (!line || !line.startsWith('{')) continue;

                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.status) {
                            finalResult = parsed;
                        }
                    } catch (e) { }
                }
            }

            // 残りのバッファ
            const remaining = buffer.trim();
            if (remaining && remaining.startsWith('{')) {
                try {
                    const parsed = JSON.parse(remaining);
                    if (parsed.status) finalResult = parsed;
                } catch (e) { }
            }
        } finally {
            reader.releaseLock();
        }

        return finalResult || { status: 'error', message: 'No final result found' };
    }

    /**
     * ストリーミングAPIの呼び出し（タスク・エージェント用）
     * @param {string} taskType - タスクの種類 (例: 'docs', 'slides')
     * @param {string} message - ユーザーからのプロンプト
     * @param {Object} options - オプション (project_id, use_model等)
     * @returns {AsyncGenerator<Object, Object, unknown>}
     */
    async *executeTaskStream(taskType, message, options = {}) {
        const body = {
            message,
            task_type: taskType,
            ...options
        };

        const response = await this._request('/agent_ask', 'POST', body);
        if (!response.body) {
            throw new Error("No response body from stream");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult = null;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                let newlineIdx;

                while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.substring(0, newlineIdx).trim();
                    buffer = buffer.substring(newlineIdx + 1);

                    if (!line || !line.startsWith('{')) continue;

                    try {
                        const parsed = JSON.parse(line);
                        // "status" が含まれていれば最終結果、それ以外は経過イベント
                        if (parsed.status) {
                            finalResult = parsed;
                        } else {
                            yield parsed;
                        }
                    } catch (e) {
                        // parse error, ignore
                    }
                }
            }

            // 残りのバッファ
            const remaining = buffer.trim();
            if (remaining && remaining.startsWith('{')) {
                try {
                    const parsed = JSON.parse(remaining);
                    if (parsed.status) finalResult = parsed;
                } catch (e) { }
            }
        } finally {
            reader.releaseLock();
        }

        return finalResult || { status: 'error', message: 'No final result found' };
    }
    
    //##################################################################################
    // 検索・解析
    //##################################################################################
    /**
     * Web検索
     * @param {String} query 検索クエリ
     * @param {Object} options オプション
     * @returns {Promise<Object>} 
     */
    async webSearch(query, options = {}) {
        const searchResult = await this._executeToolRaw('web_search', { q: query, ...options });
        return {
            raw: searchResult.data?.result || "",
            results: searchResult.data?.organic_results || [],
            status: searchResult.status,
            message: searchResult.message
        }
    }
    /**
     * 画像検索
     * @param {String} query 検索クエリ
     * @param {Object} options オプション
     * @returns {Promise<Object>} 
     */
    async imageSearch(query, options = {}) {
        const searchResult = await this._executeToolRaw('image_search', { query: query, ...options });
        return {
            raw: searchResult.data?.result || "",
            sites: searchResult.data|| [],
            images: searchResult.session_state?.flow_items || [],
            status: searchResult.status,
            message: searchResult.message
        }
    }
    /**
     * Webページ要約
     * @param {String} url URL
     * @param {String} question 質問
     * @param {Object} options オプション
     * @returns {Promise<{raw: string, summary: string, info: Object, status: string, message: string}>} 
     */
    async summarizeWeb(url, question, options = {}) {
        const searchResult = await this._executeToolRaw('summarize_large_document', { url: url, question: question, ...options });
        return {
            raw: searchResult.data?.result || "",
            summary: searchResult.data?.result || "",
            info: searchResult.session_state || {},
            status: searchResult.status,
            message: searchResult.message
        }
    }
    /**
     * オンラインの画像を解析する
     * @param {Array<String>} urls URL
     * @param {String} instruction 指示
     * @param {Object} options オプション
     * @returns {Promise<{raw: string, summary: string, info: Object, status: string, message: string}>} 
     */
    async analyzeImage(urls, instruction, options = {}) {
        const searchResult = await this._executeToolRaw('understand_images', { 
            image_urls: urls, 
            instruction: instruction, 
            ...options 
        });
        return {
            raw: searchResult.data?.result || "",
            results: searchResult.data?.results || [],
            summary: searchResult.data?.summary || "",
            info: searchResult.session_state?.understood_images || [],
            status: searchResult.status,
            message: searchResult.message
        }
    }
    /**
     * ローカルの画像を解析する（内部的にはファイルをアップロードしてから解析する）
     * @param {Blob} image 画像データ
     * @param {String} instruction 指示
     * @param {Object} options オプション
     * @returns {Promise<{raw: string, summary: string, info: Object, status: string, message: string}>} 
     */
    async analyzeLocalImage(image, instruction, options = {}) {
        const uploadResult = await this.uploadFile(image);
        if (uploadResult.status !== 'ok') {
            throw new Error('Failed to upload image: ' + uploadResult.message);
        }
        const url = uploadResult.data.file_wrapper_url;
        return await this.analyzeImage([url], instruction, options);
    }
    /**
     * 音声を解析して文字起こしする
     * @param {Array<String>} urls 音声のURL
     * @param {Object} options オプション(model, etc...)
     * @returns {Promise<{raw: string, summary: string, info: Object, status: string, message: string}>} 
     */
    async transcribeAudio(urls, options = {}) {
        const searchResult = await this._executeToolRaw('audio_transcribe', { 
            audio_urls: urls,  
            ...options 
        });
        return {
            raw: searchResult.data || "",
            results: searchResult.session_state?.results || [],
            status: searchResult.status,
            message: searchResult.message
        }
    }
    /**
     * ローカルの音声を解析して文字起こしする（内部的にはファイルをアップロードしてから解析する）
     * @param {Array<Blob>} audios 音声データ
     * @param {Object} options オプション(model, etc...)
     * @returns {Promise<{raw: string, summary: string, info: Object, status: string, message: string}>} 
     */
    async transcribeLocalAudio(audios, options = {}) {
        let urls = [];
        for (const audio of audios) {
            const uploadResult = await this.uploadFile(audio);
            if (uploadResult.status !== 'ok') {
                throw new Error('Failed to upload image: ' + uploadResult.message);
            }
            urls.push(uploadResult.data.file_wrapper_url);
        }
        return await this.transcribeAudio(urls, options);
    }

    //##################################################################################
    // 汎用ファイル操作
    //##################################################################################
    /**
     * ファイルのアップロード（gsk upload 相当）
     * 他のコマンドの引数として使えるfile_wrapper_urlを生成する。
     * 
     * @param {File|Blob} file - アップロードするファイル（File または Blob）
     *   - テキストデータの場合も new Blob([text], { type: 'text/plain' }) のように Blob化して渡す
     * @param {Object} [options]
     * @param {string} [options.name] - ファイル名（Fileオブジェクトの場合は自動取得）
     * @param {string} [options.contentType] - MIMEタイプ（省略時はfileのtype、不明ならapplication/octet-stream）
     * @returns {Promise<Object>} APIのレスポンスJSONをそのまま返す
     */
    async uploadFile(file, options = {}) {
        const name = options.name || file.name || 'uploaded_file';
        const contentType = options.contentType || file.type || 'application/octet-stream';

        // 1. アップロードURLを取得
        const urlResp = await this._request('/file/upload_url', 'POST', {
            content_type: contentType,
            name,
        });
        const urlData = await urlResp.json();
        if (urlData.status !== 'ok' || !urlData.data?.upload_url) {
            throw new Error(`Failed to get upload URL: ${urlData.message}`);
        }

        const { upload_url, file_wrapper_url } = urlData.data;

        // 2. 取得したURLに対してPUTリクエストで直接アップロード
        //    Azure Blob Storage 向けに x-ms-blob-type ヘッダーも付与
        const putResp = await fetch(upload_url, {
            method: 'PUT',
            headers: {
                'Content-Type': contentType,
                'x-ms-blob-type': 'BlockBlob',
            },
            body: file,
        });

        if (!putResp.ok) {
            throw new Error(`Upload failed: HTTP ${putResp.status}`);
        }

        // CLIと同じレスポンス形式で返す
        return {
            status: 'ok',
            message: 'File uploaded successfully',
            data: {
                file_wrapper_url,
                file_name: name,
                content_type: contentType,
                size_bytes: file.size,
            }
        };
    }


    /**
     * ファイルのダウンロード（gsk download相当）
     * @param {string} fileWrapperUrl - "/api/files/s/..." 形式のURL
     * @returns {Promise<Response>} fetchのResponseオブジェクトを返す。
     */
    async downloadFile(fileWrapperUrl) {
        // 1. ダウンロードURLの解決
        const resp = await this._request('/file/download', 'POST', {
            file_wrapper_url: fileWrapperUrl
        });
        const result = await resp.json();

        if (result.status !== 'ok' || !result.data?.download_url) {
            throw new Error(`Failed to get download URL: ${result.message}`);
        }

        // 2. 解決された実際のURLをfetchする
        const actualResp = await fetch(result.data.download_url);
        if (!actualResp.ok) {
            throw new Error(`Download fetch failed: HTTP ${actualResp.status}`);
        }

        return actualResp;
    }
    //##################################################################################
    // AIドライブ操作
    //##################################################################################
    /**
     * AI Drive 操作（gsk drive相当）
     * ls, mkdir, move, get_readable_url 等のメタ操作用。
     * ファイルのアップロードは uploadToDrive() を使用してください。
     * @param {string} action - アクション (ls, mkdir, move, get_readable_url 等)
     * @param {Object} params - アクションごとのパラメータ (path, target_path 等)
     * @returns {Promise<Object>} APIレスポンス
     */
    async executeDrive(action, params = {}) {
        return this._executeToolRaw('aidrive', {
            action,
            ...params
        });
    }
    /**
     * AI Driveのファイル一覧を取得する
     * @param {string} path 
     * @returns {Promise<Object>} {"content": any, "msg": string}
     */
    async driveList(path, options = {}) {
        const driveResult = await this.executeDrive('ls', { path, ...options });
        return {
            raw: driveResult.data?.result || "",
            files: driveResult.session_state?.aidrive_result?.files || [],
            status: driveResult.status,
            message: driveResult.message
        };
    }
    /**
     * AI Driveにディレクトリを作成する
     * @param {string} path 
     * @param {object} options 
     * @returns {Promise<Object>} {"raw": any, "path": string, "status": string, "message": string}
     */
    async driveMkdir(path, options = {}) {
        const driveResult = await this.executeDrive('mkdir', { path, ...options });
        return {
            raw: driveResult.data?.result || "",
            path: driveResult.session_state?.aidrive_result?.path || "",
            status: driveResult.status,
            message: driveResult.message
        };
    }
    /**
     * AI Drive上のファイルを移動する
     * @param {string} sourcePath 
     * @param {string} targetpath 
     * @param {object} options 
     * @returns {Promise<Object>} {"raw": any, "status": string, "source_path": string, "target_path": string, "message": string}
     */
    async driveMoveFile(sourcePath, targetpath, options = {}) {
        const driveResult = await this.executeDrive("move", {
            path: sourcePath,
            target_path: targetpath,
            ...options
        });
        return {
            raw: driveResult.data?.result || "",
            status: driveResult.status,
            source_path: driveResult.session_state?.aidrive_result?.source_path || "",
            target_path: driveResult.session_state?.aidrive_result?.target_path || "",
            message: driveResult.message
        }
    }
    /**
     * AI Drive からファイルを取得する
     * @param {string} path 
     * @param {string} filetype 
     * @returns {Promise<Object>} {"content": any, "msg": string}
     */
    async driveGetFile(path, filetype = "text") {
        const urlresult = await this.executeDrive("get_readable_url", {path});
        if (urlresult.status == "ok") {
            const url =  urlresult.session_state?.aidrive_result?.readable_url;
            if (url) {
                const dwresult = await this.downloadFile(url);
                if (dwresult.ok) {
                    if (filetype == "text") {
                        return {content: await dwresult.text(), msg:""}
                    } else if (filetype == "json") {
                        return {content: await dwresult.json(), msg:""}
                    } else if (filetype == "buffer") {
                        return {content: await dwresult.arrayBuffer(), msg:""}
                    } else if (filetype == "blob") {
                        return {content: await dwresult.blob(), msg:""}
                    } else if (filetype == "stream") {
                        return {content: dwresult.body, msg:""}
                    } else {
                        return {content: null, msg:"unknown filetype"}
                    }
                }else{
                    return {content: null, msg:"download error"}
                }
            }else{
                return {content: null, msg:"url not found"}
            }            
        } else {
            return {content: null, msg:"get url error"}
        }
    }
    /**
     * 特定のオンラインコンテンツをダウンロードしてAIドライブに保存する
     * @param {string} url - ダウンロードするオンラインコンテンツのURL
     * @param {string} target_path - AIドライブ上の保存先フォルダパス
     * @param {object} options - 追加オプション
     * @returns {Promise<Object>} {"raw": any, "fileinfo": any, "status": string, "message": string}
     */
    async driveDownloadFile(url, target_path, options = {}) {
        const driveResult = await this.executeDrive("download_file", {
            file_url: url, 
            target_folder: target_path, 
            ...options
        });
        return {
            raw: driveResult.data?.result || "",
            fileinfo: driveResult.session_state?.aidrive_result || {},
            status: driveResult.status,
            message: driveResult.message
        }
    }
    /**
     * 特定のオンラインの動画をダウンロードしてAIドライブに保存する
     * @param {string} url - ダウンロードするオンラインコンテンツのURL
     * @param {string} target_path - AIドライブ上の保存先フォルダパス
     * @param {object} options - 追加オプション
     * @returns {Promise<Object>} {"raw": any, "fileinfo": any, "status": string, "message": string}
     */
    async driveDownloadVideo(url, target_path, options = {}) {
        const driveResult = await this.executeDrive("download_video", {
            video_url: url, 
            target_folder: target_path, 
            ...options
        });
        return {
            raw: driveResult.data?.result || "",
            fileinfo: driveResult.session_state?.aidrive_result || {},
            status: driveResult.status,
            message: driveResult.message
        }
    }
    /**
     * AI Drive へのファイルアップロード（gsk drive upload 相当）
     * AI Driveの指定パスにファイルを直接アップロードする。
     * 
     * @param {File|Blob} file - アップロードするファイル（File または Blob）
     * @param {string} uploadPath - AI Drive上のアップロード先パス (例: "/images/photo.png")
     * @param {Object} [options]
     * @param {string} [options.contentType] - MIMEタイプ（省略時はfileのtype、不明ならapplication/octet-stream）
     * @param {boolean} [options.override=false] - 同名ファイルがある場合に上書きするか
     * @returns {Promise<Object>} APIのレスポンスJSONをそのまま返す
     */
    async driveUploadFile(file, uploadPath, options = {}) {
        const contentType = options.contentType || file.type || 'application/octet-stream';
        const override = options.override || false;

        // AI Drive専用のアップロードエンドポイントに直接POSTする
        let url = `${this.baseUrl}/api/tool_cli/aidrive/upload?upload_path=${encodeURIComponent(uploadPath)}`;
        if (override) url += '&override=true';

        const headers = {
            'Content-Type': contentType,
            'X-Api-Key': this.apiKey,
        };
        if (this.projectId) headers['X-Project-ID'] = this.projectId;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: file,
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`AI Drive upload failed: HTTP ${response.status}: ${text}`);
            }

            // サーバーからのレスポンスJSONをそのまま返す
            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    //##################################################################################
    // 画像、動画、音声生成
    //##################################################################################
    /**
     * 画像生成
     * @param {String} query プロンプト
     * @param {Object} args 追加オプション(model, aspect_ratio(1:1, 4:3, 3:4, 2:3, 3:2, 16:9, 9:16), image_size(auto, 0.5k, 1k, 2k, 3k, 4k), etc...)
     * @param {Number} chunkSize 
     * @returns {Promise<{result: Object, stream: AsyncGenerator<string>}>
     */
    async imageGeneration(query, args, chunkSize = 2048) {
        const result = await this.generateMediaStream("image_generation", { 
            query: query,
            ...args
        }, chunkSize);
        return result;
    }
    /**
     * 動画生成
     * @param {String} query プロンプト
     * @param {String} model モデル名
     * @param {Object} args 追加オプション
     * @param {Number} chunkSize 
     * @returns {Promise<{result: Object, stream: AsyncGenerator<string>}>
     */
    async videoGeneration(query, model, args, chunkSize = 2048) {
        const result = await this.generateMediaStream("video_generation", { 
            query: query,
            model: model,
            ...args
        }, chunkSize);
        return result;
    }
    /**
     * 音声生成
     * @param {String} query プロンプト
     * @param {String} model モデル名
     * @param {Object} args 追加オプション
     * @param {Number} chunkSize 
     * @returns {Promise<{result: Object, stream: AsyncGenerator<string>}>
     */
    async audioGeneration(query, model, args, chunkSize = 2048) {
        const result = await this.generateMediaStream("audio_generation", { 
            query: query,
            model: model,
            ...args
        }, chunkSize);
        return result;
    }

    /**
     * メディア生成とBase64ストリーミング返却 (アプローチA: 省メモリ実装)
     * @param {string} toolName - ツール名 (例: 'image_generation', 'video_generation')
     * @param {Object} args - ツールに渡す引数
     * @param {number} [chunkSize=2048] - Base64で分割して返すチャンクサイズの目安
     * @returns {Promise<{result: Object, stream: AsyncGenerator<string>}>}
     *   result: ツール実行結果のJSONオブジェクト（常にraw JSON）
     *   stream: Base64文字列チャンクを順次返すAsyncGenerator
     */
    async generateMediaStream(toolName, args, chunkSize = 2048) {
        // 1. ツールの実行 (画像・動画の生成) - 常にraw JSONで取得
        const result = await this._executeToolRaw(toolName, args);
        if (result.status !== 'ok') {
            return { result, stream: null };
        }

        // JSONからURLを探す
        // CLIの output_file_keys と同じドット記法（例: "generated_images.0.image_urls.0"）で
        // ネストされたオブジェクトからも探索する
        const searchKeys = [
            'generated_images.0.image_urls.0',  // image_generation
            'generated_videos.0.video_urls.0',  // video_generation
            'generated_audios.0.audio_urls.0',  // audio_generation
            'url',
            'file_wrapper_url',
            'download_url',
            'image_url',
            'video_url',
        ];
        let targetUrl = this._extractNestedValue(result.data, searchKeys);

        if (!targetUrl) {
            throw new Error("Media URL not found in API response.");
        }

        // 2. URLのダウンロードストリームを取得
        let mediaResponse;
        if (targetUrl.includes('/api/files/')) {
            mediaResponse = await this.downloadFile(targetUrl);
        } else {
            mediaResponse = await fetch(targetUrl);
            if (!mediaResponse.ok) {
                throw new Error(`Media fetch failed: HTTP ${mediaResponse.status}`);
            }
        }

        if (!mediaResponse.body) {
            throw new Error("No body in media response");
        }

        // 3. Base64ストリームを生成するジェネレータを作成
        const self = this;
        const body = mediaResponse.body;
        async function* createBase64Stream() {
            const reader = body.getReader();
            let buffer = new Uint8Array(0);
            const targetByteLen = Math.floor(chunkSize / 4) * 3 || 3;

            try {
                while (true) {
                    const { done, value } = await reader.read();

                    if (value) {
                        const newBuffer = new Uint8Array(buffer.length + value.length);
                        newBuffer.set(buffer);
                        newBuffer.set(value, buffer.length);
                        buffer = newBuffer;

                        while (buffer.length >= targetByteLen) {
                            const chunkToEncode = buffer.slice(0, targetByteLen);
                            buffer = buffer.slice(targetByteLen);
                            yield self._bytesToBase64(chunkToEncode);
                        }
                    }

                    if (done) {
                        if (buffer.length > 0) {
                            yield self._bytesToBase64(buffer);
                        }
                        break;
                    }
                }
            } finally {
                reader.releaseLock();
            }
        }

        return { result, stream: createBase64Stream() };
    }

    /**
     * Uint8Array を Base64 文字列に変換するユーティリティ (ブラウザ/Node両対応の簡易実装)
     * @param {Uint8Array} bytes 
     * @returns {string}
     */
    _bytesToBase64(bytes) {
        if (typeof Buffer !== 'undefined') {
            // Node.js 環境
            return Buffer.from(bytes).toString('base64');
        } else {
            // ブラウザ・Deno環境
            let binary = '';
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        }
    }

    /**
     * ドット記法のキー配列からネストされたオブジェクトの値を探索するユーティリティ
     * CLIの extractFileUrl と同等の機能。
     * @param {Object} data - 探索対象のオブジェクト
     * @param {string[]} keys - ドット区切りのキーパス配列 (例: ["generated_images.0.image_urls.0", "url"])
     * @returns {string|null} 最初に見つかった文字列値、またはnull
     */
    _extractNestedValue(data, keys) {
        for (const key of keys) {
            let current = data;
            for (const part of key.split('.')) {
                if (current == null || typeof current !== 'object') {
                    current = undefined;
                    break;
                }
                current = current[part];
            }
            if (typeof current === 'string' && current.length > 0) {
                return current;
            }
        }
        return null;
    }

    /**
     * CLIの `--output text` 相当のフォーマット関数
     * JSONオブジェクトを人間が読みやすいMarkdown風のテキストに変換します。
     */
    _formatAsText(data, indent = 0) {
        if (data === null || data === undefined) return "";

        // ルートレベルのApiResponseアンラップ ({status: "ok", data: ...})
        if (indent === 0 && typeof data === 'object' && !Array.isArray(data)) {
            if (data.status === 'error') {
                return `Error: ${data.message || "Unknown error"}`;
            }
            if (data.status === 'ok' && 'data' in data) {
                return this._formatAsText(data.data, 0);
            }
        }

        if (typeof data === "string") return data;
        if (typeof data === "number" || typeof data === "boolean") return String(data);

        const pad = "  ".repeat(indent);

        if (Array.isArray(data)) {
            if (data.length === 0) return "(empty)";
            return data.map((item, i) => {
                const formatted = this._formatAsText(item, indent + 1);
                if (typeof item === "object" && item !== null && !Array.isArray(item)) {
                    const lines = formatted.split("\n");
                    if (lines.length <= 1) return `${pad}${i + 1}. ${lines[0]}`;
                    return `${pad}${i + 1}. ${lines[0]}\n${lines.slice(1).join("\n")}`;
                }
                return `${pad}${i + 1}. ${formatted}`;
            }).join("\n");
        }

        if (typeof data === "object") {
            const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
            if (entries.length === 0) return "(empty)";
            return entries.map(([k, v]) => {
                if (typeof v === "object") {
                    return `${pad}${k}:\n${this._formatAsText(v, indent + 1)}`;
                }
                return `${pad}${k}: ${String(v)}`;
            }).join("\n");
        }

        return String(data);
    }
}
