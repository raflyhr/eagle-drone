# Eagle Drone Mission Control

Platform web untuk monitoring misi drone, bukti visual, telemetri, rute penerbangan, serta arsip misi. Aplikasi ini bersifat **observasi dan pencatatan**; tidak mengirim perintah autopilot, motor, arah, atau kecepatan ke drone.

## Fitur Utama

- Dashboard misi dengan status telemetri MAVLink.
- Simulasi MAVLink otomatis untuk pengujian UI tanpa perangkat fisik.
- Koneksi WebSerial dan WebSocket MAVLink untuk sumber telemetri eksternal.
- Peta Leaflet/OpenStreetMap, rute drone, heading, posisi, dan area pencarian.
- Kamera browser melalui `getUserMedia`.
- Deteksi orang di browser menggunakan TensorFlow.js dan COCO-SSD.
- Capture foto beserta hasil deteksi AI.
- Penandaan lokasi/temuan pada posisi GPS drone.
- Mission Logs realtime dari Supabase.
- Flight Detail dari rekaman misi: route, koordinat, durasi, altitude, capture, dan marked location.
- Pagination Mission Logs: 10 mission per halaman.
- Hapus satu atau banyak log `Success` melalui mode checkbox.
- Halaman terakhir dan gaya peta disimpan untuk mempertahankan navigasi setelah refresh.

## Status Sistem

| Kapabilitas | Status | Keterangan |
|---|---|---|
| Dashboard React + Vite | Aktif | Antarmuka monitoring desktop.
| Simulasi MAVLink | Aktif | Generator heartbeat, attitude, GPS, position, dan battery.
| WebSerial MAVLink | Aktif | Untuk telemetry radio/USB pada browser yang mendukung WebSerial.
| WebSocket MAVLink | Aktif | Untuk MAVLink bridge eksternal.
| Kamera browser | Aktif | Membutuhkan izin browser.
| Deteksi manusia COCO-SSD | Aktif | Diproses di browser.
| Supabase PostgreSQL | Aktif | Menyimpan mission dan telemetry terkait.
| Supabase Storage | Aktif | Menyimpan capture pada bucket private `mission-captures`.
| Supabase Realtime | Aktif | Sinkronisasi Mission Logs.
| Kontrol autopilot | Tidak ada | Platform tidak mengendalikan drone.

## Arsitektur

```text
MAVLink source / Simulation
          |
          v
     useTelemetry
          |
          +--> Mission Overview / Map Area
          |
          +--> Supabase PostgreSQL
          |      missions
          |      mission_track_points
          |      mission_captures
          |      mission_marked_locations
          |
          +--> Supabase Storage
                 mission-captures/<mission-id>/<capture-id>.jpg

Flight History <---- Supabase Realtime: missions
Flight Detail  <---- Supabase PostgreSQL + signed Storage URLs
```

## Lifecycle Mission

1. Telemetry GPS pertama memulai satu record `missions` dengan status `live`.
2. Telemetry disimpan ke `mission_track_points` dengan sampling minimal 1,5 detik atau saat perpindahan melewati ambang jarak.
3. Ringkasan mission—durasi, jarak, altitude maksimum, posisi awal/akhir—diperbarui berkala.
4. Capture kamera di-upload ke Supabase Storage, lalu metadata dan hasil deteksi AI disimpan ke `mission_captures`.
5. Saat lokasi ditandai, marker dan track point pada koordinat serta timestamp yang sama disimpan ke database.
6. Saat koneksi dihentikan atau halaman ditutup/refresh, mission difinalisasi menjadi `success`.
7. Detail misi `Success` mengambil satu rekaman lengkap dari database. Mission `Live` tidak dapat dibuka sampai selesai.

Database menegakkan maksimal **satu mission `live`**. Saat mission `live` baru dibuat, mission live sebelumnya otomatis diubah menjadi `success`.

## Status Mission

| Status database | Status UI | Arti |
|---|---|---|
| `live` | Live | Mission sedang berjalan. Detail arsip belum dapat dibuka.
| `success` | Success | Mission telah selesai dan rekaman lengkap dapat dibuka/dihapus.

## Penyimpanan Data

Log mission dan evidence **tidak memakai localStorage**. Supabase adalah sumber data utama untuk rekaman penerbangan.

`localStorage` hanya dipakai untuk preferensi antarmuka:

- Halaman aktif: `eagle_active_page`
- Gaya peta: `eagle_map_style`
- Mode/cuaca koordinat perangkat: `eagle_weather_mode`, `eagle_weather_coords`

### Tabel PostgreSQL

