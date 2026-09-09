/*
 * crsf.c
 *
 *  Created on: Nov 13, 2025
 *      Author: coder0908
 */

#include "crsf.h"

/*
 * sync_char(1), len(1), type(1), payload(len-2), crc(1)
 *
 * len : includes 'type', 'payload','crc'
 * crc : include 'type', 'payload'
 * */




static uint32_t buf_to_u32_little_endian(const uint8_t* buf)
{
	return (uint32_t)buf[3] | ((uint32_t)buf[2] << 8) | ((uint32_t)buf[1] << 16) | ((uint32_t)buf[0] << 24);
}

//static uint32_t buf_to_u24_little_endian(const uint8_t* buf)
//{
//	return (uint32_t)buf[2] | ((uint32_t)buf[1] << 8) | ((uint32_t)buf[0] << 16);
//}

static uint16_t buf_to_u16_little_endian(const uint8_t* buf)
{
	return (uint16_t)buf[1] | (uint16_t)(buf[0] << 8);
}

static void u16_to_buf_big_endian(uint8_t* buf, uint16_t value)
{
	buf[0] = value >> 8;
	buf[1] = value & 0xff;
}

static void u24_to_buf_big_endian(uint8_t* buf, uint32_t value)
{
	buf[0] = value >> 16;
	buf[1] = (value >> 8) & 0xff;
	buf[2] = value & 0xff;
}

static void u32_to_buf_big_endian(uint8_t* buf, int32_t value)
{
	buf[0] = value >> 24;
	buf[1] = (value >> 16) & 0xff;
	buf[2] = (value >> 8) & 0xff;
	buf[3] = value & 0xff;
}

static void crsf_set_sync(struct crsf_frame* frame, uint8_t sync)
{
	assert(frame);

	frame->frame[CRSF_IDX_SYNC] = sync;
}

static void crsf_set_len(struct crsf_frame* frame, uint8_t len)
{
	assert(frame);

	frame->frame[CRSF_IDX_LEN] = len;
}

static void crsf_set_type(struct crsf_frame* frame, enum crsf_type type)
{
	assert(frame);

	frame->frame[CRSF_IDX_TYPE] = (uint8_t)type;
}

static void crsf_set_payload(struct crsf_frame* frame, const uint8_t payload[])
{
	assert(frame);

	for (uint8_t i = 0; i < crsf_get_payload_length(frame); i++) {
		frame->frame[CRSF_IDX_PAYLOAD + i] = payload[i];
	}
}

static void crsf_set_crc(struct crsf_frame* frame, uint8_t crc)
{
	assert(frame);

	frame->frame[CRSF_IDX_CRC(crsf_get_len(frame))] = crc;
}

static uint8_t crsf_crc8_dvbs2(uint8_t crc, uint8_t val)
{
	crc ^= val;
	for (int j = 0; j < 8; j++) {
		if (crc & 0x80) {
			crc = (crc << 1) ^ 0xD5;

		}
		else {
			crc <<= 1;
		}
	}
	return crc;
}

uint8_t crsf_calc_crc8_buf(const uint8_t* buf, uint8_t len)
{
	assert(buf);

	uint8_t crc = 0;
	for (uint8_t i = CRSF_IDX_TYPE; i < len - CRSF_LEN_CRC; i++) {
		crc = crsf_crc8_dvbs2(crc, buf[i]);
	}

	return crc;
}

uint8_t crsf_calc_crc8_frame(const struct crsf_frame* frame)
{
	assert(frame);

	uint8_t crc = 0;
	for (uint8_t i = CRSF_IDX_TYPE; i < CRSF_IDX_CRC(crsf_get_len(frame)); i++) {
		crc = crsf_crc8_dvbs2(crc, frame->frame[i]);
	}

	return crc;
}

bool crsf_parse_frame(struct crsf_frame* frame, const uint8_t* buf, uint64_t buf_len, uint64_t* read_len)
{
	if (buf_len < CRSF_LEN_METADATA) {
		*read_len = buf_len;
		return false;
	}
	if (buf[0] != CRSF_SYNC_CHAR) {
		*read_len = 1;
		return false;
	}
	crsf_set_sync(frame, buf[0]);
	if (buf[1] < 2) {
		*read_len = 2;
		return false;
	}
	if (buf_len < buf[1] + 2 || CRSF_PLDLEN_MAX + 2 < buf[1]) {
		*read_len = buf_len;
		return false;
	}

	crsf_set_len(frame, buf[CRSF_IDX_LEN]);
	crsf_set_type(frame, (enum crsf_type)buf[CRSF_IDX_TYPE]);
	uint64_t len = crsf_get_len(frame);
	uint8_t crc_idx = CRSF_IDX_CRC(len);

	uint8_t crc = crsf_calc_crc8_buf(buf, crsf_get_frame_length(frame));
	*read_len = crsf_get_frame_length(frame);

	if (buf[crc_idx] != crc) {
		return false;
	}
	crsf_set_crc(frame, crc);

	crsf_set_payload(frame, buf + CRSF_IDX_PAYLOAD);

	return true;
}

