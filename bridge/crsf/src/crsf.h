/*
 * crsf.h
 *
 *  Created on: Nov 13, 2025
 *      Author: coder0908
 */

#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <assert.h>

#define CRSF_LEN_SYNC			1
#define CRSF_LEN_LEN			1
#define CRSF_LEN_TYPE			1
#define CRSF_LEN_CRC			1
#define CRSF_LEN_METADATA 		(CRSF_LEN_SYNC+CRSF_LEN_LEN+CRSF_LEN_TYPE+CRSF_LEN_CRC)

#define CRSF_FRAMELEN_MAX		(CRSF_PLDLEN_MAX + CRSF_LEN_SYNC + CRSF_LEN_LEN + CRSF_LEN_TYPE + CRSF_LEN_CRC)

#define CRSF_VOLTAGESLEN_MAX		29
#define CRSF_TEMPSLEN_MAX		20
#define CRSF_SYNC_CHAR			0xc8

 //crsf payload length
#define CRSF_PLDLEN_MAX 		60
#define CRSF_PLDLEN_GPS			15
#define CRSF_PLDLEN_GPS_TIME		9
#define CRSF_PLDLEN_GPS_EX		20
#define CRSF_PLDLEN_VARIOMETER		2
#define CRSF_PLDLEN_BATTERY		8
#define CRSF_PLDLEN_BAROMETER		3
#define CRSF_PLDLEN_AIRSPEED		2
#define CRSF_PLDLEN_LINK_STATISTIC	10
#define CRSF_PLDLEN_RC_CHANNELS		22
#define CRSF_PLDLEN_ATTITUDE		6
#define CRSF_PLDLEN_RATE		6
#define CRSF_PLDLEN_ACCEL		6

#define CRSF_PLDLEN_TEMPS(temperature_count)	((temperature_count) * 2 + 1)
#define CRSF_PLDLEN_VOLTAGES(voltage_count)	((voltage_count) * 2 + 1)

#define CRSF_CNT_VOLTAE(voltages_pld_len)	(((voltages_pld_len)-1)/2)
#define CRSF_CNT_TEMP(temps_pld_len)	(((temps_pld_len)-1)/2)

#define CRSF_IDX_SYNC			0
#define CRSF_IDX_LEN			1
#define CRSF_IDX_TYPE			2
#define CRSF_IDX_PAYLOAD		3
#define CRSF_IDX_CRC(len_field_value)	(len_field_value+1)

enum crsf_type {
	CRSF_TYPE_GPS = 0x02,
	CRSF_TYPE_GPS_TIME = 0x03,
	CRSF_TYPE_GPS_EX = 0x06,
	CRSF_TYPE_VARIOMETER = 0x07,
	CRSF_TYPE_BATTERY = 0x08,
	CRSF_TYPE_BAROMETER = 0x09,
	CRSF_TYPE_AIRSPEED = 0x0A,
	CRSF_TYPE_TEMPS = 0x0D,
	CRSF_TYPE_LINK_STATISTIC = 0x14,
	CRSF_TYPE_RC_CHANNELS = 0x16,
	CRSF_TYPE_ATTITUDE = 0x1E,
	CRSF_TYPE_VOLTAGES = 0x0E,
	/*not standard*/
	CRSF_TYPE_RATE = 0x30,
	CRSF_TYPE_ACCEL = 0x31
};

struct crsf_frame {
	uint8_t frame[CRSF_FRAMELEN_MAX];
};

struct crsf_gps {
	int32_t latitude_100ndeg;
	int32_t longitude_100ndeg;
	uint16_t groundspeed_damph;
	uint16_t heading_cdeg;
	uint16_t alt_m;
	uint8_t satellites;
};

struct crsf_gps_time {
	int16_t year;
	uint8_t month;
	uint8_t day;
	uint8_t hour;
	uint8_t minute;
	uint8_t second;
	uint16_t millisecond;
};

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

struct crsf_variometer {
	int16_t vertical_velocity_cmps;
};

struct crsf_battery {
	int16_t voltage_10uv;
	int16_t current_10ua;
	uint32_t capacity_used_mah; 	// Capacity used (mAh)	actually 24bit, ignore highest 8bit
	uint8_t remaining_percent;
};

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

struct crsf_airspeed {
	uint16_t airspeed_hmph;
};

// Center (1500µs) = 992
#pragma pack(push, 1)
struct crsf_rc_channels {
	// (11 bits per channel * 16 channels) = 22 bytes
	unsigned chan1 : 11;
	unsigned chan2 : 11;
	unsigned chan3 : 11;
	unsigned chan4 : 11;
	unsigned chan5 : 11;
	unsigned chan6 : 11;
	unsigned chan7 : 11;
	unsigned chan8 : 11;
	unsigned chan9 : 11;
	unsigned chan10 : 11;
	unsigned chan11 : 11;
	unsigned chan12 : 11;
	unsigned chan13 : 11;
	unsigned chan14 : 11;
	unsigned chan15 : 11;
	unsigned chan16 : 11;
};
#pragma pack(pop)

struct crsf_attitude {
	int16_t pitch_angle_100urad;
	int16_t roll_angle_100urad;
	int16_t yaw_angle_100urad;
};

