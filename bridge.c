#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/time.h>
#include <inttypes.h>

#define CAN_WRITE 	  0x01
#define CAN_READ 	  0x02
#define WRITE_CLOSED  0x04
#define READ_CLOSED   0x08

#define CMD_IDENTIFY  0x01
#define CMD_OPEN 	  0x02
#define CMD_CLOSE_IN  0x03
#define CMD_CLOSE_OUT 0x04

#define CTRL_REG  	 0x210
#define DATA_REG  	 0x211
#define DEVS_REG  	 0x212

static __inline unsigned char 
inb (unsigned short int port) {
  unsigned char _v;
  __asm__ __volatile__ ("inb %w1,%0":"=a" (_v):"Nd" (port));
  return _v;
}

static __inline unsigned int
inl (unsigned short int port) {
  unsigned int _v;
  __asm__ __volatile__ ("inl %w1,%0":"=a" (_v):"Nd" (port));
  return _v;
}

static __inline void
insb (unsigned short int port, void *addr, unsigned long int count) {
  __asm__ __volatile__ ("cld ; rep ; insb":"=D" (addr), "=c" (count):"d" (port), "0" (addr), "1" (count));
}

static __inline void
outb (unsigned char value, unsigned short int port) {
  __asm__ __volatile__ ("outb %b0,%w1": :"a" (value), "Nd" (port));
}

static __inline void
outl (unsigned int value, unsigned short int port) {
  __asm__ __volatile__ ("outl %0,%w1": :"a" (value), "Nd" (port));
}

static __inline void
outsb (unsigned short int port, const void *addr, unsigned long int count) {
  __asm__ __volatile__ ("cld ; rep ; outsb":"=S" (addr), "=c" (count):"d" (port), "0" (addr), "1" (count));
}

static int __device_status(int dev_id) {
	outl(dev_id, DEVS_REG);
	return inb(CTRL_REG);
}
static int __device_read(int dev_id, char *p, ssize_t s) {
	outl(dev_id, DEVS_REG);
	insb(DATA_REG, p, s);
	return inl(DEVS_REG);
}
static int __device_write(int dev_id, char *p, ssize_t s) {
	outl(dev_id, DEVS_REG);
	outsb(DATA_REG, p, s);
	return inl(DEVS_REG);
}
static void __device_config(char* p) {
	outsb(DATA_REG, p, strlen(p)+1);
}
static void __device_identity(void) {
	outb(CMD_IDENTIFY, CTRL_REG); 
}
static int __device_open(void) {
	outb(CMD_OPEN, CTRL_REG); 
	return inl(DEVS_REG);
}
static int dev_id = -1;
static void __device_close() {
	if (dev_id == -1) return;
	outl(dev_id, DEVS_REG);
	outb(CMD_CLOSE_IN, CTRL_REG); 
	outb(CMD_CLOSE_OUT, CTRL_REG);
}
static int __std_in = 0, __std_out = 0;
static void __close_stdin() {
	if (!__std_in && dev_id != -1) {
		outl(dev_id, DEVS_REG);
		outb(CMD_CLOSE_IN, CTRL_REG);
	}
	__std_in = 1; close(0);
}
static void __close_stdout() {
	if (!__std_out && dev_id != -1) {
		outl(dev_id, DEVS_REG);
		outb(CMD_CLOSE_OUT, CTRL_REG);
	}
	__std_out = 1; close(1);
}

int main(int argc, char *argv[]) {
	int i, status;
	struct timeval tv;
	char buff[512];
	fd_set rfd, wfd;
	iopl(3);
	__device_identity();
	for (i = 0; i < argc; i++) 
		__device_config(argv[i]);
	dev_id = __device_open();
	if (dev_id == -1) return 1;
	atexit(__device_close);
	while (!__std_in || !__std_out) {
		status = __device_status(dev_id);
		if (status & 0xf0) exit(status & 0x0f >> 4);
		if ((status & WRITE_CLOSED) && (status & READ_CLOSED)) break;
		FD_ZERO(&rfd); 
		if (!__std_in) FD_SET(0, &rfd);
		FD_ZERO(&wfd); 
		if (!__std_out) FD_SET(1, &wfd);
		tv.tv_sec = 1; tv.tv_usec = 0;
		if(select(3, &rfd, &wfd, NULL, &tv) == -1) return 1;
		//stdin->device
		if (!__std_in) {
			if (status & WRITE_CLOSED) {
				__close_stdin();
			} else if ((status & CAN_WRITE) && FD_ISSET(0, &rfd)) {
				ssize_t size = read(0, buff, sizeof(buff));
				if (size <= 0) __close_stdin();
				else __device_write(dev_id, buff, size);
			}
		}
		//device->stdout
		if (!__std_out) {
			if (status & READ_CLOSED) {
				__close_stdout();
			} else if ((status & CAN_READ) && FD_ISSET(1, &wfd)) {
				ssize_t size = __device_read(dev_id, buff, sizeof(buff));
				if (write(1, buff, size) <= 0) __close_stdout();
			}
		}
	}
	return 0;
}