bool crsf_parse_gps(const struct crsf_frame* frame, struct crsf_gps* gps)
{
	assert(frame);
	assert(gps);

	if (crsf_get_type(frame) != CRSF_TYPE_GPS) {
		return false;
	}

	if (crsf_get_payload_length(frame) != CRSF_PLDLEN_GPS) {
		return false;
	}

	const uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	gps->latitude_100ndeg = buf_to_u32_little_endian(payload);
	gps->longitude_100ndeg = buf_to_u32_little_endian(payload + 4);
	gps->groundspeed_damph = buf_to_u16_little_endian(payload + 8);
	gps->heading_cdeg = buf_to_u16_little_endian(payload + 10);
	gps->alt_m = buf_to_u16_little_endian(payload + 12);
	gps->satellites = payload[14];

	gps->alt_m -= 1000;

	return true;
}

bool crsf_parse_gps_ex(const struct crsf_frame *frame, struct crsf_gps_ex* gps_ex)
{
	assert(frame);
	assert(gps_ex);

	if (crsf_get_type(frame) != CRSF_TYPE_GPS_EX) {
		return false;
	}

	if (crsf_get_payload_length(frame) != CRSF_PLDLEN_GPS_EX) {
		return false;
	}

	const uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	gps_ex->fix_type = payload[0];
	gps_ex->northward_velocity_cmps = buf_to_u16_little_endian(payload+1);
	gps_ex->eastward_velocity_cmps = buf_to_u16_little_endian(payload+3);
	gps_ex->vertical_velocity_cmps = buf_to_u16_little_endian(payload+5);
	gps_ex->horizontal_velocity_accuracy_cmps = buf_to_u16_little_endian(payload+7);
	gps_ex->track_accuracy_deg = buf_to_u16_little_endian(payload+9);
	gps_ex->alt_ellipsoid_m = buf_to_u16_little_endian(payload+11);
	gps_ex->horizontal_accuracy_cm = buf_to_u16_little_endian(payload+13);
	gps_ex->vertical_accuracy_cm = buf_to_u16_little_endian(payload+15);
	gps_ex->reserved = payload[17];
	gps_ex->horizontal_dop_deci = payload[18];
	gps_ex->vertical_dop_deci= payload[19];

	return true;
}

bool crsf_parse_gps_time(const struct crsf_frame *frame, struct crsf_gps_time* gps_time)
{
	assert(frame);
	assert(gps_time);

	if (crsf_get_type(frame) != CRSF_TYPE_GPS_TIME) {
		return false;
	}

	if (crsf_get_payload_length(frame) != CRSF_PLDLEN_GPS_TIME) {
		return false;
	}

	const uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	gps_time->year = buf_to_u16_little_endian(payload);
	gps_time->month = payload[2];
	gps_time->day = payload[3];
	gps_time->hour = payload[4];
	gps_time->minute = payload[5];
	gps_time->second = payload[6];
	gps_time->millisecond = buf_to_u16_little_endian(payload+7);

	return true;
}

bool crsf_parse_airspeed(const struct crsf_frame *frame, struct crsf_airspeed *airspeed)
{
	assert(frame);
	assert(airspeed);

	if (crsf_get_type(frame) != CRSF_TYPE_AIRSPEED) {
		return false;
	}

	if (crsf_get_payload_length(frame) != CRSF_PLDLEN_AIRSPEED) {
		return false;
	}

	const uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	airspeed->airspeed_hmph = buf_to_u16_little_endian(payload);

	return true;
}

bool crsf_parse_rc_channels(const struct crsf_frame* frame, struct crsf_rc_channels* rc_channels)
{
	assert(frame);
	assert(rc_channels);

	if (crsf_get_type(frame) != CRSF_TYPE_RC_CHANNELS) {
		return false;
	}

	if (crsf_get_payload_length(frame) != CRSF_PLDLEN_RC_CHANNELS) {
		return false;
	}

	const uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	const struct crsf_rc_channels* tmp = (struct crsf_rc_channels*)(payload);
	*rc_channels = *tmp;

	return true;
}

bool crsf_parse_attitude(const struct crsf_frame* frame, struct crsf_attitude* attitude)
{
	assert(frame);
	assert(attitude);

	if (crsf_get_type(frame) != CRSF_TYPE_ATTITUDE) {
		return false;
	}

	if (crsf_get_payload_length(frame) != CRSF_PLDLEN_ATTITUDE) {
		return false;
	}

	const uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	attitude->pitch_angle_100urad = buf_to_u16_little_endian(payload);
	attitude->roll_angle_100urad = buf_to_u16_little_endian(payload + 2);
	attitude->yaw_angle_100urad = buf_to_u16_little_endian(payload + 4);

	return true;
}

