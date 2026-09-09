#include "crsf.h"

// Stable ABI: JavaScript owns serial I/O and passes byte buffers here.
int crsf_wasm_parse(const uint8_t *bytes, uint32_t length,
                    struct crsf_frame *frame, uint32_t *read_length)
{
    if (!bytes || !frame || !read_length) return 0;
    uint64_t consumed = 0;
    const int parsed = crsf_parse_frame(frame, bytes, length, &consumed);
    *read_length = (uint32_t)consumed;
    return parsed ? 1 : 0;
}

uint8_t crsf_wasm_type(const struct crsf_frame *frame)
{
    return frame ? (uint8_t)crsf_get_type(frame) : 0;
}

uint8_t crsf_wasm_frame_length(const struct crsf_frame *frame)
{
    return frame ? crsf_get_frame_length(frame) : 0;
}

int crsf_wasm_decode(const struct crsf_frame *frame, float *values, uint32_t capacity)
{
    if (!frame || !values || capacity < 6) return 0;

    switch (crsf_get_type(frame)) {
    case CRSF_TYPE_GPS: {
        struct crsf_gps value;
        if (!crsf_parse_gps(frame, &value)) return 0;
        values[0] = (float)value.latitude_100ndeg / 10000000.0f;
        values[1] = (float)value.longitude_100ndeg / 10000000.0f;
        values[2] = (float)value.groundspeed_damph / 36.0f;
        values[3] = (float)value.heading_cdeg / 100.0f;
        values[4] = (float)value.alt_m;
        values[5] = (float)value.satellites;
        return 6;
    }
    case CRSF_TYPE_BATTERY: {
        struct crsf_battery value;
        if (crsf_get_payload_length(frame) != CRSF_PLDLEN_BATTERY) return 0;
        const uint8_t *payload = frame->frame + CRSF_IDX_PAYLOAD;
        value.voltage_10uv = (int16_t)((payload[0] << 8) | payload[1]);
        value.current_10ua = (int16_t)((payload[2] << 8) | payload[3]);
        value.capacity_used_mah = ((uint32_t)payload[4] << 16) |
            ((uint32_t)payload[5] << 8) | payload[6];
        value.remaining_percent = payload[7];
        values[0] = (float)value.voltage_10uv / 10.0f;
        values[1] = (float)value.current_10ua / 10.0f;
        values[2] = (float)value.capacity_used_mah;
        values[3] = (float)value.remaining_percent;
        return 4;
    }
    case CRSF_TYPE_ATTITUDE: {
        struct crsf_attitude value;
        if (!crsf_parse_attitude(frame, &value)) return 0;
        values[0] = (float)value.pitch_angle_100urad * 180.0f / 3.14159265358979323846f / 10000.0f;
        values[1] = (float)value.roll_angle_100urad * 180.0f / 3.14159265358979323846f / 10000.0f;
        values[2] = (float)value.yaw_angle_100urad * 180.0f / 3.14159265358979323846f / 10000.0f;
        return 3;
    }
    case CRSF_TYPE_LINK_STATISTIC: {
        const uint8_t *payload = frame->frame + CRSF_IDX_PAYLOAD;
        if (crsf_get_payload_length(frame) != CRSF_PLDLEN_LINK_STATISTIC) return 0;
        values[0] = -(float)payload[0];
        values[1] = (float)payload[2];
        values[2] = (float)(int8_t)payload[3];
        return 3;
    }
    default:
        return 0;
    }
}
