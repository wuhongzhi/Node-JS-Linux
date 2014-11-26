var constant = require('./core/constant'), cache = [], _in = true;
module.exports = {
	init: function() {
		var hub = this.parent.$new('Test Device');
		hub.$attach({
			identify: function() {return 'my_echo';},
			read: function() {return cache.length ? cache.shift(): -1;},
			write: function(c) {cache.push(c);},
			stat: function() {
				var r = _in ? constant.CAN_WRITE : constant.WRITE_CLOSED;
				r |= cache.length ? constant.CAN_READ : !_in ? constant.READ_CLOSED : 0;
				return r;
			},
			open: function(argv) {
				_in = true;
				cache = [];
			},
			close: function(io) {
				_in = false;
				return io === constant.CMD_CLOSE_OUT;
			}
		});
	}
}