bool crsf_parse_rate(const struct crsf_frame* frame, struct crsf_rate* rate)
{
	assert(frame);
	assert(rate);

	if (crsf_get_type(frame) != CRSF_TYPE_RATE) {
		return false;
	}

	if (crsf_get_payload_length(frame) != CRSF_PLDLEN_RATE) {
		return false;
	}

	const uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	rate->pitch_rate_ddegps= buf_to_u16_little_endian(payload);
	rate->roll_rate_ddegps= buf_to_u16_little_endian(payload + 2);
	rate->yaw_rate_ddegps = buf_to_u16_little_endian(payload + 4);

	return true;
}

bool crsf_parse_accel(const struct crsf_frame* frame, struct crsf_accel* accel)
{
	assert(frame);
	assert(accel);

	if (crsf_get_type(frame) != CRSF_TYPE_ACCEL) {
		return false;
	}

	if (crsf_get_payload_length(frame) != CRSF_PLDLEN_ACCEL) {
		return false;
	}

	const uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	accel->lateral_accel_mg = buf_to_u16_little_endian(payload);
	accel->longitudinal_accel_mg = buf_to_u16_little_endian(payload + 2);
	accel->vertical_accel_mg = buf_to_u16_little_endian(payload + 4);

	return true;
}

bool crsf_parse_voltages(const struct crsf_frame* frame, struct crsf_voltages* voltages)
{
	assert(frame);
	assert(voltages);

	if (crsf_get_type(frame) != CRSF_TYPE_VOLTAGES) {
		return false;
	}

	voltages->voltage_cnt = CRSF_CNT_VOLTAE(crsf_get_payload_length(frame));

	const uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;


	voltages->voltage_src_id = payload[0];
	for (uint8_t i = 0; i < voltages->voltage_cnt; i++) {
		voltages->voltages_mv[i] = buf_to_u16_little_endian(payload + 1 + i * 2);
	}

	return true;
}

bool crsf_parse_temps(const struct crsf_frame* frame, struct crsf_temps* temps)
{
	assert(frame);
	assert(temps);

	if (crsf_get_type(frame) != CRSF_TYPE_TEMPS) {
		return false;
	}

	temps->temp_cnt = CRSF_CNT_TEMP(crsf_get_payload_length(frame));
	const uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	temps->temp_src_id = payload[0];
	for (uint8_t i = 0; i < temps->temp_cnt; i++) {
		temps->temps_ddeg[i] = buf_to_u16_little_endian(payload + 1 + i * 2);
	}

	return true;
}



void crsf_framing_gps(struct crsf_frame* frame, int32_t latitude_100ndeg, int32_t longitude_100ndeg,
		uint16_t groundspeed_damph, uint16_t heading_cdeg, uint16_t altitude_m, uint8_t satellites)
{
	assert(frame);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_GPS + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_GPS);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	u32_to_buf_big_endian(payload, latitude_100ndeg);
	u32_to_buf_big_endian(payload + 4, longitude_100ndeg);
	u16_to_buf_big_endian(payload + 8, groundspeed_damph);
	u16_to_buf_big_endian(payload + 10, heading_cdeg);
	u16_to_buf_big_endian(payload + 12, altitude_m + 1000);
	payload[14] = satellites;

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}

void crsf_framing_gps_ex(struct crsf_frame* frame, uint8_t fix_type, int16_t northward_velocity_cmps, int16_t eastward_velocity_cmps,
		int16_t vertical_velocity_cmps, int16_t horizontal_velocity_accuracy_cmps, int16_t track_accuracy_deg, int16_t alt_ellipsoid_m,
		int16_t horizontal_accuracy_cm, int16_t vertical_accuracy_cm, uint8_t horizontal_dop_deci, uint8_t vertical_dop_deci)
{
	assert(frame);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_GPS_EX + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_GPS_EX);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	payload[0] = fix_type;
	u16_to_buf_big_endian(payload + 1, northward_velocity_cmps);
	u16_to_buf_big_endian(payload + 3, eastward_velocity_cmps);
	u16_to_buf_big_endian(payload + 5, vertical_velocity_cmps);
	u16_to_buf_big_endian(payload + 7, horizontal_velocity_accuracy_cmps);
	u16_to_buf_big_endian(payload + 9, track_accuracy_deg);
	u16_to_buf_big_endian(payload + 11, alt_ellipsoid_m);
	u16_to_buf_big_endian(payload + 13, horizontal_accuracy_cm);
	u16_to_buf_big_endian(payload + 15, vertical_accuracy_cm);
	payload[17] = 0;
	payload[18] = horizontal_dop_deci;
	payload[19] = vertical_dop_deci;

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}

