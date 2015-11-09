# string-to-stream [![travis](https://img.shields.io/travis/feross/string-to-stream.svg)](https://travis-ci.org/feross/string-to-stream) [![npm](https://img.shields.io/npm/v/string-to-stream.svg)](https://npmjs.org/package/string-to-stream)

#### Convert a string into a stream (streams2)

[![browser support](https://ci.testling.com/feross/string-to-stream.png)](https://ci.testling.com/feross/string-to-stream)

### install

```
npm install string-to-stream
```

### usage

Use `string-to-stream` like this:

```js
var str = require('string-to-stream')

str('hi there').pipe(process.stdout) // => 'hi there'
```

### license

MIT. Copyright (c) [Feross Aboukhadijeh](http://feross.org).
