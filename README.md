# HINOKAWA AI — WhatsApp Style AI Assistant

Aplikasi web asisten AI interaktif dengan antarmuka mirip WhatsApp Dark Mode yang mendukung percakapan teks dan Voice Note dua arah (Speech-to-Text & Text-to-Speech suara perempuan **Coral**) menggunakan OpenAI API dan Netlify Functions.

## Fitur Utama
- **Antarmuka WhatsApp Dark Mode**: Bubble chat hijau `#005c4b`, wallpaper pola WhatsApp, status online/mengetik, serta pemutar Voice Note dengan tombol Play/Pause dan scrubber.
- **Konteks Percakapan**: Menyimpan riwayat obrolan secara lokal dan mengirim konteks ke OpenAI Responses API.
- **Voice Note Dua Arah**: Rekam suara langsung dari mikrofon -> ditranskrip oleh `gpt-4o-mini-transcribe` -> dijawab oleh `gpt-4o-mini` -> dibacakan kembali dengan suara perempuan natural (`coral`) melalui `gpt-4o-mini-tts`.

## Panduan Pemasangan & Deploy ke Netlify

### 1. Siapkan OpenAI API Key
1. Buka [platform.openai.com](https://platform.openai.com/) dan masuk ke akun Anda.
2. Buka menu **API Keys** -> klik **Create new secret key**.
3. Salin API Key Anda (dimulai dengan `sk-...`).

### 2. Upload Kode ke GitHub
1. Buat repository baru di GitHub bernama `hinokawa-ai`.
2. Pastikan struktur file di dalam repository sesuai dengan susunan:
   - `index.html`
   - `style.css`
   - `script.js`
   - `netlify.toml`
   - `README.md`
   - `netlify/functions/chat.js`
   - `netlify/functions/transcribe.js`
   - `netlify/functions/speech.js`
3. Push seluruh file ke repository GitHub Anda.

### 3. Deploy ke Netlify
1. Masuk ke [app.netlify.com](https://app.netlify.com/).
2. Klik **Add new site** -> **Import an existing project**.
3. Pilih **GitHub** dan pilih repository `hinokawa-ai`.
4. Pada bagian pengaturan build:
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
5. Sebelum klik deploy, klik **Add environment variables** (atau masuk ke **Site configuration** -> **Environment variables** setelah deploy):
   - **Key**: `OPENAI_API_KEY`
   - **Value**: *(Tempelkan OpenAI API Key Anda)*
6. Klik **Deploy site** (atau **Trigger deploy** -> **Deploy site** jika baru menambahkan Environment Variable).
7. Buka URL website Netlify Anda, izinkan akses mikrofon saat diminta, dan **HINOKAWA AI** siap digunakan!