| Tabel | Fungsi | Data utama |
|---|---|---|
| `missions` | Ringkasan satu penerbangan | kode, tipe, status, waktu, durasi, jarak, max altitude, koordinat awal/akhir |
| `mission_track_points` | Jalur telemetri | timestamp, latitude, longitude, altitude, speed, heading, battery |
| `mission_captures` | Metadata bukti visual | `storage_path`, waktu capture, hasil deteksi AI JSON |
| `mission_marked_locations` | Lokasi yang ditandai operator | koordinat, altitude, timestamp, capture terkait |

Relasi child menggunakan `ON DELETE CASCADE`, sehingga telemetry, capture metadata, dan marked location ikut terhapus saat mission dihapus.

### Supabase Storage

Bucket private `mission-captures` menyimpan foto dengan struktur:

```text
mission-captures/
└── <mission-uuid>/
    └── capture-<timestamp>.jpg
```

Saat Flight Detail dibuka, aplikasi membuat signed URL baru selama 1 jam menggunakan `createSignedUrl`. Karena path dan metadata disimpan di database, foto tetap dapat dibuka kembali setelah browser atau website ditutup.

Capture yang dibuat sebelum database mengembalikan `mission_id` ditahan sementara di memori lalu di-upload otomatis ketika ID tersedia. Ini bukan penyimpanan permanen lokal.

## Mission Logs

Mission Logs menggunakan Supabase Realtime untuk tabel `missions`.

- Baris baru langsung muncul.
- Durasi, jarak, altitude, dan status ikut diperbarui.
- Maksimum 10 mission per halaman.
- Search berdasarkan Mission ID.
- Mission `Live` tampil merah dan membuka modal informasi bila diklik.
- Mission `Success` dapat dibuka pada Flight Detail.
- Mode **Delete mission** menampilkan checkbox hanya pada mission `Success`.
- Hapus terpilih menghapus object Storage terlebih dahulu, lalu record mission. Mission `Live` tidak dapat dihapus.

## Flight Detail

Flight Detail hanya memakai data dari mission yang dipilih:

- Polyline rute dari `mission_track_points`.
- Start dan finish dari track pertama serta terakhir.
- Marked location dari `mission_marked_locations`.
- Capture gambar dari `mission_captures` dan Supabase Storage.
- Durasi, jarak, altitude, dan tanggal dari `missions`.

Data demo/fallback tidak digunakan untuk detail mission dari database. Rekaman lama ditampilkan apa adanya dan tidak dimodifikasi untuk menyesuaikan rute baru.

## Prasyarat

- Node.js LTS.
- npm.
- Project Supabase.
- Browser Chromium untuk WebSerial dan kamera.
- HTTPS untuk akses kamera pada deployment non-localhost.

## Instalasi

```bash
npm install
```

Buat file `.env` pada root project:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

`.env` diabaikan Git. Jangan commit service role key atau kredensial rahasia.

## Menyiapkan Supabase

Migration berada pada `supabase/migrations/`.

Urutan migration mencakup:

1. Pembuatan tabel mission, RLS policy, bucket `mission-captures`, dan index.
2. Penyesuaian tipe mission/status dari iterasi sebelumnya.
3. Publication Supabase Realtime untuk `missions` dan tabel detail.
4. Aturan satu mission `live`.
5. Policy delete mission `success` dan object capture.

Hubungkan Supabase CLI ke project lalu jalankan migration sesuai workflow tim/proyek Anda. Untuk menjalankan cleanup data demo yang tersedia di repository:

```bash
npm run db:clear
```

Perintah tersebut bersifat destruktif: menghapus data pada tabel mission terkait.

## Menjalankan Aplikasi

### Development

```bash
npm run dev
```

Buka URL yang ditampilkan Vite, biasanya `http://localhost:5173`.

### Build Produksi

```bash
npm run build
```

### Preview Build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Cara Uji Alur Mission

1. Jalankan `npm run dev`.
2. Buka Mission Overview; simulasi MAVLink berjalan otomatis.
3. Buka Flight History untuk melihat mission `Live` muncul secara realtime.
4. Hubungkan kamera dan aktifkan deteksi AI bila ingin membuat capture evidence.
5. Tandai lokasi dari kontrol mission untuk menyimpan marked location.
6. Refresh halaman atau disconnect MAVLink untuk memfinalisasi mission menjadi `Success`.
7. Buka Flight History; mission `Success` dapat dibuka.
8. Periksa route, capture, dan marker pada Flight Detail.
9. Tutup browser lalu buka lagi; log dan foto tetap tersedia karena disimpan di Supabase.

## Struktur Project

