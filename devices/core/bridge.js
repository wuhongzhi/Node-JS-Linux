var constant = require('./constant');
module.exports = Bridge;
function Bridge(PC, device) {
	this.device = device;
    PC.register_ioport_read(constant.REG_CTRL, 1, 1, this.ioport_read.bind(this));
    PC.register_ioport_read(constant.REG_DATA, 1, 1, this.ioport_read.bind(this));
    PC.register_ioport_read(constant.REG_DEVS, 1, 4, this.ioport_read.bind(this));
    PC.register_ioport_write(constant.REG_CTRL, 1, 1, this.ioport_write.bind(this));
    PC.register_ioport_write(constant.REG_DATA, 1, 1, this.ioport_write.bind(this));
    PC.register_ioport_write(constant.REG_DEVS, 1, 4, this.ioport_write.bind(this));
}
Bridge.prototype.ioport_write = function(port, val) {
	var device = this.device;
	switch(port) {
	case constant.REG_CTRL:
		switch(val) {
		case constant.CMD_IDENTIFY:
			device.identify();
			break;
		case constant.CMD_OPEN:
			this.dev_id = device.open();
			this.phase = 0;
			break;
		case constant.CMD_CLOSE_IN:
		case constant.CMD_CLOSE_OUT:
			this.phase = 0;
			device.close(this.dev_id, val);
			break;
		}
		break;
	case constant.REG_DATA:
		this.phase = 1;
		if (this.device.write(this.dev_id || -1, val) > 0) this.counter++;
		break;
	case constant.REG_DEVS:
		this.counter = 0;
		this.dev_id = val;
	}
}
Bridge.prototype.ioport_read = function(port) {
	var device = this.device;
	switch(port) {
	case constant.REG_CTRL:
		return device.stat(this.dev_id);
	case constant.REG_DATA:
		this.phase = 1;
		var r = device.read(this.dev_id);
		if (r !== -1) this.counter++;
		return r;
	case constant.REG_DEVS:
		return !this.phase ? this.dev_id : this.counter;
	}
}