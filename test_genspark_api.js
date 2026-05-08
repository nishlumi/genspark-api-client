import fs from 'fs';
import os from 'os';
import path from 'path';
import { GensparkClient } from './genspark_api.js';

/**
 * 既存のCLI設定からAPIキーを取得するヘルパー関数
 */
function getApiKey() {
  if (process.env.GSK_API_KEY) return process.env.GSK_API_KEY;
  
  try {
    const configPath = path.join(os.homedir(), '.genspark-tool-cli', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.api_key;
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

async function runTests() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("エラー: APIキーが見つかりません。環境変数 GSK_API_KEY を設定するか、`gsk login` でログインしてください。");
    process.exit(1);
  }

  const client = new GensparkClient({ 
    apiKey, 
    timeout: 60000
  });

  console.log("========================================");
  console.log("Genspark API ライブラリ テスト開始");
  console.log("========================================\n");

  // ==========================================
  // テスト1: 基本ツールの実行 (web_search) - JSON形式
  // ==========================================
  const test1 = async () => {
    console.log("▶ テスト1: Web検索 (executeTool) - JSON形式");
    try {
      console.log("「AIニュース」を検索中...");
      const searchResult = await client.executeTool('web_search', { q: "最新のAIニュース 2026" });
      if (searchResult.status === 'ok') {
        console.log("✅ 検索成功！");
        const titles = searchResult.data?.organic_results?.slice(0, 3).map(r => r.title) || [];
        console.log("結果の一部:", titles);
      } else {
        console.error("❌ 検索失敗:", searchResult.message);
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }
  }
  

  console.log("\n----------------------------------------\n");

  // ==========================================
  // テスト1b: Web検索 - Text形式 (outputFormat: 'text' テスト)
  // ==========================================
  const test1b = async () => {
    console.log("▶ テスト1b: Web検索 (executeTool) - Text形式");
    try {
      const textClient = new GensparkClient({ apiKey, timeout: 60000, outputFormat: 'text' });
      console.log("「AIニュース」をテキスト形式で検索中...");
      const textResult = await textClient.executeTool('web_search', { q: "最新のAIニュース 2026" });
      if (typeof textResult === 'string') {
        console.log("✅ テキスト形式で取得成功！");
        // 先頭の数行だけ表示
        console.log(textResult.split('\n').slice(0, 8).join('\n') + '\n...');
      } else {
        console.error("❌ テキスト形式での取得失敗");
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }
  }

  const test1c = async () => {
    console.log("▶ テスト1c: Web検索 (image_search) - JSON形式");
    try {
      const query = "猫 駅長";
      console.log(query, "を画像検索中...");
      const searchResult = await client.imageSearch(query);
      if (searchResult.status === 'ok') {
        console.log("✅ 検索成功！");
        console.log(searchResult);
      } else {
        console.error("❌ 検索失敗:", searchResult.message);
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }
  }

  console.log("\n----------------------------------------\n");

  // ==========================================
  // テスト2: AI Driveの操作 (executeDrive) - JSON形式
  // ==========================================
  const test2 = async () => {
    console.log("▶ テスト2: AI Driveの操作 (executeDrive) - JSON形式");
    try {
      console.log("ルートディレクトリのファイル一覧を取得中...");
      const driveResult = await client.executeDrive('ls', { path: '/', outputFormat: "json" });
      if (driveResult.status === 'ok') {
        console.log("✅ ドライブ一覧取得成功！");
        console.log(driveResult);
        //const files = driveResult.data?.result || [];
        const files = driveResult.session_state?.aidrive_result?.files || [];
        console.log(`ルートに ${files.length} 個のファイル/フォルダがあります。`);
        if (files.length > 0) {
          console.log("最初の一つ:",files[0]);
        }
      } else {
        console.error("❌ 取得失敗:", driveResult.message);
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }
  }

  console.log("\n----------------------------------------\n");

  // ==========================================
  // テスト3: メディア生成とBase64ストリーム (generateMediaStream)
  // ==========================================
  const test3 = async () => {
    console.log("▶ テスト3: 画像生成とBase64チャンク取得 (generateMediaStream)");
    try {
      console.log("画像を生成しています（少し時間がかかります）...");
      const { result, stream } = await client.generateMediaStream('image_generation', { 
        query: "A simple red apple on a white background",
        aspect_ratio: "1:1"
      }, 2048);

      // ツール実行結果のJSONを先に確認できる
      console.log("✅ 画像生成完了！ ツール実行結果:");
      console.log(JSON.stringify(result,null,2));
      console.log("  status:", result.status);
      console.log("  URL:", result.data?.generated_images?.[0]?.image_urls?.[0] || result.data?.file_wrapper_url || result.data?.url || "不明");

      if (stream) {
        let chunkCount = 0;
        let totalChars = 0;
        let fulldata = "";

        for await (const chunk of stream) {
          chunkCount++;
          totalChars += chunk.length;
          if (chunkCount <= 3) {
            console.log(`📦 チャンク ${chunkCount} を受信 (長さ: ${chunk.length} 文字) -> ${chunk.substring(0, 30)}...`);
          } else if (chunkCount === 4) {
            console.log(`📦 ...以降のチャンクを受信中...`);
          }
          fulldata += chunk;
        }

        console.log(`✅ Base64受信完了: 合計 ${chunkCount} チャンク、合計 ${totalChars} 文字`);
        fs.writeFileSync('apple.txt', fulldata);
      } else {
        console.log("⚠ ストリームが取得できませんでした（メディアURLが見つからなかった可能性があります）");
      }

    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }
  }
  const test4 = async () => {
    console.log("▶ テスト4: crawler - JSON形式");
    try {
      console.log("crawler 開始...");
      const driveResult = await client.executeTool('crawler', { url: "https://docs.gdevelop.io/GDJS%20Runtime%20Documentation/classes/gdjs.Variable.html", outputFormat: "json" });
      if (driveResult.status === 'ok') {
        console.log("✅ crawler 完了");
        console.log(driveResult);
      } else {
        console.error("❌ 取得失敗:", driveResult.message);
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }
  }
  const test5 = async () => {
    console.log("▶ テスト5: uploadToDrive - JSON形式");
    try {
      const textBlob = new Blob(['Hello, World!\nTest data\n'], { type: 'text/plain' });
      await client.driveUploadFile(textBlob, '/hello.txt' );
      console.log("✅ uploadToDrive 完了");
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }
  }
  const test6 = async () => {
    console.log("▶ テスト6: AI Driveの操作 (executeDrive) - JSON形式");
    try {
      console.log("ファイルの取得中...");
      const driveResult = await client.executeDrive('ls', { path: '/', outputFormat: "json" });
      if (driveResult.status === 'ok') {
        console.log("✅ ドライブ一覧取得成功！");
        console.log(driveResult);
        //const files = driveResult.data?.result || [];
        const files = driveResult.session_state?.aidrive_result?.files || [];
        //---対象ファイルの検索
        const hitfile = files.find(v => v.name == "hello.txt");
        if (hitfile) {
          console.log("対象ファイル：",hitfile);
          const driveResult = await client.driveGetFile(hitfile.path,"text");
          if (driveResult.content) {
            console.log("✅ driveGetFile 取得成功！");
            //---driveResult.contentにテキストあるいは各形式のデータが格納されている。fetchに準拠
            console.log("downloaded text: ",driveResult);
          } else {
            console.error("❌ 取得失敗:", driveResult.message);
          }
        }
      } else {
        console.error("❌ 取得失敗:", driveResult.message);
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }
  }
  const test7 = async () => {
    console.log("▶ テスト7: AI Driveの操作 (driveDownloadFile) - JSON形式");
    try {
      const url = "https://www.post.japanpost.jp/zipcode/dl/oogaki/zip/13tokyo.zip";
      const driveResult = await client.driveDownloadFile(url,"/");
      if (driveResult.status === 'ok') {
        console.log("✅ driveDownloadFile 成功！");
        console.log(driveResult);
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }

  }
  const test8 = async () => {
    console.log("▶ テスト8: ローカルの画像を解析する（analyzeLocalImage）");
    try {
      const image = fs.readFileSync("sample/apple.jpg");
      const bb = new Blob([image], {type: "image/jpeg"});
      console.log("画像読み込み完了、解析スタート");
      const driveResult = await client.analyzeLocalImage(bb, "この画像の説明");
        console.log(driveResult);
      if (driveResult.status === 'ok') {
        console.log("✅ analyzeLocalImage 成功！");
        
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }

  }
  const test9 = async () => {
    console.log("▶ テスト9: 音声を文字起こしする（transcribe)");
    try {
      const audio = fs.readFileSync("sample/myvoice.mp3");
      const audio2 = fs.readFileSync("sample/myvoice2.mp3");
      
      const bb = new Blob([audio], {type: "audio/mp3"});
      const bb2 = new Blob([audio2], {type: "audio/mp3"});

      console.log("音声読み込み完了、文字起こしスタート");
      const driveResult = await client.transcribeLocalAudio([bb,bb2]);
      console.log(driveResult);
      if (driveResult.status === 'ok') {
        console.log("✅ transcribe 成功！");
        
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }

  }
  const test10 = async () => {
    console.log("▶ テスト10: crawler - JSON形式");
    try {
      const url = "https://note.com/lumidina/n/nbf52c4403d36";
      const result = await client.crawler(url);
      if (result.status === 'ok') {
        console.log("✅ crawler 成功！");
        console.log(result);
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }

  }
  const test11 = async () => {
    console.log("▶ テスト11: social_twitter - JSON形式");
    try {
      const result = await client.executeTool("social_twitter",{
        action: "search_posts",
        query: "戦艦少女R",
        language: "ja",
      });
      if (result.status === 'ok') {
        console.log("✅ social_twitter 成功！");
        console.log(result);
      }
    } catch (e) {
      console.error("❌ 例外発生:", e.message);
    }

  }


  //await test1();
  //await test1b();
  //await test1c();
  //await test2();
  //await test3();
  //await test4();
  //await test5();
  //await test6();
  //await test7();
  //await test8();
  //await test9();
  //await test10();
  await test11();
  
  console.log("\n========================================");
  console.log("すべてのテストが終了しました");
  console.log("========================================");
}

runTests();