```text
src/
├── App.jsx                         # Page state, navigasi, detail mission
├── components/
│   ├── MissionOverview.jsx          # Dashboard utama, kamera, telemetry, AI
│   ├── Map-Area.jsx                 # Peta area pencarian
│   ├── Flight-History.jsx           # Realtime logs, pagination, delete mode
│   ├── FlightDetail.jsx             # Rekaman route, capture, marker mission
│   ├── Settings.jsx                 # Preferensi dan hardware health
│   ├── Sidebar.jsx                  # Navigasi utama
│   └── Detection-Events.jsx         # Tampilan event deteksi
├── hooks/
│   ├── useTelemetry.js              # MAVLink, simulasi, lifecycle mission
│   ├── useCamera.js                 # Kamera browser
│   ├── useObjectDetection.js        # COCO-SSD
│   ├── useWeather.js                # Cuaca dan koordinat wilayah
│   └── useDroneRegion.js            # Region drone
├── lib/
│   └── supabase.js                  # Supabase client
├── services/
│   └── missionService.js            # Query mission, storage, signed URL, delete
└── utils/
    ├── mavlink.js                   # Parser dan encoder MAVLink
    └── geoCoder.js                  # Resolusi nama wilayah

supabase/
├── migrations/                      # Schema, RLS, realtime, lifecycle rules
└── cleanup-demo.sql                 # Cleanup data mission
```

## Teknologi

| Teknologi | Penggunaan |
|---|---|
| React 19 | Antarmuka komponen |
| Vite | Development server dan bundling |
| Tailwind CSS | Styling |
| Leaflet | Peta interaktif |
| OpenStreetMap | Tile peta standar |
| TensorFlow.js + COCO-SSD | Deteksi manusia di browser |
| Supabase PostgreSQL | Metadata mission dan telemetry |
| Supabase Storage | Foto capture mission |
| Supabase Realtime | Update Mission Logs |
| Web Serial API | Telemetry MAVLink melalui serial/USB |
| WebSocket | Telemetry MAVLink bridge |
| MediaDevices API | Kamera browser |

## Keamanan dan Operasional

- Gunakan hanya `VITE_SUPABASE_ANON_KEY` di frontend.
- Jangan pernah memasukkan service role key pada `.env` frontend.
- Bucket capture bersifat private; UI menggunakan signed URL.
- Policy `anon` saat ini dibuat untuk demo/prototipe. Production sebaiknya memakai Supabase Auth, role operator, dan policy per organisasi/mission.
- Pastikan migration yang diperlukan telah diterapkan pada environment deployment.
- Capture browser dan telemetry dapat berhenti bila tab/browser dipaksa ditutup sebelum request selesai. Untuk operasi kritis, gunakan source telemetry server-side atau bridge yang memiliki retry/buffer.

## Batasan Saat Ini

- Simulasi adalah sumber telemetri default; integrasi flight controller nyata bergantung pada sumber MAVLink perangkat.
- Kamera browser bukan pengganti stream kamera drone/Runcam.
- COCO-SSD mendeteksi objek di browser; hasil dan performa bergantung pada perangkat operator.
- Tidak ada kontrol autopilot atau pengiriman command ke drone.
- RLS demo belum cocok untuk multi-user production.
- Tidak ada export laporan PDF atau sistem autentikasi operator penuh.

## Troubleshooting

### Mission Logs kosong

1. Periksa `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
2. Pastikan migration Supabase sudah diterapkan.
3. Pastikan tabel `missions` masuk publication `supabase_realtime`.
4. Periksa browser console untuk error RLS atau network.

### Foto tidak muncul di Flight Detail

1. Periksa object pada bucket `mission-captures`.
2. Pastikan tabel `mission_captures.storage_path` sesuai path object Storage.
3. Pastikan policy `SELECT` Storage tersedia untuk anon pada bucket tersebut.
4. Buka ulang detail untuk membuat signed URL baru.

### Camera tidak dapat dibuka

- Berikan izin kamera pada browser.
- Gunakan HTTPS selain pada `localhost`.
- Pastikan perangkat kamera tidak sedang dipakai aplikasi lain.

### WebSerial tidak tersedia

- Gunakan Chrome atau Edge.
- Pastikan koneksi dilakukan dari secure context.

## Kontribusi

1. Buat branch fitur dari branch kerja yang disepakati.
2. Jalankan `npm run lint` dan `npm run build` sebelum push.
3. Jangan commit `.env`, service role key, atau file `supabase/.temp/`.
4. Sertakan migration bila mengubah schema, RLS, Storage policy, atau Realtime publication.

## Lisensi

Private project. Hak penggunaan mengikuti kebijakan pemilik repository.
