# Eagle Drone Dashboard

Dashboard web untuk co-pilot atau navigator drone. Aplikasi berfungsi sebagai sistem monitoring, bukan sistem kendali autopilot.

## 1. Ringkasan Proyek

Eagle Drone menampilkan informasi misi pencarian dan penyelamatan dalam satu antarmuka dashboard:

- Streaming webcam laptop.
- Deteksi manusia dari video menggunakan TensorFlow.js dan COCO-SSD.
- Bounding box, label, confidence, dan jumlah manusia terdeteksi.
- Telemetri penerbangan dummy yang bergerak secara berkala.
- Peta navigasi berbasis Leaflet dan OpenStreetMap.
- Riwayat penerbangan dummy.
- Panel event deteksi.
- Panel pengaturan sistem.

Tahap saat ini menggunakan webcam laptop dan data penerbangan simulasi. Integrasi kamera Runcam, GPS sungguhan, flight controller, serta telemetri drone nyata belum dilakukan.

## 2. Tujuan Sistem

Sistem dirancang sebagai dashboard observasi untuk membantu operator melihat kondisi misi secara real-time. Dashboard tidak mengirim perintah autopilot dan tidak mengendalikan arah, kecepatan, ketinggian, atau motor drone.

Batas tanggung jawab aplikasi:

1. Menerima video dari kamera.
2. Memproses frame video di browser.
3. Menampilkan hasil deteksi objek.
4. Menampilkan data telemetri.
5. Menampilkan posisi drone pada peta.
6. Menyediakan informasi arsip dan konfigurasi tampilan.

## 3. Teknologi yang Digunakan

| Teknologi | Fungsi |
|---|---|
| React | Membangun UI berbasis komponen |
| Vite | Development server dan production bundler |
| JavaScript | Logika aplikasi |
| Tailwind CSS | Styling antarmuka |
| TensorFlow.js | Runtime machine learning di browser |
| COCO-SSD | Deteksi objek, khususnya class `person` |
| Leaflet | Rendering peta interaktif |
| OpenStreetMap | Tile peta navigasi |
| MediaDevices API | Akses webcam laptop |
| Canvas API | Menggambar bounding box secara presisi |
| Manrope | Font UI |
| JetBrains Mono | Font data telemetry |
| Material Symbols | Icon dashboard |

OpenCV.js dan MobileNet belum dipakai pada tahap ini. COCO-SSD dipilih karena sudah mendukung deteksi manusia secara langsung dan sesuai dengan stack implementasi yang disetujui.

## 4. Status Fitur

| Fitur | Status | Keterangan |
|---|---|---|
| React + Vite | Selesai | Project berhasil dibuat dan dapat dijalankan |
| Tailwind CSS | Selesai | Terintegrasi melalui plugin Vite |
| Layout dashboard | Selesai | Desktop dan responsive layout tersedia |
| Mission Overview | Selesai | Halaman dashboard utama |
| Map & Search Area | Selesai | Halaman peta dan waypoint dummy |
| Detection Events | Selesai | Daftar event dan detail event dummy |
| Flight History | Selesai | Arsip penerbangan dummy |
| System Settings | Selesai | Preferensi dan status hardware dummy |
| Webcam laptop | Selesai | Start/stop melalui `getUserMedia` |
| Status kamera | Selesai | Offline, Connecting, Connected, Error |
| COCO-SSD | Selesai | Model dimuat saat AI aktif dan kamera tersambung |
| Deteksi manusia | Selesai | Hanya class `person` dengan confidence minimal 50% |
| Bounding box | Selesai | Canvas memperhitungkan skala dan crop `object-cover` |
| Jumlah manusia | Selesai | Berdasarkan hasil prediksi aktif |
| Telemetri dummy | Selesai | GPS dan data penerbangan bergerak berkala |
| Leaflet/OpenStreetMap | Selesai | Peta aktif di Mission Overview |
| Marker drone | Selesai | Mengikuti koordinat GPS dummy |
| GPS asli | Belum | Menunggu sumber GPS atau flight controller |
| Stream Runcam | Belum | Menunggu format stream dan transmitter |
| Video demo | Belum | Dibuat setelah pengujian final |
| Dokumentasi | Selesai | Dokumen ini menjadi dokumentasi progres awal |

