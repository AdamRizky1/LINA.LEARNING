# Catatan desain

Arah desain: **web produk yang bersih dan tenang** — satu warna aksen,
kertas netral, tipografi tunggal, tanpa hiasan "template AI" (gradient
berlebih, glow, pill ber-glow, font display terpisah). Lapisan visual ini
diterapkan di atas fungsionalitas inti milik repo (login/akun, mesin fokus
ala alynne.edu, auto-send laporan MailKite, penyimpanan Turso) tanpa
mengubahnya — lihat bagian "Fitur inti yang dipertahankan".

## Token & visual

- Latar netral `#fafafb`, panel putih `#ffffff`, teks utama `#111827`,
  sekunder `#6b7280`. **Satu warna aksen**: indigo `#4f46e5` (dengan
  `--accent-dk` untuk hover). Tidak ada gradient merek, tidak ada glow/
  aura di atas hero. Status pakai tiga warna lembut: hijau `#059669`
  (sukses/jawaban benar/fokus bagus), amber `#b45309` (menunggu/
  peringatan), merah `#dc2626` (error/salah).
- Kartu putih, border tipis `#e7e7ec`, shadow sangat tipis (`--shadow-sm`).
  Radius konsisten per peran: kartu `12px`, tombol `8px`, pill/chip
  `999px`. Spacing kelipatan 8px.
- Tombol utama: solid indigo, radius 8px, `min-height:40px` (bukan pill
  ber-glow). Tombol kedua: putih border tipis, hover ke aksen. State
  hover/focus/disabled jelas.
- Tipografi **satu font: Inter** (Google Fonts, 400/500/600/700). Hierarki
  empat level: judul (section ~20px), subjudul (16px), body (15.5px),
  caption (13px). Label uppercase pakai `--muted` (kontras lolos WCAG AA,
  bukan pudar).

## Halaman masuk

- Hero sederhana: brand kotak + judul "Rekam pelajaran, jadi modul, slide
  & kuis" + sub. **Lencana "Dibantu AI" dihapus** dari hero (cukup judul).
- Kartu masuk berisi tab Masuk/Daftar, form username+password (dan
  nama+email ortu saat daftar), pesan status. Context aman (localhost/
  https) tetap diperingatkan.
- Logika autentikasi (scrypt, session cookie httpOnly via `/api/auth`,
  penyimpanan akun Turso) tidak diubah — hanya kulit visualnya.

## Beranda

- **Stepper tipis** di atas: Sumber → Proses → Belajar (dot state
  todo/active/done), sinkron otomatis dengan layar aktif. Nomor 1-2-3-4
  di kartu dihilangkan.
- **Dropzone besar** sebagai fokus tunggal: "Tarik file audio ke sini,
  atau rekam suara" + dua aksi jelas **Rekam** dan **Upload**. Tombol
  "Mulai rekam" baru muncul setelah Rekam dipilih. Drag-and-drop audio
  ke dropzone (file diteruskan ke input audio yang sudah ada).
- **Materi tambahan** di-collapse: link "+ Tambah materi (opsional)"
  yang bisa di-expand (textarea + tombol file). Hasil upload docx/pdf/
  rtf tetap digabung ke textarea materi sesuai perilaku bawaan (tidak
  diubah menjadi file-chip terpisah — pilihan safety agar tidak menyentuh
  alur baca file owner).
- Alur transkrip → susun tetap dua langkah sesuai bawaan: tombol
  "Mulai transkrip" tetap tampil (tidak disembunyikan/digabung), dan
  tombol utama "Mulai belajar" aktif setelah transkrip atau materi ada.
  Pilihan bahan (Modul/Slide/Peta/Kuis) sebagai chip yang bisa di-toggle.
- **Sesi sebelumnya** jadi list rapi: judul, tanggal, skor (fokus + kuis),
  tombol "Buka" (memuat ulang laporan sesi itu via `showReport`). Empty
  state kalau belum ada sesi.

## Mode belajar

- Konten (Modul/Slide/Kuis/Peta) jadi bintang utama, lebar baca maksimal
  ~720px.
- **Panel fokus collapsible**: summary "Fokus sesi 75%" selalu kelihatan,
  body (kamera + sensitivitas + statistik) bisa di-collapse dan **otomatis
  terbuka** saat masuk mode belajar. Penjelasan fokus panjang dipindah ke
  dalam body (hanya kelihatan kalau di-expand).
- **Selector sensitivitas** (Tinggi/Sedang/Rendah) tetap di panel fokus,
  nilai tersimpan di `lina-focus-sens` sesuai bawaan.
- **Tab ber-status**: tiap tab Modul/Slide/Kuis/Peta punya indikator
  kecil — spinner saat sedang disusun, centang hijau saat siap (di-mirror
  dari status pipeline).
