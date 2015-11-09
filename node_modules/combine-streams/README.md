# Combine Streams

[![NPM version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![Dependency Status][david-image]][david-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]
[![Gittip][gittip-image]][gittip-url]

Basically a streams2 version of [combined-stream](https://github.com/felixge/node-combined-stream).
Allows you to combine streams as well as strings and buffers into a single stream.
Why? I don't know.
I just saw this repo and thought, "hey, this sucks because it's not streams2".

## Example

```js
combine()
.append(fs.createReadStream('file1.txt'))
.append(fs.createReadStream('file2.txt'))
.append(null)
.pipe(process.stdout)
```

## API

### Combine([options])

Creates a new `Combine` instance.
`options` are passed to `require('stream').PassThrough`.

```js
var combine = require('combine-streams')
```

### combine.append(obj)

You can append:

- A readable stream
- A buffer
- A string
- A thunk that returns one of the above

To signify that you are done appending items,
you must call `combine.append(null)` just like a readable stream's `.push(null)` implementation.

```js
combine()
.append(fs.createReadStream('file1.txt'))
.append('End of the first file.')
.append(function (done) {
  done(null, fs.createReadStream('file2.txt'))
})
.append('End of the second file.')
.append(null)
.pipe(process.stdout)
```

### combine.pipe(dest [, options])

`combine` itself is a readable stream,
so you should probably use `combine.pipe(dest)`.

[gitter-image]: https://badges.gitter.im/stream-utils/combine-streams.png
[gitter-url]: https://gitter.im/stream-utils/combine-streams
[npm-image]: https://img.shields.io/npm/v/combine-streams.svg?style=flat-square
[npm-url]: https://npmjs.org/package/combine-streams
[github-tag]: http://img.shields.io/github/tag/stream-utils/combine-streams.svg?style=flat-square
[github-url]: https://github.com/stream-utils/combine-streams/tags
[travis-image]: https://img.shields.io/travis/stream-utils/combine-streams.svg?style=flat-square
[travis-url]: https://travis-ci.org/stream-utils/combine-streams
[coveralls-image]: https://img.shields.io/coveralls/stream-utils/combine-streams.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/stream-utils/combine-streams
[david-image]: http://img.shields.io/david/stream-utils/combine-streams.svg?style=flat-square
[david-url]: https://david-dm.org/stream-utils/combine-streams
[license-image]: http://img.shields.io/npm/l/combine-streams.svg?style=flat-square
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/combine-streams.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/combine-streams
[gittip-image]: https://img.shields.io/gratipay/jonathanong.svg?style=flat-square
[gittip-url]: https://gratipay.com/jonathanong/
