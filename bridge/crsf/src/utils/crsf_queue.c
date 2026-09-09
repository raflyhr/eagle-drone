/*
 * crsf_queue.c
 *
 *  Created on: 2025. 12. 6.
 *      Author: coder0908
 */

#include <assert.h>
#include "crsf_queue.h"




bool crsf_q_init(struct crsf_queue *queue)
{
//	assert(queue);

	queue->cnt = 0;
	queue->head = 0;

	return true;
}

bool crsf_q_enq(struct crsf_queue *queue, const struct crsf_frame *frame)
{
	assert(queue);
	assert(queue->cnt <= CRSF_FRAMESLEN_MAX);

	if (queue->cnt == CRSF_FRAMESLEN_MAX) {
		queue->head = (queue->head+1) % CRSF_FRAMESLEN_MAX;
		queue->cnt -= 1;
	}

	struct crsf_frame *const dest = queue->frames + (queue->head + queue->cnt) % CRSF_FRAMESLEN_MAX;
	*dest = *frame;
	queue->cnt += 1;

	return true;
}

bool crsf_q_deq(struct crsf_queue *queue, struct crsf_frame *frame)
{
	assert(queue);
	assert(frame);

	if (queue->cnt == 0) {
		return false;
	}

	struct crsf_frame *src = &(queue->frames[queue->head]);
	*frame = *src;
	queue->cnt -= 1;
	queue->head = (queue->head + 1) % CRSF_FRAMESLEN_MAX;

	return true;
}


bool crsf_q_clear(struct crsf_queue *queue)
{
	assert(queue);

	queue->cnt = 0;

	return true;
}

void crsf_q_parse_frames(struct crsf_queue *queue, const uint8_t buf[],
                       uint64_t buf_len, uint64_t *read_len) {
	assert(queue);
	assert(buf);
	assert(read_len);

	struct crsf_frame frame;
	uint64_t tmp_read_cnt;
	uint64_t total_read_cnt;
	bool is_parse_success;

	for (total_read_cnt=0; total_read_cnt<buf_len; /*intentionally do nothing*/) {
		is_parse_success = crsf_parse_frame(&frame, buf + total_read_cnt, buf_len - total_read_cnt, &tmp_read_cnt);

		total_read_cnt += tmp_read_cnt;
		if (is_parse_success) {
			if (!crsf_q_enq(queue, &frame)) {
				break;
			}
		}
	}

	*read_len = total_read_cnt;
}



















