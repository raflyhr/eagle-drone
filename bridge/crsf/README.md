# CRSF Web Serial/WASM

Source library C untuk parser TBS CRSF. Dashboard memakai Web Serial untuk membaca USB; wrapper `src/crsf_wasm.c` dapat dikompilasi ke WASM dengan Emscripten.

## Current browser path

Card `CRSF USB Telemetry (C/WASM)` memakai Web Serial untuk membaca USB dan parser C yang dikompilasi menjadi WASM. Dashboard tidak membutuhkan terminal, `.exe`, atau WebSocket localhost.

Build WASM:

```powershell
Set-Location D:\eagle-drone\bridge\crsf
.\build-wasm.ps1
```

Output:

```text
D:\eagle-drone\public\wasm\crsf.js
D:\eagle-drone\public\wasm\crsf.wasm
```

Browser requirement: HTTPS (atau `localhost`) dan Chrome/Edge.

## Fitur

- Membuat frame GPS, GPS Extended, GPS Time, attitude, airspeed, variometer, battery, voltages, temperatures, rate, dan acceleration.
- Mengurai frame mentah dengan validasi sync byte, panjang, dan CRC-8 DVB-S2.
- Mengurai payload telemetry ke struct bertipe.
- Queue FIFO opsional untuk membaca banyak frame dari stream.
- C99 dan standard library saja.

## Struktur repository

```text
.
├── LICENSE
├── README.md
└── src
    ├── crsf.c
    ├── crsf.h
    └── utils
        ├── crsf_queue.c
        └── crsf_queue.h
```

## Format frame

```text
sync (1 byte) | length (1 byte) | type (1 byte) | payload | crc (1 byte)
```

- Sync byte: `0xC8` (`CRSF_SYNC_CHAR`).
- `length` mencakup `type`, `payload`, dan `crc`.
- Total panjang frame: `length + 2`.
- Payload maksimum: `60` byte (`CRSF_PLDLEN_MAX`).
- Frame maksimum: `62` byte (`CRSF_FRAMELEN_MAX`).
- CRC: CRC-8 DVB-S2, polynomial `0xD5`, nilai awal `0`.
- CRC dihitung dari `type` dan `payload`; sync, length, serta CRC tidak ikut dihitung.

## Instalasi

Salin file berikut ke proyek C:

```text
src/crsf.h
src/crsf.c
```

Untuk queue stream, salin juga:

```text
src/utils/crsf_queue.h
src/utils/crsf_queue.c
```

Include API utama:

```c
#include "crsf.h"
```

Include queue opsional:

```c
#include "utils/crsf_queue.h"
```

## Build

Contoh GCC atau Clang:

```sh
cc -std=c99 -Wall -Wextra -Isrc main.c src/crsf.c -o app
```

Dengan queue:

```sh
cc -std=c99 -Wall -Wextra -Isrc main.c src/crsf.c src/utils/crsf_queue.c -o app
```

## Tipe frame

| Konstanta | Nilai | Keterangan |
|---|---:|---|
| `CRSF_TYPE_GPS` | `0x02` | GPS |
| `CRSF_TYPE_GPS_TIME` | `0x03` | Waktu GPS |
| `CRSF_TYPE_GPS_EX` | `0x06` | GPS Extended |
| `CRSF_TYPE_VARIOMETER` | `0x07` | Vertical velocity |
| `CRSF_TYPE_BATTERY` | `0x08` | Battery telemetry |
| `CRSF_TYPE_BAROMETER` | `0x09` | Barometer |
| `CRSF_TYPE_AIRSPEED` | `0x0A` | Airspeed |
| `CRSF_TYPE_TEMPS` | `0x0D` | Temperatures |
| `CRSF_TYPE_VOLTAGES` | `0x0E` | Voltages |
| `CRSF_TYPE_LINK_STATISTIC` | `0x14` | Link statistic |
| `CRSF_TYPE_RC_CHANNELS` | `0x16` | 16 RC channels |
| `CRSF_TYPE_ATTITUDE` | `0x1E` | Pitch, roll, yaw |
| `CRSF_TYPE_RATE` | `0x30` | Non-standard angular rate |
| `CRSF_TYPE_ACCEL` | `0x31` | Non-standard acceleration |

