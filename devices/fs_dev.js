var constant = require('./core/constant'), fs = require('fs');
module.exports = {
	init: function() {
		var hub = this.parent.$new('FileSystem Device');
		hub.$attach({
			__err: 0,
			__cache: new StringReader(),
			identify: function() {return 'list';},
			read: function() {return this.__cache.read();},
			stat: function() {
				var r = constant.WRITE_CLOSED;
				r |= this.__cache.available() ? constant.CAN_READ : this.__cache.eof() ? constant.READ_CLOSED : 0;
				return r;
			},
			open: function(argv) {
				this.__err = 0;
				this.__cache.reset();
				fs.readdir(argv[1] || ".", function(err, files) {
					if (err) this._err = 1 << 4;
					else this.__cache.add(files.join("\n"));
					this.__cache.eof(true);
				}.bind(this));
			},
			close: function(io) {
				return io === constant.CMD_CLOSE_OUT;
			}
		}).$attach({
			__err: 0,
			__cache: new StringReader(),
			identify: function() {return 'get';},
			read: function() {return this.__cache.read();},
			stat: function() {
				var r = constant.WRITE_CLOSED;
				r |= this.__cache.available() ? constant.CAN_READ : this.__cache.eof() ? constant.READ_CLOSED : 0;
				return r;
			},
			open: function(argv) {
				this.__err = 0;
				this.__cache.reset();
				fs.readFile(argv[1], {encoding: 'binary'}, function(err, data) {
					if (err) this._err = 1 << 4;
					else this.__cache.add(data);
					this.__cache.eof(true);
				}.bind(this));
			},
			close: function(io) {
				return io === constant.CMD_CLOSE_OUT;
			}
		}).$attach({
			__cache: "",
			identify: function() {return 'put';},
			write: function(c) {this.__cache += String.fromCharCode(c);},
			stat: function() {return constant.READ_CLOSED | constant.CAN_WRITE;},
			open: function(argv) {
				this.__cache = "";
				this._name = argv[1];
			},
			close: function(io) {
				if (io === constant.CMD_CLOSE_OUT) {
					if (this._name)
						fs.writeFileSync(this._name, this.__cache, {encoding: 'binary'});
					return true;
				}
			}
		});
	}
}
function StringReader() {
	var _eof = false;
	this.eof = function(val) {
		if (typeof(val) === 'undefined') return _eof;
		_eof = val;
	};
	var buff = "";
	this.read = function() {
		try {
			return buff.length ? buff.charCodeAt(0) : -1;
		} finally {
			buff = buff.substr(1);
		}
	};
	this.add = function(str) {
		buff += str;
	};
	this.reset = function() {
		buff = "";
		_eof = false;
	};
	this.available = function() {
		return buff.length;
	};
}