- **Statistik fokus pakai konteks**: tile diwarnai lembut (hijau/amber/
  merah) + label kata "Fokus bagus"/"Lumayan"/"Banyak gangguan" +
  ringkasan angka di summary, bukan angka mentah doang. Skor dihitung
  mesin fokus bawaan (wajah 60 + ketenangan mic 40, rata-rata 20 sampel).
- **Smart warning fokus** tetap: rata-rata skor < 35 yang bertahan
  beberapa detik memunculkan popup kontekstual (wajah/suara/skor) +
  cooldown 30 dtk, kecepatannya ikut sensitivitas.
- Tombol **"Selesai belajar" jadi secondary** (bukan primary) + dialog
  konfirmasi sebelum sesi diakhiri (anti kepencet nggak sengaja).
- Pipeline progres tahap (Modul/Slide/Peta/Kuis chip status run→done)
  tetap, muncul hanya selama generate lalu sembunyi.

## Laporan

- Kartu laporan + tabel ringkasan + transkrip collapsible. Pengiriman
  **otomatis via MailKite** saat sesi selesai tetap (tombol kirim manual
  tidak ditambahkan — sesuai arah owner). Pesan status auto-send
  ditampilkan.

## Navbar & shell

- Navbar: logo kotak + 2 menu (Beranda/Mode belajar) + **avatar akun**
  di kanan. "nama + ortu: email" dipindah ke **popover profil** (klik
  avatar), bukan ditampilkan menetap di topbar. Avatar menampilkan huruf
  depan nama siswa. Wordmark disembunyikan di layar sempit.
- Footer disederhanakan: brand + tagline + © 2026 · AdamRizky1.
- Animasi halus 150-200ms, tidak ada yang berlebihan.
- Responsif HP: satu kolom, padding/tile dikecilkan, dropzone & stepper
  tetap nyaman dipakai dari layar kecil.
- **Dark mode** opsional via `prefers-color-scheme: dark` (token
  di-override: latar gelap `#0f1117`, panel gelap, teks terang).

## Fitur inti yang dipertahankan (tidak diubah)

Lapisan visual ini sengaja tidak menyentuh logika berikut — semuanya tetap
berjalan persis seperti commit owner terbaru:

- **Login & akun siswa**: halaman masuk/daftar, scrypt + session cookie
  httpOnly, penyimpanan ke DB Turso (`users`/`sessions`/`laporan`) via
  `/api/auth` + `/api/laporan`.
- **Mesin fokus ala alynne.edu**: skor = wajah (60) + ketenangan mic
  (40 − noise×0.4), `requestAnimationFrame` + rata-rata 20 sampel, cek
  wajah tiap 1,5 dtk via FaceDetector API/fallback skin-tone (tanpa model
  online). Tab disembunyikan = sampel 0. Satu `getUserMedia` sebagai
  gerbang: tanpa kamera nyala, tidak ada sampel dan angka fokus tidak
  muncul.
- **Smart warning + sensitivitas**: rata-rata < 35 bertahan
  ≥ max(3, round((50−sens)/3)) dtk → popup kontekstual + cooldown 30 dtk,
  pulih → reset. Sensitivitas 20/35/50 tersimpan di `lina-focus-sens`.
- **Routing 2 model** (modul/slide → glm, kuis → luna) + retry 3x per
  model + fallback saling back-up + pesan 503 jelas.
- **Laporan auto-send MailKite** saat sesi selesai, gagal diulang 3x.
- **Pipeline auto-generate**: lompat ke study langsung menyusun modul,
  slide, peta, kuis dengan chip progres + pilihan bahan per-user.
- **Kurikulum & peta materi ala NotebookLM**: jalur belajar bertahap +
  mind map tab Peta + chip sumber.

## Yang tetap dijaga

- Tidak ada emoji, tidak ada glassmorphism berlebihan, bahasa santai
  tapi copy profesional.
- Semua kontrol bisa diakses keyboard (focus-visible), tab role
  tablist/tab/tabpanel, status role=status.
- **Semua element ID yang dipakai JS tidak diubah** — fungsi rekam, ASR,
  generate, fokus, laporan, autentikasi tetap berjalan. Perubahan JS
  hanya empat titik bedah (`btn-finish`→konfirmasi, `renderHistory`→list,
  `updateFocusUI`→konteks tile, `resetHome` who→format avatar) plus satu
  blok additive untuk interaksi visual (popover, collapsible, dropzone,
  stepper sync, tab-status mirror) yang membungkus `show()` dan `pipeSet()`
  tanpa menimpa logika asli.
- Identitas owner AdamRizky1 tetap di footer.
