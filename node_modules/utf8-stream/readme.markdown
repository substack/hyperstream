# utf8-stream

buffer utf8 characters that would otherwise span chunk boundaries

[![build status](https://secure.travis-ci.org/substack/utf8-stream.png)](http://travis-ci.org/substack/utf8-stream)

# example

Here we'll write some chinese characters at random byte offsets:

``` js
var utf8Stream = require('utf8-stream');
var through = require('through');

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
```

Inside the `through(function (buf) {})`, each `buf` will never span a utf8
multi-byte character so we can just call `.toString('utf8')`.

output:

```
遙
遠
未
來
的
事
件
```

# methods

``` js
var utf8Stream = require('utf8-stream')
```

## var u8 = utf8Stream()

Return a through stream `u8` that will never emit a chunk that spans a utf8
multi-byte character.

# install

With [npm](https://npmjs.org) do:

```
npm install utf8-stream
```

# license

MIT