## 5. Struktur Folder

```text
src/
├── App.jsx
├── index.css
├── main.jsx
├── assets/
└── components/
    ├── MissionOverview.jsx
    ├── Map-Area.jsx
    ├── Detection-Events.jsx
    ├── Flight-History.jsx
    └── Settings.jsx

src/hooks/
├── useCamera.js
├── useObjectDetection.js
└── useTelemetry.js
```

## 6. Arsitektur Aplikasi

### 6.1 `App.jsx`

`App.jsx` berfungsi sebagai page switcher sederhana. State `page` menentukan halaman yang ditampilkan:

- `mission` → `MissionOverview`
- `map` → `MapArea`
- `events` → `DetectionEvents`
- `history` → `FlightHistory`
- `settings` → `Settings`

Router eksternal belum diperlukan karena jumlah halaman masih sedikit. Navigasi dikirim ke setiap halaman melalui prop `onNavigate`.

### 6.2 `MissionOverview.jsx`

Halaman utama dashboard. Komponen ini menggabungkan:

- Sidebar navigasi.
- Header misi.
- Alert deteksi.
- Video panel.
- Canvas bounding box.
- Panel telemetry.
- Peta Leaflet.
- AI detection subsystem.
- Incident summary.
- Footer status sistem.

### 6.3 `Map-Area.jsx`

Halaman monitoring area pencarian. Berisi:

- Informasi posisi UAV.
- Active sector.
- Marker drone simulasi.
- Search area visual.
- Active waypoints.
- Progress pencarian.
- Data lingkungan seperti wind speed, visibility, temperature, dan signal.

### 6.4 `Detection-Events.jsx`

Halaman untuk melihat event hasil deteksi. Berisi:

- Detection alert cards.
- Status critical, review, dan event ber-confidence rendah.
- Gambar thermal/IR/optical dummy.
- Detail event terpilih.
- Target telemetry.
- Media preview.

### 6.5 `Flight-History.jsx`

Halaman arsip penerbangan. Berisi:

- Mission ID.
- Tanggal misi.
- Durasi.
- Jarak.
- Ketinggian maksimum.
- Nama pilot.
- Status penerbangan.
- Detail misi.
- Ringkasan telemetry.

### 6.6 `Settings.jsx`

Halaman pengaturan tampilan dan status hardware. Berisi:

- Measurement system: Metric atau Imperial.
- Interface theme: Dark atau NVG.
- Alert volume.
- Motor health.
- Battery cycles.
- Signal encryption.
- Tombol penyimpanan konfigurasi.

## 7. Alur Webcam

Logika kamera berada di `src/hooks/useCamera.js`.

Alur kerja:

1. User menekan tombol kamera.
2. Aplikasi memanggil `navigator.mediaDevices.getUserMedia`.
3. Browser meminta izin kamera.
4. Stream diberikan ke elemen `<video>` melalui `srcObject`.
5. Status berubah menjadi `connected`.
6. User dapat menghentikan kamera.
7. Semua video track dihentikan saat kamera berhenti atau komponen dilepas.

Status kamera:

- `offline`: kamera belum aktif.
- `connecting`: permintaan kamera sedang diproses.
- `connected`: stream aktif.
- `error`: izin ditolak atau kamera gagal diakses.

Kamera browser membutuhkan secure context. `localhost` diperbolehkan untuk development. Pada deployment jaringan, gunakan HTTPS.

## 8. Alur Deteksi COCO-SSD

Logika deteksi berada di `src/hooks/useObjectDetection.js`.