`CRSF_TYPE_RATE` dan `CRSF_TYPE_ACCEL` bukan tipe telemetry CRSF standar.

## Frame dan accessor

```c
struct crsf_frame {
    uint8_t frame[CRSF_FRAMELEN_MAX];
};
```

```c
uint8_t crsf_get_sync(const struct crsf_frame *frame);
uint8_t crsf_get_len(const struct crsf_frame *frame);
uint8_t crsf_get_payload_length(const struct crsf_frame *frame);
enum crsf_type crsf_get_type(const struct crsf_frame *frame);
void crsf_get_payload(const struct crsf_frame *frame, uint8_t *payload);
uint8_t crsf_get_crc(const struct crsf_frame *frame);
uint8_t crsf_get_frame_length(const struct crsf_frame *frame);
```

Accessor memakai `assert`. Beri pointer frame valid. Buffer pada `crsf_get_payload` harus cukup besar untuk payload.

## CRC

```c
uint8_t crsf_calc_crc8_buf(const uint8_t *buf, uint8_t len);
uint8_t crsf_calc_crc8_frame(const struct crsf_frame *frame);
```

`crsf_calc_crc8_buf` menghitung CRC pada buffer arbitrary. `crsf_calc_crc8_frame` menghitung ulang CRC `type + payload` dari frame.

## Parsing frame mentah

```c
bool crsf_parse_frame(
    struct crsf_frame *frame,
    const uint8_t *buf,
    uint64_t buf_len,
    uint64_t *read_len
);
```

- Return `true` bila satu frame valid berhasil diparsing.
- Return `false` bila buffer belum lengkap atau frame invalid.
- Validasi sync, nilai length, ukuran buffer, dan CRC.
- `read_len` berisi byte yang sudah diperiksa/dikonsumsi.
- Bila sync invalid, `read_len` bernilai `1`; caller dapat geser stream satu byte lalu coba lagi.
- Jangan pakai `frame` output saat return `false`.

Contoh parser stream manual:

```c
#include <stdint.h>
#include <stdbool.h>
#include "crsf.h"

void process_stream(const uint8_t *buf, uint64_t len)
{
    uint64_t offset = 0;

    while (offset < len) {
        struct crsf_frame frame;
        uint64_t read_len = 0;

        if (crsf_parse_frame(&frame, buf + offset, len - offset, &read_len)) {
            if (crsf_get_type(&frame) == CRSF_TYPE_GPS) {
                struct crsf_gps gps;
                crsf_parse_gps(&frame, &gps);
            }
        }

        if (read_len == 0) {
            break;
        }

        offset += read_len;
    }
}
```

## Struct payload

### GPS

```c
struct crsf_gps {
    int32_t latitude_100ndeg;
    int32_t longitude_100ndeg;
    uint16_t groundspeed_damph;
    uint16_t heading_cdeg;
    uint16_t alt_m;
    uint8_t satellites;
};
```

### GPS time

```c
struct crsf_gps_time {
    int16_t year;
    uint8_t month;
    uint8_t day;
    uint8_t hour;
    uint8_t minute;
    uint8_t second;
    uint16_t millisecond;
};
```

### GPS Extended

```c
struct crsf_gps_ex {
    uint8_t fix_type;
    int16_t northward_velocity_cmps;
    int16_t eastward_velocity_cmps;
    int16_t vertical_velocity_cmps;
    int16_t horizontal_velocity_accuracy_cmps;
    int16_t track_accuracy_deg;
    int16_t alt_ellipsoid_m;
    int16_t horizontal_accuracy_cm;
    int16_t vertical_accuracy_cm;
    uint8_t reserved;
    uint8_t horizontal_dop_deci;
    uint8_t vertical_dop_deci;
};
```

### Telemetry lain

