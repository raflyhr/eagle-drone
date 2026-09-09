/*
 * crsf_queue.h
 *
 *  Created on: 2025. 12. 6.
 *      Author: coder0908
 */

#pragma once

#include "../crsf.h"

//crsf driver settings
#define CRSF_FRAMESLEN_MAX 5

struct crsf_queue {
	struct crsf_frame frames[CRSF_FRAMESLEN_MAX];
	uint64_t head;
	uint64_t cnt;
};

bool crsf_q_init(struct crsf_queue *queue);
bool crsf_q_enq(struct crsf_queue *queue, const struct crsf_frame *frame);
bool crsf_q_deq(struct crsf_queue *queue, struct crsf_frame *frame);
bool crsf_q_clear(struct crsf_queue *queue);
void crsf_q_parse_frames(struct crsf_queue *queue, const uint8_t buf[],
                       uint64_t buf_len, uint64_t *read_len);