Alur kerja:

1. AI aktif dan kamera berada pada status `connected`.
2. Model COCO-SSD dimuat sekali.
3. Status model berubah menjadi `loading` lalu `ready`.
4. Model membaca frame video secara berkala.
5. Prediksi difilter hanya untuk class `person`.
6. Prediksi dengan confidence di bawah `0.5` dibuang.
7. Hasil disimpan sebagai array `detections`.
8. Jumlah array digunakan sebagai jumlah manusia.
9. Bounding box digambar pada canvas.

Contoh bentuk data prediksi COCO-SSD:

```js
{
  class: 'person',
  score: 0.94,
  bbox: [x, y, width, height]
}
```

`bbox` menggunakan koordinat ukuran asli video, bukan ukuran tampilan dashboard.

## 9. Perbaikan Presisi Bounding Box

Bounding box tidak ditempel langsung sebagai elemen HTML biasa. Dashboard menggunakan canvas overlay.

Perhitungan yang dilakukan:

1. Ambil ukuran asli video dari `video.videoWidth` dan `video.videoHeight`.
2. Ambil ukuran video yang tampil melalui `getBoundingClientRect()`.
3. Hitung rasio `object-cover` menggunakan nilai terbesar dari skala lebar dan tinggi.
4. Hitung offset crop horizontal dan vertikal.
5. Konversi `bbox` dari koordinat video ke koordinat layar.
6. Gambar rectangle dan label confidence di canvas.
7. Canvas mengikuti perubahan ukuran video dengan `ResizeObserver`.

Pendekatan ini mencegah kotak bergeser saat:

- Ukuran browser berubah.
- Layout berpindah dari desktop ke mobile.
- Video memakai `object-cover`.
- Rasio video webcam berbeda dengan rasio panel.

## 10. Telemetri Dummy

Logika telemetri berada di `src/hooks/useTelemetry.js`.

Data awal:

```js
{
  latitude: -6.2,
  longitude: 106.816666,
  altitude: 120,
  speed: 15,
  heading: 285,
  battery: 74,
  signal: 98
}
```

Setiap interval simulasi:

- Latitude bertambah sedikit.
- Longitude bertambah sedikit.
- Altitude berubah pada rentang kecil.
- Speed berubah secara periodik.
- Heading berputar.
- Battery berkurang perlahan.
- Signal berubah pada rentang kecil.

Data ini belum berasal dari sensor drone. Tujuannya untuk menguji tampilan, pembaruan state, dan sinkronisasi marker peta.

## 11. Integrasi Leaflet dan OpenStreetMap

Mission Overview menggunakan Leaflet sebagai peta navigasi.

Alur peta:

1. Container peta dibuat dengan `ref`.
2. Leaflet map diinisialisasi satu kali.
3. Tile OpenStreetMap dimuat melalui URL tile standar.
4. Marker drone dibuat pada posisi awal.
5. Marker dipindahkan saat latitude atau longitude berubah.
6. Map melakukan pan menuju posisi terbaru.
7. Instance map dihapus saat komponen unmount.

Peta hanya digunakan sebagai monitor navigasi. Belum ada kontrol autopilot atau pengiriman waypoint ke drone.

## 12. Cara Menjalankan

### Persyaratan

- Node.js versi LTS.
- npm.
- Browser modern yang mendukung webcam dan WebGL.
- Webcam laptop untuk pengujian kamera.

### Instalasi

```bash
npm install
```

### Development server

```bash
npm run dev
```

Buka alamat localhost yang diberikan Vite. Izinkan akses webcam ketika browser memintanya.

### Production build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## 13. Skenario Demo untuk Dosen

