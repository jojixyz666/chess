# Chess Web App

Antarmuka catur modern berbasis web dengan highlight gerakan, drag-and-drop, PGN export, serta bot minimax dengan alpha-beta pruning.

## Ringkasan
- Tech stack: HTML + Tailwind CDN, CSS kustom, dan JavaScript murni (tanpa bundler).
- Fitur utama: legalitas langkah lengkap, bot dengan pengaturan depth, hint best move, PGN otomatis, papan interaktif (drag, highlight, animasi).
- Siap jalan lokal: cukup buka index.html di browser desktop modern (Chrome/Edge) atau via ekstensi Live Server.

## Fitur
- Legality lengkap: langkah sah, check, checkmate, stalemate, rokade, en passant, promosi otomatis ke ratu.
- Bot minimax dengan alpha-beta pruning; pilih kedalaman (depth) 1–4 dan toggle bot on/off kapan saja.
- Hint "Best Move" menampilkan langkah terbaik menurut evaluasi bot beserta skornya.
- Highlight interaktif: kotak terpilih, langkah legal, tangkapan, jejak langkah terakhir, dan animasi geser bidak.
- Pilih warna awal (Putih/Hitam) dan depth bot dari overlay sambutan; papan otomatis dibalik jika bermain Hitam.
- PGN selalu diperbarui otomatis dan dapat disalin dengan satu klik.

## Cara Menjalankan
1) Buka index.html di browser modern (klik ganda) atau jalankan melalui ekstensi Live Server di VS Code.
2) Pada overlay sambutan, pilih warna (Putih/Hitam) dan kedalaman bot, lalu mulai.
3) Jika bermain Putih, bot bergerak setelah Anda; jika bermain Hitam, bot jalan lebih dulu.

## Kontrol & UI
- New Game: mulai ulang posisi awal.
- Bot: On/Off: aktif/nonaktifkan bot; warna bot mengikuti lawan manusia.
- Hint (Best Move): tampilkan langkah terbaik untuk sisi yang akan bergerak.
- Depth: ubah kedalaman pencarian bot saat permainan berlangsung.
- PGN > Copy: salin notasi PGN terkini ke clipboard.

## Arsitektur & Logika
- Engine: minimax dengan alpha-beta; evaluasi mencakup nilai material, kontrol pusat, kemajuan pion, mobilitas, serta penalti/bonus kondisi skak.
- Legalitas langkah: generator lengkap termasuk rokade, en passant, promosi; pengecekan skak memastikan hanya langkah sah yang ditawarkan.
- Promosi: otomatis ke ratu untuk kecepatan input (tidak ada dialog pemilihan bidak).
- Penghitungan fullmove/halfmove: halfmove reset pada langkah pion atau tangkapan; fullmove naik tiap giliran putih selesai.

## Struktur Berkas
- index.html: markup utama + elemen kontrol (UI dan overlay start).
- style.css: tema papan, highlight, animasi bidak, dan background.
- main.js: logika permainan, legalitas langkah, bot minimax, PGN, dan interaksi UI (drag, klik, hint, copy).
- image/board: tekstur papan.
- image/piesces/white dan image/piesces/black: aset bidak; nama file mengikuti mapping di objek PIECE_IMG (perhatikan ratu hitam memakai nama file "quenn.svg").

## Catatan & Batasan
- Optimasi performa cocok untuk depth rendah-menengah (1–4); depth lebih tinggi akan melambat secara eksponensial.
- Bot memakai random tie-break ketika skor setara agar permainan tidak repetitif.
- Disarankan memakai browser desktop modern; drag-and-drop di perangkat sentuh belum dioptimalkan.

Selamat bermain dan bereksperimen!
