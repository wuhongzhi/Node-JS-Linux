var constant = require('./constant'), 
	extend =  function(obj, apis) {
		for (var n in apis) obj[n] = apis[n];
		return obj;
	};
function Device(apis, parent) {
	this.parent = parent;
	extend(this, apis);
}
extend(Device.prototype, {
	init: function() {return this;},
	identify: function() {},
	open: function(argv) {},
	close: function(io) {},
	read: function() {return -1;},
	write: function(c) {return -1;},
	stat: function() {return constant.WRITE_CLOSED | constant.READ_CLOSED;},
});
function Hub() {
	this.devices = {};
	this.parent = new Device({write: function(c) {
		this.config += String.fromCharCode(c);
	}.bind(this)});
}
var active_devs = {}, next_dev_id = 1, FD_MAX = Math.pow(2, 31);
function new_dev_id() {
	if (next_dev_id > FD_MAX) next_dev_id = 1;
	while (active_devs[next_dev_id]) next_dev_id++;
	return next_dev_id > FD_MAX ? -1 : next_dev_id++;
}
extend(Hub.prototype, {
	$attach: function(apis) {
		var dev = new Device(apis, this);
		if (dev.init()) this.devices[dev.identify()] = dev;
		return this;
	},
	$new: function(name) {
		name = name || 'HUB-' + Date.now();
		var dev = extend(new Hub(), {parent: this, identify: function() {return name;}}); 
		return this.devices[dev.identify()] = dev;
	},
	identify: function() {
		this.config = "";
		return 'ROOT-HUB';
	},
	open: function() {
		var argv = this.config.split(/\0/),
			name = argv[0].split(/\//).pop();
		for (var n in active_devs)
			if (active_devs[n].identify() == name) return -1;
		var dev = findDev(this, name), dev_id = -1;
		if (!dev) return -1;
		if ((dev_id = new_dev_id()) !== -1) {
			active_devs[dev_id] = dev;
			dev.open(argv);
		}
		return dev_id;
		function findDev(hub, name) {
			for (var n in hub.devices) {
				if (n === name) return hub.devices[n];
				else if (hub.devices[n] instanceof Hub) {
					var dev = findDev(hub.devices[n], name);
					if (dev) return dev;
				}
			}
		}
	},
	close: function(dev_id, io) {
		if (active_devs[dev_id] && active_devs[dev_id].close(io)) 
			delete active_devs[dev_id];
	},
	read: function(dev_id) {
		return (active_devs[dev_id] || this.parent).read();
	},
	write: function(dev_id, c) {
		return (active_devs[dev_id] || this.parent).write(c);
	},
	stat: function(dev_id) {
		return (active_devs[dev_id] || this.parent).stat();
	}
});
// ======== CREATE DUMY ROOT DEVICE ==========
var root_hub = new Hub();
module.exports = root_hub.$attach({
	identify: function() {return "bridge";},
	stat: function() {return this.cache.length ? constant.CAN_READ : constant.READ_CLOSED;},
	read: function() {
		try {
			return this.cache.length ? this.cache.charCodeAt(0) : -1;
		} finally {
			this.cache = this.cache.substr(1);
		}
	},
	open: function(argv) {
		var inc_hub = argv.indexOf('-a') != -1;
		function enums(hub, level) {
			function getName(n, prefix) {
				if (inc_hub) {
					n = prefix + n;
					for (var i = level; i>0; i--) n = "  " + n;
				}
				return n;
			}
			var devs = [];
			if (inc_hub) devs.push(getName(hub.identify(), level ? '+-' : ''));
			for (var n in hub.devices) {
				if (hub.devices[n] instanceof Hub)
					devs = devs.concat(enums(hub.devices[n], level+1))
				else devs.push(getName(n, '  +-'));
			}
			return devs;
		}
		(this.cache =  enums(this.parent, 0)).push('');
		this.cache = this.cache.join('\n');
	},
	close: function(io) {
		if (io === constant.CMD_CLOSE_OUT) {
			this.cache = [];
			return true;
		}
	}
});