```c
struct crsf_variometer { int16_t vertical_velocity_cmps; };

struct crsf_battery {
    int16_t voltage_10uv;
    int16_t current_10ua;
    uint32_t capacity_used_mah;
    uint8_t remaining_percent;
};

struct crsf_airspeed { uint16_t airspeed_hmph; };

struct crsf_attitude {
    int16_t pitch_angle_100urad;
    int16_t roll_angle_100urad;
    int16_t yaw_angle_100urad;
};

struct crsf_rate {
    int16_t pitch_rate_ddegps;
    int16_t roll_rate_ddegps;
    int16_t yaw_rate_ddegps;
};

struct crsf_accel {
    int16_t lateral_accel_mg;
    int16_t longitudinal_accel_mg;
    int16_t vertical_accel_mg;
};
```

### Voltages dan temperatures

```c
struct crsf_voltages {
    uint8_t voltage_cnt;
    uint8_t voltage_src_id;
    uint16_t voltages_mv[CRSF_VOLTAGESLEN_MAX];
};

struct crsf_temps {
    uint8_t temp_cnt;
    uint8_t temp_src_id;
    int16_t temps_ddeg[CRSF_TEMPSLEN_MAX];
};
```

Panjang payload dinamis:

```c
CRSF_PLDLEN_VOLTAGES(voltage_count)
CRSF_PLDLEN_TEMPS(temperature_count)
CRSF_CNT_VOLTAE(voltages_payload_length)
CRSF_CNT_TEMP(temps_payload_length)
```

### RC channels

```c
struct crsf_rc_channels {
    unsigned chan1 : 11;
    unsigned chan2 : 11;
    /* sampai chan16 */
};
```

16 channel dikemas sebagai nilai 11-bit, total 22 byte. Nilai tengah `1500 us` setara `992`.

## Payload parser

Semua fungsi parser return `true` saat tipe dan payload frame valid.

```c
bool crsf_parse_gps(const struct crsf_frame *frame, struct crsf_gps *gps);
bool crsf_parse_gps_time(const struct crsf_frame *frame, struct crsf_gps_time *gps_time);
bool crsf_parse_gps_ex(const struct crsf_frame *frame, struct crsf_gps_ex *gps_ex);
bool crsf_parse_rc_channels(const struct crsf_frame *frame, struct crsf_rc_channels *rc_channels);
bool crsf_parse_attitude(const struct crsf_frame *frame, struct crsf_attitude *attitude);
bool crsf_parse_voltages(const struct crsf_frame *frame, struct crsf_voltages *voltages);
bool crsf_parse_temps(const struct crsf_frame *frame, struct crsf_temps *temps);
bool crsf_parse_airspeed(const struct crsf_frame *frame, struct crsf_airspeed *airspeed);
bool crsf_parse_rate(const struct crsf_frame *frame, struct crsf_rate *rate);
bool crsf_parse_accel(const struct crsf_frame *frame, struct crsf_accel *accel);
```

Contoh:

```c
struct crsf_frame frame;
uint64_t read_len = 0;

if (crsf_parse_frame(&frame, buffer, buffer_len, &read_len) &&
    crsf_get_type(&frame) == CRSF_TYPE_ATTITUDE) {
    struct crsf_attitude attitude;

    if (crsf_parse_attitude(&frame, &attitude)) {
        /* gunakan attitude */
    }
}
```

## Membuat frame

```c
void crsf_framing_gps(
    struct crsf_frame *frame,
    int32_t latitude_100ndeg,
    int32_t longitude_100ndeg,
    uint16_t groundspeed_damph,
    uint16_t heading_cdeg,
    uint16_t altitude_m,
    uint8_t satellites
);

void crsf_framing_gps_ex(
    struct crsf_frame *frame,
    uint8_t fix_type,
    int16_t northward_velocity_cmps,
    int16_t eastward_velocity_cmps,
    int16_t vertical_velocity_cmps,
    int16_t horizontal_velocity_accuracy_cmps,
    int16_t track_accuracy_deg,
    int16_t alt_ellipsoid_m,
    int16_t horizontal_accuracy_cm,
    int16_t vertical_accuracy_cm,
    uint8_t horizontal_dop_deci,
    uint8_t vertical_dop_deci
);

void crsf_framing_gps_time(struct crsf_frame *frame, int16_t year, uint8_t month, uint8_t day, uint8_t hour, uint8_t minuate, uint8_t second, uint8_t millisecond);
void crsf_framing_attitude(struct crsf_frame *frame, int16_t pitch_angle_100urad, int16_t roll_angle_100urad, int16_t yaw_angle_100urad);
void crsf_framing_airspeed(struct crsf_frame *frame, uint16_t arispeed_hmph);
void crsf_framing_variometer(struct crsf_frame *frame, int16_t vertical_velocity_cmps);
void crsf_framing_battery(struct crsf_frame *frame, int16_t voltage_10uv, int16_t current_10ua, uint32_t capacity_used_mah, uint8_t remaining_percet);
void crsf_framing_voltages(struct crsf_frame *frame, uint8_t voltage_src_id, uint16_t voltages_mv[], uint8_t voltages_len);
void crsf_framing_temps(struct crsf_frame *frame, uint8_t temp_src_id, int16_t temps_ddeg[], uint8_t temps_len);
void crsf_framing_rate(struct crsf_frame *frame, int16_t pitch_rate_dgegps, int16_t roll_rate_ddegps, int16_t yaw_rate_ddegps);
void crsf_framing_accel(struct crsf_frame *frame, int16_t lateral_accel_mg, int16_t longitudinal_accel_mg, int16_t vertical_accel_mg);
```

