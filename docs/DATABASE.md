# Database dan Supabase

## Tujuan

Supabase menyimpan hasil mission yang dibuat Eagle Drone. Tanpa konfigurasi Supabase, dashboard dan simulator tetap dapat dipakai, tetapi data mission tidak disimpan permanen.

Konfigurasi klien berada di `src/lib/supabase.js`.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Gunakan anon key frontend. Jangan gunakan service role key pada aplikasi browser.

## Migration

Skema database ada di `supabase/migrations`. Jalankan migration secara berurutan berdasarkan nama file. Migration membangun tabel mission, track point, capture, marked location, target point, realtime, dan aturan status mission.

## Relasi data

```text
missions
  |-- mission_track_points
  |-- mission_captures
  |     `-- mission_marked_locations
  `-- mission_target_points

mission-captures Storage bucket
  `-- {mission_id}/{capture_id}.jpg
```

## Tabel `missions`

Satu record untuk satu session mission.

Data utama:

| Kolom | Fungsi |
|---|---|
| `id` | Primary key database |
| `mission_code` | Kode mission, misalnya `SAR-12345678` atau `SIM-12345678` |
| `mission_type` | Jenis mission |
| `status` | `live` atau `success` |
| `started_at` | Waktu mission dimulai |
| `finished_at` | Waktu mission selesai |
| `duration_seconds` | Durasi mission |
| `distance_meters` | Total jarak track |
| `max_altitude_meters` | Ketinggian maksimum mission selesai |
| `current_altitude_meters` | Ketinggian terbaru saat mission live |
| `start_lat`, `start_lng` | Koordinat awal |
| `finish_lat`, `finish_lng` | Koordinat akhir |

`formatMissionRecord()` pada `src/services/missionService.js` mengubah record database menjadi format UI.

## Tabel `mission_track_points`

Menyimpan titik perjalanan drone.

| Kolom | Fungsi |
|---|---|
| `mission_id` | Relasi ke `missions.id` |
| `recorded_at` | Waktu titik direkam |
| `latitude`, `longitude` | Koordinat drone |
| `altitude_meters` | Ketinggian |
| `speed_mps` | Kecepatan meter per detik |
| `heading` | Arah drone |
| `battery_percent` | Persentase battery |

Aplikasi tidak menulis semua update GPS. `getTrackWritePolicy()` memakai aturan berikut:

- koordinat harus valid;
- titik pertama selalu dapat disimpan;
- interval minimum 1 detik;
- jarak minimum 15 meter;
- loncatan GPS lebih dari 250 meter dibuang.

Tujuan aturan ini: mengurangi data duplikat dan mencegah loncatan GPS rusak membuat route salah.

## Tabel `mission_captures`

Menyimpan metadata capture kamera.

| Kolom | Fungsi |
|---|---|
| `mission_id` | Relasi ke mission |
| `storage_path` | Path gambar di bucket Storage |
| `captured_at` | Waktu capture |
| `ai_detections` | Hasil AI detection dalam JSON |

File gambar tidak disimpan langsung di PostgreSQL. Gambar diunggah ke bucket `mission-captures` dengan path:

```text
{mission_id}/{capture_id}.jpg
```

Saat Flight Detail dibuka, aplikasi membuat signed URL dengan masa berlaku 3600 detik untuk menampilkan gambar private.

## Tabel `mission_marked_locations`

Menyimpan lokasi penting yang terkait capture.

| Kolom | Fungsi |
|---|---|
| `mission_id` | Relasi ke mission |
| `capture_id` | Capture yang menjadi sumber marker |
| `latitude`, `longitude` | Lokasi marker |
| `altitude_meters` | Ketinggian saat marker dibuat |
| `marked_at` | Waktu marker dibuat |

## Tabel `mission_target_points`

Menyimpan titik target yang ditandai user di peta.

| Kolom | Fungsi |
|---|---|
| `mission_id` | Relasi ke mission |
| `name` | Nama target point |
| `latitude`, `longitude` | Koordinat target |
| `marked_at` | Waktu target dibuat |

Target point dapat ditambah atau dihapus dari aplikasi.

## Storage bucket `mission-captures`

Bucket menyimpan file capture kamera. Bucket ini diperlakukan sebagai private; UI meminta signed URL sebelum menampilkan file.

Pastikan bucket dibuat dengan nama persis:

```text
mission-captures
```

Policy Storage harus mengizinkan operasi yang dibutuhkan anon user sesuai kebijakan aplikasi: upload capture, membuat signed URL untuk file sendiri yang diizinkan, dan menghapus capture saat mission sukses dihapus.

## Realtime

Migration mengaktifkan Realtime untuk mission dan detail terkait. Aplikasi memuat mission terbaru dan dapat menerima pembaruan data tanpa refresh penuh.

Pastikan table yang digunakan sudah ditambahkan ke publication Supabase Realtime bila lingkungan Supabase memakai konfigurasi manual.

## Alur mission

```text
User mulai mission
  |
createMissionRecord()
  |
telemetry masuk
  |
insertTrackPoint() + updateMissionRecord()
  |
user capture gambar
  |
uploadMissionCapture()
  |
user tandai lokasi/target
  |
insertMarkedLocation() / insertTargetPoint()
  |
mission selesai
  |
updateMissionRecord(status: success)
```

## Penghapusan mission

`deleteMissionLogs()` hanya menghapus mission dengan status `success`.

Urutan penghapusan:

1. Ambil `storage_path` seluruh capture mission.
2. Hapus file dari bucket `mission-captures`.
3. Hapus record mission sukses.
4. Relasi database menangani record child sesuai foreign key migration.

Mission live tidak boleh dihapus lewat operasi ini.

## Memeriksa masalah database

1. Buka browser Console dan Network tab.
2. Pastikan environment variable tersedia setelah restart Vite.
3. Periksa Supabase Table Editor untuk record mission.
4. Periksa Storage bucket untuk file capture.
5. Periksa RLS policy bila menerima error `permission denied`.
6. Pastikan migration terakhir telah diterapkan.

## Membersihkan data demo

Project menyediakan script:

```bash
npm run db:clear
```

Script ini menjalankan `supabase/cleanup-demo.sql` pada Supabase project yang telah dihubungkan melalui Supabase CLI. Perintah ini menghapus data demo; periksa file SQL sebelum menjalankan pada environment penting.
