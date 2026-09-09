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
- [CRSF C/WASM](#crsf-cwasm)
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

## CRSF C/WASM

Dashboard memiliki opsi **CRSF USB Telemetry (C/WASM)**. Opsi ini membaca telemetry CRSF langsung dari port USB menggunakan Web Serial, lalu menerjemahkan frame dengan parser C yang dikompilasi ke WebAssembly.

### Alur data

```text
Remote / receiver CRSF
        |
        | byte biner CRSF melalui USB serial
        v
navigator.serial.requestPort()
        |
        v
src/utils/crsfWasm.js
        |
        | crsf.wasm
        v
bridge/crsf/src/crsf.c
        |
        | validasi sync, length, CRC, dan decode payload
        v
handleCrsfMessage()
        |
        v
React telemetry state
        |
        v
Dashboard, map, battery, attitude, dan mission tracking
```

CRSF mengirim byte biner, bukan JSON. Parser WASM mengubah byte tersebut menjadi object JavaScript seperti:

```js
{
  type: 'gps',
  latitude: -7.595,
  longitude: 110.4485,
  speed: 12.5,
  heading: 90,
  altitude: 100,
  satellites: 10,
  fix: true,
}
```

### Data yang didukung

Parser C/WASM saat ini menerjemahkan:

| Frame | Data |
|---|---|
| GPS (`0x02`) | latitude, longitude, speed, heading, altitude, satellites, GPS fix |
| Battery (`0x08`) | voltage, current, capacity, remaining battery |
| Link statistics (`0x14`) | RSSI, link quality, SNR |
| Attitude (`0x1E`) | pitch, roll, yaw |

Data masuk realtime setiap frame valid diterima dari serial. UI hanya menampilkan field yang memang dikirim oleh perangkat. Contoh, GPS tidak muncul jika remote/receiver tidak mengirim GPS telemetry.

### File terkait

```text
bridge/crsf/src/crsf.c          Parser dan CRC CRSF asli
bridge/crsf/src/crsf.h          Struct, konstanta, dan API C
bridge/crsf/src/crsf_wasm.c     ABI C untuk dipanggil JavaScript
bridge/crsf/build-wasm.ps1      Script rebuild artifact WASM
src/utils/crsfWasm.js           Loader WASM dan buffer serial incremental
src/hooks/useTelemetry.js        Web Serial dan update telemetry state
src/components/MissionOverview.jsx  Card koneksi CRSF C/WASM
public/wasm/crsf.js              Loader Emscripten hasil compile
public/wasm/crsf.wasm            Binary parser C hasil compile
```

### Referensi baris kode

Nomor baris berikut merujuk pada source saat dokumentasi ini dibuat. File hasil generate seperti `public/wasm/crsf.js` dapat berubah nomor baris setelah rebuild, sehingga penjelasan utama merujuk ke source C dan JavaScript.

| File dan baris | Penjelasan |
|---|---|
| `src/components/MissionOverview.jsx:68-80` | Mengambil fungsi koneksi dari `telemetryState`, termasuk `connectElrsCrsf`. |
| `src/components/MissionOverview.jsx:82` | Menyimpan pilihan baudrate CRSF di state React. Default `420000`. |
| `src/components/MissionOverview.jsx:1719-1747` | Card **CRSF USB Telemetry (C/WASM)**, dropdown baudrate, dan button `Connect CRSF`. |
| `src/components/MissionOverview.jsx:1737-1741` | Button mereset trail, memanggil `connectElrsCrsf`, lalu menutup modal jika koneksi berhasil. |
| `src/hooks/useTelemetry.js:1-7` | Import React hooks, parser MAVLink/MSP, loader parser CRSF WASM, dan service mission. |
| `src/hooks/useTelemetry.js:307-349` | `handleCrsfMessage` mengubah pesan GPS, battery, link, attitude, dan flight mode menjadi state dashboard. |
| `src/hooks/useTelemetry.js:474-568` | `disconnect` menghentikan reader, menutup port, menghentikan watchdog, menutup socket, dan membebaskan memory parser WASM. |
| `src/hooks/useTelemetry.js:625-684` | `connectElrsCrsf` memeriksa Web Serial, meminta port, membuka port dengan baudrate, membuat parser WASM, dan menjalankan read loop. |
| `src/hooks/useTelemetry.js:637-640` | Membuka port USB, lalu memanggil `createCrsfWasmParser(handleCrsfMessage)`. Ini titik penghubung Web Serial dan WASM. |
| `src/hooks/useTelemetry.js:649-671` | Membaca data serial terus-menerus dan meneruskan setiap chunk byte ke `parserRef.current.parseBytes`. |
| `src/utils/crsfWasm.js:1-10` | Loader mengambil `crsf.js` dari folder public dan membuat module Emscripten dengan file `crsf.wasm`. |
| `src/utils/crsfWasm.js:11-16` | Mengalokasikan memory WASM untuk input byte, frame, hasil float, dan panjang frame. |
| `src/utils/crsfWasm.js:19-49` | Parser stream incremental: menerima chunk, mencari sync, menunggu frame lengkap, memanggil fungsi C, lalu mengirim hasil ke React. |
| `src/utils/crsfWasm.js:25-34` | Validasi sync `0xC8`, batas length, dan frame partial. Frame partial ditahan sampai data berikutnya datang. |
| `src/utils/crsfWasm.js:36-44` | Menyalin byte ke memory WASM, memanggil `crsf_wasm_parse`, decode tipe/angka, lalu menghapus frame dari buffer. |
| `src/utils/crsfWasm.js:45-48` | Mengubah hasil C/WASM menjadi object JavaScript untuk GPS, battery, attitude, dan link. |
| `src/utils/crsfWasm.js:51-57` | `destroy` membebaskan semua memory yang dialokasikan WASM. |
| `bridge/crsf/src/crsf.h:20-39` | Mendefinisikan ukuran frame, sync byte, panjang payload, dan tipe frame CRSF. |
| `bridge/crsf/src/crsf.h:71-73` | Mendefinisikan `struct crsf_frame` sebagai penyimpan frame mentah. |
| `bridge/crsf/src/crsf.h:75-175` | Mendefinisikan struct GPS, battery, attitude, link-related data, dan telemetry lain. |
| `bridge/crsf/src/crsf.h:229-244` | Mendeklarasikan API CRC dan parser frame/payload. |
| `bridge/crsf/src/crsf.c:93-129` | Implementasi CRC-8 DVB-S2 dengan polynomial `0xD5`. |
| `bridge/crsf/src/crsf.c:132-168` | `crsf_parse_frame` memeriksa ukuran buffer, sync, length, CRC, lalu menyimpan frame valid. |
| `bridge/crsf/src/crsf.c:138-149` | Menolak sync atau panjang frame invalid. |
| `bridge/crsf/src/crsf.c:157-167` | Menghitung CRC, membandingkan CRC dari perangkat, dan mengembalikan frame valid. |
| `bridge/crsf/src/crsf.c:170-194` | Mengurai payload GPS dan mengubah altitude CRSF ke meter. |
| `bridge/crsf/src/crsf.c:295-315` | Mengurai payload attitude pitch, roll, dan yaw. |
| `bridge/crsf/src/crsf_wasm.c:4-10` | ABI `crsf_wasm_parse`: pintu masuk JavaScript ke parser C. |
| `bridge/crsf/src/crsf_wasm.c:11-19` | ABI untuk mengambil tipe dan panjang frame dari memory C. |
| `bridge/crsf/src/crsf_wasm.c:21-71` | `crsf_wasm_decode` mengubah struct hasil parser C menjadi array angka yang mudah dibaca JavaScript. |
| `bridge/crsf/build-wasm.ps1:14-23` | Mengompilasi source C menjadi `public/wasm/crsf.js` dan `public/wasm/crsf.wasm`. |

### Penjelasan singkat untuk presentasi

Gunakan urutan ini saat menjelaskan kepada dosen:

1. `MissionOverview.jsx` menyediakan tombol dan pilihan baudrate.
2. `connectElrsCrsf` pada `useTelemetry.js` meminta izin user dan membuka port USB memakai Web Serial API.
3. Data dari port berbentuk byte biner CRSF, bukan JSON.
4. `crsfWasm.js` mengumpulkan byte karena satu frame dapat datang dalam beberapa chunk.
5. Byte dikirim ke `crsf_wasm_parse`, yaitu fungsi C yang diekspor ke WASM.
6. `crsf.c` memvalidasi sync byte, panjang frame, dan CRC-8 DVB-S2.
7. `crsf_wasm_decode` menerjemahkan payload menjadi angka GPS, battery, attitude, atau link.
8. `handleCrsfMessage` memasukkan hasil ke React state.
9. React merender state baru ke dashboard secara realtime.

Kalimat inti:

> Sistem membaca byte CRSF dari USB menggunakan Web Serial API, menerjemahkannya dengan parser C yang dikompilasi menjadi WebAssembly, lalu memasukkan hasil decoding ke state React agar telemetry tampil realtime.

### Cara memakai

1. Buka aplikasi di Chrome atau Edge.
2. Pastikan halaman memakai HTTPS atau `localhost`.
3. Buka modal **Telemetry Connection**.
4. Pilih **CRSF USB Telemetry (C/WASM)**.
5. Pilih baudrate `420000` atau `115200` sesuai konfigurasi perangkat.
6. Tekan **Connect CRSF**.
7. Pilih port USB remote/receiver pada dialog browser.
8. Tunggu status terhubung dan packet count bertambah.

Browser tidak dapat memilih COM port secara otomatis tanpa izin user. Nomor port seperti `COM3` atau `COM4` tidak ditulis di source karena dapat berubah setiap perangkat/laptop.

### Rebuild WASM

Artifact WASM sudah tersedia di `public/wasm`. Jika `bridge/crsf/src/crsf.c` atau `bridge/crsf/src/crsf_wasm.c` berubah, install dan aktifkan Emscripten, lalu jalankan PowerShell:

```powershell
Set-Location D:\eagle-drone\bridge\crsf
.\build-wasm.ps1
```

Output:

```text
D:\eagle-drone\public\wasm\crsf.js
D:\eagle-drone\public\wasm\crsf.wasm
```

Build script memakai Emscripten untuk:

- mengompilasi `crsf.c` dan `crsf_wasm.c`;
- mengekspor fungsi parser ke JavaScript;
- mengekspor memory view untuk buffer byte dan hasil float;
- membuat module ES6 yang diload saat user memilih koneksi CRSF.

### Cara kerja parser stream

Data USB bisa datang dalam potongan kecil atau beberapa frame sekaligus. `src/utils/crsfWasm.js` menyimpan byte pada buffer incremental:

1. Gabungkan chunk serial baru ke buffer.
2. Cari sync byte `0xC8`.
3. Baca field `length`.
4. Tunggu sampai satu frame lengkap tersedia.
5. Kirim frame ke `crsf_wasm_parse()`.
6. C parser validasi panjang dan CRC-8 DVB-S2 polynomial `0xD5`.
7. Decode payload dengan `crsf_wasm_decode()`.
8. Hapus frame yang sudah diproses dan lanjutkan frame berikutnya.

Frame rusak dibuang satu byte demi satu byte sampai sync valid ditemukan. Frame partial disimpan sampai chunk berikutnya datang.

### Troubleshooting CRSF C/WASM

#### WASM gagal dimuat

- Pastikan `public/wasm/crsf.js` dan `public/wasm/crsf.wasm` tersedia.
- Jalankan `npm run build`.
- Periksa Network tab browser untuk request `/wasm/crsf.js` dan `/wasm/crsf.wasm`.
- Jangan buka file HTML langsung dengan `file://`; gunakan `npm run dev` atau HTTPS.

#### Port USB tidak muncul

- Gunakan Chrome atau Edge.
- Gunakan kabel USB data.
- Pastikan device terdeteksi Windows.
- Tutup Betaflight Configurator atau aplikasi lain yang sedang memakai port.
- Klik button lalu pilih port melalui dialog browser.

#### Port terbuka tetapi tidak ada telemetry

- Coba baud `420000` terlebih dahulu untuk CRSF standar.
- Coba `115200` jika memakai serial bridge dengan baud custom.
- Pastikan output perangkat adalah CRSF, bukan MSP.
- Pastikan receiver/remote memang mengirim telemetry balik.
- Periksa `packetCount` dan Console browser.

#### GPS kosong

- Pastikan GPS sudah mendapat fix.
- Pastikan frame GPS dikirim oleh perangkat.
- Battery atau link frame tidak otomatis menyediakan koordinat GPS.

#### CRC atau frame invalid

- Periksa baudrate.
- Pastikan koneksi memakai output CRSF yang benar.
- Jangan sambungkan port yang mengirim MSP ke parser CRSF.
- Frame parsial normal pada serial; parser akan menunggu chunk berikutnya.

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
