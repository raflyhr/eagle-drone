# Eagle Drone Mission Control

Platform web untuk memantau misi drone, telemetri, peta, kamera, deteksi objek, dan riwayat penerbangan. Sistem ini dibuat untuk observasi, pencatatan, dan evaluasi misi.

> Sistem tidak mengirim perintah arm, motor, arah, kecepatan, atau autopilot ke drone.

## Daftar Isi

- [Fitur](#fitur)
- [Arsitektur](#arsitektur)
- [Teknologi](#teknologi)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi Supabase](#konfigurasi-supabase)
- [Menjalankan aplikasi](#menjalankan-aplikasi)
- [Cara pakai](#cara-pakai)
- [Sumber telemetry](#sumber-telemetry)
- [Penyimpanan data](#penyimpanan-data)
- [Struktur project](#struktur-project)
- [Perintah project](#perintah-project)
- [Batasan dan keamanan](#batasan-dan-keamanan)
- [Troubleshooting](#troubleshooting)
- [Dokumentasi lanjutan](#dokumentasi-lanjutan)

## Fitur

- Dashboard monitoring misi.
- Telemetry real-time: attitude, GPS, posisi, altitude, battery, flight mode, dan status koneksi.
- Mode simulator MAVLink untuk demo tanpa hardware.
- Koneksi SpeedyBee/Betaflight melalui USB memakai MSP.
- Koneksi ELRS/CRSF serial untuk telemetry radio.
- Koneksi Pixhawk atau SiK radio memakai MAVLink serial.
- Koneksi MAVLink melalui WebSocket bridge.
- Peta Leaflet/OpenStreetMap, drone trail, heading, marked location, dan target point.
- Kamera browser melalui `getUserMedia`.
- Deteksi objek di browser memakai model YOLO ONNX dan ONNX Runtime Web.
- Capture gambar beserta hasil deteksi.
- Mission log, flight detail, route, capture, dan target point.
- Supabase PostgreSQL, Storage private, dan Realtime.

## Arsitektur

```text
Flight controller / telemetry radio / simulator
                    |
        MSP | CRSF | MAVLink | WebSocket
                    |
             useTelemetry hook
                    |
        React state + mission service
          |        |          |
 Dashboard     Map UI     Supabase
          |        |          |
 Camera + AI   History   Storage
```

Sumber telemetry mengirim data mentah. Parser mengubah data menjadi object JavaScript. `useTelemetry` menyimpan object tersebut, memperbarui dashboard, dan menulis data mission ke Supabase bila konfigurasi tersedia.

## Teknologi

| Bagian | Teknologi |
|---|---|
| UI | React 19, Tailwind CSS |
| Build | Vite |
| Peta | Leaflet, OpenStreetMap |
| Telemetry serial | Web Serial API bawaan Chrome/Edge |
| Protokol FC | MSP, CRSF, MAVLink v1/v2 |
| Kamera | Browser MediaDevices API |
| AI | ONNX Runtime Web, model YOLO ONNX |
| Database, realtime, storage | Supabase |
| Lint | oxlint |

Tidak ada dependency serial eksternal seperti `pyserial` atau `serialport`. Browser memakai `navigator.serial`.

## Prasyarat

- Node.js versi LTS.
- npm.
- Browser Chromium: Chrome atau Edge, untuk Web Serial dan kamera.
- SpeedyBee FC/Betaflight, radio ELRS/CRSF, Pixhawk, atau sumber MAVLink bila memakai hardware.
- Project Supabase opsional. Aplikasi masih dapat dijalankan untuk UI/simulator tanpa Supabase.

## Instalasi

```bash
git clone https://github.com/raflyhr/eagle-drone.git
cd eagle-drone
npm install
```

## Konfigurasi Supabase

Buat file `.env` di root project:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Jangan commit `.env`. File ini berisi alamat project dan anon key browser.

Terapkan migration pada folder `supabase/migrations` secara berurutan ke project Supabase. Database dan bucket Storage diperlukan bila ingin menyimpan mission, track, capture, marker, dan target point.

## Menjalankan aplikasi

Development server:

```bash
npm run dev
```

Build produksi:

```bash
npm run build
```

Preview build:

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

Buka alamat yang dicetak Vite, biasanya `http://localhost:5173` saat development.

## Cara pakai

1. Jalankan aplikasi di Chrome atau Edge.
2. Buka halaman Mission Overview.
3. Tekan tombol telemetry/connection.
4. Pilih sumber telemetry.
5. Bila memakai serial, browser menampilkan pemilih perangkat. Pilih port perangkat benar.
6. Tunggu status menjadi `connected` dan telemetry masuk.
7. Mulai mission dari dashboard bila ingin menyimpan session.
8. Sambungkan kamera bila perlu capture atau deteksi objek.
9. Tambahkan target point atau marked location dari peta/hasil capture.
10. Selesaikan mission. Riwayat dapat dibuka pada Flight History.

## Sumber telemetry

| Sumber | Protokol | Baudrate default | Kegunaan |
|---|---:|---:|---|
| Simulation | MAVLink generator internal | - | Demo tanpa hardware |
| SpeedyBee / Betaflight USB | MSP | `115200` | Membaca telemetry FC Betaflight |
| ELRS / CRSF serial bridge | CRSF | `420000` | Membaca GPS, battery, link, attitude |
| Pixhawk / SiK radio USB | MAVLink | `57600` | Membaca telemetry autopilot |
| WebSocket bridge | MAVLink | - | Membaca data dari bridge lokal/jaringan |

Rincian frame, parser, command MSP, dan langkah koneksi ada di [docs/TELEMETRY.md](docs/TELEMETRY.md).

## Penyimpanan data

Saat Supabase terkonfigurasi, aplikasi menyimpan:

- mission aktif dan selesai;
- titik track GPS dengan filter waktu, jarak minimum, dan loncatan GPS;
- capture kamera dan metadata hasil AI;
- marked location;
- target point;
- riwayat mission dan detail route.

Rincian tabel dan Storage ada di [docs/DATABASE.md](docs/DATABASE.md).

## Struktur project

```text
src/
  components/       Halaman dan komponen UI
  hooks/            State telemetry, kamera, AI, cuaca, region
  lib/              Klien Supabase
  services/         Operasi mission, track, capture, storage
  utils/            Parser MSP, CRSF, MAVLink, geocoder
supabase/
  migrations/       Perubahan skema database berurutan
  cleanup-demo.sql  Bersihkan data demo
public/             Logo, icon, dan aset statis
docs/               Dokumentasi teknis
```

Rincian tanggung jawab file ada di [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Perintah project

| Command | Fungsi |
|---|---|
| `npm run dev` | Menjalankan Vite development server |
| `npm run build` | Membuat build produksi ke `dist/` |
| `npm run preview` | Menjalankan hasil build lokal |
| `npm run lint` | Memeriksa kualitas kode dengan oxlint |
| `npm run db:clear` | Menjalankan `supabase/cleanup-demo.sql` pada project Supabase yang sudah linked |

## Batasan dan keamanan

- Aplikasi hanya monitoring dan pencatatan. Tidak mengontrol drone.
- Web Serial hanya tersedia pada browser Chromium dan halaman secure context atau localhost.
- Sambungkan hanya perangkat yang dikenal saat browser meminta izin serial.
- Lepas propeller saat menguji koneksi flight controller di meja.
- Telemetry, GPS, dan AI detection tidak menggantikan pemeriksaan pilot, failsafe, atau prosedur keselamatan penerbangan.
- Jangan masukkan service role key Supabase ke `.env` frontend. Gunakan hanya anon key yang dibatasi RLS.

## Troubleshooting

### Browser tidak mendukung serial

Pakai Chrome atau Edge versi modern. Firefox dan Safari belum menyediakan Web Serial API stabil.

### SpeedyBee tidak mengirim data

- Pastikan FC menjalankan firmware Betaflight.
- Pilih metode `Betaflight USB (MSP)`.
- Gunakan baudrate `115200`.
- Tutup Betaflight Configurator atau aplikasi lain yang sedang memakai port.
- Ganti kabel USB data; banyak kabel hanya mendukung charging.
- Pastikan port USB FC aktif dan driver terpasang.

### GPS kosong atau posisi tidak berubah

- Pastikan GPS sudah mendapat fix.
- Gunakan telemetry source yang memang mengirim GPS.
- Periksa antenna, receiver, dan konfigurasi port telemetry.

### Data tidak tersimpan

- Periksa `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
- Pastikan migration selesai diterapkan.
- Periksa RLS policy dan bucket `mission-captures`.
- Lihat Console browser untuk error Supabase.

### Kamera atau AI tidak aktif

- Izinkan akses kamera pada browser.
- Pastikan halaman dibuka di localhost atau HTTPS.
- Tunggu model ONNX selesai dimuat.
- Periksa browser Console bila model gagal dimuat.

## Dokumentasi lanjutan

- [Telemetry dan flight controller](docs/TELEMETRY.md)
- [Database dan Supabase](docs/DATABASE.md)
- [Panduan pengembangan](docs/DEVELOPMENT.md)
