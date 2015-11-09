var through = require('through');
var utf8Stream = require('../');

var u8 = utf8Stream();
u8.pipe(through(function (buf) {
    var s = buf.toString('utf8');
    this.queue(s.split('').join('\n') + '\n');
})).pipe(process.stdout);

u8.write(Buffer([ 0xe9, 0x81 ]));
u8.write(Buffer([ 0x99, 0xe9, 0x81, 0xa0, 0xe6 ]));
u8.write(Buffer([ 0x9c, 0xaa, 0xe4, 0xbe ]));
u8.write(Buffer([ 0x86, 0xe7, 0x9a, 0x84, 0xe4, 0xba, 0x8b ]));
u8.write(Buffer([ 0xe4, 0xbb, 0xb6 ]));
u8.end();