1. Jalankan `npm run dev`.
2. Buka dashboard Mission Overview.
3. Jelaskan sidebar dan lima halaman utama.
4. Klik tombol kamera.
5. Izinkan akses webcam.
6. Tunjukkan status kamera berubah menjadi `CONNECTED`.
7. Aktifkan `AI DETECT`.
8. Tunggu status COCO-SSD berubah menjadi `READY`.
9. Arahkan kamera ke seseorang.
10. Tunjukkan bounding box, label confidence, dan jumlah person.
11. Jelaskan bahwa bounding box telah dikonversi dari koordinat frame asli ke ukuran panel.
12. Tunjukkan telemetry yang bergerak.
13. Tunjukkan marker drone yang mengikuti koordinat dummy.
14. Buka Map & Search Area.
15. Buka Detection Events.
16. Buka Flight History.
17. Buka System Settings.
18. Jalankan `npm run lint` dan `npm run build` sebagai bukti validasi kode.

## 14. Batasan Saat Ini

- COCO-SSD berjalan di browser sehingga performa bergantung pada CPU/GPU perangkat.
- Model bukan sistem deteksi khusus SAR.
- Data telemetri masih simulasi.
- Koordinat GPS belum berasal dari modul GPS.
- Kamera Runcam belum terhubung.
- Peta Mission Overview sudah menggunakan OpenStreetMap, sedangkan beberapa halaman lain masih menggunakan visual peta dummy.
- Belum ada backend atau database.
- Belum ada autentikasi operator.
- Belum ada penyimpanan event permanen.
- Belum ada sistem kendali drone.
- Belum ada integrasi thermal camera sungguhan.
- Belum ada deteksi barang jatuh.
- Belum ada analisis NDVI atau MDVI.

## 15. Rencana Pengembangan

### Tahap berikutnya

1. Tambahkan backend untuk menyimpan event deteksi.
2. Ganti telemetri dummy dengan data MAVLink atau API flight controller.
3. Tambahkan koneksi GPS nyata.
4. Tambahkan URL stream Runcam sesuai protokol transmitter.
5. Tambahkan reconnect saat stream terputus.
6. Tambahkan snapshot event deteksi.
7. Tambahkan filter confidence dan class objek.
8. Tambahkan peta pencarian berbasis polygon.
9. Tambahkan histori penerbangan dari database.
10. Tambahkan dokumentasi video demo.

### Fitur opsional

- Kamera termal nyata.
- Deteksi korban pada kondisi malam.
- Deteksi objek yang jatuh.
- Analisis vegetasi NDVI/MDVI.
- Export laporan PDF.
- Notifikasi operator.
- Multi-camera stream.
- Mode offline untuk area tanpa koneksi internet.

## 16. Penjelasan Singkat untuk Presentasi

> Eagle Drone adalah dashboard web untuk membantu co-pilot atau navigator memonitor misi drone. Sistem menerima video dari webcam, memproses frame menggunakan TensorFlow.js dan COCO-SSD, kemudian menampilkan manusia yang terdeteksi melalui bounding box dan confidence. Telemetri penerbangan masih menggunakan data dummy yang bergerak untuk menguji antarmuka. Posisi drone ditampilkan pada peta Leaflet dengan tile OpenStreetMap. Sistem ini bersifat monitoring dan tidak mengendalikan autopilot.

## 17. Kesimpulan Progres Hari Ini

Fondasi aplikasi telah selesai:

- Project React + Vite tersedia.
- Tailwind CSS terintegrasi.
- Lima halaman dashboard tersedia.
- Navigasi antar halaman tersedia.
- Layout konsisten dan fullscreen.
- Webcam laptop telah terhubung.
- COCO-SSD telah digunakan untuk deteksi manusia.
- Bounding box telah diperbaiki menggunakan canvas overlay.
- Telemetri dummy telah dibuat bergerak.
- Leaflet/OpenStreetMap telah digunakan.
- Marker mengikuti GPS dummy.
- Lint dan production build berhasil.

Tahap berikutnya adalah pengujian langsung menggunakan webcam, optimasi performa model, dan persiapan integrasi stream Runcam serta telemetri drone nyata.