struct crsf_rate {
	int16_t pitch_rate_ddegps;	//deci degree per second
	int16_t roll_rate_ddegps;
	int16_t yaw_rate_ddegps;
};

struct crsf_accel {
	int16_t lateral_accel_mg;
	int16_t longitudinal_accel_mg;
	int16_t vertical_accel_mg;
};

static inline uint8_t crsf_get_sync(const struct crsf_frame* frame)
{
	assert(frame);

	return frame->frame[CRSF_IDX_SYNC];
}

static inline uint8_t crsf_get_len(const struct crsf_frame* frame)
{
	assert(frame);

	return frame->frame[CRSF_IDX_LEN];
}

static inline uint8_t crsf_get_payload_length(const struct crsf_frame* frame)
{
	assert(frame);

	return crsf_get_len(frame) - (CRSF_LEN_SYNC + CRSF_LEN_LEN);
}

static inline enum crsf_type crsf_get_type(const struct crsf_frame* frame)
{
	assert(frame);

	return (enum crsf_type)frame->frame[CRSF_IDX_TYPE];
}

static inline void crsf_get_payload(const struct crsf_frame* frame, uint8_t* payload)
{
	assert(frame);

	for (uint8_t i = 0; i < crsf_get_payload_length(frame); i++) {
		payload[i] = frame->frame[CRSF_IDX_PAYLOAD + i];
	}
}

static inline uint8_t crsf_get_crc(const struct crsf_frame* frame)
{
	assert(frame);

	return frame->frame[CRSF_IDX_CRC(crsf_get_len(frame))];
}


static inline uint8_t crsf_get_frame_length(const struct crsf_frame* frame)
{
	assert(frame);

	return crsf_get_len(frame) + CRSF_LEN_SYNC + CRSF_LEN_LEN;
}

uint8_t crsf_calc_crc8_buf(const uint8_t* buf, uint8_t len);
uint8_t crsf_calc_crc8_frame(const struct crsf_frame* frame);


bool crsf_parse_frame(struct crsf_frame* frame, const uint8_t* buf, uint64_t buf_len, uint64_t* read_len);

bool crsf_parse_gps(const struct crsf_frame* frame, struct crsf_gps* gps);
bool crsf_parse_rc_channels(const struct crsf_frame* frame, struct crsf_rc_channels* rc_channels);
bool crsf_parse_attitude(const struct crsf_frame* frame, struct crsf_attitude* attitude);
bool crsf_parse_voltages(const struct crsf_frame* frame, struct crsf_voltages* voltages);
bool crsf_parse_temps(const struct crsf_frame* frame, struct crsf_temps* temps);
bool crsf_parse_gps_time(const struct crsf_frame *frame, struct crsf_gps_time* gps_time);
bool crsf_parse_gps_ex(const struct crsf_frame *frame, struct crsf_gps_ex* gps_ex);
bool crsf_parse_airspeed(const struct crsf_frame *frame, struct crsf_airspeed *airspeed);
bool crsf_parse_rate(const struct crsf_frame* frame, struct crsf_rate* rate);
bool crsf_parse_accel(const struct crsf_frame* frame, struct crsf_accel* accel);

void crsf_framing_gps(struct crsf_frame* frame, int32_t latitude_100ndeg, int32_t longitude_100ndeg,
	uint16_t groundspeed_damph, uint16_t heading_cdeg, uint16_t altitude_m, uint8_t satellites);
void crsf_framing_gps_ex(struct crsf_frame* frame, uint8_t fix_type, int16_t northward_velocity_cmps, int16_t eastward_velocity_cmps,
	int16_t vertical_velocity_cmps, int16_t horizontal_velocity_accuracy_cmps, int16_t track_accuracy_deg, int16_t alt_ellipsoid_m,
	int16_t horizontal_accuracy_cm, int16_t vertical_accuracy_cm, uint8_t horizontal_dop_deci, uint8_t vertical_dop_deci);
void crsf_framing_gps_time(struct crsf_frame* frame, int16_t year, uint8_t month, uint8_t day, uint8_t hour, uint8_t minuate, uint8_t second, uint8_t millisecond);
void crsf_framing_attitude(struct crsf_frame* frame, int16_t pitch_angle_100urad, int16_t roll_angle_100urad, int16_t yaw_angle_100urad);
void crsf_framing_airspeed(struct crsf_frame* frame, uint16_t arispeed_hmph);
void crsf_framing_variometer(struct crsf_frame* frame, int16_t vertical_velocity_cmps);
void crsf_framing_battery(struct crsf_frame* frame, int16_t voltage_10uv, int16_t current_10ua, uint32_t capacity_used_mah, uint8_t remaining_percet);
void crsf_framing_voltages(struct crsf_frame* frame, uint8_t voltage_src_id, uint16_t voltages_mv[], uint8_t voltages_len);
void crsf_framing_temps(struct crsf_frame* frame, uint8_t temp_src_id, int16_t temps_ddeg[], uint8_t temps_len);
void crsf_framing_rate(struct crsf_frame* frame, int16_t pitch_rate_dgegps, int16_t roll_rate_ddegps, int16_t yaw_rate_ddegps);
void crsf_framing_accel(struct crsf_frame* frame, int16_t lateral_accel_mg, int16_t longitudinal_accel_mg, int16_t vertical_accel_mg);

