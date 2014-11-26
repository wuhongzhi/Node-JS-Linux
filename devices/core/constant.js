module.exports = {
	/* used by user device */
	CAN_WRITE: 0x01,
	CAN_READ: 0x02,
	WRITE_CLOSED: 0x04,
	READ_CLOSED: 0x08,
	
	/* used by bridge */
	CMD_IDENTIFY: 0x01,
	CMD_OPEN: 0x02,
	/* used by user device */
	CMD_CLOSE_IN: 0x03,
	CMD_CLOSE_OUT: 0x04,
	
	/* used by bridge */
	REG_CTRL: 0x210,
	REG_DATA: 0x211,
	REG_DEVS: 0x212
}