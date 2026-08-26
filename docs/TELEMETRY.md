# Telemetry dan Flight Controller

## Gambaran sederhana

Flight controller adalah otak drone. Eagle Drone membaca data dari otak tersebut, lalu menampilkannya di dashboard.

```text
SpeedyBee / radio / simulator
          |
      koneksi data
          |
   parser protocol
          |
     useTelemetry
          |
      dashboard
```

Aplikasi tidak memberi perintah terbang. Semua fungsi telemetry bersifat baca saja.

## Web Serial API

Koneksi USB serial memakai API bawaan browser:

```js
const port = await navigator.serial.requestPort()
await port.open({ baudRate: 115200 })
```

`requestPort()` meminta user memilih perangkat. `open()` membuka koneksi dengan baudrate tertentu.

- `port.readable`: data dari perangkat ke browser.
- `port.writable`: data dari browser ke perangkat.
- `getReader()`: membaca byte.
- `getWriter()`: mengirim byte.

Kode koneksi berada di `src/hooks/useTelemetry.js`.

## Betaflight MSP untuk SpeedyBee

SpeedyBee FC yang menjalankan Betaflight berkomunikasi melalui MSP, yaitu MultiWii Serial Protocol. Project tidak memakai library MSP eksternal. Frame request dibuat manual di `src/utils/msp.js`.

```js
export function encodeMspRequest(command) {
  return new Uint8Array([36, 77, 60, 0, command, command])
}
```

MSP v1 request kosong memiliki bentuk:

```text
$ M < payload_length command checksum
```

Nilai byte:

- `36` = `$` sebagai awal frame.
- `77` = `M` sebagai penanda MSP.
- `60` = `<`, arah pesan dari aplikasi ke FC.
- `0` = payload kosong.
- `command` = ID permintaan.
- `checksum` = pemeriksaan sederhana untuk frame.

Command yang digunakan:

| Nama | ID | Data |
|---|---:|---|
| `API_VERSION` | 1 | Versi API Betaflight |
| `FC_VARIANT` | 2 | Nama variant firmware |
| `FC_VERSION` | 3 | Versi firmware |
| `STATUS` | 101 | Status FC dan mode |
| `RAW_GPS` | 106 | Latitude, longitude, altitude, speed, heading |
| `ATTITUDE` | 108 | Roll, pitch, heading |
| `ALTITUDE` | 109 | Altitude dan vario |
| `ANALOG` | 110 | Tegangan, arus, RSSI |
| `BOXNAMES` | 116 | Nama flight mode |
| `BOXIDS` | 119 | ID flight mode |
| `BATTERY_STATE` | 130 | Tegangan, arus, kapasitas, status battery |
| `STATUS_EX` | 150 | Status dan arming flags |

## Alur koneksi Betaflight

`connectBetaflightMsp()` melakukan langkah berikut:

1. Memastikan browser memiliki `navigator.serial`.
2. Memutus koneksi lama.
3. Meminta user memilih port.
4. Membuka port dengan default `115200`.
5. Membuat `MspParser`.
6. Menyiapkan writer.
7. Menjalankan read loop.
8. Meminta informasi dasar FC.
9. Polling telemetry setiap 50 ms.
10. Mengubah response menjadi state dashboard.

Request awal:

```text
API_VERSION
FC_VARIANT
FC_VERSION
BOXNAMES
BOXIDS
```

Polling bergantian meminta attitude dan data tambahan:

```text
ATTITUDE
ALTITUDE
ATTITUDE
RAW_GPS
ATTITUDE
BATTERY_STATE
ATTITUDE
STATUS_EX
ATTITUDE
ANALOG
```

Antrean write mencegah dua request menulis ke serial secara bersamaan.

## MspParser

`MspParser` menerima potongan byte dari Web Serial. Data serial tidak selalu datang dalam satu frame lengkap, sehingga parser menyimpan byte sementara pada `buffer`.

Parser:

1. Mencari header `$M`.
2. Membaca panjang payload.
3. Menunggu sampai frame lengkap.
4. Menghitung checksum.
5. Membuang frame rusak.
6. Memanggil `decodeMessage()` untuk command yang dikenal.
7. Mengirim hasil decode ke callback.

Contoh hasil decode attitude:

```js
{
  type: 'attitude',
  roll: 12.4,
  pitch: -2.1,
  heading: 180
}
```

Nilai binary dibaca sebagai little-endian. Roll dan pitch dari Betaflight disimpan dalam satuan 0.1 derajat, sehingga dibagi 10.

## CRSF dan ELRS

Koneksi `connectElrsCrsf()` memakai Web Serial API dengan default `420000` baud. Parser berada di `src/utils/crsf.js`.

CRSF adalah protocol serial yang umum dipakai receiver ELRS. Parser memeriksa panjang frame dan CRC8, kemudian membaca:

- GPS;
- battery;
- link statistics;
- attitude;
- flight mode.

CRSF berbeda dari MSP. Jangan memilih koneksi CRSF untuk port yang mengirim MSP, dan sebaliknya.

## MAVLink

MAVLink dipakai untuk simulator internal, Pixhawk/SiK radio, dan WebSocket bridge. Parser berada di `src/utils/mavlink.js`.

Parser mendukung MAVLink v1 dan v2. Message utama:

- `HEARTBEAT`;
- `SYS_STATUS`;
- `GPS_RAW_INT`;
- `ATTITUDE`;
- `GLOBAL_POSITION_INT`;
- `VFR_HUD`.

MAVLink serial default memakai `57600` baud. WebSocket memakai binary message dari bridge. MAVLink adalah protocol berbeda dari MSP dan CRSF.

## Simulator

Simulator membuat telemetry MAVLink tanpa hardware. Gunakan simulator untuk memeriksa UI, peta, mission, dan alur penyimpanan sebelum menghubungkan drone sungguhan.

## Batasan penting

- Aplikasi membaca telemetry, bukan mengontrol FC.
- Tidak ada command arm/disarm.
- Tidak ada command motor, throttle, waypoint, atau flight control.
- Baudrate harus sama dengan konfigurasi perangkat.
- Satu port serial sebaiknya dipakai satu aplikasi pada satu waktu.
- Lepas propeller saat menguji hardware.

## Troubleshooting

| Masalah | Pemeriksaan |
|---|---|
| Port tidak muncul | Gunakan kabel USB data dan cek driver |
| Port sedang dipakai | Tutup Betaflight Configurator atau serial monitor lain |
| Terhubung tapi data kosong | Pastikan protocol dan baudrate sesuai |
| MSP tidak menjawab | Pastikan firmware Betaflight dan port MSP aktif |
| CRSF tidak menjawab | Pastikan perangkat mengirim CRSF, bukan MSP |
| MAVLink kosong | Pastikan Pixhawk/radio mengirim MAVLink frame |
| Browser menolak serial | Gunakan Chrome/Edge pada localhost atau HTTPS |
| Data patah-patah | Kurangi aplikasi pemakai port dan cek kabel |

## Referensi

- Betaflight MSP Protocol Reference: https://www.betaflight.com/docs/development/API/MSP-Protocol-Reference-Dev
- Betaflight MSP Extensions: https://www.betaflight.com/docs/development/API/MSP-Extensions
- Betaflight firmware: https://github.com/betaflight/betaflight
- Web Serial API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API