void crsf_framing_gps_time(struct crsf_frame* frame, int16_t year, uint8_t month, uint8_t day, uint8_t hour, uint8_t minuate, uint8_t second, uint8_t millisecond)
{
	assert(frame);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_GPS_TIME + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_GPS_TIME);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;


	u16_to_buf_big_endian(payload, year);
	payload[2] = month;
	payload[3] = day;
	payload[4] = hour;
	payload[5] = minuate;
	payload[6] = second;
	u16_to_buf_big_endian(payload + 7, millisecond);

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}

void crsf_framing_attitude(struct crsf_frame* frame, int16_t pitch_angle_100urad, int16_t roll_angle_100urad, int16_t yaw_angle_100urad)
{
	assert(frame);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_ATTITUDE + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_ATTITUDE);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;


	u16_to_buf_big_endian(payload, pitch_angle_100urad);
	u16_to_buf_big_endian(payload + 2, roll_angle_100urad);
	u16_to_buf_big_endian(payload + 4, yaw_angle_100urad);

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}

void crsf_framing_airspeed(struct crsf_frame* frame, uint16_t arispeed_hmph)
{
	assert(frame);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_AIRSPEED + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_AIRSPEED);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	u16_to_buf_big_endian(payload, arispeed_hmph);

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}


void crsf_framing_variometer(struct crsf_frame* frame, int16_t vertical_velocity_cmps)
{
	assert(frame);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_VARIOMETER + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_VARIOMETER);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	u16_to_buf_big_endian(payload, vertical_velocity_cmps);

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}

void crsf_framing_battery(struct crsf_frame* frame, int16_t voltage_10uv, int16_t current_10ua, uint32_t capacity_used_mah, uint8_t remaining_percet)
{
	assert(frame);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_BATTERY + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_BATTERY);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	u16_to_buf_big_endian(payload, voltage_10uv);
	u16_to_buf_big_endian(payload + 2, current_10ua);
	u24_to_buf_big_endian(payload + 4, capacity_used_mah);
	payload[7] = remaining_percet;

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}

void crsf_framing_voltages(struct crsf_frame* frame, uint8_t voltage_src_id, uint16_t voltages_mv[], uint8_t voltages_len)
{
	assert(frame);
	assert(voltages_mv);
	assert(voltages_len <= CRSF_VOLTAGESLEN_MAX);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_VOLTAGES(voltages_len) + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_VOLTAGES);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	payload[0] = voltage_src_id;
	uint8_t voltages_idx;
	for (voltages_idx = 0; voltages_idx < voltages_len; voltages_idx++) {
		u16_to_buf_big_endian(payload + 1 + (voltages_idx * 2), voltages_mv[voltages_idx]);
	}

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}

void crsf_framing_temps(struct crsf_frame* frame, uint8_t temp_src_id, int16_t temps_ddeg[], uint8_t temps_len)
{
	assert(frame);
	assert(temps_ddeg);
	assert(temps_len <= CRSF_TEMPSLEN_MAX);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_TEMPS(temps_len) + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_TEMPS);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	payload[0] = temp_src_id;
	uint8_t temps_idx;
	for (temps_idx = 0; temps_idx < temps_len; temps_idx++) {
		u16_to_buf_big_endian(payload + 1 + (temps_idx * 2), temps_ddeg[temps_idx]);
	}

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}

void crsf_framing_rate(struct crsf_frame* frame, int16_t pitch_rate_dgegps, int16_t roll_rate_ddegps, int16_t yaw_rate_ddegps)
{
	assert(frame);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_RATE + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_RATE);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	u16_to_buf_big_endian(payload, pitch_rate_dgegps);
	u16_to_buf_big_endian(payload + 2, roll_rate_ddegps);
	u16_to_buf_big_endian(payload + 4, yaw_rate_ddegps);

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}



void crsf_framing_accel(struct crsf_frame* frame, int16_t lateral_accel_mg, int16_t longitudinal_accel_mg, int16_t vertical_accel_mg)
{
	assert(frame);

	crsf_set_sync(frame, CRSF_SYNC_CHAR);
	crsf_set_len(frame, CRSF_PLDLEN_ACCEL + CRSF_LEN_TYPE + CRSF_LEN_CRC);
	crsf_set_type(frame, CRSF_TYPE_ACCEL);

	uint8_t* const payload = frame->frame + CRSF_IDX_PAYLOAD;

	u16_to_buf_big_endian(payload, lateral_accel_mg);
	u16_to_buf_big_endian(payload + 2, longitudinal_accel_mg);
	u16_to_buf_big_endian(payload + 4, vertical_accel_mg);

	crsf_set_crc(frame, crsf_calc_crc8_frame(frame));
}










