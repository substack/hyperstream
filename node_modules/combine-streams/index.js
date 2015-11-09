var Stream = require('stream')
var util = require('util')

var PassThrough = Stream.PassThrough

util.inherits(Combine, PassThrough)

module.exports = Combine

function Combine(options) {
  if (!(this instanceof Combine))
    return new Combine(options)

  PassThrough.call(this, options)

  this.queue = []
  this.destroy = this.destroy.bind(this)
}

Combine.prototype.busy = false
Combine.prototype.destroyed = false

Combine.prototype.append = function (stream) {
  if (!this._writableState.ended
    && !this.destroyed
    && !~this.queue.indexOf(null)
    && this.queue.push(stream) === 1
    && !this.busy
  ) this._next()

  return this
}

Combine.prototype.destroy = function () {
  if (!this.destroyed) {
    this.emit('close')
    this.destroyed = true
    this.queue = null
  }
}

Combine.prototype._appendStream = function (stream) {
  this.busy = true

  stream.pipe(this, {
    end: false
  })

  stream.once('error', callback)
  stream.once('end', callback)
  stream.once('close', this.destroy)
  stream.once('close', cleanup)

  var that = this

  function callback(err) {
    cleanup()

    if (err)
      that.emit('error', err)
    else
      that._next()
  }

  function cleanup() {
    that.busy = false

    stream.removeListener('error', callback)
    stream.removeListener('end', callback)
    stream.removeListener('close', that.destroy)
    stream.removeListener('close', cleanup)
  }
}

Combine.prototype._next = function (obj) {
  if (this.destroyed)
    return

  if (arguments.length === 0)
    obj = this.queue.shift()

  if (obj === null) {
    this.end()
    this.queue = null
  } else if (obj === undefined) {
    // Just ignore
  } else if (typeof obj === 'string' || Buffer.isBuffer(obj)) {
    this.write(obj)
    this._next()
  } else if (typeof obj === 'function') {
    var that = this

    this.busy = true

    obj(function (err, obj2) {
      if (err) {
        that.emit('error', err)
      } else {
        that.busy = false
        that._next(obj2)
      }
    })
  } else if (obj instanceof Stream) {
    this._appendStream(obj)
  } else {
    throw new TypeError('You can only append streams, strings, buffers, and functions.')
  }
}