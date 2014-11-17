var fs = require("fs"), http = require("http"), path = require("path");
global.load_binary = load_binary;
var argv = process.argv.slice(2),
    jslinux_root = argv[0] || 'http://bellard.org/jslinux',
    clipboard = argv[1] || 'clipboard.tmp';
load_binary('cpux86-ta.js', function(code) {
    code += '[CPU_X86, PCEmulator]'
    var machine = eval(code);
    machine[0].prototype.load_binary = function(path, offset, cb) {
        var self = this;
        load_binary(path, function(buffer, length) {
            for (var i = 0; i < length; i++) {
                self.st8_phys(offset + i, buffer[i]);
            }
            cb(length);
        });
    };
    start.call(global, machine[1]);
});
function load_binary(url, cb) {
	url = jslinux_root  + '/' + url;
	http.get(url, function(res) {
		var length = res.headers['content-length'] | 0,
			buffer = new Buffer(length),
			offset = 0;
		res.on('data', function (chunk) {
			chunk.copy(buffer, offset, 0);
			offset += chunk.length;
		}).on('end', function(chunk) {
			cb(buffer, offset);	
		});
	}).on('error', function(e) {
		cb(null, -1);
	});
};
function start(PCEmulator) {
    var params = {};

    /* serial output chars */
    params.serial_write = process.stdout.write.bind(process.stdout);

    /* memory size */
    params.mem_size = 64 * 1024 * 1024;

    /* clipboard I/O */
    params.clipboard_get = function() {
        return fs.readFileSync(clipboard, {encoding: "binary"});
    };
    params.clipboard_set = function(val) {
        fs.writeFileSync(clipboard, val, {encoding: "binary"});
    };
    
    var boot_start_time = new Date();
    params.get_boot_time = function(){
        return (+new Date()) - boot_start_time;
    };
    params.hda = { url: "hda%d.bin", block_size: 64, nb_blocks: 912 };
    
    var init_state = {};

    var pc = new PCEmulator(params);
    init_state.params = params;

    pc.load_binary("vmlinux-2.6.20.bin", 0x00100000, phase2);

    function phase2(ret) {
        check(ret);
        init_state.start_addr = 0x10000;
        pc.load_binary("linuxstart.bin", init_state.start_addr, phase3);
    }

    function phase3(ret) {
        check(ret);
        var block_list;
        /* Preload blocks so that the boot time does not depend on the
         * time to load the required disk data (optional) */
        block_list = [ 0, 7, 3, 643, 720, 256, 336, 644, 781, 387, 464, 475, 131, 
            589, 468, 472, 474, 776, 777, 778, 779, 465, 466, 473, 467, 469, 470, 
            512, 592, 471, 691, 697, 708, 792, 775, 769 ];
        pc.ide0.drives[0].bs.preload(block_list, phase4);
		pc.ide0.drives[0].bs.write_async = function(Bh, bi, n, ci) {
			return 0;
		};
    }

    function phase4(ret) {
        check(ret);
        var cmdline_addr;

        /* set the Linux kernel command line */
        cmdline_addr = 0xf800;
        pc.cpu.write_string(cmdline_addr, "console=ttyS0 root=/dev/hda ro init=/sbin/init notsc=1 hdb=none");

        pc.cpu.eip = init_state.start_addr;
        pc.cpu.regs[0] = init_state.params.mem_size; /* eax */
        pc.cpu.regs[3] = 0; /* ebx = initrd_size (no longer used) */
        pc.cpu.regs[1] = cmdline_addr; /* ecx */

        boot_start_time = (+new Date());
        phase5(pc);
    }
    
    function phase5(pc) {
        process.stdin.setEncoding("utf8");
        process.stdin.resume();
        console.log("[Node.js switching to raw mode. Hit Ctrl-C twice within 1 second to exit.]");
        process.stdin.setRawMode(true);
        var last_ctrl_c = new Date();
        process.stdin.on('data', function(data) {
            if (data.length === 1 && data.charCodeAt(0) === 3) {
                var ctrl_c =  new Date();
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