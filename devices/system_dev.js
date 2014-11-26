var constant = require('./core/constant');
module.exports = {
	init: function() {
		var hub = this.parent.$new('System Device');
		hub.$attach({
			identify: function() {return 'poweroff';},
			stat: function() {return constant.WRITE_CLOSED | constant.READ_CLOSED;},
			close: function(io) {if (io === constant.CMD_CLOSE_OUT) process.exit();}
		});
	}
}