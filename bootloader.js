var fs = require("fs"), 
	http = require("http"), 
	path = require("path"),
	bridge = require('./devices/core/bridge'),
	hub = require('./devices/core/hub'),
	argv = process.argv.slice(2),
    jslinux_root = argv[0] || 'http://bellard.org/jslinux',
    clipboard = argv[1] || 'clipboard',
	extend = function(target, obj) {
		for(var i in obj) target[i] = obj[i];
		return target;
	};
//setTimeout = setImmediate; clearTimeout = clearImmediate;
load_binary('cpux86-ta.js', function(code) {
    var machine = eval(code + ';[CPU_X86, PCEmulator]'),
		CPU_X86 = machine[0],
		PCEmulator = machine[1];
	extend(CPU_X86.prototype, {
		load_binary: function(url, address, cb) {
			var self = this;
			load_binary(url, function(buffer, length) {
				for (var i = 0; i < length; i++) {
					self.st8_phys(address + i, buffer[i]);
				}
				cb(length);
			});
		}
	});
    start(PCEmulator);
});
function load_binary(url, cb) {
	url = jslinux_root  + '/' + url;
	http.get(url, function(res) {
		var length = res.headers['content-length'] | 0,
			buffer = new Buffer(length),
			address = 0;
		res.on('data', function (chunk) {
			chunk.copy(buffer, address, 0);
			address += chunk.length;
		}).on('end', function(chunk) {
			cb(buffer, address);	
		});
	}).on('error', function(e) {
		cb(null, -1);
	});
};
function start(PCEmulator) {
    var params = {mem_size: 128 * 1024 * 1024, hda: { url: "hda%d.bin", block_size: 64, nb_blocks: 912 }},
		term = process.stdout,
		boot_start_time = Date.now();
	var pc = new PCEmulator(extend(params, {
		serial_write: term.write.bind(term),
		clipboard_get: function() {
			return fs.readFileSync(clipboard, {encoding: "binary"});
		},
		clipboard_set: function(val) {
			fs.writeFileSync(clipboard, val, {encoding: "binary"});
		},
		get_boot_time: function(){
			return Date.now() - boot_start_time;
		}		
	}));
	///////////////////////////
	// BEGIN
	///////////////////////////
	
	// Simple device emulation
	extend(pc, {bridge: new bridge(pc, hub)});
	fs.readdirSync('./devices/').forEach(function(dev) {
		if (/.*(?=_dev.js)/.test(dev)) 
			hub.$attach(require('./devices/'  + dev));
	});
	///////////////////////////	
	// END
	///////////////////////////	
	
    var init_state = {params: params};
    pc.load_binary("vmlinux-2.6.20.bin", 0x00100000, phase2);
    function phase2(ret) {
        check(ret);
		extend(init_state, {start_addr: 0x10000});
        pc.load_binary("linuxstart.bin", init_state.start_addr, phase3);
    }
    function phase3(ret) {
        check(ret);
        /* Preload blocks so that the boot time does not depend on the
         * time to load the required disk data (optional) */
        var block_list = [ 0, 7, 3, 643, 720, 256, 336, 644, 781, 387, 464, 475, 131, 
            589, 468, 472, 474, 776, 777, 778, 779, 465, 466, 473, 467, 469, 470, 
            512, 592, 471, 691, 697, 708, 792, 775, 769 ];
        pc.ide0.drives[0].bs.preload(block_list, phase4);
		pc.ide0.drives[0].bs.write_async = function(Bh, bi, n, ci) {
			return 0;
		};
    }
    function phase4(ret) {
        check(ret);
        /* set the Linux kernel command line */
        var cmdline_addr = 0xf800;
        pc.cpu.write_string(cmdline_addr, "console=ttyS0 root=/dev/hda ro init=/sbin/init notsc=1 hdb=none");
        pc.cpu.eip = init_state.start_addr;
        pc.cpu.regs[0] = init_state.params.mem_size; /* eax */
        pc.cpu.regs[3] = 0; /* ebx = initrd_size (no longer used) */
        pc.cpu.regs[1] = cmdline_addr; /* ecx */
        phase5(pc);
    }
    function phase5(pc) {
        console.log("[Node.js switching to raw mode. Hit Ctrl-C twice within 1 second to exit.]");
        process.stdin.setEncoding("utf8");
        process.stdin.resume();
        process.stdin.setRawMode(true);
        var last_ctrl_c = Date.now();
        process.stdin.on('data', function(data) {
            if (data.length === 1 && data.charCodeAt(0) === 3) {
                var ctrl_c = Date.now();
                if (ctrl_c - last_ctrl_c < 1000)
                    process.exit();
                last_ctrl_c = ctrl_c;
            }
            pc.serial.send_chars(data);
        });
        pc.start();
    }
    function check(ret) {
        if (ret < 0) {
            throw new Error(ret);
        }
    }
    return pc;
}