Nama parameter mengikuti header publik, termasuk ejaan `minuate`, `arispeed_hmph`, `remaining_percet`, dan `pitch_rate_dgegps`.

Contoh membuat frame GPS:

```c
#include <stdint.h>
#include "crsf.h"

int main(void)
{
    struct crsf_frame frame;

    crsf_framing_gps(
        &frame,
        -62500000,
        1068166667,
        120,
        9000,
        100,
        12
    );

    uint8_t frame_length = crsf_get_frame_length(&frame);
    const uint8_t *bytes = frame.frame;

    send_bytes(bytes, frame_length);
    return 0;
}
```

`send_bytes` pada contoh adalah fungsi transport milik aplikasi Anda.

## Queue stream opsional

`src/utils/crsf_queue.h` menyediakan queue FIFO berkapasitas tetap `5` frame.

```c
struct crsf_queue {
    struct crsf_frame frames[CRSF_QUEUE_SIZE];
    uint8_t head;
    uint8_t tail;
    uint8_t size;
};
```

```c
void crsf_queue_init(struct crsf_queue *queue);
bool crsf_queue_enqueue(struct crsf_queue *queue, const struct crsf_frame *frame);
bool crsf_queue_dequeue(struct crsf_queue *queue, struct crsf_frame *frame);
void crsf_queue_clear(struct crsf_queue *queue);
void crsf_queue_parse_frames(struct crsf_queue *queue, const uint8_t *buf, uint64_t buf_len);
```

- FIFO.
- Saat penuh, `crsf_queue_enqueue` membuang frame tertua.
- `crsf_queue_parse_frames` memindai buffer dan memasukkan semua frame valid.

```c
#include "crsf.h"
#include "utils/crsf_queue.h"

void process_stream(const uint8_t *data, uint64_t length)
{
    struct crsf_queue queue;
    struct crsf_frame frame;

    crsf_queue_init(&queue);
    crsf_queue_parse_frames(&queue, data, length);

    while (crsf_queue_dequeue(&queue, &frame)) {
        if (crsf_get_type(&frame) == CRSF_TYPE_GPS) {
            struct crsf_gps gps;
            crsf_parse_gps(&frame, &gps);
        }
    }
}
```

## Catatan integrasi React dashboard

Library ini C, bukan package React atau JavaScript. Browser tidak dapat memanggilnya langsung.

Pola integrasi:

```text
Perangkat CRSF → aplikasi C/service backend → JSON atau WebSocket → React dashboard
```

Backend membaca UART/serial, memakai library ini untuk parse frame, lalu mengirim telemetry bertipe JSON ke React. Untuk memakai C langsung di browser, kompilasi library ke WebAssembly dan buat binding JavaScript.

## Batasan

- Tidak ada metadata package, Makefile, CMake, atau test suite di repository.
- Tidak ada parser payload khusus untuk variometer, battery, barometer, atau link statistic.
- Queue memiliki kapasitas compile-time tetap `5` frame.
- API parser dan framing memakai pointer caller; pastikan pointer dan ukuran buffer valid.

## License

MIT. Lihat [LICENSE](LICENSE).
