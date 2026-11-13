// Contoh konfigurasi LinaLearning — setara .env.example di ketentuan submission.
// Cara pakai: salin file ini jadi config.js (di folder yang sama dengan index.html),
// lalu isi nilai aslinya. config.js masuk .gitignore dan TIDAK boleh di-push.
//
// Untuk deploy online (mis. Netlify Drop): drag folder lokal yang SUDAH berisi
// config.js terisi — jangan deploy langsung dari repo tanpa config.js.
window.LINA_CONFIG = {
  base: 'https://kenari.id/v1',            // base URL API Kenari (kenari.id)
  key: '',                                  // WAJIB diisi: API key Kenari (format kn-...)
  chatModel: 'glm-5-3-flash',               // model modul & slide (konteks 1M)
  // Cadangan kalau model utama 503: chatComplete turun berurutan (tanpa duplikat),
  // rantai saling back-up dua arah: modul/slide glm->luna, kuis luna->glm.
  chatFallbacks: ['gpt-6-luna', 'glm-5-3-flash'],
  quizModel: 'gpt-6-luna',                  // model kuis (tugas terstruktur cepat)
  asrModel: 'whisper-large-v3-turbo',       // speech-to-text
  chatProxy: ''                             // opsional: proxy utk provider tanpa CORS
};
