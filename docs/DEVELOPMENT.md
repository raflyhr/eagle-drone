# Panduan Pengembangan

## Gambaran project

Eagle Drone adalah single-page application React. Navigasi halaman disimpan pada state `App`, sementara telemetry dan mission dikelola oleh `useTelemetry`.

## Entry point

- `src/main.jsx`: memasang aplikasi React ke DOM.
- `src/App.jsx`: mengatur halaman, navigation, map style, selected mission, dan instance `useTelemetry`.
- `src/index.css`: style global dan Tailwind.

`App` mempertahankan halaman aktif dan gaya peta di `localStorage`:

```text
eagle_active_page
eagle_map_style
```

## Komponen

| File | Tanggung jawab |
|---|---|
| `Sidebar.jsx` | Navigasi halaman utama |
| `MissionOverview.jsx` | Dashboard, mission control UI, telemetry, kamera, capture, dan modal koneksi |
| `Map-Area.jsx` | Peta, drone position, route, marked location, target point |
| `Flight-History.jsx` | Daftar mission dan penghapusan log sukses |
| `FlightDetail.jsx` | Detail mission, route, capture, marker, dan target |
| `Settings.jsx` | Status perangkat, koneksi, dan informasi telemetry |
| `Detection-Events.jsx` | Tampilan event hasil deteksi |

## Hooks

| File | Tanggung jawab |
|---|---|
| `useTelemetry.js` | Semua sumber telemetry, parser callback, state koneksi, simulation, mission lifecycle, realtime |
| `useCamera.js` | Permission kamera, stream, pemilihan device, disconnect |
| `useObjectDetection.js` | Memuat model ONNX dan menjalankan object detection |
| `useWeather.js` | Data cuaca untuk dashboard |
| `useDroneRegion.js` | Region/geocoding posisi drone |

## Utility protocol

### `src/utils/msp.js`

- Daftar command MSP.
- Encoder request MSP v1.
- Buffer parser.
- Checksum.
- Decoder Betaflight telemetry.

### `src/utils/crsf.js`

- Daftar frame CRSF.
- CRC8.
- Decoder GPS, battery, link statistics, attitude, dan flight mode.

### `src/utils/mavlink.js`

- Parser MAVLink v1 dan v2.
- Decoder heartbeat, system status, GPS, attitude, global position, dan VFR HUD.
- Generator/message utility untuk simulation.

### `src/utils/geoCoder.js`

- Membantu mengubah koordinat atau region menjadi informasi lokasi untuk UI.

## Service

`src/services/missionService.js` menjadi batas antara UI dan Supabase.

Fungsi utama:

- `createMissionRecord()`;
- `updateMissionRecord()`;
- `finalizeMissionOnUnload()`;
- `insertTrackPoint()`;
- `uploadMissionCapture()`;
- `insertMarkedLocation()`;
- `insertTargetPoint()`;
- `deleteTargetPoint()`;
- `fetchMissionLogs()`;
- `fetchMissionDetail()`;
- `deleteMissionLogs()`.

Komponen sebaiknya tidak menulis query Supabase baru secara langsung. Tambahkan operasi mission pada service agar akses data tetap terpusat.

## Alur state telemetry

```text
Serial/WebSocket/Simulator
          |
       parser
          |
handleMspMessage / handleCrsfMessage / handleMavlinkMessage
          |
     telemetry state
          |
 components menerima telemetryState dari App
```

`useTelemetry` juga menyimpan reference resource yang tidak cocok disimpan sebagai state React:

- serial port;
- serial reader;
- serial writer;
- WebSocket;
- parser;
- polling timer;
- disconnect task.

Resource tersebut harus dilepas saat disconnect atau component unmount.

## Menambah telemetry field

1. Temukan protocol sumber field.
2. Tambahkan message/command ID bila belum ada.
3. Decode payload dengan panjang minimum yang benar.
4. Perhatikan endian dan unit protocol.
5. Teruskan hasil decode melalui callback parser.
6. Perbarui state pada `useTelemetry`.
7. Tampilkan field pada komponen.
8. Uji dengan simulator atau hardware.
9. Jalankan lint dan build.

Jangan mencampur unit. Gunakan nama jelas seperti `speedMps`, `altitudeMeters`, atau konversi terpusat sebelum data masuk UI.

## Menambah source koneksi

Source baru harus memiliki:

- capability check;
- status `connecting`, `connected`, `error`, dan `disconnected`;
- cleanup reader/writer/socket;
- timeout atau freshness check bila protocol pasif;
- parser dengan validasi panjang dan checksum/CRC;
- pesan error yang dapat dipahami user;
- integrasi dengan `disconnect()`.

## Kamera dan AI

Camera stream berasal dari Browser MediaDevices API. Object detection berjalan lokal di browser memakai ONNX Runtime Web. Image frame diproses oleh model, lalu hasil deteksi dipakai untuk overlay dan metadata capture.

Saat mengubah pipeline AI:

- jangan memblokir main thread dengan loop tanpa jeda;
- validasi dimensi input model;
- pertahankan mapping koordinat model ke video;
- tangani model gagal dimuat;
- uji tanpa kamera dan saat permission ditolak.

## Database

Semua perubahan skema dibuat sebagai migration baru di `supabase/migrations`. Jangan mengubah migration lama yang sudah mungkin diterapkan pada environment lain.

Nama migration:

```text
YYYYMMDDHHMM_description.sql
```

Perubahan database harus mempertimbangkan:

- foreign key;
- cascade behavior;
- RLS policy;
- Realtime publication;
- index untuk query history/detail;
- kompatibilitas data lama.

## Pemeriksaan sebelum push

```bash
npm run lint
npm run build
```

Lakukan pemeriksaan manual minimum:

1. Aplikasi terbuka tanpa error Console.
2. Navigation antar halaman berfungsi.
3. Simulation tersambung dan telemetry berubah.
4. Disconnect membersihkan koneksi.
5. Peta menampilkan posisi dan trail.
6. Kamera menangani izin diterima/ditolak.
7. Mission dapat dimulai dan diselesaikan.
8. History dan detail tampil bila Supabase aktif.
9. Serial hardware diuji di Chrome/Edge bila perubahan menyentuh protocol.

## Build dan deployment

Build produksi dibuat ke `dist/`:

```bash
npm run build
```

Host harus mendukung:

- HTTPS, kecuali localhost;
- fallback SPA ke `index.html`;
- file static model/aset;
- environment variable Vite saat build;
- koneksi HTTPS ke Supabase.

Web Serial membutuhkan browser Chromium. Deployment tidak dapat membuat Firefox/Safari mendukung API tersebut.

## Konvensi perubahan

- Ikuti pola komponen dan hook yang sudah ada.
- Pakai dependency existing sebelum menambah package baru.
- Pertahankan parser protocol di `src/utils`.
- Pertahankan query mission di `missionService`.
- Jangan log key, token, atau data rahasia.
- Jangan commit `.env`, `node_modules`, atau artifact lokal yang tidak diperlukan.
- Hindari menambahkan kontrol autopilot tanpa perubahan scope dan review keselamatan terpisah.
