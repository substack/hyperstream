(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (Buffer){
var trumpet = require('trumpet');
var through = require('through2');
var concat = require('concat-stream');
var u8 = require('utf8-stream');
var combine = require('stream-combiner2');
var ent = require('ent');
var str = require('string-to-stream');
var combiner = require('combine-streams');

module.exports = hwm;

function hwm (streams) {
    if (!streams) streams = {};
    var tr = trumpet();
    tr.setMaxListeners(Infinity);
    Object.keys(streams).forEach(function (key) {
        var value = streams[key];
        var vstream;

        if (value === null) return;
        if (typeof value === 'object' && value.pipe) {
            vstream = through();
            value.pipe(vstream);
        }

        if (/:first$/.test(key)) {
            tr.select(key.replace(/:first$/,''), onmatch);
        }
        else tr.selectAll(key, onmatch);

        function onmatch (elem) {
            if (typeof value === 'string') {
                elem.createWriteStream().end(value);
            }
            else if (isStream(value)) {
                vstream.pipe(elem.createWriteStream());
            }
            else if (typeof value === 'object') {
                Object.keys(value).forEach(function (prop) {
                    var lprop = prop.toLowerCase();
                    var v = value[prop];
                    if (prop === '_html' && isStream(v)) {
                        v.pipe(elem.createWriteStream());
                    }
                    else if (prop === '_html' && (Buffer.isBuffer(v)
                    || typeof v === 'string')) {
                        elem.createWriteStream().end(v);
                    }
                    else if (prop === '_html') {
                        elem.createWriteStream().end(String(value[prop]));
                    }
                    else if (prop === '_text' && isStream(v)) {
                        v.pipe(encoder()).pipe(elem.createWriteStream());
                    }
                    else if (prop === '_text') {
                        elem.createWriteStream().end(ent.encode(String(v)));
                    }
                    else if (lprop === '_appendhtml' && (Buffer.isBuffer(v)
                    || typeof v === 'string')) {
                        var body = elem.createStream();
                        body.pipe(body, { end: false });
                        body.on('end', function () { body.end(v) });
                    }
                    else if (lprop === '_appendhtml' && isStream(v)) {
                        var body = elem.createStream();
                        body.pipe(body, { end: false });
                        body.on('end', function (){ v.pipe(body) });
                    }
                    else if (lprop === '_prependhtml' && (Buffer.isBuffer(v)
                    || typeof v === 'string')) {
                        var body = elem.createStream();
                        body.write(v);
                        body.pipe(body);
                    }
                    else if (lprop === '_prependhtml' && isStream(v)) {
                        var body = elem.createStream();
                        v.pipe(body, { end: false });
                        v.on('end', function () { body.pipe(body) });
                    }
                    else if ((prop === '_append' || lprop === '_appendtext')
                    && (Buffer.isBuffer(v) || typeof v === 'string')) {
                        var body = elem.createStream();
                        body.pipe(body, { end: false });
                        body.on('end', function () {
                            body.end(ent.encode(toStr(v)));
                        });
                    }
                    else if ((prop === '_append' || lprop === '_appendtext')
                    && isStream(v)) {
                        var body = elem.createStream();
                        body.pipe(body, { end: false });
                        body.on('end', function () {
                            v.pipe(encoder()).pipe(body);
                        });
                    }
                    else if ((prop === '_prepend' || lprop === '_prependtext')
                    && (Buffer.isBuffer(v) || typeof v === 'string')) {
                        var body = elem.createStream();
                        body.write(ent.encode(toStr(v)));
                        body.pipe(body);
                    }
                    else if ((prop === '_prepend' || lprop === '_prependtext')
                    && isStream(v)) {
                        var body = elem.createStream();
                        v.pipe(encoder()).pipe(body, { end: false });
                        v.on('end', function () { body.pipe(body) });
                    }
                    else if (/^_map/.test(prop) && isObj(v)) {
                        var body = elem.createStream();
                        var catbodybuf = concat(function (bodybuf) {
                            var cmb = combiner();
                            if (lprop === '_mapappend') {
                                cmb.append(bodybuf);
                            }
                            Object.keys(v).forEach(function (mapkey) {
                                cmb.append(function (done) {
                                    var mapper = through();
                                    var trr = trumpet();
                                    var cattemplate = concat(function (template) {
                                        var cmbb = combiner();
                                        v[mapkey].forEach(function (params) {
                                            cmbb.append(function (done) {
                                                done(null, str(template).pipe(hwm(params)));
                                            });
                                        });
                                        cmbb.append(null).pipe(mapper);
                                    });
                                    trr.createReadStream(mapkey, {outer:true}).pipe(cattemplate);
                                    str(bodybuf).pipe(trr);
                                    done(null, mapper);
                                });
                            });
                            if (lprop === '_mapprepend') {
                                cmb.append(bodybuf);
                            }
                            cmb.append(null).pipe(body);
                        })
                        body.pipe(catbodybuf);
                    }
                    else {
                        var vp = value[prop];
                        if (vp && isObj(vp)) {
                            var cur = elem.getAttribute(prop) || '';
                            if (vp.append) cur += vp.append;
                            if (vp.prepend) cur = vp.prepend + cur;
                            elem.setAttribute(prop, cur);
                        }
                        else elem.setAttribute(prop, vp);
                    }
                });
            }
            else if (typeof value === 'function') {
                var stream = elem.createStream();
                stream.pipe(concat(function (body) {
                    stream.end(toStr(value(body.toString('utf8'))));
                }));
            }
            else {
                elem.createWriteStream().end(String(value));
            }
        }
    });
    return tr;
};

function isStream (s) {
    return s && typeof s.pipe === 'function';
}

function toStr (s) {
    if (Buffer.isBuffer(s) || typeof s === 'string') return s;
    return String(s);
}

function isObj (o) {
    return typeof o === 'object' && o !== null;
}

function encoder () {
    return combine(u8(), through(function (buf, enc, next) {
        this.push(ent.encode(buf.toString('utf8')));
        next();
    }));
}


}).call(this,require("buffer").Buffer)
},{"buffer":102,"combine-streams":2,"concat-stream":3,"ent":10,"stream-combiner2":55,"string-to-stream":70,"through2":78,"trumpet":79,"utf8-stream":92}],2:[function(require,module,exports){
(function (Buffer){
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
}).call(this,require("buffer").Buffer)
},{"buffer":102,"stream":122,"util":126}],3:[function(require,module,exports){
(function (Buffer){
var Writable = require('readable-stream').Writable
var inherits = require('inherits')

if (typeof Uint8Array === 'undefined') {
  var U8 = require('typedarray').Uint8Array
} else {
  var U8 = Uint8Array
}

function ConcatStream(opts, cb) {
  if (!(this instanceof ConcatStream)) return new ConcatStream(opts, cb)

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts) opts = {}

  var encoding = opts.encoding
  var shouldInferEncoding = false

  if (!encoding) {
    shouldInferEncoding = true
  } else {
    encoding =  String(encoding).toLowerCase()
    if (encoding === 'u8' || encoding === 'uint8') {
      encoding = 'uint8array'
    }
  }

  Writable.call(this, { objectMode: true })

  this.encoding = encoding
  this.shouldInferEncoding = shouldInferEncoding

  if (cb) this.on('finish', function () { cb(this.getBody()) })
  this.body = []
}

module.exports = ConcatStream
inherits(ConcatStream, Writable)

ConcatStream.prototype._write = function(chunk, enc, next) {
  this.body.push(chunk)
  next()
}

ConcatStream.prototype.inferEncoding = function (buff) {
  var firstBuffer = buff === undefined ? this.body[0] : buff;
  if (Buffer.isBuffer(firstBuffer)) return 'buffer'
  if (typeof Uint8Array !== 'undefined' && firstBuffer instanceof Uint8Array) return 'uint8array'
  if (Array.isArray(firstBuffer)) return 'array'
  if (typeof firstBuffer === 'string') return 'string'
  if (Object.prototype.toString.call(firstBuffer) === "[object Object]") return 'object'
  return 'buffer'
}

ConcatStream.prototype.getBody = function () {
  if (!this.encoding && this.body.length === 0) return []
  if (this.shouldInferEncoding) this.encoding = this.inferEncoding()
  if (this.encoding === 'array') return arrayConcat(this.body)
  if (this.encoding === 'string') return stringConcat(this.body)
  if (this.encoding === 'buffer') return bufferConcat(this.body)
  if (this.encoding === 'uint8array') return u8Concat(this.body)
  return this.body
}

var isArray = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]'
}

function isArrayish (arr) {
  return /Array\]$/.test(Object.prototype.toString.call(arr))
}

function stringConcat (parts) {
  var strings = []
  var needsToString = false
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i]
    if (typeof p === 'string') {
      strings.push(p)
    } else if (Buffer.isBuffer(p)) {
      strings.push(p)
    } else {
      strings.push(Buffer(p))
    }
  }
  if (Buffer.isBuffer(parts[0])) {
    strings = Buffer.concat(strings)
    strings = strings.toString('utf8')
  } else {
    strings = strings.join('')
  }
  return strings
}

function bufferConcat (parts) {
  var bufs = []
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i]
    if (Buffer.isBuffer(p)) {
      bufs.push(p)
    } else if (typeof p === 'string' || isArrayish(p)
    || (p && typeof p.subarray === 'function')) {
      bufs.push(Buffer(p))
    } else bufs.push(Buffer(String(p)))
  }
  return Buffer.concat(bufs)
}

function arrayConcat (parts) {
  var res = []
  for (var i = 0; i < parts.length; i++) {
    res.push.apply(res, parts[i])
  }
  return res
}

function u8Concat (parts) {
  var len = 0
  for (var i = 0; i < parts.length; i++) {
    if (typeof parts[i] === 'string') {
      parts[i] = Buffer(parts[i])
    }
    len += parts[i].length
  }
  var u8 = new U8(len)
  for (var i = 0, offset = 0; i < parts.length; i++) {
    var part = parts[i]
    for (var j = 0; j < part.length; j++) {
      u8[offset++] = part[j]
    }
  }
  return u8
}

}).call(this,require("buffer").Buffer)
},{"buffer":102,"inherits":39,"readable-stream":47,"typedarray":91}],4:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

function isBuffer(arg) {
  return Buffer.isBuffer(arg);
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}
}).call(this,require("buffer").Buffer)
},{"buffer":102}],5:[function(require,module,exports){
module.exports = language

var tokenizer = require('./tokenizer')

function language(lookups) {
  return function(selector) {
    return parse(selector, remap(lookups))
  }
}

function remap(opts) {
  for(var key in opts) if(opt_okay(opts, key)) {
    opts[key] = Function(
        'return function(node, attr) { return node.' + opts[key] + ' }'
    )
    opts[key] = opts[key]()
  }

  return opts
}

function opt_okay(opts, key) {
  return opts.hasOwnProperty(key) && typeof opts[key] === 'string'
}

function parse(selector, options) {
  var stream = tokenizer()
    , default_subj = true
    , selectors = [[]]
    , traversal
    , bits

  bits = selectors[0]

  traversal = {
      '': any_parents
    , '>': direct_parent
    , '+': direct_sibling
    , '~': any_sibling
  }

  stream
    .on('data', group)
    .end(selector)

  function group(token) {
    var crnt

    if(token.type === 'comma') {
      selectors.unshift(bits = [])

      return
    }

    if(token.type === 'op' || token.type === 'any-child') {
      bits.unshift(traversal[token.data])
      bits.unshift(check())

      return
    }

    bits[0] = bits[0] || check()
    crnt = bits[0]

    if(token.type === '!') {
      crnt.subject =
      selectors[0].subject = true

      return
    }

    crnt.push(
        token.type === 'class' ? listContains(token.type, token.data) :
        token.type === 'attr' ? attr(token) :
        token.type === ':' || token.type === '::' ? pseudo(token) :
        token.type === '*' ? Boolean :
        matches(token.type, token.data)
    )
  }

  return selector_fn

  function selector_fn(node, as_boolean) {
    var current
      , length
      , orig
      , subj
      , set

    orig = node
    set = []

    for(var i = 0, len = selectors.length; i < len; ++i) {
      bits = selectors[i]
      current = entry
      length = bits.length
      node = orig
      subj = []

      for(var j = 0; j < length; j += 2) {
        node = current(node, bits[j], subj)

        if(!node) {
          break
        }

        current = bits[j + 1]
      }

      if(j >= length) {
        if(as_boolean) {
          return true
        }

        add(!bits.subject ? [orig] : subj)
      }
    }

    if(as_boolean) {
      return false
    }

    return !set.length ? false :
            set.length === 1 ? set[0] :
            set

    function add(items) {
      var next

      while(items.length) {
        next = items.shift()

        if(set.indexOf(next) === -1) {
          set.push(next)
        }
      }
    }
  }

  function check() {
    _check.bits = []
    _check.subject = false
    _check.push = function(token) {
      _check.bits.push(token)
    }

    return _check

    function _check(node, subj) {
      for(var i = 0, len = _check.bits.length; i < len; ++i) {
        if(!_check.bits[i](node)) {
          return false
        }
      }

      if(_check.subject) {
        subj.push(node)
      }

      return true
    }
  }

  function listContains(type, data) {
    return function(node) {
      var val = options[type](node)
      val =
        Array.isArray(val) ? val :
        val ? val.toString().split(/\s+/) :
        []
      return val.indexOf(data) >= 0
    }
  }

  function attr(token) {
    return token.data.lhs ?
      valid_attr(
          options.attr
        , token.data.lhs
        , token.data.cmp
        , token.data.rhs
      ) :
      valid_attr(options.attr, token.data)
  }

  function matches(type, data) {
    return function(node) {
      return options[type](node) == data
    }
  }

  function any_parents(node, next, subj) {
    do {
      node = options.parent(node)
    } while(node && !next(node, subj))

    return node
  }

  function direct_parent(node, next, subj) {
    node = options.parent(node)

    return node && next(node, subj) ? node : null
  }

  function direct_sibling(node, next, subj) {
    var parent = options.parent(node)
      , idx = 0
      , children

    children = options.children(parent)

    for(var i = 0, len = children.length; i < len; ++i) {
      if(children[i] === node) {
        idx = i

        break
      }
    }

    return children[idx - 1] && next(children[idx - 1], subj) ?
      children[idx - 1] :
      null
  }

  function any_sibling(node, next, subj) {
    var parent = options.parent(node)
      , children

    children = options.children(parent)

    for(var i = 0, len = children.length; i < len; ++i) {
      if(children[i] === node) {
        return null
      }

      if(next(children[i], subj)) {
        return children[i]
      }
    }

    return null
  }

  function pseudo(token) {
    return valid_pseudo(options, token.data)
  }

}

function entry(node, next, subj) {
  return next(node, subj) ? node : null
}

function valid_pseudo(options, match) {
  switch(match) {
    case 'empty': return valid_empty(options)
    case 'first-child': return valid_first_child(options)
    case 'last-child': return valid_last_child(options)
    case 'root': return valid_root(options)
  }

  if(match.indexOf('contains') === 0) {
    return valid_contains(options, match.slice(9, -1))
  }

  if(match.indexOf('any') === 0) {
    return valid_any_match(options, match.slice(4, -1))
  }

  if(match.indexOf('not') === 0) {
    return valid_not_match(options, match.slice(4, -1))
  }

  return function() {
    return false
  }
}

function valid_not_match(options, selector) {
  var fn = parse(selector, options)

  return not_function

  function not_function(node) {
    return !fn(node, true)
  }
}

function valid_any_match(options, selector) {
  var fn = parse(selector, options)

  return fn
}

function valid_attr(fn, lhs, cmp, rhs) {
  return function(node) {
    var attr = fn(node, lhs)

    if(!cmp) {
      return !!attr
    }

    if(cmp.length === 1) {
      return attr == rhs
    }

    if(attr === void 0 || attr === null) {
      return false
    }

    return checkattr[cmp.charAt(0)](attr, rhs)
  }
}

function valid_first_child(options) {
  return function(node) {
    return options.children(options.parent(node))[0] === node
  }
}

function valid_last_child(options) {
  return function(node) {
    var children = options.children(options.parent(node))

    return children[children.length - 1] === node
  }
}

function valid_empty(options) {
  return function(node) {
    return options.children(node).length === 0
  }
}

function valid_root(options) {
  return function(node) {
    return !options.parent(node)
  }
}

function valid_contains(options, contents) {
  return function(node) {
    return options.contents(node).indexOf(contents) !== -1
  }
}

var checkattr = {
    '$': check_end
  , '^': check_beg
  , '*': check_any
  , '~': check_spc
  , '|': check_dsh
}

function check_end(l, r) {
  return l.slice(l.length - r.length) === r
}

function check_beg(l, r) {
  return l.slice(0, r.length) === r
}

function check_any(l, r) {
  return l.indexOf(r) > -1
}

function check_spc(l, r) {
  return l.split(/\s+/).indexOf(r) > -1
}

function check_dsh(l, r) {
  return l.split('-').indexOf(r) > -1
}

},{"./tokenizer":6}],6:[function(require,module,exports){
module.exports = tokenize

var through = require('through')

var PSEUDOSTART = 'pseudo-start'
  , ATTR_START = 'attr-start'
  , ANY_CHILD = 'any-child'
  , ATTR_COMP = 'attr-comp'
  , ATTR_END = 'attr-end'
  , PSEUDOPSEUDO = '::'
  , PSEUDOCLASS = ':'
  , READY = '(ready)'
  , OPERATION = 'op'
  , CLASS = 'class'
  , COMMA = 'comma'
  , ATTR = 'attr'
  , SUBJECT = '!'
  , TAG = 'tag'
  , STAR = '*'
  , ID = 'id'

function tokenize() {
  var escaped = false
    , gathered = []
    , state = READY 
    , data = []
    , idx = 0
    , stream
    , length
    , quote
    , depth
    , lhs
    , rhs
    , cmp
    , c

  return stream = through(ondata, onend)

  function ondata(chunk) {
    data = data.concat(chunk.split(''))
    length = data.length

    while(idx < length && (c = data[idx++])) {
      switch(state) {
        case READY: state_ready(); break
        case ANY_CHILD: state_any_child(); break
        case OPERATION: state_op(); break
        case ATTR_START: state_attr_start(); break
        case ATTR_COMP: state_attr_compare(); break
        case ATTR_END: state_attr_end(); break
        case PSEUDOCLASS:
        case PSEUDOPSEUDO: state_pseudo(); break
        case PSEUDOSTART: state_pseudostart(); break
        case ID:
        case TAG:
        case CLASS: state_gather(); break
      }
    }

    data = data.slice(idx)
  }

  function onend(chunk) {
    if(arguments.length) {
      ondata(chunk)
    }

    if(gathered.length) {
      stream.queue(token())
    }
  }

  function state_ready() {
    switch(true) {
      case '#' === c: state = ID; break
      case '.' === c: state = CLASS; break
      case ':' === c: state = PSEUDOCLASS; break
      case '[' === c: state = ATTR_START; break
      case '!' === c: subject(); break
      case '*' === c: star(); break
      case ',' === c: comma(); break
      case /[>\+~]/.test(c): state = OPERATION; break
      case /\s/.test(c): state = ANY_CHILD; break
      case /[\w\d\-_]/.test(c): state = TAG; --idx; break
    }
  }

  function subject() {
    state = SUBJECT
    gathered = ['!']
    stream.queue(token())
    state = READY
  }

  function star() {
    state = STAR
    gathered = ['*']
    stream.queue(token())
    state = READY
  }

  function comma() {
    state = COMMA
    gathered = [',']
    stream.queue(token())
    state = READY
  }

  function state_op() {
    if(/[>\+~]/.test(c)) {
      return gathered.push(c)
    }

    // chomp down the following whitespace.
    if(/\s/.test(c)) {
      return
    }

    stream.queue(token())
    state = READY
    --idx
  }

  function state_any_child() {
    if(/\s/.test(c)) {
      return
    }

    if(/[>\+~]/.test(c)) {
      return --idx, state = OPERATION
    }

    stream.queue(token())
    state = READY
    --idx
  }

  function state_pseudo() {
    rhs = state
    state_gather(true)

    if(state !== READY) {
      return
    }

    if(c === '(') {
      lhs = gathered.join('')
      state = PSEUDOSTART
      gathered.length = 0
      depth = 1
      ++idx

      return
    }

    state = PSEUDOCLASS
    stream.queue(token())
    state = READY
  }

  function state_pseudostart() {
    if(gathered.length === 0 && !quote) {
      quote = /['"]/.test(c) ? c : null

      if(quote) {
        return
      }
    }

    if(quote) {
      if(!escaped && c === quote) {
        quote = null

        return
      }

      if(c === '\\') {
        escaped ? gathered.push(c) : (escaped = true)

        return
      }

      escaped = false
      gathered.push(c)

      return
    }

    gathered.push(c)

    if(c === '(') {
      ++depth
    } else if(c === ')') {
      --depth
    }
    
    if(!depth) {
      gathered.pop()
      stream.queue({
          type: rhs 
        , data: lhs + '(' + gathered.join('') + ')'
      })

      state = READY
      lhs = rhs = cmp = null
      gathered.length = 0
    }

    return 
  }

  function state_attr_start() {
    state_gather(true)

    if(state !== READY) {
      return
    }

    if(c === ']') {
      state = ATTR
      stream.queue(token())
      state = READY

      return
    }

    lhs = gathered.join('')
    gathered.length = 0
    state = ATTR_COMP
  }

  function state_attr_compare() {
    if(/[=~|$^*]/.test(c)) {
      gathered.push(c)
    }

    if(gathered.length === 2 || c === '=') {
      cmp = gathered.join('')
      gathered.length = 0
      state = ATTR_END
      quote = null

      return
    }
  }

  function state_attr_end() {
    if(!gathered.length && !quote) {
      quote = /['"]/.test(c) ? c : null

      if(quote) {
        return
      }
    }

    if(quote) {
      if(!escaped && c === quote) {
        quote = null

        return
      }

      if(c === '\\') {
        if(escaped) {
          gathered.push(c)
        }

        escaped = !escaped

        return
      }

      escaped = false
      gathered.push(c)

      return
    }

    state_gather(true)

    if(state !== READY) {
      return
    }

    stream.queue({
        type: ATTR
      , data: {
            lhs: lhs
          , rhs: gathered.join('')
          , cmp: cmp
        }
    })

    state = READY
    lhs = rhs = cmp = null
    gathered.length = 0

    return 
  }

  function state_gather(quietly) {
    if(/[^\d\w\-_]/.test(c) && !escaped) {
      if(c === '\\') {
        escaped = true
      } else {
        !quietly && stream.queue(token())
        state = READY
        --idx
      }

      return
    }

    escaped = false
    gathered.push(c)
  }

  function token() {
    var data = gathered.join('')

    gathered.length = 0

    return {
        type: state
      , data: data
    }
  }
}

},{"through":72}],7:[function(require,module,exports){
var punycode = require('punycode');
var entities = require('./entities.json');

module.exports = decode;

function decode (str) {
    if (typeof str !== 'string') {
        throw new TypeError('Expected a String');
    }

    return str.replace(/&(#?[^;\W]+;?)/g, function (_, match) {
        var m;
        if (m = /^#(\d+);?$/.exec(match)) {
            return punycode.ucs2.encode([ parseInt(m[1], 10) ]);
        } else if (m = /^#[Xx]([A-Fa-f0-9]+);?/.exec(match)) {
            return punycode.ucs2.encode([ parseInt(m[1], 16) ]);
        } else {
            // named entity
            var hasSemi = /;$/.test(match);
            var withoutSemi = hasSemi ? match.replace(/;$/, '') : match;
            var target = entities[withoutSemi] || (hasSemi && entities[match]);

            if (typeof target === 'number') {
                return punycode.ucs2.encode([ target ]);
            } else if (typeof target === 'string') {
                return target;
            } else {
                return '&' + match;
            }
        }
    });
}

},{"./entities.json":9,"punycode":111}],8:[function(require,module,exports){
var punycode = require('punycode');
var revEntities = require('./reversed.json');

module.exports = encode;

function encode (str, opts) {
    if (typeof str !== 'string') {
        throw new TypeError('Expected a String');
    }
    if (!opts) opts = {};

    var numeric = true;
    if (opts.named) numeric = false;
    if (opts.numeric !== undefined) numeric = opts.numeric;

    var special = opts.special || {
        '"': true, "'": true,
        '<': true, '>': true,
        '&': true
    };

    var codePoints = punycode.ucs2.decode(str);
    var chars = [];
    for (var i = 0; i < codePoints.length; i++) {
        var cc = codePoints[i];
        var c = punycode.ucs2.encode([ cc ]);
        var e = revEntities[cc];
        if (e && (cc >= 127 || special[c]) && !numeric) {
            chars.push('&' + (/;$/.test(e) ? e : e + ';'));
        }
        else if (cc < 32 || cc >= 127 || special[c]) {
            chars.push('&#' + cc + ';');
        }
        else {
            chars.push(c);
        }
    }
    return chars.join('');
}

},{"./reversed.json":11,"punycode":111}],9:[function(require,module,exports){
module.exports={
    "Aacute;": "\u00C1",
    "Aacute": "\u00C1",
    "aacute;": "\u00E1",
    "aacute": "\u00E1",
    "Abreve;": "\u0102",
    "abreve;": "\u0103",
    "ac;": "\u223E",
    "acd;": "\u223F",
    "acE;": "\u223E\u0333",
    "Acirc;": "\u00C2",
    "Acirc": "\u00C2",
    "acirc;": "\u00E2",
    "acirc": "\u00E2",
    "acute;": "\u00B4",
    "acute": "\u00B4",
    "Acy;": "\u0410",
    "acy;": "\u0430",
    "AElig;": "\u00C6",
    "AElig": "\u00C6",
    "aelig;": "\u00E6",
    "aelig": "\u00E6",
    "af;": "\u2061",
    "Afr;": "\uD835\uDD04",
    "afr;": "\uD835\uDD1E",
    "Agrave;": "\u00C0",
    "Agrave": "\u00C0",
    "agrave;": "\u00E0",
    "agrave": "\u00E0",
    "alefsym;": "\u2135",
    "aleph;": "\u2135",
    "Alpha;": "\u0391",
    "alpha;": "\u03B1",
    "Amacr;": "\u0100",
    "amacr;": "\u0101",
    "amalg;": "\u2A3F",
    "AMP;": "&",
    "AMP": "&",
    "amp;": "&",
    "amp": "&",
    "And;": "\u2A53",
    "and;": "\u2227",
    "andand;": "\u2A55",
    "andd;": "\u2A5C",
    "andslope;": "\u2A58",
    "andv;": "\u2A5A",
    "ang;": "\u2220",
    "ange;": "\u29A4",
    "angle;": "\u2220",
    "angmsd;": "\u2221",
    "angmsdaa;": "\u29A8",
    "angmsdab;": "\u29A9",
    "angmsdac;": "\u29AA",
    "angmsdad;": "\u29AB",
    "angmsdae;": "\u29AC",
    "angmsdaf;": "\u29AD",
    "angmsdag;": "\u29AE",
    "angmsdah;": "\u29AF",
    "angrt;": "\u221F",
    "angrtvb;": "\u22BE",
    "angrtvbd;": "\u299D",
    "angsph;": "\u2222",
    "angst;": "\u00C5",
    "angzarr;": "\u237C",
    "Aogon;": "\u0104",
    "aogon;": "\u0105",
    "Aopf;": "\uD835\uDD38",
    "aopf;": "\uD835\uDD52",
    "ap;": "\u2248",
    "apacir;": "\u2A6F",
    "apE;": "\u2A70",
    "ape;": "\u224A",
    "apid;": "\u224B",
    "apos;": "'",
    "ApplyFunction;": "\u2061",
    "approx;": "\u2248",
    "approxeq;": "\u224A",
    "Aring;": "\u00C5",
    "Aring": "\u00C5",
    "aring;": "\u00E5",
    "aring": "\u00E5",
    "Ascr;": "\uD835\uDC9C",
    "ascr;": "\uD835\uDCB6",
    "Assign;": "\u2254",
    "ast;": "*",
    "asymp;": "\u2248",
    "asympeq;": "\u224D",
    "Atilde;": "\u00C3",
    "Atilde": "\u00C3",
    "atilde;": "\u00E3",
    "atilde": "\u00E3",
    "Auml;": "\u00C4",
    "Auml": "\u00C4",
    "auml;": "\u00E4",
    "auml": "\u00E4",
    "awconint;": "\u2233",
    "awint;": "\u2A11",
    "backcong;": "\u224C",
    "backepsilon;": "\u03F6",
    "backprime;": "\u2035",
    "backsim;": "\u223D",
    "backsimeq;": "\u22CD",
    "Backslash;": "\u2216",
    "Barv;": "\u2AE7",
    "barvee;": "\u22BD",
    "Barwed;": "\u2306",
    "barwed;": "\u2305",
    "barwedge;": "\u2305",
    "bbrk;": "\u23B5",
    "bbrktbrk;": "\u23B6",
    "bcong;": "\u224C",
    "Bcy;": "\u0411",
    "bcy;": "\u0431",
    "bdquo;": "\u201E",
    "becaus;": "\u2235",
    "Because;": "\u2235",
    "because;": "\u2235",
    "bemptyv;": "\u29B0",
    "bepsi;": "\u03F6",
    "bernou;": "\u212C",
    "Bernoullis;": "\u212C",
    "Beta;": "\u0392",
    "beta;": "\u03B2",
    "beth;": "\u2136",
    "between;": "\u226C",
    "Bfr;": "\uD835\uDD05",
    "bfr;": "\uD835\uDD1F",
    "bigcap;": "\u22C2",
    "bigcirc;": "\u25EF",
    "bigcup;": "\u22C3",
    "bigodot;": "\u2A00",
    "bigoplus;": "\u2A01",
    "bigotimes;": "\u2A02",
    "bigsqcup;": "\u2A06",
    "bigstar;": "\u2605",
    "bigtriangledown;": "\u25BD",
    "bigtriangleup;": "\u25B3",
    "biguplus;": "\u2A04",
    "bigvee;": "\u22C1",
    "bigwedge;": "\u22C0",
    "bkarow;": "\u290D",
    "blacklozenge;": "\u29EB",
    "blacksquare;": "\u25AA",
    "blacktriangle;": "\u25B4",
    "blacktriangledown;": "\u25BE",
    "blacktriangleleft;": "\u25C2",
    "blacktriangleright;": "\u25B8",
    "blank;": "\u2423",
    "blk12;": "\u2592",
    "blk14;": "\u2591",
    "blk34;": "\u2593",
    "block;": "\u2588",
    "bne;": "=\u20E5",
    "bnequiv;": "\u2261\u20E5",
    "bNot;": "\u2AED",
    "bnot;": "\u2310",
    "Bopf;": "\uD835\uDD39",
    "bopf;": "\uD835\uDD53",
    "bot;": "\u22A5",
    "bottom;": "\u22A5",
    "bowtie;": "\u22C8",
    "boxbox;": "\u29C9",
    "boxDL;": "\u2557",
    "boxDl;": "\u2556",
    "boxdL;": "\u2555",
    "boxdl;": "\u2510",
    "boxDR;": "\u2554",
    "boxDr;": "\u2553",
    "boxdR;": "\u2552",
    "boxdr;": "\u250C",
    "boxH;": "\u2550",
    "boxh;": "\u2500",
    "boxHD;": "\u2566",
    "boxHd;": "\u2564",
    "boxhD;": "\u2565",
    "boxhd;": "\u252C",
    "boxHU;": "\u2569",
    "boxHu;": "\u2567",
    "boxhU;": "\u2568",
    "boxhu;": "\u2534",
    "boxminus;": "\u229F",
    "boxplus;": "\u229E",
    "boxtimes;": "\u22A0",
    "boxUL;": "\u255D",
    "boxUl;": "\u255C",
    "boxuL;": "\u255B",
    "boxul;": "\u2518",
    "boxUR;": "\u255A",
    "boxUr;": "\u2559",
    "boxuR;": "\u2558",
    "boxur;": "\u2514",
    "boxV;": "\u2551",
    "boxv;": "\u2502",
    "boxVH;": "\u256C",
    "boxVh;": "\u256B",
    "boxvH;": "\u256A",
    "boxvh;": "\u253C",
    "boxVL;": "\u2563",
    "boxVl;": "\u2562",
    "boxvL;": "\u2561",
    "boxvl;": "\u2524",
    "boxVR;": "\u2560",
    "boxVr;": "\u255F",
    "boxvR;": "\u255E",
    "boxvr;": "\u251C",
    "bprime;": "\u2035",
    "Breve;": "\u02D8",
    "breve;": "\u02D8",
    "brvbar;": "\u00A6",
    "brvbar": "\u00A6",
    "Bscr;": "\u212C",
    "bscr;": "\uD835\uDCB7",
    "bsemi;": "\u204F",
    "bsim;": "\u223D",
    "bsime;": "\u22CD",
    "bsol;": "\\",
    "bsolb;": "\u29C5",
    "bsolhsub;": "\u27C8",
    "bull;": "\u2022",
    "bullet;": "\u2022",
    "bump;": "\u224E",
    "bumpE;": "\u2AAE",
    "bumpe;": "\u224F",
    "Bumpeq;": "\u224E",
    "bumpeq;": "\u224F",
    "Cacute;": "\u0106",
    "cacute;": "\u0107",
    "Cap;": "\u22D2",
    "cap;": "\u2229",
    "capand;": "\u2A44",
    "capbrcup;": "\u2A49",
    "capcap;": "\u2A4B",
    "capcup;": "\u2A47",
    "capdot;": "\u2A40",
    "CapitalDifferentialD;": "\u2145",
    "caps;": "\u2229\uFE00",
    "caret;": "\u2041",
    "caron;": "\u02C7",
    "Cayleys;": "\u212D",
    "ccaps;": "\u2A4D",
    "Ccaron;": "\u010C",
    "ccaron;": "\u010D",
    "Ccedil;": "\u00C7",
    "Ccedil": "\u00C7",
    "ccedil;": "\u00E7",
    "ccedil": "\u00E7",
    "Ccirc;": "\u0108",
    "ccirc;": "\u0109",
    "Cconint;": "\u2230",
    "ccups;": "\u2A4C",
    "ccupssm;": "\u2A50",
    "Cdot;": "\u010A",
    "cdot;": "\u010B",
    "cedil;": "\u00B8",
    "cedil": "\u00B8",
    "Cedilla;": "\u00B8",
    "cemptyv;": "\u29B2",
    "cent;": "\u00A2",
    "cent": "\u00A2",
    "CenterDot;": "\u00B7",
    "centerdot;": "\u00B7",
    "Cfr;": "\u212D",
    "cfr;": "\uD835\uDD20",
    "CHcy;": "\u0427",
    "chcy;": "\u0447",
    "check;": "\u2713",
    "checkmark;": "\u2713",
    "Chi;": "\u03A7",
    "chi;": "\u03C7",
    "cir;": "\u25CB",
    "circ;": "\u02C6",
    "circeq;": "\u2257",
    "circlearrowleft;": "\u21BA",
    "circlearrowright;": "\u21BB",
    "circledast;": "\u229B",
    "circledcirc;": "\u229A",
    "circleddash;": "\u229D",
    "CircleDot;": "\u2299",
    "circledR;": "\u00AE",
    "circledS;": "\u24C8",
    "CircleMinus;": "\u2296",
    "CirclePlus;": "\u2295",
    "CircleTimes;": "\u2297",
    "cirE;": "\u29C3",
    "cire;": "\u2257",
    "cirfnint;": "\u2A10",
    "cirmid;": "\u2AEF",
    "cirscir;": "\u29C2",
    "ClockwiseContourIntegral;": "\u2232",
    "CloseCurlyDoubleQuote;": "\u201D",
    "CloseCurlyQuote;": "\u2019",
    "clubs;": "\u2663",
    "clubsuit;": "\u2663",
    "Colon;": "\u2237",
    "colon;": ":",
    "Colone;": "\u2A74",
    "colone;": "\u2254",
    "coloneq;": "\u2254",
    "comma;": ",",
    "commat;": "@",
    "comp;": "\u2201",
    "compfn;": "\u2218",
    "complement;": "\u2201",
    "complexes;": "\u2102",
    "cong;": "\u2245",
    "congdot;": "\u2A6D",
    "Congruent;": "\u2261",
    "Conint;": "\u222F",
    "conint;": "\u222E",
    "ContourIntegral;": "\u222E",
    "Copf;": "\u2102",
    "copf;": "\uD835\uDD54",
    "coprod;": "\u2210",
    "Coproduct;": "\u2210",
    "COPY;": "\u00A9",
    "COPY": "\u00A9",
    "copy;": "\u00A9",
    "copy": "\u00A9",
    "copysr;": "\u2117",
    "CounterClockwiseContourIntegral;": "\u2233",
    "crarr;": "\u21B5",
    "Cross;": "\u2A2F",
    "cross;": "\u2717",
    "Cscr;": "\uD835\uDC9E",
    "cscr;": "\uD835\uDCB8",
    "csub;": "\u2ACF",
    "csube;": "\u2AD1",
    "csup;": "\u2AD0",
    "csupe;": "\u2AD2",
    "ctdot;": "\u22EF",
    "cudarrl;": "\u2938",
    "cudarrr;": "\u2935",
    "cuepr;": "\u22DE",
    "cuesc;": "\u22DF",
    "cularr;": "\u21B6",
    "cularrp;": "\u293D",
    "Cup;": "\u22D3",
    "cup;": "\u222A",
    "cupbrcap;": "\u2A48",
    "CupCap;": "\u224D",
    "cupcap;": "\u2A46",
    "cupcup;": "\u2A4A",
    "cupdot;": "\u228D",
    "cupor;": "\u2A45",
    "cups;": "\u222A\uFE00",
    "curarr;": "\u21B7",
    "curarrm;": "\u293C",
    "curlyeqprec;": "\u22DE",
    "curlyeqsucc;": "\u22DF",
    "curlyvee;": "\u22CE",
    "curlywedge;": "\u22CF",
    "curren;": "\u00A4",
    "curren": "\u00A4",
    "curvearrowleft;": "\u21B6",
    "curvearrowright;": "\u21B7",
    "cuvee;": "\u22CE",
    "cuwed;": "\u22CF",
    "cwconint;": "\u2232",
    "cwint;": "\u2231",
    "cylcty;": "\u232D",
    "Dagger;": "\u2021",
    "dagger;": "\u2020",
    "daleth;": "\u2138",
    "Darr;": "\u21A1",
    "dArr;": "\u21D3",
    "darr;": "\u2193",
    "dash;": "\u2010",
    "Dashv;": "\u2AE4",
    "dashv;": "\u22A3",
    "dbkarow;": "\u290F",
    "dblac;": "\u02DD",
    "Dcaron;": "\u010E",
    "dcaron;": "\u010F",
    "Dcy;": "\u0414",
    "dcy;": "\u0434",
    "DD;": "\u2145",
    "dd;": "\u2146",
    "ddagger;": "\u2021",
    "ddarr;": "\u21CA",
    "DDotrahd;": "\u2911",
    "ddotseq;": "\u2A77",
    "deg;": "\u00B0",
    "deg": "\u00B0",
    "Del;": "\u2207",
    "Delta;": "\u0394",
    "delta;": "\u03B4",
    "demptyv;": "\u29B1",
    "dfisht;": "\u297F",
    "Dfr;": "\uD835\uDD07",
    "dfr;": "\uD835\uDD21",
    "dHar;": "\u2965",
    "dharl;": "\u21C3",
    "dharr;": "\u21C2",
    "DiacriticalAcute;": "\u00B4",
    "DiacriticalDot;": "\u02D9",
    "DiacriticalDoubleAcute;": "\u02DD",
    "DiacriticalGrave;": "`",
    "DiacriticalTilde;": "\u02DC",
    "diam;": "\u22C4",
    "Diamond;": "\u22C4",
    "diamond;": "\u22C4",
    "diamondsuit;": "\u2666",
    "diams;": "\u2666",
    "die;": "\u00A8",
    "DifferentialD;": "\u2146",
    "digamma;": "\u03DD",
    "disin;": "\u22F2",
    "div;": "\u00F7",
    "divide;": "\u00F7",
    "divide": "\u00F7",
    "divideontimes;": "\u22C7",
    "divonx;": "\u22C7",
    "DJcy;": "\u0402",
    "djcy;": "\u0452",
    "dlcorn;": "\u231E",
    "dlcrop;": "\u230D",
    "dollar;": "$",
    "Dopf;": "\uD835\uDD3B",
    "dopf;": "\uD835\uDD55",
    "Dot;": "\u00A8",
    "dot;": "\u02D9",
    "DotDot;": "\u20DC",
    "doteq;": "\u2250",
    "doteqdot;": "\u2251",
    "DotEqual;": "\u2250",
    "dotminus;": "\u2238",
    "dotplus;": "\u2214",
    "dotsquare;": "\u22A1",
    "doublebarwedge;": "\u2306",
    "DoubleContourIntegral;": "\u222F",
    "DoubleDot;": "\u00A8",
    "DoubleDownArrow;": "\u21D3",
    "DoubleLeftArrow;": "\u21D0",
    "DoubleLeftRightArrow;": "\u21D4",
    "DoubleLeftTee;": "\u2AE4",
    "DoubleLongLeftArrow;": "\u27F8",
    "DoubleLongLeftRightArrow;": "\u27FA",
    "DoubleLongRightArrow;": "\u27F9",
    "DoubleRightArrow;": "\u21D2",
    "DoubleRightTee;": "\u22A8",
    "DoubleUpArrow;": "\u21D1",
    "DoubleUpDownArrow;": "\u21D5",
    "DoubleVerticalBar;": "\u2225",
    "DownArrow;": "\u2193",
    "Downarrow;": "\u21D3",
    "downarrow;": "\u2193",
    "DownArrowBar;": "\u2913",
    "DownArrowUpArrow;": "\u21F5",
    "DownBreve;": "\u0311",
    "downdownarrows;": "\u21CA",
    "downharpoonleft;": "\u21C3",
    "downharpoonright;": "\u21C2",
    "DownLeftRightVector;": "\u2950",
    "DownLeftTeeVector;": "\u295E",
    "DownLeftVector;": "\u21BD",
    "DownLeftVectorBar;": "\u2956",
    "DownRightTeeVector;": "\u295F",
    "DownRightVector;": "\u21C1",
    "DownRightVectorBar;": "\u2957",
    "DownTee;": "\u22A4",
    "DownTeeArrow;": "\u21A7",
    "drbkarow;": "\u2910",
    "drcorn;": "\u231F",
    "drcrop;": "\u230C",
    "Dscr;": "\uD835\uDC9F",
    "dscr;": "\uD835\uDCB9",
    "DScy;": "\u0405",
    "dscy;": "\u0455",
    "dsol;": "\u29F6",
    "Dstrok;": "\u0110",
    "dstrok;": "\u0111",
    "dtdot;": "\u22F1",
    "dtri;": "\u25BF",
    "dtrif;": "\u25BE",
    "duarr;": "\u21F5",
    "duhar;": "\u296F",
    "dwangle;": "\u29A6",
    "DZcy;": "\u040F",
    "dzcy;": "\u045F",
    "dzigrarr;": "\u27FF",
    "Eacute;": "\u00C9",
    "Eacute": "\u00C9",
    "eacute;": "\u00E9",
    "eacute": "\u00E9",
    "easter;": "\u2A6E",
    "Ecaron;": "\u011A",
    "ecaron;": "\u011B",
    "ecir;": "\u2256",
    "Ecirc;": "\u00CA",
    "Ecirc": "\u00CA",
    "ecirc;": "\u00EA",
    "ecirc": "\u00EA",
    "ecolon;": "\u2255",
    "Ecy;": "\u042D",
    "ecy;": "\u044D",
    "eDDot;": "\u2A77",
    "Edot;": "\u0116",
    "eDot;": "\u2251",
    "edot;": "\u0117",
    "ee;": "\u2147",
    "efDot;": "\u2252",
    "Efr;": "\uD835\uDD08",
    "efr;": "\uD835\uDD22",
    "eg;": "\u2A9A",
    "Egrave;": "\u00C8",
    "Egrave": "\u00C8",
    "egrave;": "\u00E8",
    "egrave": "\u00E8",
    "egs;": "\u2A96",
    "egsdot;": "\u2A98",
    "el;": "\u2A99",
    "Element;": "\u2208",
    "elinters;": "\u23E7",
    "ell;": "\u2113",
    "els;": "\u2A95",
    "elsdot;": "\u2A97",
    "Emacr;": "\u0112",
    "emacr;": "\u0113",
    "empty;": "\u2205",
    "emptyset;": "\u2205",
    "EmptySmallSquare;": "\u25FB",
    "emptyv;": "\u2205",
    "EmptyVerySmallSquare;": "\u25AB",
    "emsp;": "\u2003",
    "emsp13;": "\u2004",
    "emsp14;": "\u2005",
    "ENG;": "\u014A",
    "eng;": "\u014B",
    "ensp;": "\u2002",
    "Eogon;": "\u0118",
    "eogon;": "\u0119",
    "Eopf;": "\uD835\uDD3C",
    "eopf;": "\uD835\uDD56",
    "epar;": "\u22D5",
    "eparsl;": "\u29E3",
    "eplus;": "\u2A71",
    "epsi;": "\u03B5",
    "Epsilon;": "\u0395",
    "epsilon;": "\u03B5",
    "epsiv;": "\u03F5",
    "eqcirc;": "\u2256",
    "eqcolon;": "\u2255",
    "eqsim;": "\u2242",
    "eqslantgtr;": "\u2A96",
    "eqslantless;": "\u2A95",
    "Equal;": "\u2A75",
    "equals;": "=",
    "EqualTilde;": "\u2242",
    "equest;": "\u225F",
    "Equilibrium;": "\u21CC",
    "equiv;": "\u2261",
    "equivDD;": "\u2A78",
    "eqvparsl;": "\u29E5",
    "erarr;": "\u2971",
    "erDot;": "\u2253",
    "Escr;": "\u2130",
    "escr;": "\u212F",
    "esdot;": "\u2250",
    "Esim;": "\u2A73",
    "esim;": "\u2242",
    "Eta;": "\u0397",
    "eta;": "\u03B7",
    "ETH;": "\u00D0",
    "ETH": "\u00D0",
    "eth;": "\u00F0",
    "eth": "\u00F0",
    "Euml;": "\u00CB",
    "Euml": "\u00CB",
    "euml;": "\u00EB",
    "euml": "\u00EB",
    "euro;": "\u20AC",
    "excl;": "!",
    "exist;": "\u2203",
    "Exists;": "\u2203",
    "expectation;": "\u2130",
    "ExponentialE;": "\u2147",
    "exponentiale;": "\u2147",
    "fallingdotseq;": "\u2252",
    "Fcy;": "\u0424",
    "fcy;": "\u0444",
    "female;": "\u2640",
    "ffilig;": "\uFB03",
    "fflig;": "\uFB00",
    "ffllig;": "\uFB04",
    "Ffr;": "\uD835\uDD09",
    "ffr;": "\uD835\uDD23",
    "filig;": "\uFB01",
    "FilledSmallSquare;": "\u25FC",
    "FilledVerySmallSquare;": "\u25AA",
    "fjlig;": "fj",
    "flat;": "\u266D",
    "fllig;": "\uFB02",
    "fltns;": "\u25B1",
    "fnof;": "\u0192",
    "Fopf;": "\uD835\uDD3D",
    "fopf;": "\uD835\uDD57",
    "ForAll;": "\u2200",
    "forall;": "\u2200",
    "fork;": "\u22D4",
    "forkv;": "\u2AD9",
    "Fouriertrf;": "\u2131",
    "fpartint;": "\u2A0D",
    "frac12;": "\u00BD",
    "frac12": "\u00BD",
    "frac13;": "\u2153",
    "frac14;": "\u00BC",
    "frac14": "\u00BC",
    "frac15;": "\u2155",
    "frac16;": "\u2159",
    "frac18;": "\u215B",
    "frac23;": "\u2154",
    "frac25;": "\u2156",
    "frac34;": "\u00BE",
    "frac34": "\u00BE",
    "frac35;": "\u2157",
    "frac38;": "\u215C",
    "frac45;": "\u2158",
    "frac56;": "\u215A",
    "frac58;": "\u215D",
    "frac78;": "\u215E",
    "frasl;": "\u2044",
    "frown;": "\u2322",
    "Fscr;": "\u2131",
    "fscr;": "\uD835\uDCBB",
    "gacute;": "\u01F5",
    "Gamma;": "\u0393",
    "gamma;": "\u03B3",
    "Gammad;": "\u03DC",
    "gammad;": "\u03DD",
    "gap;": "\u2A86",
    "Gbreve;": "\u011E",
    "gbreve;": "\u011F",
    "Gcedil;": "\u0122",
    "Gcirc;": "\u011C",
    "gcirc;": "\u011D",
    "Gcy;": "\u0413",
    "gcy;": "\u0433",
    "Gdot;": "\u0120",
    "gdot;": "\u0121",
    "gE;": "\u2267",
    "ge;": "\u2265",
    "gEl;": "\u2A8C",
    "gel;": "\u22DB",
    "geq;": "\u2265",
    "geqq;": "\u2267",
    "geqslant;": "\u2A7E",
    "ges;": "\u2A7E",
    "gescc;": "\u2AA9",
    "gesdot;": "\u2A80",
    "gesdoto;": "\u2A82",
    "gesdotol;": "\u2A84",
    "gesl;": "\u22DB\uFE00",
    "gesles;": "\u2A94",
    "Gfr;": "\uD835\uDD0A",
    "gfr;": "\uD835\uDD24",
    "Gg;": "\u22D9",
    "gg;": "\u226B",
    "ggg;": "\u22D9",
    "gimel;": "\u2137",
    "GJcy;": "\u0403",
    "gjcy;": "\u0453",
    "gl;": "\u2277",
    "gla;": "\u2AA5",
    "glE;": "\u2A92",
    "glj;": "\u2AA4",
    "gnap;": "\u2A8A",
    "gnapprox;": "\u2A8A",
    "gnE;": "\u2269",
    "gne;": "\u2A88",
    "gneq;": "\u2A88",
    "gneqq;": "\u2269",
    "gnsim;": "\u22E7",
    "Gopf;": "\uD835\uDD3E",
    "gopf;": "\uD835\uDD58",
    "grave;": "`",
    "GreaterEqual;": "\u2265",
    "GreaterEqualLess;": "\u22DB",
    "GreaterFullEqual;": "\u2267",
    "GreaterGreater;": "\u2AA2",
    "GreaterLess;": "\u2277",
    "GreaterSlantEqual;": "\u2A7E",
    "GreaterTilde;": "\u2273",
    "Gscr;": "\uD835\uDCA2",
    "gscr;": "\u210A",
    "gsim;": "\u2273",
    "gsime;": "\u2A8E",
    "gsiml;": "\u2A90",
    "GT;": ">",
    "GT": ">",
    "Gt;": "\u226B",
    "gt;": ">",
    "gt": ">",
    "gtcc;": "\u2AA7",
    "gtcir;": "\u2A7A",
    "gtdot;": "\u22D7",
    "gtlPar;": "\u2995",
    "gtquest;": "\u2A7C",
    "gtrapprox;": "\u2A86",
    "gtrarr;": "\u2978",
    "gtrdot;": "\u22D7",
    "gtreqless;": "\u22DB",
    "gtreqqless;": "\u2A8C",
    "gtrless;": "\u2277",
    "gtrsim;": "\u2273",
    "gvertneqq;": "\u2269\uFE00",
    "gvnE;": "\u2269\uFE00",
    "Hacek;": "\u02C7",
    "hairsp;": "\u200A",
    "half;": "\u00BD",
    "hamilt;": "\u210B",
    "HARDcy;": "\u042A",
    "hardcy;": "\u044A",
    "hArr;": "\u21D4",
    "harr;": "\u2194",
    "harrcir;": "\u2948",
    "harrw;": "\u21AD",
    "Hat;": "^",
    "hbar;": "\u210F",
    "Hcirc;": "\u0124",
    "hcirc;": "\u0125",
    "hearts;": "\u2665",
    "heartsuit;": "\u2665",
    "hellip;": "\u2026",
    "hercon;": "\u22B9",
    "Hfr;": "\u210C",
    "hfr;": "\uD835\uDD25",
    "HilbertSpace;": "\u210B",
    "hksearow;": "\u2925",
    "hkswarow;": "\u2926",
    "hoarr;": "\u21FF",
    "homtht;": "\u223B",
    "hookleftarrow;": "\u21A9",
    "hookrightarrow;": "\u21AA",
    "Hopf;": "\u210D",
    "hopf;": "\uD835\uDD59",
    "horbar;": "\u2015",
    "HorizontalLine;": "\u2500",
    "Hscr;": "\u210B",
    "hscr;": "\uD835\uDCBD",
    "hslash;": "\u210F",
    "Hstrok;": "\u0126",
    "hstrok;": "\u0127",
    "HumpDownHump;": "\u224E",
    "HumpEqual;": "\u224F",
    "hybull;": "\u2043",
    "hyphen;": "\u2010",
    "Iacute;": "\u00CD",
    "Iacute": "\u00CD",
    "iacute;": "\u00ED",
    "iacute": "\u00ED",
    "ic;": "\u2063",
    "Icirc;": "\u00CE",
    "Icirc": "\u00CE",
    "icirc;": "\u00EE",
    "icirc": "\u00EE",
    "Icy;": "\u0418",
    "icy;": "\u0438",
    "Idot;": "\u0130",
    "IEcy;": "\u0415",
    "iecy;": "\u0435",
    "iexcl;": "\u00A1",
    "iexcl": "\u00A1",
    "iff;": "\u21D4",
    "Ifr;": "\u2111",
    "ifr;": "\uD835\uDD26",
    "Igrave;": "\u00CC",
    "Igrave": "\u00CC",
    "igrave;": "\u00EC",
    "igrave": "\u00EC",
    "ii;": "\u2148",
    "iiiint;": "\u2A0C",
    "iiint;": "\u222D",
    "iinfin;": "\u29DC",
    "iiota;": "\u2129",
    "IJlig;": "\u0132",
    "ijlig;": "\u0133",
    "Im;": "\u2111",
    "Imacr;": "\u012A",
    "imacr;": "\u012B",
    "image;": "\u2111",
    "ImaginaryI;": "\u2148",
    "imagline;": "\u2110",
    "imagpart;": "\u2111",
    "imath;": "\u0131",
    "imof;": "\u22B7",
    "imped;": "\u01B5",
    "Implies;": "\u21D2",
    "in;": "\u2208",
    "incare;": "\u2105",
    "infin;": "\u221E",
    "infintie;": "\u29DD",
    "inodot;": "\u0131",
    "Int;": "\u222C",
    "int;": "\u222B",
    "intcal;": "\u22BA",
    "integers;": "\u2124",
    "Integral;": "\u222B",
    "intercal;": "\u22BA",
    "Intersection;": "\u22C2",
    "intlarhk;": "\u2A17",
    "intprod;": "\u2A3C",
    "InvisibleComma;": "\u2063",
    "InvisibleTimes;": "\u2062",
    "IOcy;": "\u0401",
    "iocy;": "\u0451",
    "Iogon;": "\u012E",
    "iogon;": "\u012F",
    "Iopf;": "\uD835\uDD40",
    "iopf;": "\uD835\uDD5A",
    "Iota;": "\u0399",
    "iota;": "\u03B9",
    "iprod;": "\u2A3C",
    "iquest;": "\u00BF",
    "iquest": "\u00BF",
    "Iscr;": "\u2110",
    "iscr;": "\uD835\uDCBE",
    "isin;": "\u2208",
    "isindot;": "\u22F5",
    "isinE;": "\u22F9",
    "isins;": "\u22F4",
    "isinsv;": "\u22F3",
    "isinv;": "\u2208",
    "it;": "\u2062",
    "Itilde;": "\u0128",
    "itilde;": "\u0129",
    "Iukcy;": "\u0406",
    "iukcy;": "\u0456",
    "Iuml;": "\u00CF",
    "Iuml": "\u00CF",
    "iuml;": "\u00EF",
    "iuml": "\u00EF",
    "Jcirc;": "\u0134",
    "jcirc;": "\u0135",
    "Jcy;": "\u0419",
    "jcy;": "\u0439",
    "Jfr;": "\uD835\uDD0D",
    "jfr;": "\uD835\uDD27",
    "jmath;": "\u0237",
    "Jopf;": "\uD835\uDD41",
    "jopf;": "\uD835\uDD5B",
    "Jscr;": "\uD835\uDCA5",
    "jscr;": "\uD835\uDCBF",
    "Jsercy;": "\u0408",
    "jsercy;": "\u0458",
    "Jukcy;": "\u0404",
    "jukcy;": "\u0454",
    "Kappa;": "\u039A",
    "kappa;": "\u03BA",
    "kappav;": "\u03F0",
    "Kcedil;": "\u0136",
    "kcedil;": "\u0137",
    "Kcy;": "\u041A",
    "kcy;": "\u043A",
    "Kfr;": "\uD835\uDD0E",
    "kfr;": "\uD835\uDD28",
    "kgreen;": "\u0138",
    "KHcy;": "\u0425",
    "khcy;": "\u0445",
    "KJcy;": "\u040C",
    "kjcy;": "\u045C",
    "Kopf;": "\uD835\uDD42",
    "kopf;": "\uD835\uDD5C",
    "Kscr;": "\uD835\uDCA6",
    "kscr;": "\uD835\uDCC0",
    "lAarr;": "\u21DA",
    "Lacute;": "\u0139",
    "lacute;": "\u013A",
    "laemptyv;": "\u29B4",
    "lagran;": "\u2112",
    "Lambda;": "\u039B",
    "lambda;": "\u03BB",
    "Lang;": "\u27EA",
    "lang;": "\u27E8",
    "langd;": "\u2991",
    "langle;": "\u27E8",
    "lap;": "\u2A85",
    "Laplacetrf;": "\u2112",
    "laquo;": "\u00AB",
    "laquo": "\u00AB",
    "Larr;": "\u219E",
    "lArr;": "\u21D0",
    "larr;": "\u2190",
    "larrb;": "\u21E4",
    "larrbfs;": "\u291F",
    "larrfs;": "\u291D",
    "larrhk;": "\u21A9",
    "larrlp;": "\u21AB",
    "larrpl;": "\u2939",
    "larrsim;": "\u2973",
    "larrtl;": "\u21A2",
    "lat;": "\u2AAB",
    "lAtail;": "\u291B",
    "latail;": "\u2919",
    "late;": "\u2AAD",
    "lates;": "\u2AAD\uFE00",
    "lBarr;": "\u290E",
    "lbarr;": "\u290C",
    "lbbrk;": "\u2772",
    "lbrace;": "{",
    "lbrack;": "[",
    "lbrke;": "\u298B",
    "lbrksld;": "\u298F",
    "lbrkslu;": "\u298D",
    "Lcaron;": "\u013D",
    "lcaron;": "\u013E",
    "Lcedil;": "\u013B",
    "lcedil;": "\u013C",
    "lceil;": "\u2308",
    "lcub;": "{",
    "Lcy;": "\u041B",
    "lcy;": "\u043B",
    "ldca;": "\u2936",
    "ldquo;": "\u201C",
    "ldquor;": "\u201E",
    "ldrdhar;": "\u2967",
    "ldrushar;": "\u294B",
    "ldsh;": "\u21B2",
    "lE;": "\u2266",
    "le;": "\u2264",
    "LeftAngleBracket;": "\u27E8",
    "LeftArrow;": "\u2190",
    "Leftarrow;": "\u21D0",
    "leftarrow;": "\u2190",
    "LeftArrowBar;": "\u21E4",
    "LeftArrowRightArrow;": "\u21C6",
    "leftarrowtail;": "\u21A2",
    "LeftCeiling;": "\u2308",
    "LeftDoubleBracket;": "\u27E6",
    "LeftDownTeeVector;": "\u2961",
    "LeftDownVector;": "\u21C3",
    "LeftDownVectorBar;": "\u2959",
    "LeftFloor;": "\u230A",
    "leftharpoondown;": "\u21BD",
    "leftharpoonup;": "\u21BC",
    "leftleftarrows;": "\u21C7",
    "LeftRightArrow;": "\u2194",
    "Leftrightarrow;": "\u21D4",
    "leftrightarrow;": "\u2194",
    "leftrightarrows;": "\u21C6",
    "leftrightharpoons;": "\u21CB",
    "leftrightsquigarrow;": "\u21AD",
    "LeftRightVector;": "\u294E",
    "LeftTee;": "\u22A3",
    "LeftTeeArrow;": "\u21A4",
    "LeftTeeVector;": "\u295A",
    "leftthreetimes;": "\u22CB",
    "LeftTriangle;": "\u22B2",
    "LeftTriangleBar;": "\u29CF",
    "LeftTriangleEqual;": "\u22B4",
    "LeftUpDownVector;": "\u2951",
    "LeftUpTeeVector;": "\u2960",
    "LeftUpVector;": "\u21BF",
    "LeftUpVectorBar;": "\u2958",
    "LeftVector;": "\u21BC",
    "LeftVectorBar;": "\u2952",
    "lEg;": "\u2A8B",
    "leg;": "\u22DA",
    "leq;": "\u2264",
    "leqq;": "\u2266",
    "leqslant;": "\u2A7D",
    "les;": "\u2A7D",
    "lescc;": "\u2AA8",
    "lesdot;": "\u2A7F",
    "lesdoto;": "\u2A81",
    "lesdotor;": "\u2A83",
    "lesg;": "\u22DA\uFE00",
    "lesges;": "\u2A93",
    "lessapprox;": "\u2A85",
    "lessdot;": "\u22D6",
    "lesseqgtr;": "\u22DA",
    "lesseqqgtr;": "\u2A8B",
    "LessEqualGreater;": "\u22DA",
    "LessFullEqual;": "\u2266",
    "LessGreater;": "\u2276",
    "lessgtr;": "\u2276",
    "LessLess;": "\u2AA1",
    "lesssim;": "\u2272",
    "LessSlantEqual;": "\u2A7D",
    "LessTilde;": "\u2272",
    "lfisht;": "\u297C",
    "lfloor;": "\u230A",
    "Lfr;": "\uD835\uDD0F",
    "lfr;": "\uD835\uDD29",
    "lg;": "\u2276",
    "lgE;": "\u2A91",
    "lHar;": "\u2962",
    "lhard;": "\u21BD",
    "lharu;": "\u21BC",
    "lharul;": "\u296A",
    "lhblk;": "\u2584",
    "LJcy;": "\u0409",
    "ljcy;": "\u0459",
    "Ll;": "\u22D8",
    "ll;": "\u226A",
    "llarr;": "\u21C7",
    "llcorner;": "\u231E",
    "Lleftarrow;": "\u21DA",
    "llhard;": "\u296B",
    "lltri;": "\u25FA",
    "Lmidot;": "\u013F",
    "lmidot;": "\u0140",
    "lmoust;": "\u23B0",
    "lmoustache;": "\u23B0",
    "lnap;": "\u2A89",
    "lnapprox;": "\u2A89",
    "lnE;": "\u2268",
    "lne;": "\u2A87",
    "lneq;": "\u2A87",
    "lneqq;": "\u2268",
    "lnsim;": "\u22E6",
    "loang;": "\u27EC",
    "loarr;": "\u21FD",
    "lobrk;": "\u27E6",
    "LongLeftArrow;": "\u27F5",
    "Longleftarrow;": "\u27F8",
    "longleftarrow;": "\u27F5",
    "LongLeftRightArrow;": "\u27F7",
    "Longleftrightarrow;": "\u27FA",
    "longleftrightarrow;": "\u27F7",
    "longmapsto;": "\u27FC",
    "LongRightArrow;": "\u27F6",
    "Longrightarrow;": "\u27F9",
    "longrightarrow;": "\u27F6",
    "looparrowleft;": "\u21AB",
    "looparrowright;": "\u21AC",
    "lopar;": "\u2985",
    "Lopf;": "\uD835\uDD43",
    "lopf;": "\uD835\uDD5D",
    "loplus;": "\u2A2D",
    "lotimes;": "\u2A34",
    "lowast;": "\u2217",
    "lowbar;": "_",
    "LowerLeftArrow;": "\u2199",
    "LowerRightArrow;": "\u2198",
    "loz;": "\u25CA",
    "lozenge;": "\u25CA",
    "lozf;": "\u29EB",
    "lpar;": "(",
    "lparlt;": "\u2993",
    "lrarr;": "\u21C6",
    "lrcorner;": "\u231F",
    "lrhar;": "\u21CB",
    "lrhard;": "\u296D",
    "lrm;": "\u200E",
    "lrtri;": "\u22BF",
    "lsaquo;": "\u2039",
    "Lscr;": "\u2112",
    "lscr;": "\uD835\uDCC1",
    "Lsh;": "\u21B0",
    "lsh;": "\u21B0",
    "lsim;": "\u2272",
    "lsime;": "\u2A8D",
    "lsimg;": "\u2A8F",
    "lsqb;": "[",
    "lsquo;": "\u2018",
    "lsquor;": "\u201A",
    "Lstrok;": "\u0141",
    "lstrok;": "\u0142",
    "LT;": "<",
    "LT": "<",
    "Lt;": "\u226A",
    "lt;": "<",
    "lt": "<",
    "ltcc;": "\u2AA6",
    "ltcir;": "\u2A79",
    "ltdot;": "\u22D6",
    "lthree;": "\u22CB",
    "ltimes;": "\u22C9",
    "ltlarr;": "\u2976",
    "ltquest;": "\u2A7B",
    "ltri;": "\u25C3",
    "ltrie;": "\u22B4",
    "ltrif;": "\u25C2",
    "ltrPar;": "\u2996",
    "lurdshar;": "\u294A",
    "luruhar;": "\u2966",
    "lvertneqq;": "\u2268\uFE00",
    "lvnE;": "\u2268\uFE00",
    "macr;": "\u00AF",
    "macr": "\u00AF",
    "male;": "\u2642",
    "malt;": "\u2720",
    "maltese;": "\u2720",
    "Map;": "\u2905",
    "map;": "\u21A6",
    "mapsto;": "\u21A6",
    "mapstodown;": "\u21A7",
    "mapstoleft;": "\u21A4",
    "mapstoup;": "\u21A5",
    "marker;": "\u25AE",
    "mcomma;": "\u2A29",
    "Mcy;": "\u041C",
    "mcy;": "\u043C",
    "mdash;": "\u2014",
    "mDDot;": "\u223A",
    "measuredangle;": "\u2221",
    "MediumSpace;": "\u205F",
    "Mellintrf;": "\u2133",
    "Mfr;": "\uD835\uDD10",
    "mfr;": "\uD835\uDD2A",
    "mho;": "\u2127",
    "micro;": "\u00B5",
    "micro": "\u00B5",
    "mid;": "\u2223",
    "midast;": "*",
    "midcir;": "\u2AF0",
    "middot;": "\u00B7",
    "middot": "\u00B7",
    "minus;": "\u2212",
    "minusb;": "\u229F",
    "minusd;": "\u2238",
    "minusdu;": "\u2A2A",
    "MinusPlus;": "\u2213",
    "mlcp;": "\u2ADB",
    "mldr;": "\u2026",
    "mnplus;": "\u2213",
    "models;": "\u22A7",
    "Mopf;": "\uD835\uDD44",
    "mopf;": "\uD835\uDD5E",
    "mp;": "\u2213",
    "Mscr;": "\u2133",
    "mscr;": "\uD835\uDCC2",
    "mstpos;": "\u223E",
    "Mu;": "\u039C",
    "mu;": "\u03BC",
    "multimap;": "\u22B8",
    "mumap;": "\u22B8",
    "nabla;": "\u2207",
    "Nacute;": "\u0143",
    "nacute;": "\u0144",
    "nang;": "\u2220\u20D2",
    "nap;": "\u2249",
    "napE;": "\u2A70\u0338",
    "napid;": "\u224B\u0338",
    "napos;": "\u0149",
    "napprox;": "\u2249",
    "natur;": "\u266E",
    "natural;": "\u266E",
    "naturals;": "\u2115",
    "nbsp;": "\u00A0",
    "nbsp": "\u00A0",
    "nbump;": "\u224E\u0338",
    "nbumpe;": "\u224F\u0338",
    "ncap;": "\u2A43",
    "Ncaron;": "\u0147",
    "ncaron;": "\u0148",
    "Ncedil;": "\u0145",
    "ncedil;": "\u0146",
    "ncong;": "\u2247",
    "ncongdot;": "\u2A6D\u0338",
    "ncup;": "\u2A42",
    "Ncy;": "\u041D",
    "ncy;": "\u043D",
    "ndash;": "\u2013",
    "ne;": "\u2260",
    "nearhk;": "\u2924",
    "neArr;": "\u21D7",
    "nearr;": "\u2197",
    "nearrow;": "\u2197",
    "nedot;": "\u2250\u0338",
    "NegativeMediumSpace;": "\u200B",
    "NegativeThickSpace;": "\u200B",
    "NegativeThinSpace;": "\u200B",
    "NegativeVeryThinSpace;": "\u200B",
    "nequiv;": "\u2262",
    "nesear;": "\u2928",
    "nesim;": "\u2242\u0338",
    "NestedGreaterGreater;": "\u226B",
    "NestedLessLess;": "\u226A",
    "NewLine;": "\n",
    "nexist;": "\u2204",
    "nexists;": "\u2204",
    "Nfr;": "\uD835\uDD11",
    "nfr;": "\uD835\uDD2B",
    "ngE;": "\u2267\u0338",
    "nge;": "\u2271",
    "ngeq;": "\u2271",
    "ngeqq;": "\u2267\u0338",
    "ngeqslant;": "\u2A7E\u0338",
    "nges;": "\u2A7E\u0338",
    "nGg;": "\u22D9\u0338",
    "ngsim;": "\u2275",
    "nGt;": "\u226B\u20D2",
    "ngt;": "\u226F",
    "ngtr;": "\u226F",
    "nGtv;": "\u226B\u0338",
    "nhArr;": "\u21CE",
    "nharr;": "\u21AE",
    "nhpar;": "\u2AF2",
    "ni;": "\u220B",
    "nis;": "\u22FC",
    "nisd;": "\u22FA",
    "niv;": "\u220B",
    "NJcy;": "\u040A",
    "njcy;": "\u045A",
    "nlArr;": "\u21CD",
    "nlarr;": "\u219A",
    "nldr;": "\u2025",
    "nlE;": "\u2266\u0338",
    "nle;": "\u2270",
    "nLeftarrow;": "\u21CD",
    "nleftarrow;": "\u219A",
    "nLeftrightarrow;": "\u21CE",
    "nleftrightarrow;": "\u21AE",
    "nleq;": "\u2270",
    "nleqq;": "\u2266\u0338",
    "nleqslant;": "\u2A7D\u0338",
    "nles;": "\u2A7D\u0338",
    "nless;": "\u226E",
    "nLl;": "\u22D8\u0338",
    "nlsim;": "\u2274",
    "nLt;": "\u226A\u20D2",
    "nlt;": "\u226E",
    "nltri;": "\u22EA",
    "nltrie;": "\u22EC",
    "nLtv;": "\u226A\u0338",
    "nmid;": "\u2224",
    "NoBreak;": "\u2060",
    "NonBreakingSpace;": "\u00A0",
    "Nopf;": "\u2115",
    "nopf;": "\uD835\uDD5F",
    "Not;": "\u2AEC",
    "not;": "\u00AC",
    "not": "\u00AC",
    "NotCongruent;": "\u2262",
    "NotCupCap;": "\u226D",
    "NotDoubleVerticalBar;": "\u2226",
    "NotElement;": "\u2209",
    "NotEqual;": "\u2260",
    "NotEqualTilde;": "\u2242\u0338",
    "NotExists;": "\u2204",
    "NotGreater;": "\u226F",
    "NotGreaterEqual;": "\u2271",
    "NotGreaterFullEqual;": "\u2267\u0338",
    "NotGreaterGreater;": "\u226B\u0338",
    "NotGreaterLess;": "\u2279",
    "NotGreaterSlantEqual;": "\u2A7E\u0338",
    "NotGreaterTilde;": "\u2275",
    "NotHumpDownHump;": "\u224E\u0338",
    "NotHumpEqual;": "\u224F\u0338",
    "notin;": "\u2209",
    "notindot;": "\u22F5\u0338",
    "notinE;": "\u22F9\u0338",
    "notinva;": "\u2209",
    "notinvb;": "\u22F7",
    "notinvc;": "\u22F6",
    "NotLeftTriangle;": "\u22EA",
    "NotLeftTriangleBar;": "\u29CF\u0338",
    "NotLeftTriangleEqual;": "\u22EC",
    "NotLess;": "\u226E",
    "NotLessEqual;": "\u2270",
    "NotLessGreater;": "\u2278",
    "NotLessLess;": "\u226A\u0338",
    "NotLessSlantEqual;": "\u2A7D\u0338",
    "NotLessTilde;": "\u2274",
    "NotNestedGreaterGreater;": "\u2AA2\u0338",
    "NotNestedLessLess;": "\u2AA1\u0338",
    "notni;": "\u220C",
    "notniva;": "\u220C",
    "notnivb;": "\u22FE",
    "notnivc;": "\u22FD",
    "NotPrecedes;": "\u2280",
    "NotPrecedesEqual;": "\u2AAF\u0338",
    "NotPrecedesSlantEqual;": "\u22E0",
    "NotReverseElement;": "\u220C",
    "NotRightTriangle;": "\u22EB",
    "NotRightTriangleBar;": "\u29D0\u0338",
    "NotRightTriangleEqual;": "\u22ED",
    "NotSquareSubset;": "\u228F\u0338",
    "NotSquareSubsetEqual;": "\u22E2",
    "NotSquareSuperset;": "\u2290\u0338",
    "NotSquareSupersetEqual;": "\u22E3",
    "NotSubset;": "\u2282\u20D2",
    "NotSubsetEqual;": "\u2288",
    "NotSucceeds;": "\u2281",
    "NotSucceedsEqual;": "\u2AB0\u0338",
    "NotSucceedsSlantEqual;": "\u22E1",
    "NotSucceedsTilde;": "\u227F\u0338",
    "NotSuperset;": "\u2283\u20D2",
    "NotSupersetEqual;": "\u2289",
    "NotTilde;": "\u2241",
    "NotTildeEqual;": "\u2244",
    "NotTildeFullEqual;": "\u2247",
    "NotTildeTilde;": "\u2249",
    "NotVerticalBar;": "\u2224",
    "npar;": "\u2226",
    "nparallel;": "\u2226",
    "nparsl;": "\u2AFD\u20E5",
    "npart;": "\u2202\u0338",
    "npolint;": "\u2A14",
    "npr;": "\u2280",
    "nprcue;": "\u22E0",
    "npre;": "\u2AAF\u0338",
    "nprec;": "\u2280",
    "npreceq;": "\u2AAF\u0338",
    "nrArr;": "\u21CF",
    "nrarr;": "\u219B",
    "nrarrc;": "\u2933\u0338",
    "nrarrw;": "\u219D\u0338",
    "nRightarrow;": "\u21CF",
    "nrightarrow;": "\u219B",
    "nrtri;": "\u22EB",
    "nrtrie;": "\u22ED",
    "nsc;": "\u2281",
    "nsccue;": "\u22E1",
    "nsce;": "\u2AB0\u0338",
    "Nscr;": "\uD835\uDCA9",
    "nscr;": "\uD835\uDCC3",
    "nshortmid;": "\u2224",
    "nshortparallel;": "\u2226",
    "nsim;": "\u2241",
    "nsime;": "\u2244",
    "nsimeq;": "\u2244",
    "nsmid;": "\u2224",
    "nspar;": "\u2226",
    "nsqsube;": "\u22E2",
    "nsqsupe;": "\u22E3",
    "nsub;": "\u2284",
    "nsubE;": "\u2AC5\u0338",
    "nsube;": "\u2288",
    "nsubset;": "\u2282\u20D2",
    "nsubseteq;": "\u2288",
    "nsubseteqq;": "\u2AC5\u0338",
    "nsucc;": "\u2281",
    "nsucceq;": "\u2AB0\u0338",
    "nsup;": "\u2285",
    "nsupE;": "\u2AC6\u0338",
    "nsupe;": "\u2289",
    "nsupset;": "\u2283\u20D2",
    "nsupseteq;": "\u2289",
    "nsupseteqq;": "\u2AC6\u0338",
    "ntgl;": "\u2279",
    "Ntilde;": "\u00D1",
    "Ntilde": "\u00D1",
    "ntilde;": "\u00F1",
    "ntilde": "\u00F1",
    "ntlg;": "\u2278",
    "ntriangleleft;": "\u22EA",
    "ntrianglelefteq;": "\u22EC",
    "ntriangleright;": "\u22EB",
    "ntrianglerighteq;": "\u22ED",
    "Nu;": "\u039D",
    "nu;": "\u03BD",
    "num;": "#",
    "numero;": "\u2116",
    "numsp;": "\u2007",
    "nvap;": "\u224D\u20D2",
    "nVDash;": "\u22AF",
    "nVdash;": "\u22AE",
    "nvDash;": "\u22AD",
    "nvdash;": "\u22AC",
    "nvge;": "\u2265\u20D2",
    "nvgt;": ">\u20D2",
    "nvHarr;": "\u2904",
    "nvinfin;": "\u29DE",
    "nvlArr;": "\u2902",
    "nvle;": "\u2264\u20D2",
    "nvlt;": "<\u20D2",
    "nvltrie;": "\u22B4\u20D2",
    "nvrArr;": "\u2903",
    "nvrtrie;": "\u22B5\u20D2",
    "nvsim;": "\u223C\u20D2",
    "nwarhk;": "\u2923",
    "nwArr;": "\u21D6",
    "nwarr;": "\u2196",
    "nwarrow;": "\u2196",
    "nwnear;": "\u2927",
    "Oacute;": "\u00D3",
    "Oacute": "\u00D3",
    "oacute;": "\u00F3",
    "oacute": "\u00F3",
    "oast;": "\u229B",
    "ocir;": "\u229A",
    "Ocirc;": "\u00D4",
    "Ocirc": "\u00D4",
    "ocirc;": "\u00F4",
    "ocirc": "\u00F4",
    "Ocy;": "\u041E",
    "ocy;": "\u043E",
    "odash;": "\u229D",
    "Odblac;": "\u0150",
    "odblac;": "\u0151",
    "odiv;": "\u2A38",
    "odot;": "\u2299",
    "odsold;": "\u29BC",
    "OElig;": "\u0152",
    "oelig;": "\u0153",
    "ofcir;": "\u29BF",
    "Ofr;": "\uD835\uDD12",
    "ofr;": "\uD835\uDD2C",
    "ogon;": "\u02DB",
    "Ograve;": "\u00D2",
    "Ograve": "\u00D2",
    "ograve;": "\u00F2",
    "ograve": "\u00F2",
    "ogt;": "\u29C1",
    "ohbar;": "\u29B5",
    "ohm;": "\u03A9",
    "oint;": "\u222E",
    "olarr;": "\u21BA",
    "olcir;": "\u29BE",
    "olcross;": "\u29BB",
    "oline;": "\u203E",
    "olt;": "\u29C0",
    "Omacr;": "\u014C",
    "omacr;": "\u014D",
    "Omega;": "\u03A9",
    "omega;": "\u03C9",
    "Omicron;": "\u039F",
    "omicron;": "\u03BF",
    "omid;": "\u29B6",
    "ominus;": "\u2296",
    "Oopf;": "\uD835\uDD46",
    "oopf;": "\uD835\uDD60",
    "opar;": "\u29B7",
    "OpenCurlyDoubleQuote;": "\u201C",
    "OpenCurlyQuote;": "\u2018",
    "operp;": "\u29B9",
    "oplus;": "\u2295",
    "Or;": "\u2A54",
    "or;": "\u2228",
    "orarr;": "\u21BB",
    "ord;": "\u2A5D",
    "order;": "\u2134",
    "orderof;": "\u2134",
    "ordf;": "\u00AA",
    "ordf": "\u00AA",
    "ordm;": "\u00BA",
    "ordm": "\u00BA",
    "origof;": "\u22B6",
    "oror;": "\u2A56",
    "orslope;": "\u2A57",
    "orv;": "\u2A5B",
    "oS;": "\u24C8",
    "Oscr;": "\uD835\uDCAA",
    "oscr;": "\u2134",
    "Oslash;": "\u00D8",
    "Oslash": "\u00D8",
    "oslash;": "\u00F8",
    "oslash": "\u00F8",
    "osol;": "\u2298",
    "Otilde;": "\u00D5",
    "Otilde": "\u00D5",
    "otilde;": "\u00F5",
    "otilde": "\u00F5",
    "Otimes;": "\u2A37",
    "otimes;": "\u2297",
    "otimesas;": "\u2A36",
    "Ouml;": "\u00D6",
    "Ouml": "\u00D6",
    "ouml;": "\u00F6",
    "ouml": "\u00F6",
    "ovbar;": "\u233D",
    "OverBar;": "\u203E",
    "OverBrace;": "\u23DE",
    "OverBracket;": "\u23B4",
    "OverParenthesis;": "\u23DC",
    "par;": "\u2225",
    "para;": "\u00B6",
    "para": "\u00B6",
    "parallel;": "\u2225",
    "parsim;": "\u2AF3",
    "parsl;": "\u2AFD",
    "part;": "\u2202",
    "PartialD;": "\u2202",
    "Pcy;": "\u041F",
    "pcy;": "\u043F",
    "percnt;": "%",
    "period;": ".",
    "permil;": "\u2030",
    "perp;": "\u22A5",
    "pertenk;": "\u2031",
    "Pfr;": "\uD835\uDD13",
    "pfr;": "\uD835\uDD2D",
    "Phi;": "\u03A6",
    "phi;": "\u03C6",
    "phiv;": "\u03D5",
    "phmmat;": "\u2133",
    "phone;": "\u260E",
    "Pi;": "\u03A0",
    "pi;": "\u03C0",
    "pitchfork;": "\u22D4",
    "piv;": "\u03D6",
    "planck;": "\u210F",
    "planckh;": "\u210E",
    "plankv;": "\u210F",
    "plus;": "+",
    "plusacir;": "\u2A23",
    "plusb;": "\u229E",
    "pluscir;": "\u2A22",
    "plusdo;": "\u2214",
    "plusdu;": "\u2A25",
    "pluse;": "\u2A72",
    "PlusMinus;": "\u00B1",
    "plusmn;": "\u00B1",
    "plusmn": "\u00B1",
    "plussim;": "\u2A26",
    "plustwo;": "\u2A27",
    "pm;": "\u00B1",
    "Poincareplane;": "\u210C",
    "pointint;": "\u2A15",
    "Popf;": "\u2119",
    "popf;": "\uD835\uDD61",
    "pound;": "\u00A3",
    "pound": "\u00A3",
    "Pr;": "\u2ABB",
    "pr;": "\u227A",
    "prap;": "\u2AB7",
    "prcue;": "\u227C",
    "prE;": "\u2AB3",
    "pre;": "\u2AAF",
    "prec;": "\u227A",
    "precapprox;": "\u2AB7",
    "preccurlyeq;": "\u227C",
    "Precedes;": "\u227A",
    "PrecedesEqual;": "\u2AAF",
    "PrecedesSlantEqual;": "\u227C",
    "PrecedesTilde;": "\u227E",
    "preceq;": "\u2AAF",
    "precnapprox;": "\u2AB9",
    "precneqq;": "\u2AB5",
    "precnsim;": "\u22E8",
    "precsim;": "\u227E",
    "Prime;": "\u2033",
    "prime;": "\u2032",
    "primes;": "\u2119",
    "prnap;": "\u2AB9",
    "prnE;": "\u2AB5",
    "prnsim;": "\u22E8",
    "prod;": "\u220F",
    "Product;": "\u220F",
    "profalar;": "\u232E",
    "profline;": "\u2312",
    "profsurf;": "\u2313",
    "prop;": "\u221D",
    "Proportion;": "\u2237",
    "Proportional;": "\u221D",
    "propto;": "\u221D",
    "prsim;": "\u227E",
    "prurel;": "\u22B0",
    "Pscr;": "\uD835\uDCAB",
    "pscr;": "\uD835\uDCC5",
    "Psi;": "\u03A8",
    "psi;": "\u03C8",
    "puncsp;": "\u2008",
    "Qfr;": "\uD835\uDD14",
    "qfr;": "\uD835\uDD2E",
    "qint;": "\u2A0C",
    "Qopf;": "\u211A",
    "qopf;": "\uD835\uDD62",
    "qprime;": "\u2057",
    "Qscr;": "\uD835\uDCAC",
    "qscr;": "\uD835\uDCC6",
    "quaternions;": "\u210D",
    "quatint;": "\u2A16",
    "quest;": "?",
    "questeq;": "\u225F",
    "QUOT;": "\"",
    "QUOT": "\"",
    "quot;": "\"",
    "quot": "\"",
    "rAarr;": "\u21DB",
    "race;": "\u223D\u0331",
    "Racute;": "\u0154",
    "racute;": "\u0155",
    "radic;": "\u221A",
    "raemptyv;": "\u29B3",
    "Rang;": "\u27EB",
    "rang;": "\u27E9",
    "rangd;": "\u2992",
    "range;": "\u29A5",
    "rangle;": "\u27E9",
    "raquo;": "\u00BB",
    "raquo": "\u00BB",
    "Rarr;": "\u21A0",
    "rArr;": "\u21D2",
    "rarr;": "\u2192",
    "rarrap;": "\u2975",
    "rarrb;": "\u21E5",
    "rarrbfs;": "\u2920",
    "rarrc;": "\u2933",
    "rarrfs;": "\u291E",
    "rarrhk;": "\u21AA",
    "rarrlp;": "\u21AC",
    "rarrpl;": "\u2945",
    "rarrsim;": "\u2974",
    "Rarrtl;": "\u2916",
    "rarrtl;": "\u21A3",
    "rarrw;": "\u219D",
    "rAtail;": "\u291C",
    "ratail;": "\u291A",
    "ratio;": "\u2236",
    "rationals;": "\u211A",
    "RBarr;": "\u2910",
    "rBarr;": "\u290F",
    "rbarr;": "\u290D",
    "rbbrk;": "\u2773",
    "rbrace;": "}",
    "rbrack;": "]",
    "rbrke;": "\u298C",
    "rbrksld;": "\u298E",
    "rbrkslu;": "\u2990",
    "Rcaron;": "\u0158",
    "rcaron;": "\u0159",
    "Rcedil;": "\u0156",
    "rcedil;": "\u0157",
    "rceil;": "\u2309",
    "rcub;": "}",
    "Rcy;": "\u0420",
    "rcy;": "\u0440",
    "rdca;": "\u2937",
    "rdldhar;": "\u2969",
    "rdquo;": "\u201D",
    "rdquor;": "\u201D",
    "rdsh;": "\u21B3",
    "Re;": "\u211C",
    "real;": "\u211C",
    "realine;": "\u211B",
    "realpart;": "\u211C",
    "reals;": "\u211D",
    "rect;": "\u25AD",
    "REG;": "\u00AE",
    "REG": "\u00AE",
    "reg;": "\u00AE",
    "reg": "\u00AE",
    "ReverseElement;": "\u220B",
    "ReverseEquilibrium;": "\u21CB",
    "ReverseUpEquilibrium;": "\u296F",
    "rfisht;": "\u297D",
    "rfloor;": "\u230B",
    "Rfr;": "\u211C",
    "rfr;": "\uD835\uDD2F",
    "rHar;": "\u2964",
    "rhard;": "\u21C1",
    "rharu;": "\u21C0",
    "rharul;": "\u296C",
    "Rho;": "\u03A1",
    "rho;": "\u03C1",
    "rhov;": "\u03F1",
    "RightAngleBracket;": "\u27E9",
    "RightArrow;": "\u2192",
    "Rightarrow;": "\u21D2",
    "rightarrow;": "\u2192",
    "RightArrowBar;": "\u21E5",
    "RightArrowLeftArrow;": "\u21C4",
    "rightarrowtail;": "\u21A3",
    "RightCeiling;": "\u2309",
    "RightDoubleBracket;": "\u27E7",
    "RightDownTeeVector;": "\u295D",
    "RightDownVector;": "\u21C2",
    "RightDownVectorBar;": "\u2955",
    "RightFloor;": "\u230B",
    "rightharpoondown;": "\u21C1",
    "rightharpoonup;": "\u21C0",
    "rightleftarrows;": "\u21C4",
    "rightleftharpoons;": "\u21CC",
    "rightrightarrows;": "\u21C9",
    "rightsquigarrow;": "\u219D",
    "RightTee;": "\u22A2",
    "RightTeeArrow;": "\u21A6",
    "RightTeeVector;": "\u295B",
    "rightthreetimes;": "\u22CC",
    "RightTriangle;": "\u22B3",
    "RightTriangleBar;": "\u29D0",
    "RightTriangleEqual;": "\u22B5",
    "RightUpDownVector;": "\u294F",
    "RightUpTeeVector;": "\u295C",
    "RightUpVector;": "\u21BE",
    "RightUpVectorBar;": "\u2954",
    "RightVector;": "\u21C0",
    "RightVectorBar;": "\u2953",
    "ring;": "\u02DA",
    "risingdotseq;": "\u2253",
    "rlarr;": "\u21C4",
    "rlhar;": "\u21CC",
    "rlm;": "\u200F",
    "rmoust;": "\u23B1",
    "rmoustache;": "\u23B1",
    "rnmid;": "\u2AEE",
    "roang;": "\u27ED",
    "roarr;": "\u21FE",
    "robrk;": "\u27E7",
    "ropar;": "\u2986",
    "Ropf;": "\u211D",
    "ropf;": "\uD835\uDD63",
    "roplus;": "\u2A2E",
    "rotimes;": "\u2A35",
    "RoundImplies;": "\u2970",
    "rpar;": ")",
    "rpargt;": "\u2994",
    "rppolint;": "\u2A12",
    "rrarr;": "\u21C9",
    "Rrightarrow;": "\u21DB",
    "rsaquo;": "\u203A",
    "Rscr;": "\u211B",
    "rscr;": "\uD835\uDCC7",
    "Rsh;": "\u21B1",
    "rsh;": "\u21B1",
    "rsqb;": "]",
    "rsquo;": "\u2019",
    "rsquor;": "\u2019",
    "rthree;": "\u22CC",
    "rtimes;": "\u22CA",
    "rtri;": "\u25B9",
    "rtrie;": "\u22B5",
    "rtrif;": "\u25B8",
    "rtriltri;": "\u29CE",
    "RuleDelayed;": "\u29F4",
    "ruluhar;": "\u2968",
    "rx;": "\u211E",
    "Sacute;": "\u015A",
    "sacute;": "\u015B",
    "sbquo;": "\u201A",
    "Sc;": "\u2ABC",
    "sc;": "\u227B",
    "scap;": "\u2AB8",
    "Scaron;": "\u0160",
    "scaron;": "\u0161",
    "sccue;": "\u227D",
    "scE;": "\u2AB4",
    "sce;": "\u2AB0",
    "Scedil;": "\u015E",
    "scedil;": "\u015F",
    "Scirc;": "\u015C",
    "scirc;": "\u015D",
    "scnap;": "\u2ABA",
    "scnE;": "\u2AB6",
    "scnsim;": "\u22E9",
    "scpolint;": "\u2A13",
    "scsim;": "\u227F",
    "Scy;": "\u0421",
    "scy;": "\u0441",
    "sdot;": "\u22C5",
    "sdotb;": "\u22A1",
    "sdote;": "\u2A66",
    "searhk;": "\u2925",
    "seArr;": "\u21D8",
    "searr;": "\u2198",
    "searrow;": "\u2198",
    "sect;": "\u00A7",
    "sect": "\u00A7",
    "semi;": ";",
    "seswar;": "\u2929",
    "setminus;": "\u2216",
    "setmn;": "\u2216",
    "sext;": "\u2736",
    "Sfr;": "\uD835\uDD16",
    "sfr;": "\uD835\uDD30",
    "sfrown;": "\u2322",
    "sharp;": "\u266F",
    "SHCHcy;": "\u0429",
    "shchcy;": "\u0449",
    "SHcy;": "\u0428",
    "shcy;": "\u0448",
    "ShortDownArrow;": "\u2193",
    "ShortLeftArrow;": "\u2190",
    "shortmid;": "\u2223",
    "shortparallel;": "\u2225",
    "ShortRightArrow;": "\u2192",
    "ShortUpArrow;": "\u2191",
    "shy;": "\u00AD",
    "shy": "\u00AD",
    "Sigma;": "\u03A3",
    "sigma;": "\u03C3",
    "sigmaf;": "\u03C2",
    "sigmav;": "\u03C2",
    "sim;": "\u223C",
    "simdot;": "\u2A6A",
    "sime;": "\u2243",
    "simeq;": "\u2243",
    "simg;": "\u2A9E",
    "simgE;": "\u2AA0",
    "siml;": "\u2A9D",
    "simlE;": "\u2A9F",
    "simne;": "\u2246",
    "simplus;": "\u2A24",
    "simrarr;": "\u2972",
    "slarr;": "\u2190",
    "SmallCircle;": "\u2218",
    "smallsetminus;": "\u2216",
    "smashp;": "\u2A33",
    "smeparsl;": "\u29E4",
    "smid;": "\u2223",
    "smile;": "\u2323",
    "smt;": "\u2AAA",
    "smte;": "\u2AAC",
    "smtes;": "\u2AAC\uFE00",
    "SOFTcy;": "\u042C",
    "softcy;": "\u044C",
    "sol;": "/",
    "solb;": "\u29C4",
    "solbar;": "\u233F",
    "Sopf;": "\uD835\uDD4A",
    "sopf;": "\uD835\uDD64",
    "spades;": "\u2660",
    "spadesuit;": "\u2660",
    "spar;": "\u2225",
    "sqcap;": "\u2293",
    "sqcaps;": "\u2293\uFE00",
    "sqcup;": "\u2294",
    "sqcups;": "\u2294\uFE00",
    "Sqrt;": "\u221A",
    "sqsub;": "\u228F",
    "sqsube;": "\u2291",
    "sqsubset;": "\u228F",
    "sqsubseteq;": "\u2291",
    "sqsup;": "\u2290",
    "sqsupe;": "\u2292",
    "sqsupset;": "\u2290",
    "sqsupseteq;": "\u2292",
    "squ;": "\u25A1",
    "Square;": "\u25A1",
    "square;": "\u25A1",
    "SquareIntersection;": "\u2293",
    "SquareSubset;": "\u228F",
    "SquareSubsetEqual;": "\u2291",
    "SquareSuperset;": "\u2290",
    "SquareSupersetEqual;": "\u2292",
    "SquareUnion;": "\u2294",
    "squarf;": "\u25AA",
    "squf;": "\u25AA",
    "srarr;": "\u2192",
    "Sscr;": "\uD835\uDCAE",
    "sscr;": "\uD835\uDCC8",
    "ssetmn;": "\u2216",
    "ssmile;": "\u2323",
    "sstarf;": "\u22C6",
    "Star;": "\u22C6",
    "star;": "\u2606",
    "starf;": "\u2605",
    "straightepsilon;": "\u03F5",
    "straightphi;": "\u03D5",
    "strns;": "\u00AF",
    "Sub;": "\u22D0",
    "sub;": "\u2282",
    "subdot;": "\u2ABD",
    "subE;": "\u2AC5",
    "sube;": "\u2286",
    "subedot;": "\u2AC3",
    "submult;": "\u2AC1",
    "subnE;": "\u2ACB",
    "subne;": "\u228A",
    "subplus;": "\u2ABF",
    "subrarr;": "\u2979",
    "Subset;": "\u22D0",
    "subset;": "\u2282",
    "subseteq;": "\u2286",
    "subseteqq;": "\u2AC5",
    "SubsetEqual;": "\u2286",
    "subsetneq;": "\u228A",
    "subsetneqq;": "\u2ACB",
    "subsim;": "\u2AC7",
    "subsub;": "\u2AD5",
    "subsup;": "\u2AD3",
    "succ;": "\u227B",
    "succapprox;": "\u2AB8",
    "succcurlyeq;": "\u227D",
    "Succeeds;": "\u227B",
    "SucceedsEqual;": "\u2AB0",
    "SucceedsSlantEqual;": "\u227D",
    "SucceedsTilde;": "\u227F",
    "succeq;": "\u2AB0",
    "succnapprox;": "\u2ABA",
    "succneqq;": "\u2AB6",
    "succnsim;": "\u22E9",
    "succsim;": "\u227F",
    "SuchThat;": "\u220B",
    "Sum;": "\u2211",
    "sum;": "\u2211",
    "sung;": "\u266A",
    "Sup;": "\u22D1",
    "sup;": "\u2283",
    "sup1;": "\u00B9",
    "sup1": "\u00B9",
    "sup2;": "\u00B2",
    "sup2": "\u00B2",
    "sup3;": "\u00B3",
    "sup3": "\u00B3",
    "supdot;": "\u2ABE",
    "supdsub;": "\u2AD8",
    "supE;": "\u2AC6",
    "supe;": "\u2287",
    "supedot;": "\u2AC4",
    "Superset;": "\u2283",
    "SupersetEqual;": "\u2287",
    "suphsol;": "\u27C9",
    "suphsub;": "\u2AD7",
    "suplarr;": "\u297B",
    "supmult;": "\u2AC2",
    "supnE;": "\u2ACC",
    "supne;": "\u228B",
    "supplus;": "\u2AC0",
    "Supset;": "\u22D1",
    "supset;": "\u2283",
    "supseteq;": "\u2287",
    "supseteqq;": "\u2AC6",
    "supsetneq;": "\u228B",
    "supsetneqq;": "\u2ACC",
    "supsim;": "\u2AC8",
    "supsub;": "\u2AD4",
    "supsup;": "\u2AD6",
    "swarhk;": "\u2926",
    "swArr;": "\u21D9",
    "swarr;": "\u2199",
    "swarrow;": "\u2199",
    "swnwar;": "\u292A",
    "szlig;": "\u00DF",
    "szlig": "\u00DF",
    "Tab;": "\t",
    "target;": "\u2316",
    "Tau;": "\u03A4",
    "tau;": "\u03C4",
    "tbrk;": "\u23B4",
    "Tcaron;": "\u0164",
    "tcaron;": "\u0165",
    "Tcedil;": "\u0162",
    "tcedil;": "\u0163",
    "Tcy;": "\u0422",
    "tcy;": "\u0442",
    "tdot;": "\u20DB",
    "telrec;": "\u2315",
    "Tfr;": "\uD835\uDD17",
    "tfr;": "\uD835\uDD31",
    "there4;": "\u2234",
    "Therefore;": "\u2234",
    "therefore;": "\u2234",
    "Theta;": "\u0398",
    "theta;": "\u03B8",
    "thetasym;": "\u03D1",
    "thetav;": "\u03D1",
    "thickapprox;": "\u2248",
    "thicksim;": "\u223C",
    "ThickSpace;": "\u205F\u200A",
    "thinsp;": "\u2009",
    "ThinSpace;": "\u2009",
    "thkap;": "\u2248",
    "thksim;": "\u223C",
    "THORN;": "\u00DE",
    "THORN": "\u00DE",
    "thorn;": "\u00FE",
    "thorn": "\u00FE",
    "Tilde;": "\u223C",
    "tilde;": "\u02DC",
    "TildeEqual;": "\u2243",
    "TildeFullEqual;": "\u2245",
    "TildeTilde;": "\u2248",
    "times;": "\u00D7",
    "times": "\u00D7",
    "timesb;": "\u22A0",
    "timesbar;": "\u2A31",
    "timesd;": "\u2A30",
    "tint;": "\u222D",
    "toea;": "\u2928",
    "top;": "\u22A4",
    "topbot;": "\u2336",
    "topcir;": "\u2AF1",
    "Topf;": "\uD835\uDD4B",
    "topf;": "\uD835\uDD65",
    "topfork;": "\u2ADA",
    "tosa;": "\u2929",
    "tprime;": "\u2034",
    "TRADE;": "\u2122",
    "trade;": "\u2122",
    "triangle;": "\u25B5",
    "triangledown;": "\u25BF",
    "triangleleft;": "\u25C3",
    "trianglelefteq;": "\u22B4",
    "triangleq;": "\u225C",
    "triangleright;": "\u25B9",
    "trianglerighteq;": "\u22B5",
    "tridot;": "\u25EC",
    "trie;": "\u225C",
    "triminus;": "\u2A3A",
    "TripleDot;": "\u20DB",
    "triplus;": "\u2A39",
    "trisb;": "\u29CD",
    "tritime;": "\u2A3B",
    "trpezium;": "\u23E2",
    "Tscr;": "\uD835\uDCAF",
    "tscr;": "\uD835\uDCC9",
    "TScy;": "\u0426",
    "tscy;": "\u0446",
    "TSHcy;": "\u040B",
    "tshcy;": "\u045B",
    "Tstrok;": "\u0166",
    "tstrok;": "\u0167",
    "twixt;": "\u226C",
    "twoheadleftarrow;": "\u219E",
    "twoheadrightarrow;": "\u21A0",
    "Uacute;": "\u00DA",
    "Uacute": "\u00DA",
    "uacute;": "\u00FA",
    "uacute": "\u00FA",
    "Uarr;": "\u219F",
    "uArr;": "\u21D1",
    "uarr;": "\u2191",
    "Uarrocir;": "\u2949",
    "Ubrcy;": "\u040E",
    "ubrcy;": "\u045E",
    "Ubreve;": "\u016C",
    "ubreve;": "\u016D",
    "Ucirc;": "\u00DB",
    "Ucirc": "\u00DB",
    "ucirc;": "\u00FB",
    "ucirc": "\u00FB",
    "Ucy;": "\u0423",
    "ucy;": "\u0443",
    "udarr;": "\u21C5",
    "Udblac;": "\u0170",
    "udblac;": "\u0171",
    "udhar;": "\u296E",
    "ufisht;": "\u297E",
    "Ufr;": "\uD835\uDD18",
    "ufr;": "\uD835\uDD32",
    "Ugrave;": "\u00D9",
    "Ugrave": "\u00D9",
    "ugrave;": "\u00F9",
    "ugrave": "\u00F9",
    "uHar;": "\u2963",
    "uharl;": "\u21BF",
    "uharr;": "\u21BE",
    "uhblk;": "\u2580",
    "ulcorn;": "\u231C",
    "ulcorner;": "\u231C",
    "ulcrop;": "\u230F",
    "ultri;": "\u25F8",
    "Umacr;": "\u016A",
    "umacr;": "\u016B",
    "uml;": "\u00A8",
    "uml": "\u00A8",
    "UnderBar;": "_",
    "UnderBrace;": "\u23DF",
    "UnderBracket;": "\u23B5",
    "UnderParenthesis;": "\u23DD",
    "Union;": "\u22C3",
    "UnionPlus;": "\u228E",
    "Uogon;": "\u0172",
    "uogon;": "\u0173",
    "Uopf;": "\uD835\uDD4C",
    "uopf;": "\uD835\uDD66",
    "UpArrow;": "\u2191",
    "Uparrow;": "\u21D1",
    "uparrow;": "\u2191",
    "UpArrowBar;": "\u2912",
    "UpArrowDownArrow;": "\u21C5",
    "UpDownArrow;": "\u2195",
    "Updownarrow;": "\u21D5",
    "updownarrow;": "\u2195",
    "UpEquilibrium;": "\u296E",
    "upharpoonleft;": "\u21BF",
    "upharpoonright;": "\u21BE",
    "uplus;": "\u228E",
    "UpperLeftArrow;": "\u2196",
    "UpperRightArrow;": "\u2197",
    "Upsi;": "\u03D2",
    "upsi;": "\u03C5",
    "upsih;": "\u03D2",
    "Upsilon;": "\u03A5",
    "upsilon;": "\u03C5",
    "UpTee;": "\u22A5",
    "UpTeeArrow;": "\u21A5",
    "upuparrows;": "\u21C8",
    "urcorn;": "\u231D",
    "urcorner;": "\u231D",
    "urcrop;": "\u230E",
    "Uring;": "\u016E",
    "uring;": "\u016F",
    "urtri;": "\u25F9",
    "Uscr;": "\uD835\uDCB0",
    "uscr;": "\uD835\uDCCA",
    "utdot;": "\u22F0",
    "Utilde;": "\u0168",
    "utilde;": "\u0169",
    "utri;": "\u25B5",
    "utrif;": "\u25B4",
    "uuarr;": "\u21C8",
    "Uuml;": "\u00DC",
    "Uuml": "\u00DC",
    "uuml;": "\u00FC",
    "uuml": "\u00FC",
    "uwangle;": "\u29A7",
    "vangrt;": "\u299C",
    "varepsilon;": "\u03F5",
    "varkappa;": "\u03F0",
    "varnothing;": "\u2205",
    "varphi;": "\u03D5",
    "varpi;": "\u03D6",
    "varpropto;": "\u221D",
    "vArr;": "\u21D5",
    "varr;": "\u2195",
    "varrho;": "\u03F1",
    "varsigma;": "\u03C2",
    "varsubsetneq;": "\u228A\uFE00",
    "varsubsetneqq;": "\u2ACB\uFE00",
    "varsupsetneq;": "\u228B\uFE00",
    "varsupsetneqq;": "\u2ACC\uFE00",
    "vartheta;": "\u03D1",
    "vartriangleleft;": "\u22B2",
    "vartriangleright;": "\u22B3",
    "Vbar;": "\u2AEB",
    "vBar;": "\u2AE8",
    "vBarv;": "\u2AE9",
    "Vcy;": "\u0412",
    "vcy;": "\u0432",
    "VDash;": "\u22AB",
    "Vdash;": "\u22A9",
    "vDash;": "\u22A8",
    "vdash;": "\u22A2",
    "Vdashl;": "\u2AE6",
    "Vee;": "\u22C1",
    "vee;": "\u2228",
    "veebar;": "\u22BB",
    "veeeq;": "\u225A",
    "vellip;": "\u22EE",
    "Verbar;": "\u2016",
    "verbar;": "|",
    "Vert;": "\u2016",
    "vert;": "|",
    "VerticalBar;": "\u2223",
    "VerticalLine;": "|",
    "VerticalSeparator;": "\u2758",
    "VerticalTilde;": "\u2240",
    "VeryThinSpace;": "\u200A",
    "Vfr;": "\uD835\uDD19",
    "vfr;": "\uD835\uDD33",
    "vltri;": "\u22B2",
    "vnsub;": "\u2282\u20D2",
    "vnsup;": "\u2283\u20D2",
    "Vopf;": "\uD835\uDD4D",
    "vopf;": "\uD835\uDD67",
    "vprop;": "\u221D",
    "vrtri;": "\u22B3",
    "Vscr;": "\uD835\uDCB1",
    "vscr;": "\uD835\uDCCB",
    "vsubnE;": "\u2ACB\uFE00",
    "vsubne;": "\u228A\uFE00",
    "vsupnE;": "\u2ACC\uFE00",
    "vsupne;": "\u228B\uFE00",
    "Vvdash;": "\u22AA",
    "vzigzag;": "\u299A",
    "Wcirc;": "\u0174",
    "wcirc;": "\u0175",
    "wedbar;": "\u2A5F",
    "Wedge;": "\u22C0",
    "wedge;": "\u2227",
    "wedgeq;": "\u2259",
    "weierp;": "\u2118",
    "Wfr;": "\uD835\uDD1A",
    "wfr;": "\uD835\uDD34",
    "Wopf;": "\uD835\uDD4E",
    "wopf;": "\uD835\uDD68",
    "wp;": "\u2118",
    "wr;": "\u2240",
    "wreath;": "\u2240",
    "Wscr;": "\uD835\uDCB2",
    "wscr;": "\uD835\uDCCC",
    "xcap;": "\u22C2",
    "xcirc;": "\u25EF",
    "xcup;": "\u22C3",
    "xdtri;": "\u25BD",
    "Xfr;": "\uD835\uDD1B",
    "xfr;": "\uD835\uDD35",
    "xhArr;": "\u27FA",
    "xharr;": "\u27F7",
    "Xi;": "\u039E",
    "xi;": "\u03BE",
    "xlArr;": "\u27F8",
    "xlarr;": "\u27F5",
    "xmap;": "\u27FC",
    "xnis;": "\u22FB",
    "xodot;": "\u2A00",
    "Xopf;": "\uD835\uDD4F",
    "xopf;": "\uD835\uDD69",
    "xoplus;": "\u2A01",
    "xotime;": "\u2A02",
    "xrArr;": "\u27F9",
    "xrarr;": "\u27F6",
    "Xscr;": "\uD835\uDCB3",
    "xscr;": "\uD835\uDCCD",
    "xsqcup;": "\u2A06",
    "xuplus;": "\u2A04",
    "xutri;": "\u25B3",
    "xvee;": "\u22C1",
    "xwedge;": "\u22C0",
    "Yacute;": "\u00DD",
    "Yacute": "\u00DD",
    "yacute;": "\u00FD",
    "yacute": "\u00FD",
    "YAcy;": "\u042F",
    "yacy;": "\u044F",
    "Ycirc;": "\u0176",
    "ycirc;": "\u0177",
    "Ycy;": "\u042B",
    "ycy;": "\u044B",
    "yen;": "\u00A5",
    "yen": "\u00A5",
    "Yfr;": "\uD835\uDD1C",
    "yfr;": "\uD835\uDD36",
    "YIcy;": "\u0407",
    "yicy;": "\u0457",
    "Yopf;": "\uD835\uDD50",
    "yopf;": "\uD835\uDD6A",
    "Yscr;": "\uD835\uDCB4",
    "yscr;": "\uD835\uDCCE",
    "YUcy;": "\u042E",
    "yucy;": "\u044E",
    "Yuml;": "\u0178",
    "yuml;": "\u00FF",
    "yuml": "\u00FF",
    "Zacute;": "\u0179",
    "zacute;": "\u017A",
    "Zcaron;": "\u017D",
    "zcaron;": "\u017E",
    "Zcy;": "\u0417",
    "zcy;": "\u0437",
    "Zdot;": "\u017B",
    "zdot;": "\u017C",
    "zeetrf;": "\u2128",
    "ZeroWidthSpace;": "\u200B",
    "Zeta;": "\u0396",
    "zeta;": "\u03B6",
    "Zfr;": "\u2128",
    "zfr;": "\uD835\uDD37",
    "ZHcy;": "\u0416",
    "zhcy;": "\u0436",
    "zigrarr;": "\u21DD",
    "Zopf;": "\u2124",
    "zopf;": "\uD835\uDD6B",
    "Zscr;": "\uD835\uDCB5",
    "zscr;": "\uD835\uDCCF",
    "zwj;": "\u200D",
    "zwnj;": "\u200C"
}
},{}],10:[function(require,module,exports){
exports.encode = require('./encode');
exports.decode = require('./decode');

},{"./decode":7,"./encode":8}],11:[function(require,module,exports){
module.exports={
    "9": "Tab;",
    "10": "NewLine;",
    "33": "excl;",
    "34": "quot;",
    "35": "num;",
    "36": "dollar;",
    "37": "percnt;",
    "38": "amp;",
    "39": "apos;",
    "40": "lpar;",
    "41": "rpar;",
    "42": "midast;",
    "43": "plus;",
    "44": "comma;",
    "46": "period;",
    "47": "sol;",
    "58": "colon;",
    "59": "semi;",
    "60": "lt;",
    "61": "equals;",
    "62": "gt;",
    "63": "quest;",
    "64": "commat;",
    "91": "lsqb;",
    "92": "bsol;",
    "93": "rsqb;",
    "94": "Hat;",
    "95": "UnderBar;",
    "96": "grave;",
    "123": "lcub;",
    "124": "VerticalLine;",
    "125": "rcub;",
    "160": "NonBreakingSpace;",
    "161": "iexcl;",
    "162": "cent;",
    "163": "pound;",
    "164": "curren;",
    "165": "yen;",
    "166": "brvbar;",
    "167": "sect;",
    "168": "uml;",
    "169": "copy;",
    "170": "ordf;",
    "171": "laquo;",
    "172": "not;",
    "173": "shy;",
    "174": "reg;",
    "175": "strns;",
    "176": "deg;",
    "177": "pm;",
    "178": "sup2;",
    "179": "sup3;",
    "180": "DiacriticalAcute;",
    "181": "micro;",
    "182": "para;",
    "183": "middot;",
    "184": "Cedilla;",
    "185": "sup1;",
    "186": "ordm;",
    "187": "raquo;",
    "188": "frac14;",
    "189": "half;",
    "190": "frac34;",
    "191": "iquest;",
    "192": "Agrave;",
    "193": "Aacute;",
    "194": "Acirc;",
    "195": "Atilde;",
    "196": "Auml;",
    "197": "Aring;",
    "198": "AElig;",
    "199": "Ccedil;",
    "200": "Egrave;",
    "201": "Eacute;",
    "202": "Ecirc;",
    "203": "Euml;",
    "204": "Igrave;",
    "205": "Iacute;",
    "206": "Icirc;",
    "207": "Iuml;",
    "208": "ETH;",
    "209": "Ntilde;",
    "210": "Ograve;",
    "211": "Oacute;",
    "212": "Ocirc;",
    "213": "Otilde;",
    "214": "Ouml;",
    "215": "times;",
    "216": "Oslash;",
    "217": "Ugrave;",
    "218": "Uacute;",
    "219": "Ucirc;",
    "220": "Uuml;",
    "221": "Yacute;",
    "222": "THORN;",
    "223": "szlig;",
    "224": "agrave;",
    "225": "aacute;",
    "226": "acirc;",
    "227": "atilde;",
    "228": "auml;",
    "229": "aring;",
    "230": "aelig;",
    "231": "ccedil;",
    "232": "egrave;",
    "233": "eacute;",
    "234": "ecirc;",
    "235": "euml;",
    "236": "igrave;",
    "237": "iacute;",
    "238": "icirc;",
    "239": "iuml;",
    "240": "eth;",
    "241": "ntilde;",
    "242": "ograve;",
    "243": "oacute;",
    "244": "ocirc;",
    "245": "otilde;",
    "246": "ouml;",
    "247": "divide;",
    "248": "oslash;",
    "249": "ugrave;",
    "250": "uacute;",
    "251": "ucirc;",
    "252": "uuml;",
    "253": "yacute;",
    "254": "thorn;",
    "255": "yuml;",
    "256": "Amacr;",
    "257": "amacr;",
    "258": "Abreve;",
    "259": "abreve;",
    "260": "Aogon;",
    "261": "aogon;",
    "262": "Cacute;",
    "263": "cacute;",
    "264": "Ccirc;",
    "265": "ccirc;",
    "266": "Cdot;",
    "267": "cdot;",
    "268": "Ccaron;",
    "269": "ccaron;",
    "270": "Dcaron;",
    "271": "dcaron;",
    "272": "Dstrok;",
    "273": "dstrok;",
    "274": "Emacr;",
    "275": "emacr;",
    "278": "Edot;",
    "279": "edot;",
    "280": "Eogon;",
    "281": "eogon;",
    "282": "Ecaron;",
    "283": "ecaron;",
    "284": "Gcirc;",
    "285": "gcirc;",
    "286": "Gbreve;",
    "287": "gbreve;",
    "288": "Gdot;",
    "289": "gdot;",
    "290": "Gcedil;",
    "292": "Hcirc;",
    "293": "hcirc;",
    "294": "Hstrok;",
    "295": "hstrok;",
    "296": "Itilde;",
    "297": "itilde;",
    "298": "Imacr;",
    "299": "imacr;",
    "302": "Iogon;",
    "303": "iogon;",
    "304": "Idot;",
    "305": "inodot;",
    "306": "IJlig;",
    "307": "ijlig;",
    "308": "Jcirc;",
    "309": "jcirc;",
    "310": "Kcedil;",
    "311": "kcedil;",
    "312": "kgreen;",
    "313": "Lacute;",
    "314": "lacute;",
    "315": "Lcedil;",
    "316": "lcedil;",
    "317": "Lcaron;",
    "318": "lcaron;",
    "319": "Lmidot;",
    "320": "lmidot;",
    "321": "Lstrok;",
    "322": "lstrok;",
    "323": "Nacute;",
    "324": "nacute;",
    "325": "Ncedil;",
    "326": "ncedil;",
    "327": "Ncaron;",
    "328": "ncaron;",
    "329": "napos;",
    "330": "ENG;",
    "331": "eng;",
    "332": "Omacr;",
    "333": "omacr;",
    "336": "Odblac;",
    "337": "odblac;",
    "338": "OElig;",
    "339": "oelig;",
    "340": "Racute;",
    "341": "racute;",
    "342": "Rcedil;",
    "343": "rcedil;",
    "344": "Rcaron;",
    "345": "rcaron;",
    "346": "Sacute;",
    "347": "sacute;",
    "348": "Scirc;",
    "349": "scirc;",
    "350": "Scedil;",
    "351": "scedil;",
    "352": "Scaron;",
    "353": "scaron;",
    "354": "Tcedil;",
    "355": "tcedil;",
    "356": "Tcaron;",
    "357": "tcaron;",
    "358": "Tstrok;",
    "359": "tstrok;",
    "360": "Utilde;",
    "361": "utilde;",
    "362": "Umacr;",
    "363": "umacr;",
    "364": "Ubreve;",
    "365": "ubreve;",
    "366": "Uring;",
    "367": "uring;",
    "368": "Udblac;",
    "369": "udblac;",
    "370": "Uogon;",
    "371": "uogon;",
    "372": "Wcirc;",
    "373": "wcirc;",
    "374": "Ycirc;",
    "375": "ycirc;",
    "376": "Yuml;",
    "377": "Zacute;",
    "378": "zacute;",
    "379": "Zdot;",
    "380": "zdot;",
    "381": "Zcaron;",
    "382": "zcaron;",
    "402": "fnof;",
    "437": "imped;",
    "501": "gacute;",
    "567": "jmath;",
    "710": "circ;",
    "711": "Hacek;",
    "728": "breve;",
    "729": "dot;",
    "730": "ring;",
    "731": "ogon;",
    "732": "tilde;",
    "733": "DiacriticalDoubleAcute;",
    "785": "DownBreve;",
    "913": "Alpha;",
    "914": "Beta;",
    "915": "Gamma;",
    "916": "Delta;",
    "917": "Epsilon;",
    "918": "Zeta;",
    "919": "Eta;",
    "920": "Theta;",
    "921": "Iota;",
    "922": "Kappa;",
    "923": "Lambda;",
    "924": "Mu;",
    "925": "Nu;",
    "926": "Xi;",
    "927": "Omicron;",
    "928": "Pi;",
    "929": "Rho;",
    "931": "Sigma;",
    "932": "Tau;",
    "933": "Upsilon;",
    "934": "Phi;",
    "935": "Chi;",
    "936": "Psi;",
    "937": "Omega;",
    "945": "alpha;",
    "946": "beta;",
    "947": "gamma;",
    "948": "delta;",
    "949": "epsilon;",
    "950": "zeta;",
    "951": "eta;",
    "952": "theta;",
    "953": "iota;",
    "954": "kappa;",
    "955": "lambda;",
    "956": "mu;",
    "957": "nu;",
    "958": "xi;",
    "959": "omicron;",
    "960": "pi;",
    "961": "rho;",
    "962": "varsigma;",
    "963": "sigma;",
    "964": "tau;",
    "965": "upsilon;",
    "966": "phi;",
    "967": "chi;",
    "968": "psi;",
    "969": "omega;",
    "977": "vartheta;",
    "978": "upsih;",
    "981": "varphi;",
    "982": "varpi;",
    "988": "Gammad;",
    "989": "gammad;",
    "1008": "varkappa;",
    "1009": "varrho;",
    "1013": "varepsilon;",
    "1014": "bepsi;",
    "1025": "IOcy;",
    "1026": "DJcy;",
    "1027": "GJcy;",
    "1028": "Jukcy;",
    "1029": "DScy;",
    "1030": "Iukcy;",
    "1031": "YIcy;",
    "1032": "Jsercy;",
    "1033": "LJcy;",
    "1034": "NJcy;",
    "1035": "TSHcy;",
    "1036": "KJcy;",
    "1038": "Ubrcy;",
    "1039": "DZcy;",
    "1040": "Acy;",
    "1041": "Bcy;",
    "1042": "Vcy;",
    "1043": "Gcy;",
    "1044": "Dcy;",
    "1045": "IEcy;",
    "1046": "ZHcy;",
    "1047": "Zcy;",
    "1048": "Icy;",
    "1049": "Jcy;",
    "1050": "Kcy;",
    "1051": "Lcy;",
    "1052": "Mcy;",
    "1053": "Ncy;",
    "1054": "Ocy;",
    "1055": "Pcy;",
    "1056": "Rcy;",
    "1057": "Scy;",
    "1058": "Tcy;",
    "1059": "Ucy;",
    "1060": "Fcy;",
    "1061": "KHcy;",
    "1062": "TScy;",
    "1063": "CHcy;",
    "1064": "SHcy;",
    "1065": "SHCHcy;",
    "1066": "HARDcy;",
    "1067": "Ycy;",
    "1068": "SOFTcy;",
    "1069": "Ecy;",
    "1070": "YUcy;",
    "1071": "YAcy;",
    "1072": "acy;",
    "1073": "bcy;",
    "1074": "vcy;",
    "1075": "gcy;",
    "1076": "dcy;",
    "1077": "iecy;",
    "1078": "zhcy;",
    "1079": "zcy;",
    "1080": "icy;",
    "1081": "jcy;",
    "1082": "kcy;",
    "1083": "lcy;",
    "1084": "mcy;",
    "1085": "ncy;",
    "1086": "ocy;",
    "1087": "pcy;",
    "1088": "rcy;",
    "1089": "scy;",
    "1090": "tcy;",
    "1091": "ucy;",
    "1092": "fcy;",
    "1093": "khcy;",
    "1094": "tscy;",
    "1095": "chcy;",
    "1096": "shcy;",
    "1097": "shchcy;",
    "1098": "hardcy;",
    "1099": "ycy;",
    "1100": "softcy;",
    "1101": "ecy;",
    "1102": "yucy;",
    "1103": "yacy;",
    "1105": "iocy;",
    "1106": "djcy;",
    "1107": "gjcy;",
    "1108": "jukcy;",
    "1109": "dscy;",
    "1110": "iukcy;",
    "1111": "yicy;",
    "1112": "jsercy;",
    "1113": "ljcy;",
    "1114": "njcy;",
    "1115": "tshcy;",
    "1116": "kjcy;",
    "1118": "ubrcy;",
    "1119": "dzcy;",
    "8194": "ensp;",
    "8195": "emsp;",
    "8196": "emsp13;",
    "8197": "emsp14;",
    "8199": "numsp;",
    "8200": "puncsp;",
    "8201": "ThinSpace;",
    "8202": "VeryThinSpace;",
    "8203": "ZeroWidthSpace;",
    "8204": "zwnj;",
    "8205": "zwj;",
    "8206": "lrm;",
    "8207": "rlm;",
    "8208": "hyphen;",
    "8211": "ndash;",
    "8212": "mdash;",
    "8213": "horbar;",
    "8214": "Vert;",
    "8216": "OpenCurlyQuote;",
    "8217": "rsquor;",
    "8218": "sbquo;",
    "8220": "OpenCurlyDoubleQuote;",
    "8221": "rdquor;",
    "8222": "ldquor;",
    "8224": "dagger;",
    "8225": "ddagger;",
    "8226": "bullet;",
    "8229": "nldr;",
    "8230": "mldr;",
    "8240": "permil;",
    "8241": "pertenk;",
    "8242": "prime;",
    "8243": "Prime;",
    "8244": "tprime;",
    "8245": "bprime;",
    "8249": "lsaquo;",
    "8250": "rsaquo;",
    "8254": "OverBar;",
    "8257": "caret;",
    "8259": "hybull;",
    "8260": "frasl;",
    "8271": "bsemi;",
    "8279": "qprime;",
    "8287": "MediumSpace;",
    "8288": "NoBreak;",
    "8289": "ApplyFunction;",
    "8290": "it;",
    "8291": "InvisibleComma;",
    "8364": "euro;",
    "8411": "TripleDot;",
    "8412": "DotDot;",
    "8450": "Copf;",
    "8453": "incare;",
    "8458": "gscr;",
    "8459": "Hscr;",
    "8460": "Poincareplane;",
    "8461": "quaternions;",
    "8462": "planckh;",
    "8463": "plankv;",
    "8464": "Iscr;",
    "8465": "imagpart;",
    "8466": "Lscr;",
    "8467": "ell;",
    "8469": "Nopf;",
    "8470": "numero;",
    "8471": "copysr;",
    "8472": "wp;",
    "8473": "primes;",
    "8474": "rationals;",
    "8475": "Rscr;",
    "8476": "Rfr;",
    "8477": "Ropf;",
    "8478": "rx;",
    "8482": "trade;",
    "8484": "Zopf;",
    "8487": "mho;",
    "8488": "Zfr;",
    "8489": "iiota;",
    "8492": "Bscr;",
    "8493": "Cfr;",
    "8495": "escr;",
    "8496": "expectation;",
    "8497": "Fscr;",
    "8499": "phmmat;",
    "8500": "oscr;",
    "8501": "aleph;",
    "8502": "beth;",
    "8503": "gimel;",
    "8504": "daleth;",
    "8517": "DD;",
    "8518": "DifferentialD;",
    "8519": "exponentiale;",
    "8520": "ImaginaryI;",
    "8531": "frac13;",
    "8532": "frac23;",
    "8533": "frac15;",
    "8534": "frac25;",
    "8535": "frac35;",
    "8536": "frac45;",
    "8537": "frac16;",
    "8538": "frac56;",
    "8539": "frac18;",
    "8540": "frac38;",
    "8541": "frac58;",
    "8542": "frac78;",
    "8592": "slarr;",
    "8593": "uparrow;",
    "8594": "srarr;",
    "8595": "ShortDownArrow;",
    "8596": "leftrightarrow;",
    "8597": "varr;",
    "8598": "UpperLeftArrow;",
    "8599": "UpperRightArrow;",
    "8600": "searrow;",
    "8601": "swarrow;",
    "8602": "nleftarrow;",
    "8603": "nrightarrow;",
    "8605": "rightsquigarrow;",
    "8606": "twoheadleftarrow;",
    "8607": "Uarr;",
    "8608": "twoheadrightarrow;",
    "8609": "Darr;",
    "8610": "leftarrowtail;",
    "8611": "rightarrowtail;",
    "8612": "mapstoleft;",
    "8613": "UpTeeArrow;",
    "8614": "RightTeeArrow;",
    "8615": "mapstodown;",
    "8617": "larrhk;",
    "8618": "rarrhk;",
    "8619": "looparrowleft;",
    "8620": "rarrlp;",
    "8621": "leftrightsquigarrow;",
    "8622": "nleftrightarrow;",
    "8624": "lsh;",
    "8625": "rsh;",
    "8626": "ldsh;",
    "8627": "rdsh;",
    "8629": "crarr;",
    "8630": "curvearrowleft;",
    "8631": "curvearrowright;",
    "8634": "olarr;",
    "8635": "orarr;",
    "8636": "lharu;",
    "8637": "lhard;",
    "8638": "upharpoonright;",
    "8639": "upharpoonleft;",
    "8640": "RightVector;",
    "8641": "rightharpoondown;",
    "8642": "RightDownVector;",
    "8643": "LeftDownVector;",
    "8644": "rlarr;",
    "8645": "UpArrowDownArrow;",
    "8646": "lrarr;",
    "8647": "llarr;",
    "8648": "uuarr;",
    "8649": "rrarr;",
    "8650": "downdownarrows;",
    "8651": "ReverseEquilibrium;",
    "8652": "rlhar;",
    "8653": "nLeftarrow;",
    "8654": "nLeftrightarrow;",
    "8655": "nRightarrow;",
    "8656": "Leftarrow;",
    "8657": "Uparrow;",
    "8658": "Rightarrow;",
    "8659": "Downarrow;",
    "8660": "Leftrightarrow;",
    "8661": "vArr;",
    "8662": "nwArr;",
    "8663": "neArr;",
    "8664": "seArr;",
    "8665": "swArr;",
    "8666": "Lleftarrow;",
    "8667": "Rrightarrow;",
    "8669": "zigrarr;",
    "8676": "LeftArrowBar;",
    "8677": "RightArrowBar;",
    "8693": "duarr;",
    "8701": "loarr;",
    "8702": "roarr;",
    "8703": "hoarr;",
    "8704": "forall;",
    "8705": "complement;",
    "8706": "PartialD;",
    "8707": "Exists;",
    "8708": "NotExists;",
    "8709": "varnothing;",
    "8711": "nabla;",
    "8712": "isinv;",
    "8713": "notinva;",
    "8715": "SuchThat;",
    "8716": "NotReverseElement;",
    "8719": "Product;",
    "8720": "Coproduct;",
    "8721": "sum;",
    "8722": "minus;",
    "8723": "mp;",
    "8724": "plusdo;",
    "8726": "ssetmn;",
    "8727": "lowast;",
    "8728": "SmallCircle;",
    "8730": "Sqrt;",
    "8733": "vprop;",
    "8734": "infin;",
    "8735": "angrt;",
    "8736": "angle;",
    "8737": "measuredangle;",
    "8738": "angsph;",
    "8739": "VerticalBar;",
    "8740": "nsmid;",
    "8741": "spar;",
    "8742": "nspar;",
    "8743": "wedge;",
    "8744": "vee;",
    "8745": "cap;",
    "8746": "cup;",
    "8747": "Integral;",
    "8748": "Int;",
    "8749": "tint;",
    "8750": "oint;",
    "8751": "DoubleContourIntegral;",
    "8752": "Cconint;",
    "8753": "cwint;",
    "8754": "cwconint;",
    "8755": "CounterClockwiseContourIntegral;",
    "8756": "therefore;",
    "8757": "because;",
    "8758": "ratio;",
    "8759": "Proportion;",
    "8760": "minusd;",
    "8762": "mDDot;",
    "8763": "homtht;",
    "8764": "Tilde;",
    "8765": "bsim;",
    "8766": "mstpos;",
    "8767": "acd;",
    "8768": "wreath;",
    "8769": "nsim;",
    "8770": "esim;",
    "8771": "TildeEqual;",
    "8772": "nsimeq;",
    "8773": "TildeFullEqual;",
    "8774": "simne;",
    "8775": "NotTildeFullEqual;",
    "8776": "TildeTilde;",
    "8777": "NotTildeTilde;",
    "8778": "approxeq;",
    "8779": "apid;",
    "8780": "bcong;",
    "8781": "CupCap;",
    "8782": "HumpDownHump;",
    "8783": "HumpEqual;",
    "8784": "esdot;",
    "8785": "eDot;",
    "8786": "fallingdotseq;",
    "8787": "risingdotseq;",
    "8788": "coloneq;",
    "8789": "eqcolon;",
    "8790": "eqcirc;",
    "8791": "cire;",
    "8793": "wedgeq;",
    "8794": "veeeq;",
    "8796": "trie;",
    "8799": "questeq;",
    "8800": "NotEqual;",
    "8801": "equiv;",
    "8802": "NotCongruent;",
    "8804": "leq;",
    "8805": "GreaterEqual;",
    "8806": "LessFullEqual;",
    "8807": "GreaterFullEqual;",
    "8808": "lneqq;",
    "8809": "gneqq;",
    "8810": "NestedLessLess;",
    "8811": "NestedGreaterGreater;",
    "8812": "twixt;",
    "8813": "NotCupCap;",
    "8814": "NotLess;",
    "8815": "NotGreater;",
    "8816": "NotLessEqual;",
    "8817": "NotGreaterEqual;",
    "8818": "lsim;",
    "8819": "gtrsim;",
    "8820": "NotLessTilde;",
    "8821": "NotGreaterTilde;",
    "8822": "lg;",
    "8823": "gtrless;",
    "8824": "ntlg;",
    "8825": "ntgl;",
    "8826": "Precedes;",
    "8827": "Succeeds;",
    "8828": "PrecedesSlantEqual;",
    "8829": "SucceedsSlantEqual;",
    "8830": "prsim;",
    "8831": "succsim;",
    "8832": "nprec;",
    "8833": "nsucc;",
    "8834": "subset;",
    "8835": "supset;",
    "8836": "nsub;",
    "8837": "nsup;",
    "8838": "SubsetEqual;",
    "8839": "supseteq;",
    "8840": "nsubseteq;",
    "8841": "nsupseteq;",
    "8842": "subsetneq;",
    "8843": "supsetneq;",
    "8845": "cupdot;",
    "8846": "uplus;",
    "8847": "SquareSubset;",
    "8848": "SquareSuperset;",
    "8849": "SquareSubsetEqual;",
    "8850": "SquareSupersetEqual;",
    "8851": "SquareIntersection;",
    "8852": "SquareUnion;",
    "8853": "oplus;",
    "8854": "ominus;",
    "8855": "otimes;",
    "8856": "osol;",
    "8857": "odot;",
    "8858": "ocir;",
    "8859": "oast;",
    "8861": "odash;",
    "8862": "plusb;",
    "8863": "minusb;",
    "8864": "timesb;",
    "8865": "sdotb;",
    "8866": "vdash;",
    "8867": "LeftTee;",
    "8868": "top;",
    "8869": "UpTee;",
    "8871": "models;",
    "8872": "vDash;",
    "8873": "Vdash;",
    "8874": "Vvdash;",
    "8875": "VDash;",
    "8876": "nvdash;",
    "8877": "nvDash;",
    "8878": "nVdash;",
    "8879": "nVDash;",
    "8880": "prurel;",
    "8882": "vltri;",
    "8883": "vrtri;",
    "8884": "trianglelefteq;",
    "8885": "trianglerighteq;",
    "8886": "origof;",
    "8887": "imof;",
    "8888": "mumap;",
    "8889": "hercon;",
    "8890": "intercal;",
    "8891": "veebar;",
    "8893": "barvee;",
    "8894": "angrtvb;",
    "8895": "lrtri;",
    "8896": "xwedge;",
    "8897": "xvee;",
    "8898": "xcap;",
    "8899": "xcup;",
    "8900": "diamond;",
    "8901": "sdot;",
    "8902": "Star;",
    "8903": "divonx;",
    "8904": "bowtie;",
    "8905": "ltimes;",
    "8906": "rtimes;",
    "8907": "lthree;",
    "8908": "rthree;",
    "8909": "bsime;",
    "8910": "cuvee;",
    "8911": "cuwed;",
    "8912": "Subset;",
    "8913": "Supset;",
    "8914": "Cap;",
    "8915": "Cup;",
    "8916": "pitchfork;",
    "8917": "epar;",
    "8918": "ltdot;",
    "8919": "gtrdot;",
    "8920": "Ll;",
    "8921": "ggg;",
    "8922": "LessEqualGreater;",
    "8923": "gtreqless;",
    "8926": "curlyeqprec;",
    "8927": "curlyeqsucc;",
    "8928": "nprcue;",
    "8929": "nsccue;",
    "8930": "nsqsube;",
    "8931": "nsqsupe;",
    "8934": "lnsim;",
    "8935": "gnsim;",
    "8936": "prnsim;",
    "8937": "succnsim;",
    "8938": "ntriangleleft;",
    "8939": "ntriangleright;",
    "8940": "ntrianglelefteq;",
    "8941": "ntrianglerighteq;",
    "8942": "vellip;",
    "8943": "ctdot;",
    "8944": "utdot;",
    "8945": "dtdot;",
    "8946": "disin;",
    "8947": "isinsv;",
    "8948": "isins;",
    "8949": "isindot;",
    "8950": "notinvc;",
    "8951": "notinvb;",
    "8953": "isinE;",
    "8954": "nisd;",
    "8955": "xnis;",
    "8956": "nis;",
    "8957": "notnivc;",
    "8958": "notnivb;",
    "8965": "barwedge;",
    "8966": "doublebarwedge;",
    "8968": "LeftCeiling;",
    "8969": "RightCeiling;",
    "8970": "lfloor;",
    "8971": "RightFloor;",
    "8972": "drcrop;",
    "8973": "dlcrop;",
    "8974": "urcrop;",
    "8975": "ulcrop;",
    "8976": "bnot;",
    "8978": "profline;",
    "8979": "profsurf;",
    "8981": "telrec;",
    "8982": "target;",
    "8988": "ulcorner;",
    "8989": "urcorner;",
    "8990": "llcorner;",
    "8991": "lrcorner;",
    "8994": "sfrown;",
    "8995": "ssmile;",
    "9005": "cylcty;",
    "9006": "profalar;",
    "9014": "topbot;",
    "9021": "ovbar;",
    "9023": "solbar;",
    "9084": "angzarr;",
    "9136": "lmoustache;",
    "9137": "rmoustache;",
    "9140": "tbrk;",
    "9141": "UnderBracket;",
    "9142": "bbrktbrk;",
    "9180": "OverParenthesis;",
    "9181": "UnderParenthesis;",
    "9182": "OverBrace;",
    "9183": "UnderBrace;",
    "9186": "trpezium;",
    "9191": "elinters;",
    "9251": "blank;",
    "9416": "oS;",
    "9472": "HorizontalLine;",
    "9474": "boxv;",
    "9484": "boxdr;",
    "9488": "boxdl;",
    "9492": "boxur;",
    "9496": "boxul;",
    "9500": "boxvr;",
    "9508": "boxvl;",
    "9516": "boxhd;",
    "9524": "boxhu;",
    "9532": "boxvh;",
    "9552": "boxH;",
    "9553": "boxV;",
    "9554": "boxdR;",
    "9555": "boxDr;",
    "9556": "boxDR;",
    "9557": "boxdL;",
    "9558": "boxDl;",
    "9559": "boxDL;",
    "9560": "boxuR;",
    "9561": "boxUr;",
    "9562": "boxUR;",
    "9563": "boxuL;",
    "9564": "boxUl;",
    "9565": "boxUL;",
    "9566": "boxvR;",
    "9567": "boxVr;",
    "9568": "boxVR;",
    "9569": "boxvL;",
    "9570": "boxVl;",
    "9571": "boxVL;",
    "9572": "boxHd;",
    "9573": "boxhD;",
    "9574": "boxHD;",
    "9575": "boxHu;",
    "9576": "boxhU;",
    "9577": "boxHU;",
    "9578": "boxvH;",
    "9579": "boxVh;",
    "9580": "boxVH;",
    "9600": "uhblk;",
    "9604": "lhblk;",
    "9608": "block;",
    "9617": "blk14;",
    "9618": "blk12;",
    "9619": "blk34;",
    "9633": "square;",
    "9642": "squf;",
    "9643": "EmptyVerySmallSquare;",
    "9645": "rect;",
    "9646": "marker;",
    "9649": "fltns;",
    "9651": "xutri;",
    "9652": "utrif;",
    "9653": "utri;",
    "9656": "rtrif;",
    "9657": "triangleright;",
    "9661": "xdtri;",
    "9662": "dtrif;",
    "9663": "triangledown;",
    "9666": "ltrif;",
    "9667": "triangleleft;",
    "9674": "lozenge;",
    "9675": "cir;",
    "9708": "tridot;",
    "9711": "xcirc;",
    "9720": "ultri;",
    "9721": "urtri;",
    "9722": "lltri;",
    "9723": "EmptySmallSquare;",
    "9724": "FilledSmallSquare;",
    "9733": "starf;",
    "9734": "star;",
    "9742": "phone;",
    "9792": "female;",
    "9794": "male;",
    "9824": "spadesuit;",
    "9827": "clubsuit;",
    "9829": "heartsuit;",
    "9830": "diams;",
    "9834": "sung;",
    "9837": "flat;",
    "9838": "natural;",
    "9839": "sharp;",
    "10003": "checkmark;",
    "10007": "cross;",
    "10016": "maltese;",
    "10038": "sext;",
    "10072": "VerticalSeparator;",
    "10098": "lbbrk;",
    "10099": "rbbrk;",
    "10184": "bsolhsub;",
    "10185": "suphsol;",
    "10214": "lobrk;",
    "10215": "robrk;",
    "10216": "LeftAngleBracket;",
    "10217": "RightAngleBracket;",
    "10218": "Lang;",
    "10219": "Rang;",
    "10220": "loang;",
    "10221": "roang;",
    "10229": "xlarr;",
    "10230": "xrarr;",
    "10231": "xharr;",
    "10232": "xlArr;",
    "10233": "xrArr;",
    "10234": "xhArr;",
    "10236": "xmap;",
    "10239": "dzigrarr;",
    "10498": "nvlArr;",
    "10499": "nvrArr;",
    "10500": "nvHarr;",
    "10501": "Map;",
    "10508": "lbarr;",
    "10509": "rbarr;",
    "10510": "lBarr;",
    "10511": "rBarr;",
    "10512": "RBarr;",
    "10513": "DDotrahd;",
    "10514": "UpArrowBar;",
    "10515": "DownArrowBar;",
    "10518": "Rarrtl;",
    "10521": "latail;",
    "10522": "ratail;",
    "10523": "lAtail;",
    "10524": "rAtail;",
    "10525": "larrfs;",
    "10526": "rarrfs;",
    "10527": "larrbfs;",
    "10528": "rarrbfs;",
    "10531": "nwarhk;",
    "10532": "nearhk;",
    "10533": "searhk;",
    "10534": "swarhk;",
    "10535": "nwnear;",
    "10536": "toea;",
    "10537": "tosa;",
    "10538": "swnwar;",
    "10547": "rarrc;",
    "10549": "cudarrr;",
    "10550": "ldca;",
    "10551": "rdca;",
    "10552": "cudarrl;",
    "10553": "larrpl;",
    "10556": "curarrm;",
    "10557": "cularrp;",
    "10565": "rarrpl;",
    "10568": "harrcir;",
    "10569": "Uarrocir;",
    "10570": "lurdshar;",
    "10571": "ldrushar;",
    "10574": "LeftRightVector;",
    "10575": "RightUpDownVector;",
    "10576": "DownLeftRightVector;",
    "10577": "LeftUpDownVector;",
    "10578": "LeftVectorBar;",
    "10579": "RightVectorBar;",
    "10580": "RightUpVectorBar;",
    "10581": "RightDownVectorBar;",
    "10582": "DownLeftVectorBar;",
    "10583": "DownRightVectorBar;",
    "10584": "LeftUpVectorBar;",
    "10585": "LeftDownVectorBar;",
    "10586": "LeftTeeVector;",
    "10587": "RightTeeVector;",
    "10588": "RightUpTeeVector;",
    "10589": "RightDownTeeVector;",
    "10590": "DownLeftTeeVector;",
    "10591": "DownRightTeeVector;",
    "10592": "LeftUpTeeVector;",
    "10593": "LeftDownTeeVector;",
    "10594": "lHar;",
    "10595": "uHar;",
    "10596": "rHar;",
    "10597": "dHar;",
    "10598": "luruhar;",
    "10599": "ldrdhar;",
    "10600": "ruluhar;",
    "10601": "rdldhar;",
    "10602": "lharul;",
    "10603": "llhard;",
    "10604": "rharul;",
    "10605": "lrhard;",
    "10606": "UpEquilibrium;",
    "10607": "ReverseUpEquilibrium;",
    "10608": "RoundImplies;",
    "10609": "erarr;",
    "10610": "simrarr;",
    "10611": "larrsim;",
    "10612": "rarrsim;",
    "10613": "rarrap;",
    "10614": "ltlarr;",
    "10616": "gtrarr;",
    "10617": "subrarr;",
    "10619": "suplarr;",
    "10620": "lfisht;",
    "10621": "rfisht;",
    "10622": "ufisht;",
    "10623": "dfisht;",
    "10629": "lopar;",
    "10630": "ropar;",
    "10635": "lbrke;",
    "10636": "rbrke;",
    "10637": "lbrkslu;",
    "10638": "rbrksld;",
    "10639": "lbrksld;",
    "10640": "rbrkslu;",
    "10641": "langd;",
    "10642": "rangd;",
    "10643": "lparlt;",
    "10644": "rpargt;",
    "10645": "gtlPar;",
    "10646": "ltrPar;",
    "10650": "vzigzag;",
    "10652": "vangrt;",
    "10653": "angrtvbd;",
    "10660": "ange;",
    "10661": "range;",
    "10662": "dwangle;",
    "10663": "uwangle;",
    "10664": "angmsdaa;",
    "10665": "angmsdab;",
    "10666": "angmsdac;",
    "10667": "angmsdad;",
    "10668": "angmsdae;",
    "10669": "angmsdaf;",
    "10670": "angmsdag;",
    "10671": "angmsdah;",
    "10672": "bemptyv;",
    "10673": "demptyv;",
    "10674": "cemptyv;",
    "10675": "raemptyv;",
    "10676": "laemptyv;",
    "10677": "ohbar;",
    "10678": "omid;",
    "10679": "opar;",
    "10681": "operp;",
    "10683": "olcross;",
    "10684": "odsold;",
    "10686": "olcir;",
    "10687": "ofcir;",
    "10688": "olt;",
    "10689": "ogt;",
    "10690": "cirscir;",
    "10691": "cirE;",
    "10692": "solb;",
    "10693": "bsolb;",
    "10697": "boxbox;",
    "10701": "trisb;",
    "10702": "rtriltri;",
    "10703": "LeftTriangleBar;",
    "10704": "RightTriangleBar;",
    "10716": "iinfin;",
    "10717": "infintie;",
    "10718": "nvinfin;",
    "10723": "eparsl;",
    "10724": "smeparsl;",
    "10725": "eqvparsl;",
    "10731": "lozf;",
    "10740": "RuleDelayed;",
    "10742": "dsol;",
    "10752": "xodot;",
    "10753": "xoplus;",
    "10754": "xotime;",
    "10756": "xuplus;",
    "10758": "xsqcup;",
    "10764": "qint;",
    "10765": "fpartint;",
    "10768": "cirfnint;",
    "10769": "awint;",
    "10770": "rppolint;",
    "10771": "scpolint;",
    "10772": "npolint;",
    "10773": "pointint;",
    "10774": "quatint;",
    "10775": "intlarhk;",
    "10786": "pluscir;",
    "10787": "plusacir;",
    "10788": "simplus;",
    "10789": "plusdu;",
    "10790": "plussim;",
    "10791": "plustwo;",
    "10793": "mcomma;",
    "10794": "minusdu;",
    "10797": "loplus;",
    "10798": "roplus;",
    "10799": "Cross;",
    "10800": "timesd;",
    "10801": "timesbar;",
    "10803": "smashp;",
    "10804": "lotimes;",
    "10805": "rotimes;",
    "10806": "otimesas;",
    "10807": "Otimes;",
    "10808": "odiv;",
    "10809": "triplus;",
    "10810": "triminus;",
    "10811": "tritime;",
    "10812": "iprod;",
    "10815": "amalg;",
    "10816": "capdot;",
    "10818": "ncup;",
    "10819": "ncap;",
    "10820": "capand;",
    "10821": "cupor;",
    "10822": "cupcap;",
    "10823": "capcup;",
    "10824": "cupbrcap;",
    "10825": "capbrcup;",
    "10826": "cupcup;",
    "10827": "capcap;",
    "10828": "ccups;",
    "10829": "ccaps;",
    "10832": "ccupssm;",
    "10835": "And;",
    "10836": "Or;",
    "10837": "andand;",
    "10838": "oror;",
    "10839": "orslope;",
    "10840": "andslope;",
    "10842": "andv;",
    "10843": "orv;",
    "10844": "andd;",
    "10845": "ord;",
    "10847": "wedbar;",
    "10854": "sdote;",
    "10858": "simdot;",
    "10861": "congdot;",
    "10862": "easter;",
    "10863": "apacir;",
    "10864": "apE;",
    "10865": "eplus;",
    "10866": "pluse;",
    "10867": "Esim;",
    "10868": "Colone;",
    "10869": "Equal;",
    "10871": "eDDot;",
    "10872": "equivDD;",
    "10873": "ltcir;",
    "10874": "gtcir;",
    "10875": "ltquest;",
    "10876": "gtquest;",
    "10877": "LessSlantEqual;",
    "10878": "GreaterSlantEqual;",
    "10879": "lesdot;",
    "10880": "gesdot;",
    "10881": "lesdoto;",
    "10882": "gesdoto;",
    "10883": "lesdotor;",
    "10884": "gesdotol;",
    "10885": "lessapprox;",
    "10886": "gtrapprox;",
    "10887": "lneq;",
    "10888": "gneq;",
    "10889": "lnapprox;",
    "10890": "gnapprox;",
    "10891": "lesseqqgtr;",
    "10892": "gtreqqless;",
    "10893": "lsime;",
    "10894": "gsime;",
    "10895": "lsimg;",
    "10896": "gsiml;",
    "10897": "lgE;",
    "10898": "glE;",
    "10899": "lesges;",
    "10900": "gesles;",
    "10901": "eqslantless;",
    "10902": "eqslantgtr;",
    "10903": "elsdot;",
    "10904": "egsdot;",
    "10905": "el;",
    "10906": "eg;",
    "10909": "siml;",
    "10910": "simg;",
    "10911": "simlE;",
    "10912": "simgE;",
    "10913": "LessLess;",
    "10914": "GreaterGreater;",
    "10916": "glj;",
    "10917": "gla;",
    "10918": "ltcc;",
    "10919": "gtcc;",
    "10920": "lescc;",
    "10921": "gescc;",
    "10922": "smt;",
    "10923": "lat;",
    "10924": "smte;",
    "10925": "late;",
    "10926": "bumpE;",
    "10927": "preceq;",
    "10928": "succeq;",
    "10931": "prE;",
    "10932": "scE;",
    "10933": "prnE;",
    "10934": "succneqq;",
    "10935": "precapprox;",
    "10936": "succapprox;",
    "10937": "prnap;",
    "10938": "succnapprox;",
    "10939": "Pr;",
    "10940": "Sc;",
    "10941": "subdot;",
    "10942": "supdot;",
    "10943": "subplus;",
    "10944": "supplus;",
    "10945": "submult;",
    "10946": "supmult;",
    "10947": "subedot;",
    "10948": "supedot;",
    "10949": "subseteqq;",
    "10950": "supseteqq;",
    "10951": "subsim;",
    "10952": "supsim;",
    "10955": "subsetneqq;",
    "10956": "supsetneqq;",
    "10959": "csub;",
    "10960": "csup;",
    "10961": "csube;",
    "10962": "csupe;",
    "10963": "subsup;",
    "10964": "supsub;",
    "10965": "subsub;",
    "10966": "supsup;",
    "10967": "suphsub;",
    "10968": "supdsub;",
    "10969": "forkv;",
    "10970": "topfork;",
    "10971": "mlcp;",
    "10980": "DoubleLeftTee;",
    "10982": "Vdashl;",
    "10983": "Barv;",
    "10984": "vBar;",
    "10985": "vBarv;",
    "10987": "Vbar;",
    "10988": "Not;",
    "10989": "bNot;",
    "10990": "rnmid;",
    "10991": "cirmid;",
    "10992": "midcir;",
    "10993": "topcir;",
    "10994": "nhpar;",
    "10995": "parsim;",
    "11005": "parsl;",
    "64256": "fflig;",
    "64257": "filig;",
    "64258": "fllig;",
    "64259": "ffilig;",
    "64260": "ffllig;"
}
},{}],12:[function(require,module,exports){
(function (process){
var through = require('through2');
var inherits = require('inherits');
var Splicer = require('stream-splicer');
var Duplexer = require('readable-stream').Duplexer;

var Match = require('./lib/match.js');
var selfClosing = require('./lib/self_closing.js');
var getTag = require('./lib/get_tag.js');
var lang = require('./lib/lang.js');

var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate : process.nextTick;

module.exports = Plex;
inherits(Plex, Splicer);

function Plex (sel, cb) {
    var self = this;
    if (!(this instanceof Plex)) return new Plex(sel, cb);
    
    var streams = [ this._pre(), [], this._post() ];
    Splicer.call(this, streams, { objectMode: true });
    
    this._root = {};
    this._current = this._root;
    
    this._selectors = [];
    this._lang = lang();
    
    if (sel && cb) this.select(sel, cb);
}

Plex.prototype._pre = function () {
    var self = this;
    var pipeline;
    
    return through.obj(function (row, enc, next) {
        var tree = self._updateTree(row);
        if (!pipeline) pipeline = self.get(1);
        
        var matched = null;
        
        if (row[0] === 'open') {
            for (var i = 0, l = self._selectors.length; i < l; i++) {
                var s = self._selectors[i];
                if (s.test(tree)) {
                    matched = self._createMatch(tree, s.fn);
                    this.push(['FIRST', matched]);
                }
            }
        }
        
        if (row[0] === 'open' && tree.selfClosing && tree.parent) {
            self._current = self._current.parent;
        }
        
        if ((matched && tree.selfClosing) || row[0] === 'close') {
            var s = pipeline.get(0);
            if (s && s.finished && s.finished(tree)) {
                s.once('close', function () {
                    nextTick(next);
                });
                this.push([ 'END', row ]);
                return;
            }
        }
        
        this.push(row);
        
        next();
    });
};

Plex.prototype._post = function () {
    return through.obj(function (row, enc, next) {
        if (row[0] !== 'FIRST') this.push(row);
        next();
    });
};

Plex.prototype.select = function (sel, cb) {
    this._selectors.push({ test: this._lang(sel), fn: cb });
    return this;
};

Plex.prototype._updateTree = function (row) {
    if (row[0] === 'open') {
        var node = { parent: this._current, row: row };
        node.selfClosing = node.parent && selfClosing(getTag(node));
        if (!this._current.children) this._current.children = [ node ]
        else this._current.children.push(node);
        this._current = node;
    }
    else if (row[0] === 'close') {
        if (this._current.parent) this._current = this._current.parent;
    }
    return this._current;
};

Plex.prototype._createMatch = function (tree, fn) {
    var self = this;
    var m = new Match(tree, fn);
    var pipeline = this.get(1);
    pipeline.splice(0, 0, m);
    
    m.once('close', function () {
        var ix = pipeline.indexOf(m);
        if (ix >= 0) pipeline.splice(ix, 1);
        
        var next = pipeline.get(ix);
        if (next && next._start === tree) {
            next.write([ 'END' ]);
        }
    });
    
    return m;
};

}).call(this,require('_process'))
},{"./lib/get_tag.js":14,"./lib/lang.js":16,"./lib/match.js":17,"./lib/self_closing.js":19,"_process":110,"inherits":39,"readable-stream":27,"stream-splicer":63,"through2":29}],13:[function(require,module,exports){
var parseTag = require('./parse_tag.js');

module.exports = function (node, k) {
    var key = k.toLowerCase();
    if (node.attributes && !key) return node.attributes;
    else if (node.attributes) return node.attributes[key];
    if (!node._parsed) {
        if (!node.row) return undefined;
        var p = parseTag(node.row[1]);
        node._parsed = p;
        node.tag = p.tag;
    }
    node.attributes = node._parsed.getAttributes();
    if (!key) return node.attributes;
    else return node.attributes[key];
};

},{"./parse_tag.js":18}],14:[function(require,module,exports){
var parseTag = require('./parse_tag.js');

module.exports = function (node) {
    if (node.tag) return node.tag;
    if (!node.row) return undefined;
    if (!node._parsed) {
        var p = parseTag(node.row[1]);
        node._parsed = p;
        node.tag = p.name;
    }
    return node.tag;
};

},{"./parse_tag.js":18}],15:[function(require,module,exports){
var through = require('through2');
var duplexer = require('duplexer2');
var Readable = require('readable-stream').Readable;
var Writable = require('readable-stream').Writable;
var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var parseTag = require('./parse_tag.js');

module.exports = Interface;
inherits(Interface, EventEmitter);

function Interface (pipeline, match) {
    if (!(this instanceof Interface)) return new Interface(pipeline, match);
    var self = this;
    this._pipeline = pipeline;
    this._match = match;
    match.once('close', function () {
        self._closed = true;
        self.emit('close')
    });
    
    var tag = match._start._parsed;
    this.name = tag.name;
    this.attributes = tag.getAttributes();
    this._setAttr = null;
}

Interface.prototype.getAttribute = function (key, cb) {
    var value = this.attributes[String(key).toLowerCase()];
    if (cb) cb(value);
    return value;
};

Interface.prototype.getAttributes = function (cb) {
    if (cb) cb(this.attributes);
    return this.attributes;
};

Interface.prototype.setAttribute = function (key, value) {
    if (!this._setAttr) this._setAttr = {};
    this._setAttr[key] = value;
};

Interface.prototype.removeAttribute = function (key) {
    if (!this._setAttr) this._setAttr = {};
    this._setAttr[key] = undefined;
};

Interface.prototype.createStream = function (opts) {
    if (!opts) opts = {};
    var self = this;
    var input = through.obj(iwrite, iend);
    var output = through.obj(owrite, oend);
    var first = true, last = false, lastBuf = null;
    var pending = 2;
    
    var inext, irow, iended = false;

    this._pipeline.push(duplexer(output, input));
    return duplexer(input, output);
    
    function owrite (row, enc, next) {
        if (row[0] === 'FIRST') {
            if (iended) input.push(row)
            else input.write(row);
            return next();
        }
        if (row[0] === 'LAST') {
            last = true;

            if (iended) input.push(row)
            else input.write(row);

            return next();
        }
        
        if (opts.inner && first) {
            first = false;
            
            if (iended) input.push(row)
            else input.write(row)
            
            if (irow) {
                input.write(irow);
                inext();
            }
        }
        else if (opts.inner && last) {
            lastBuf = row;
        }
        else if (last) {
            var tag = parseTag(row[1]);
            if (self._match._start._parsed.name === tag.name) {
                this.push(row);
            }
        }
        else this.push(row);
        
        first = false;
        next();
    }
    
    function oend () {
        this.push(null);
        done();
    }
    
    function iwrite (row, enc, next) {
        if (opts.inner && first) {
            irow = row;
            inext = next;
        }
        else {
            this.push(row);
            next();
        }
    }
    
    function iend () { iended = true; done() }
    
    function done () {
        if (-- pending === 0) {
            if (lastBuf) input.push(lastBuf);
            input.push(null);
        }
    }
};

Interface.prototype.createReadStream = function (opts) {
    if (!opts) opts = {};
    var self = this;
    var input = through.obj();
    var first = true, last = false;
    
    var stream = through.obj(write, end);
    this._pipeline.push(stream);
    
    var r = new Readable({ objectMode: true });
    r._read = function () {};
    
    return r;
    
    function write (row, enc, next) {
        if (row[0] === 'FIRST') {
            this.push(row);
            return next();
        }
        if (row[0] === 'LAST') {
            last = true;
            this.push(row);
            return next();
        }
        
        if (opts.inner && (first || last)) {}
        else if (last) {
            var tag = parseTag(row[1]);
            if (self._match._start._parsed.name === tag.name) {
                r.push(row);
            }
        }
        else r.push(row);
        first = false;
        
        this.push(row);
        next();
    }
    
    function end () {
        r.push(null);
        this.push(null);
    }
};

Interface.prototype.createWriteStream = function (opts) {
    var self = this;
    var stream = this.createStream(opts);
    var w = new Writable({ objectMode: true });
    w._write = function (buf, enc, next) {
        stream._write(buf, enc, next);
    };
    // since we're only using this stream for write, 
    // siphon off the read end to prevent it from blocking.
    stream.resume();
    w.on('finish', function () { stream.end() });
    return w;
};

},{"./parse_tag.js":18,"duplexer2":21,"events":104,"inherits":39,"readable-stream":27,"through2":29}],16:[function(require,module,exports){
var cssauron = require('cssauron');
var getTag = require('./get_tag.js');
var getAttr = require('./get_attr.js');

module.exports = function () {
    return cssauron({
        tag: function (node) { return getTag(node) },
        class: function (node) { return getAttr(node, 'class') },
        id: function (node) { return getAttr(node, 'id') },
        parent: 'parent',
        children: 'children',
        attr: getAttr
    });
};

},{"./get_attr.js":13,"./get_tag.js":14,"cssauron":5}],17:[function(require,module,exports){
var inherits = require('inherits');
var Interface = require('./interface.js');
var through = require('through2');
var Splicer = require('stream-splicer');
var Readable = require('readable-stream').Readable;
var setAttrs = require('./set_attrs.js');

module.exports = Match;
inherits(Match, Splicer);

function Match (start, fn) {
    if (!(this instanceof Match)) return new Match;
    
    var streams = [ this._pre(), [], this._post() ];
    this._start = start;
    this._fn = fn;
    
    Splicer.call(this, streams, { objectMode: true });
}

Match.prototype._pre = function () {
    var self = this;
    var matched = false;
    var first = true;
    return through.obj(write, end);
    
    function write (row, enc, next) {

        // detect when the selected tokens start        
        if (!matched && row[0] === 'FIRST' && row[1] === self) {
            matched = true; 
        }

        // first interesting token of the selection
        if (matched && first && row[0] !== 'FIRST') {
            var iface = self.createInterface();
            self._fn(iface);
            
            if (iface._setAttr && row[0] === 'END') {
                row[1][1] = setAttrs(row[1][1], iface._setAttr);
            }
            else if (iface._setAttr) {
                row[1] = setAttrs(row[1], iface._setAttr);
            }
            first = false;
        }
        
        if (row[0] === 'END' && self._ended) {
            self._ended = false;
            self.emit('close');
            next();
        }
        else if (row[0] === 'END') {
            self._next = next;
            
            self._ended = true;
            this.push(['LAST']);
            this.push(row[1]);
            this.push(null);
        }
        else {
            if (!self._ended) this.push(row);
            next();
        }
    }
    function end () {}
};

Match.prototype._post = function () {
    var self = this;
    var first = true;
    return through.obj(write, end);
    
    function write (row, enc, next) {
        if (row[0] !== 'LAST') this.push(row);
        next();
    }
    
    function end () {
        if (self._next) {
            self.emit('close');
            self._next();
        }
        else {
            self._ended = true;
        }
    }
};

Match.prototype.finished = function (tree) {
    if (this._start.selfClosing) return true;
    return tree === this._start.parent;
};

Match.prototype.createInterface = function () {
    return new Interface(this.get(1), this);
};

},{"./interface.js":15,"./set_attrs.js":20,"inherits":39,"readable-stream":27,"stream-splicer":63,"through2":29}],18:[function(require,module,exports){
(function (Buffer){
module.exports = function (buf) {
    if (typeof buf === 'string') buf = Buffer(buf);

    var closing = buf[1] === '/'.charCodeAt(0);
    var start = closing ? 2 : 1;
    var name;

    for (var i = start; i < buf.length; i++) {
        var c = String.fromCharCode(buf[i]);
        if (/[\s>\/]/.test(c)) {
            name = buf.slice(start, i).toString('utf8').toLowerCase();
            break;
        }
    }
    var attr;
    return {
        name: name,
        getAttributes: function () {
            if (attr) return attr;
            attr = parse(buf, i)
            return attr;
        }
    };
};

function parse (buf, i) {
    var attr = {};
    var s = buf.slice(i, buf.length-1).toString('utf8');
    var parts = s.match(/[^\s=\/]+\s*=\s*("[^"]+"|'[^']+'|\S+)|[^\s=\/]+/g) || [];
    var key, value;

    for (var j = 0; j < parts.length; j++) {
        var kv = parts[j].split('=');
        key = kv[0].toLowerCase().trim();
        if (kv.length > 1) {
            value = kv.slice(1).join('=');
            if (/^\s*"/.test(value)) {
                value = value.replace(/^\s*"/, '').replace(/"\s*$/, '');
            }
            else if (/^\s*'/.test(value)) {
                value = value.replace(/^\s*'/, '').replace(/'\s*$/, '');
            }
            else value = value.trim();
        }
        else value = true;
        attr[key] = value;
    }
    return attr;
}

}).call(this,require("buffer").Buffer)
},{"buffer":102}],19:[function(require,module,exports){
var tags = '!-- area base br col embed hr img input keygen link menuitem meta param source track wbr'.split(' ');
var map = {};
tags.forEach(function (t) { map[t] = true });
module.exports = function (name) {
    return Object.prototype.hasOwnProperty.call(map, name);
};

},{}],20:[function(require,module,exports){
var parse = require('./parse_tag.js');

module.exports = function (buf, attrs) {
    var p = parse(buf);
    var xattrs = p.getAttributes();
    Object.keys(attrs).forEach(function (key) {
        xattrs[key] = attrs[key];
    });
    var keys = Object.keys(xattrs).filter(function (key) {
        return xattrs[key] !== undefined;
    });
    var parts = keys.map(function (key) {
        if (xattrs[key] === true) return key;
        return key + '="' + esc(xattrs[key]) + '"';
    }).join(' ');
    return '<' + p.name + (parts.length ? ' ' : '') + parts + '>';
};

function esc (s) {
    return String(s).replace(/&/, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</, '&lt;')
        .replace(/>/, '&gt;')
    ;
}

},{"./parse_tag.js":18}],21:[function(require,module,exports){
var stream = require("readable-stream");

var duplex2 = module.exports = function duplex2(options, writable, readable) {
  return new DuplexWrapper(options, writable, readable);
};

var DuplexWrapper = exports.DuplexWrapper = function DuplexWrapper(options, writable, readable) {
  if (typeof readable === "undefined") {
    readable = writable;
    writable = options;
    options = null;
  }

  options = options || {};
  options.objectMode = true;

  stream.Duplex.call(this, options);

  this._bubbleErrors = (typeof options.bubbleErrors === "undefined") || !!options.bubbleErrors;

  this._writable = writable;
  this._readable = readable;

  var self = this;

  writable.once("finish", function() {
    self.end();
  });

  this.once("finish", function() {
    writable.end();
  });

  readable.on("data", function(e) {
    if (!self.push(e)) {
      readable.pause();
    }
  });

  readable.once("end", function() {
    return self.push(null);
  });

  if (this._bubbleErrors) {
    writable.on("error", function(err) {
      return self.emit("error", err);
    });

    readable.on("error", function(err) {
      return self.emit("error", err);
    });
  }
};
DuplexWrapper.prototype = Object.create(stream.Duplex.prototype, {constructor: {value: DuplexWrapper}});

DuplexWrapper.prototype._write = function _write(input, encoding, done) {
  this._writable.write(input, encoding, done);
};

DuplexWrapper.prototype._read = function _read(n) {
  this._readable.resume();
};

},{"readable-stream":27}],22:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

module.exports = Duplex;

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

forEach(objectKeys(Writable.prototype), function(method) {
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
});

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  process.nextTick(this.end.bind(this));
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

}).call(this,require('_process'))
},{"./_stream_readable":24,"./_stream_writable":26,"_process":110,"core-util-is":4,"inherits":39}],23:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":25,"core-util-is":4,"inherits":39}],24:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;

/*<replacement>*/
if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

var Stream = require('stream');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var StringDecoder;


/*<replacement>*/
var debug = require('util');
if (debug && debug.debuglog) {
  debug = debug.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/


util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.readableObjectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  var Duplex = require('./_stream_duplex');

  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (util.isString(chunk) && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (util.isNullOrUndefined(chunk)) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      if (!addToFront)
        state.reading = false;

      // if we want the data now, just emit it.
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit('data', chunk);
        stream.read(0);
      } else {
        // update the buffer info.
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront)
          state.buffer.unshift(chunk);
        else
          state.buffer.push(chunk);

        if (state.needReadable)
          emitReadable(stream);
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (isNaN(n) || util.isNull(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (!util.isNumber(n) || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended)
      endReadable(this);
    else
      emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (util.isNull(ret)) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0)
    endReadable(this);

  if (!util.isNull(ret))
    this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!util.isBuffer(chunk) &&
      !util.isString(chunk) &&
      !util.isNullOrUndefined(chunk) &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync)
      process.nextTick(function() {
        emitReadable_(stream);
      });
    else
      emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    process.nextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain &&
        (!dest._writableState || dest._writableState.needDrain))
      ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      debug('false write response, pause',
            src._readableState.awaitDrain);
      src._readableState.awaitDrain++;
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];



  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain)
      state.awaitDrain--;
    if (state.awaitDrain === 0 && EE.listenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        var self = this;
        process.nextTick(function() {
          debug('readable nexttick read 0');
          self.read(0);
        });
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    if (!state.reading) {
      debug('resume read 0');
      this.read(0);
    }
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    process.nextTick(function() {
      resume_(stream, state);
    });
  }
}

function resume_(stream, state) {
  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0);
}

Readable.prototype.pause = function() {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    debug('wrapped data');
    if (state.decoder)
      chunk = state.decoder.write(chunk);
    if (!chunk || !state.objectMode && !chunk.length)
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (util.isFunction(stream[i]) && util.isUndefined(this[i])) {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    process.nextTick(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))
},{"./_stream_duplex":22,"_process":110,"buffer":102,"core-util-is":4,"events":104,"inherits":39,"isarray":40,"stream":122,"string_decoder/":71,"util":101}],25:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (!util.isNullOrUndefined(data))
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('prefinish', function() {
    if (util.isFunction(this._flush))
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (!util.isNull(ts.writechunk) && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":22,"core-util-is":4,"inherits":39}],26:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;

/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Stream = require('stream');

util.inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.writableObjectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  process.nextTick(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!util.isBuffer(chunk) &&
      !util.isString(chunk) &&
      !util.isNullOrUndefined(chunk) &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    process.nextTick(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (util.isFunction(encoding)) {
    cb = encoding;
    encoding = null;
  }

  if (util.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (!util.isFunction(cb))
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function() {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function() {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing &&
        !state.corked &&
        !state.finished &&
        !state.bufferProcessing &&
        state.buffer.length)
      clearBuffer(this, state);
  }
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      util.isString(chunk)) {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  if (util.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing || state.corked)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, false, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev)
    stream._writev(chunk, state.onwrite);
  else
    stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    process.nextTick(function() {
      state.pendingcb--;
      cb(er);
    });
  else {
    state.pendingcb--;
    cb(er);
  }

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished &&
        !state.corked &&
        !state.bufferProcessing &&
        state.buffer.length) {
      clearBuffer(stream, state);
    }

    if (sync) {
      process.nextTick(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  if (stream._writev && state.buffer.length > 1) {
    // Fast case, write everything using _writev()
    var cbs = [];
    for (var c = 0; c < state.buffer.length; c++)
      cbs.push(state.buffer[c].callback);

    // count the one we are adding, as well.
    // TODO(isaacs) clean this up
    state.pendingcb++;
    doWrite(stream, state, true, state.length, state.buffer, '', function(err) {
      for (var i = 0; i < cbs.length; i++) {
        state.pendingcb--;
        cbs[i](err);
      }
    });

    // Clear buffer
    state.buffer = [];
  } else {
    // Slow case, write chunks one-by-one
    for (var c = 0; c < state.buffer.length; c++) {
      var entry = state.buffer[c];
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);

      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        c++;
        break;
      }
    }

    if (c < state.buffer.length)
      state.buffer = state.buffer.slice(c);
    else
      state.buffer.length = 0;
  }

  state.bufferProcessing = false;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));

};

Writable.prototype._writev = null;

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (util.isFunction(chunk)) {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (util.isFunction(encoding)) {
    cb = encoding;
    encoding = null;
  }

  if (!util.isNullOrUndefined(chunk))
    this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else
      prefinish(stream, state);
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      process.nextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

}).call(this,require('_process'))
},{"./_stream_duplex":22,"_process":110,"buffer":102,"core-util-is":4,"inherits":39,"stream":122}],27:[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = require('stream');
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":22,"./lib/_stream_passthrough.js":23,"./lib/_stream_readable.js":24,"./lib/_stream_transform.js":25,"./lib/_stream_writable.js":26,"stream":122}],28:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":25}],29:[function(require,module,exports){
(function (process){
var Transform = require('readable-stream/transform')
  , inherits  = require('util').inherits
  , xtend     = require('xtend')

function DestroyableTransform(opts) {
  Transform.call(this, opts)
  this._destroyed = false
}

inherits(DestroyableTransform, Transform)

DestroyableTransform.prototype.destroy = function(err) {
  if (this._destroyed) return
  this._destroyed = true
  
  var self = this
  process.nextTick(function() {
    if (err)
      self.emit('error', err)
    self.emit('close')
  })
}

// a noop _transform function
function noop (chunk, enc, callback) {
  callback(null, chunk)
}


// create a new export function, used by both the main export and
// the .ctor export, contains common logic for dealing with arguments
function through2 (construct) {
  return function (options, transform, flush) {
    if (typeof options == 'function') {
      flush     = transform
      transform = options
      options   = {}
    }

    if (typeof transform != 'function')
      transform = noop

    if (typeof flush != 'function')
      flush = null

    return construct(options, transform, flush)
  }
}


// main export, just make me a transform stream!
module.exports = through2(function (options, transform, flush) {
  var t2 = new DestroyableTransform(options)

  t2._transform = transform

  if (flush)
    t2._flush = flush

  return t2
})


// make me a reusable prototype that I can `new`, or implicitly `new`
// with a constructor call
module.exports.ctor = through2(function (options, transform, flush) {
  function Through2 (override) {
    if (!(this instanceof Through2))
      return new Through2(override)

    this.options = xtend(options, override)

    DestroyableTransform.call(this, this.options)
  }

  inherits(Through2, DestroyableTransform)

  Through2.prototype._transform = transform

  if (flush)
    Through2.prototype._flush = flush

  return Through2
})


module.exports.obj = through2(function (options, transform, flush) {
  var t2 = new DestroyableTransform(xtend({ objectMode: true, highWaterMark: 16 }, options))

  t2._transform = transform

  if (flush)
    t2._flush = flush

  return t2
})

}).call(this,require('_process'))
},{"_process":110,"readable-stream/transform":28,"util":126,"xtend":30}],30:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],31:[function(require,module,exports){
(function (Buffer){
var Transform = require('readable-stream').Transform;
var inherits = require('inherits');

inherits(Tokenize, Transform);
module.exports = Tokenize;

var codes = {
    lt: '<'.charCodeAt(0),
    gt: '>'.charCodeAt(0),
    slash: '/'.charCodeAt(0),
    dquote: '"'.charCodeAt(0),
    squote: "'".charCodeAt(0),
    equal: '='.charCodeAt(0)
};

var strings = {
    endScript: Buffer('</script'),
    endStyle: Buffer('</style'),
    endTitle: Buffer('</title'),
    comment: Buffer('<!--'),
    endComment: Buffer('-->'),
    cdata: Buffer('<![CDATA['),
    endCdata: Buffer(']]>')
};

var states = {
    'TagNameState': 1,
    'AttributeNameState': 2,
    'BeforeAttributeValueState': 3,
    'AttributeValueState':4
}

function Tokenize () {
    if (!(this instanceof Tokenize)) return new Tokenize;
    Transform.call(this);
    this._readableState.objectMode = true;
    this.state = 'text';
    this.tagState = null;
    this.quoteState = null;
    this.raw = null;
    this.buffers = [];
    this._last = [];
}

Tokenize.prototype._transform = function (buf, enc, next) {
    var i = 0;
    var offset = 0;
    
    if (this._prev) {
        buf = Buffer.concat([ this._prev, buf ]);
        i = this._prev.length - 1;
        offset = this._offset;
        this._prev = null;
        this._offset = 0;
    }
    
    for (; i < buf.length; i++) {
        var b = buf[i];
        this._last.push(b);
        if (this._last.length > 9) this._last.shift();
        // detect end of raw character mode (comment, script,..)
        if (this.raw) {
            var parts = this._testRaw(buf, offset, i);
            if (parts) {
                this.push([ 'text', parts[0] ]);
                
                if (this.raw === strings.endComment
                || this.raw === strings.endCdata) {
                    this.state = 'text';
                    this.buffers = [];
                    this.push([ 'close', parts[1] ]);
                }
                else {
                    this.state = 'open';
                    this.buffers = [ parts[1] ];
                }
                
                this.raw = null;
                offset = i + 1;
            }
        }
        // ask for more data if last byte is '<' 
        else if (this.state === 'text' && b === codes.lt
        && i === buf.length - 1) {
            this._prev = buf;
            this._offset = offset;
            return next();
        }
        // detect a tag opening
        else if (this.state === 'text' && b === codes.lt
        && !isWhiteSpace(buf[i+1])) {
            if (i > 0 && i - offset > 0) {
                this.buffers.push(buf.slice(offset, i));
            }
            offset = i;
            this.state = 'open';
            this.tagState = states.TagNameState;
            this._pushState('text');
        }
        else if (
            this.tagState === states.TagNameState &&
            isWhiteSpace(b)
        ) {
            this.tagState = states.AttributeNameState
        }
        else if (
            this.tagState === states.AttributeNameState &&
            b === codes.equal
        ) {
            this.tagState = states.BeforeAttributeValueState
        }
        else if (
            this.tagState === states.BeforeAttributeValueState &&
            isWhiteSpace(b)
        ) {}
        else if (
            this.tagState === states.BeforeAttributeValueState
            && b !== codes.gt
        ) {
            this.tagState = states.AttributeValueState;
            if (b === codes.dquote) {
                this.quoteState = 'double';
            } else if (b === codes.squote) {
                this.quoteState = 'single';
            } else {
                this.quoteState = null;
            }
        }
        else if (
            this.tagState === states.AttributeValueState &&
            !this.quoteState &&
            isWhiteSpace(b)
        ) {
            this.tagState = states.AttributeNameState;
        }
        else if (
            this.tagState === states.AttributeValueState &&
            this.quoteState === 'double' &&
            b === codes.dquote
        ) {
            this.quoteState = null;
            this.tagState = states.AttributeNameState;
        }
        else if (
            this.tagState === states.AttributeValueState &&
            this.quoteState === 'single' &&
            b === codes.squote
        ) {
            this.quoteState = null;
            this.tagState = states.AttributeNameState;
        }
        else if (this.state === 'open' && b === codes.gt && !this.quoteState) {
            this.buffers.push(buf.slice(offset, i + 1));
            offset = i + 1;
            this.state = 'text';
            this.tagState = null;
            if (this._getChar(1) === codes.slash) {
                this._pushState('close');
            }
            else {
                var tag = this._getTag();
                if (tag === 'script') this.raw = strings.endScript;
                if (tag === 'style') this.raw = strings.endStyle;
                if (tag === 'title') this.raw = strings.endTitle;
                this._pushState('open');
            }
        }
        else if (this.state === 'open' && compare(this._last, strings.comment)) {
            this.buffers.push(buf.slice(offset, i + 1));
            offset = i + 1;
            this.state = 'text';
            this.raw = strings.endComment;
            this._pushState('open');
        }
        else if (this.state === 'open' && compare(this._last, strings.cdata)) {
            this.buffers.push(buf.slice(offset, i + 1));
            offset = i + 1;
            this.state = 'text';
            this.raw = strings.endCdata;
            this._pushState('open');
        }
    }
    if (offset < buf.length) this.buffers.push(buf.slice(offset));
    next();
};

Tokenize.prototype._flush = function (next) {
    if (this.state === 'text') this._pushState('text');
    this.push(null);
    next();
};

Tokenize.prototype._pushState = function (ev) {
    if (this.buffers.length === 0) return;
    var buf = Buffer.concat(this.buffers);
    this.buffers = [];
    this.push([ ev, buf ]);
};

Tokenize.prototype._getChar = function (i) {
    var offset = 0;
    for (var j = 0; j < this.buffers.length; j++) {
        var buf = this.buffers[j];
        if (offset + buf.length > i) {
            return buf[i - offset];
        }
        offset += buf;
    }
};

Tokenize.prototype._getTag = function () {
    var offset = 0;
    var tag = '';
    for (var j = 0; j < this.buffers.length; j++) {
        var buf = this.buffers[j];
        for (var k = 0; k < buf.length; k++) {
            if (offset === 0 && k === 0) continue;
            var c = String.fromCharCode(buf[k]);
            if (/[^\w-!\[\]]/.test(c)) {
                return tag.toLowerCase();
            }
            else tag += c;
        }
        offset += buf.length;
    }
};

Tokenize.prototype._testRaw = function (buf, offset, index) {
    var raw = this.raw, last = this._last;
    if (!compare(last, raw)) return;
    
    this.buffers.push(buf.slice(offset, index + 1));
    var buf = Buffer.concat(this.buffers);
    var k = buf.length - raw.length;
    return [ buf.slice(0, k), buf.slice(k) ];
};

function compare (a, b) {
    if (a.length < b.length) return false;
    for (var i=a.length-1, j=b.length-1; i >= 0 && j >= 0; i--, j--) {
        if (lower(a[i]) !== lower(b[j])) return false;
    }
    return true;
}

function lower (n) {
    if (n >= 65 && n <= 90) return n + 32;
    return n;
}

function isWhiteSpace(b) {
  return b === 0x20 || b === 0x09 || b === 0x0A || b === 0x0C || b === 0x0D;
}

}).call(this,require("buffer").Buffer)
},{"buffer":102,"inherits":39,"readable-stream":37}],32:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"./_stream_readable":34,"./_stream_writable":36,"_process":110,"core-util-is":4,"dup":22,"inherits":39}],33:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"./_stream_transform":35,"core-util-is":4,"dup":23,"inherits":39}],34:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;

/*<replacement>*/
if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

var Stream = require('stream');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = false;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // In streams that never have any data, and do push(null) right away,
  // the consumer can miss the 'end' event if they do some I/O before
  // consuming the stream.  So, we don't emit('end') until some reading
  // happens.
  this.calledRead = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (typeof chunk === 'string' && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null || chunk === undefined) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      // update the buffer info.
      state.length += state.objectMode ? 1 : chunk.length;
      if (addToFront) {
        state.buffer.unshift(chunk);
      } else {
        state.reading = false;
        state.buffer.push(chunk);
      }

      if (state.needReadable)
        emitReadable(stream);

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  var state = this._readableState;
  state.calledRead = true;
  var nOrig = n;
  var ret;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    ret = null;

    // In cases where the decoder did not receive enough data
    // to produce a full chunk, then immediately received an
    // EOF, state.buffer will contain [<Buffer >, <Buffer 00 ...>].
    // howMuchToRead will see this and coerce the amount to
    // read to zero (because it's looking at the length of the
    // first <Buffer > in state.buffer), and we'll end up here.
    //
    // This can only happen via state.decoder -- no other venue
    // exists for pushing a zero-length chunk into state.buffer
    // and triggering this behavior. In this case, we return our
    // remaining data and end the stream, if appropriate.
    if (state.length > 0 && state.decoder) {
      ret = fromList(n, state);
      state.length -= ret.length;
    }

    if (state.length === 0)
      endReadable(this);

    return ret;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;

  // if we currently have less than the highWaterMark, then also read some
  if (state.length - n <= state.highWaterMark)
    doRead = true;

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading)
    doRead = false;

  if (doRead) {
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read called its callback synchronously, then `reading`
  // will be false, and we need to re-evaluate how much data we
  // can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we happened to read() exactly the remaining amount in the
  // buffer, and the EOF has been seen at this point, then make sure
  // that we emit 'end' on the very next tick.
  if (state.ended && !state.endEmitted && state.length === 0)
    endReadable(this);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // if we've ended and we have some data left, then emit
  // 'readable' now to make sure it gets picked up.
  if (state.length > 0)
    emitReadable(stream);
  else
    endReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (state.emittedReadable)
    return;

  state.emittedReadable = true;
  if (state.sync)
    process.nextTick(function() {
      emitReadable_(stream);
    });
  else
    emitReadable_(stream);
}

function emitReadable_(stream) {
  stream.emit('readable');
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    process.nextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    if (readable !== src) return;
    cleanup();
  }

  function onend() {
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (!dest._writableState || dest._writableState.needDrain)
      ondrain();
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    unpipe();
    dest.removeListener('error', onerror);
    if (EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];



  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    // the handler that waits for readable events after all
    // the data gets sucked out in flow.
    // This would be easier to follow with a .once() handler
    // in flow(), but that is too slow.
    this.on('readable', pipeOnReadable);

    state.flowing = true;
    process.nextTick(function() {
      flow(src);
    });
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var dest = this;
    var state = src._readableState;
    state.awaitDrain--;
    if (state.awaitDrain === 0)
      flow(src);
  };
}

function flow(src) {
  var state = src._readableState;
  var chunk;
  state.awaitDrain = 0;

  function write(dest, i, list) {
    var written = dest.write(chunk);
    if (false === written) {
      state.awaitDrain++;
    }
  }

  while (state.pipesCount && null !== (chunk = src.read())) {

    if (state.pipesCount === 1)
      write(state.pipes, 0, null);
    else
      forEach(state.pipes, write);

    src.emit('data', chunk);

    // if anyone needs a drain, then we have to wait for that.
    if (state.awaitDrain > 0)
      return;
  }

  // if every destination was unpiped, either before entering this
  // function, or in the while loop, then stop flowing.
  //
  // NB: This is a pretty rare edge case.
  if (state.pipesCount === 0) {
    state.flowing = false;

    // if there were data event listeners added, then switch to old mode.
    if (EE.listenerCount(src, 'data') > 0)
      emitDataEvents(src);
    return;
  }

  // at this point, no one needed a drain, so we just ran out of data
  // on the next readable event, start it over again.
  state.ranOut = true;
}

function pipeOnReadable() {
  if (this._readableState.ranOut) {
    this._readableState.ranOut = false;
    flow(this);
  }
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data' && !this._readableState.flowing)
    emitDataEvents(this);

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        this.read(0);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  emitDataEvents(this);
  this.read(0);
  this.emit('resume');
};

Readable.prototype.pause = function() {
  emitDataEvents(this, true);
  this.emit('pause');
};

function emitDataEvents(stream, startPaused) {
  var state = stream._readableState;

  if (state.flowing) {
    // https://github.com/isaacs/readable-stream/issues/16
    throw new Error('Cannot switch to old mode now.');
  }

  var paused = startPaused || false;
  var readable = false;

  // convert to an old-style stream.
  stream.readable = true;
  stream.pipe = Stream.prototype.pipe;
  stream.on = stream.addListener = Stream.prototype.on;

  stream.on('readable', function() {
    readable = true;

    var c;
    while (!paused && (null !== (c = stream.read())))
      stream.emit('data', c);

    if (c === null) {
      readable = false;
      stream._readableState.needReadable = true;
    }
  });

  stream.pause = function() {
    paused = true;
    this.emit('pause');
  };

  stream.resume = function() {
    paused = false;
    if (readable)
      process.nextTick(function() {
        stream.emit('readable');
      });
    else
      this.read(0);
    this.emit('resume');
  };

  // now make it start, just in case it hadn't already.
  stream.emit('readable');
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    if (state.decoder)
      chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    //if (state.objectMode && util.isNullOrUndefined(chunk))
    if (state.objectMode && (chunk === null || chunk === undefined))
      return;
    else if (!state.objectMode && (!chunk || !chunk.length))
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (typeof stream[i] === 'function' &&
        typeof this[i] === 'undefined') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted && state.calledRead) {
    state.ended = true;
    process.nextTick(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))
},{"_process":110,"buffer":102,"core-util-is":4,"events":104,"inherits":39,"isarray":40,"stream":122,"string_decoder/":71}],35:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  var ts = this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('finish', function() {
    if ('function' === typeof this._flush)
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var rs = stream._readableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":32,"core-util-is":4,"inherits":39}],36:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;

/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Stream = require('stream');

util.inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  process.nextTick(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    process.nextTick(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb))
    ret = writeOrBuffer(this, state, chunk, encoding, cb);

  return ret;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    process.nextTick(function() {
      cb(er);
    });
  else
    cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished && !state.bufferProcessing && state.buffer.length)
      clearBuffer(stream, state);

    if (sync) {
      process.nextTick(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  cb();
  if (finished)
    finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  for (var c = 0; c < state.buffer.length; c++) {
    var entry = state.buffer[c];
    var chunk = entry.chunk;
    var encoding = entry.encoding;
    var cb = entry.callback;
    var len = state.objectMode ? 1 : chunk.length;

    doWrite(stream, state, len, chunk, encoding, cb);

    // if we didn't call the onwrite immediately, then
    // it means that we need to wait until it does.
    // also, that means that the chunk and cb are currently
    // being processed, so move the buffer counter past them.
    if (state.writing) {
      c++;
      break;
    }
  }

  state.bufferProcessing = false;
  if (c < state.buffer.length)
    state.buffer = state.buffer.slice(c);
  else
    state.buffer.length = 0;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (typeof chunk !== 'undefined' && chunk !== null)
    this.write(chunk, encoding);

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    state.finished = true;
    stream.emit('finish');
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      process.nextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

}).call(this,require('_process'))
},{"./_stream_duplex":32,"_process":110,"buffer":102,"core-util-is":4,"inherits":39,"stream":122}],37:[function(require,module,exports){
var Stream = require('stream'); // hack to fix a circular dependency issue when used with browserify
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = Stream;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":32,"./lib/_stream_passthrough.js":33,"./lib/_stream_readable.js":34,"./lib/_stream_transform.js":35,"./lib/_stream_writable.js":36,"stream":122}],38:[function(require,module,exports){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
},{}],39:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],40:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],41:[function(require,module,exports){
(function (process){
'use strict';
module.exports = nextTick;

function nextTick(fn) {
  var args = new Array(arguments.length - 1);
  var i = 0;
  while (i < args.length) {
    args[i++] = arguments[i];
  }
  process.nextTick(function afterTick() {
    fn.apply(null, args);
  });
}

}).call(this,require('_process'))
},{"_process":110}],42:[function(require,module,exports){
// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


module.exports = Duplex;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/



/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

},{"./_stream_readable":44,"./_stream_writable":46,"core-util-is":4,"inherits":39,"process-nextick-args":41}],43:[function(require,module,exports){
// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":45,"core-util-is":4,"inherits":39}],44:[function(require,module,exports){
(function (process){
'use strict';

module.exports = Readable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/


/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events');

/*<replacement>*/
var EElistenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/



/*<replacement>*/
var Stream;
(function (){try{
  Stream = require('st' + 'ream');
}catch(_){}finally{
  if (!Stream)
    Stream = require('events').EventEmitter;
}}())
/*</replacement>*/

var Buffer = require('buffer').Buffer;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/



/*<replacement>*/
var debugUtil = require('util');
var debug;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  var Duplex = require('./_stream_duplex');

  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options && typeof options.read === 'function')
    this._read = options.read;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (!state.objectMode && typeof chunk === 'string') {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

Readable.prototype.isPaused = function() {
  return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      if (!addToFront)
        state.reading = false;

      // if we want the data now, just emit it.
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit('data', chunk);
        stream.read(0);
      } else {
        // update the buffer info.
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront)
          state.buffer.unshift(chunk);
        else
          state.buffer.push(chunk);

        if (state.needReadable)
          emitReadable(stream);
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}


// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = computeNewHighWaterMark(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else {
      return state.length;
    }
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended)
      endReadable(this);
    else
      emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0)
    endReadable(this);

  if (ret !== null)
    this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!(Buffer.isBuffer(chunk)) &&
      typeof chunk !== 'string' &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync)
      processNextTick(emitReadable_, stream);
    else
      emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    processNextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain &&
        (!dest._writableState || dest._writableState.needDrain))
      ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      if (state.pipesCount === 1 &&
          state.pipes[0] === dest &&
          src.listenerCount('data') === 1 &&
          !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];


  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain)
      state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0);
}

Readable.prototype.pause = function() {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    debug('wrapped data');
    if (state.decoder)
      chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined))
      return;
    else if (!state.objectMode && (!chunk || !chunk.length))
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }; }(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};


// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else if (list.length === 1)
      ret = list[0];
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))
},{"./_stream_duplex":42,"_process":110,"buffer":102,"core-util-is":4,"events":104,"inherits":39,"isarray":40,"process-nextick-args":41,"string_decoder/":71,"util":101}],45:[function(require,module,exports){
// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function')
      this._transform = options.transform;

    if (typeof options.flush === 'function')
      this._flush = options.flush;
  }

  this.once('prefinish', function() {
    if (typeof this._flush === 'function')
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":42,"core-util-is":4,"inherits":39}],46:[function(require,module,exports){
// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

module.exports = Writable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/


/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/



/*<replacement>*/
var Stream;
(function (){try{
  Stream = require('st' + 'ream');
}catch(_){}finally{
  if (!Stream)
    Stream = require('events').EventEmitter;
}}())
/*</replacement>*/

var Buffer = require('buffer').Buffer;

util.inherits(Writable, Stream);

function nop() {}

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

function WritableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

WritableState.prototype.getBuffer = function writableStateGetBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function (){try {
Object.defineProperty(WritableState.prototype, 'buffer', {
  get: internalUtil.deprecate(function() {
    return this.getBuffer();
  }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' +
     'instead.')
});
}catch(_){}}());


function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function')
      this._write = options.write;

    if (typeof options.writev === 'function')
      this._writev = options.writev;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;

  if (!(Buffer.isBuffer(chunk)) &&
      typeof chunk !== 'string' &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = nop;

  if (state.ended)
    writeAfterEnd(this, cb);
  else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function() {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function() {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing &&
        !state.corked &&
        !state.finished &&
        !state.bufferProcessing &&
        state.bufferedRequest)
      clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string')
    encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64',
'ucs2', 'ucs-2','utf16le', 'utf-16le', 'raw']
.indexOf((encoding + '').toLowerCase()) > -1))
    throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev)
    stream._writev(chunk, state.onwrite);
  else
    stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync)
    processNextTick(cb, er);
  else
    cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished &&
        !state.corked &&
        !state.bufferProcessing &&
        state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      processNextTick(afterWrite, stream, state, finished, cb);
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var buffer = [];
    var cbs = [];
    while (entry) {
      cbs.push(entry.callback);
      buffer.push(entry);
      entry = entry.next;
    }

    // count the one we are adding, as well.
    // TODO(isaacs) clean this up
    state.pendingcb++;
    state.lastBufferedRequest = null;
    doWrite(stream, state, true, state.length, buffer, '', function(err) {
      for (var i = 0; i < cbs.length; i++) {
        state.pendingcb--;
        cbs[i](err);
      }
    });

    // Clear buffer
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null)
      state.lastBufferedRequest = null;
  }
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined)
    this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(state) {
  return (state.ending &&
          state.length === 0 &&
          state.bufferedRequest === null &&
          !state.finished &&
          !state.writing);
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else {
      prefinish(stream, state);
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      processNextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

},{"./_stream_duplex":42,"buffer":102,"core-util-is":4,"events":104,"inherits":39,"process-nextick-args":41,"util-deprecate":98}],47:[function(require,module,exports){
var Stream = (function (){
  try {
    return require('st' + 'ream'); // hack to fix a circular dependency issue when used with browserify
  } catch(_){}
}());
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = Stream || exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":42,"./lib/_stream_passthrough.js":43,"./lib/_stream_readable.js":44,"./lib/_stream_transform.js":45,"./lib/_stream_writable.js":46}],48:[function(require,module,exports){
var Readable = require('readable-stream').Readable;

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
module.exports = wrap;
module.exports.obj = function (stream, opts) {
  if (!opts) opts = {};
  opts.objectMode = true;
  return wrap(stream, opts);
};

function wrap (stream, opts) {
  var self = new Readable(opts)
  var state = self._readableState;
  var paused = false;

  stream.on('end', function() {
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    if (state.decoder)
      chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    //if (state.objectMode && util.isNullOrUndefined(chunk))
    if (state.objectMode && (chunk === null || chunk === undefined))
      return
    else if (!state.objectMode && (!chunk || !chunk.length))
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (typeof stream[i] === 'function' &&
        typeof self[i] === 'undefined') {
      self[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  for (var i = 0; i < events.length; i++) (function (ev) {
    stream.on(ev, function () {
      var args = [ ev ].concat([].slice.call(arguments));
      self.emit.apply(self, args);
    })
  })(events[i]);

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};

},{"readable-stream":54}],49:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"./_stream_readable":51,"./_stream_writable":53,"_process":110,"core-util-is":4,"dup":22,"inherits":39}],50:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"./_stream_transform":52,"core-util-is":4,"dup":23,"inherits":39}],51:[function(require,module,exports){
arguments[4][24][0].apply(exports,arguments)
},{"./_stream_duplex":49,"_process":110,"buffer":102,"core-util-is":4,"dup":24,"events":104,"inherits":39,"isarray":40,"stream":122,"string_decoder/":71,"util":101}],52:[function(require,module,exports){
arguments[4][25][0].apply(exports,arguments)
},{"./_stream_duplex":49,"core-util-is":4,"dup":25,"inherits":39}],53:[function(require,module,exports){
arguments[4][26][0].apply(exports,arguments)
},{"./_stream_duplex":49,"_process":110,"buffer":102,"core-util-is":4,"dup":26,"inherits":39,"stream":122}],54:[function(require,module,exports){
arguments[4][27][0].apply(exports,arguments)
},{"./lib/_stream_duplex.js":49,"./lib/_stream_passthrough.js":50,"./lib/_stream_readable.js":51,"./lib/_stream_transform.js":52,"./lib/_stream_writable.js":53,"dup":27,"stream":122}],55:[function(require,module,exports){
var duplexer = require('duplexer2')
var through = require('through2')

module.exports = function () {
  var streams
  if(arguments.length == 1 && Array.isArray(arguments[0])) {
    streams = arguments[0]
  } else {
    streams = [].slice.call(arguments)
  }
  return combine(streams)
}

module.exports.obj = function () {
  var streams
  if(arguments.length == 1 && Array.isArray(arguments[0])) {
    streams = arguments[0]
  } else {
    streams = [].slice.call(arguments)
  }
  return combine(streams, { objectMode: true })
}

  
function combine (streams, opts) {

  for (var i = 0; i < streams.length; i++)
    streams[i] = wrap(streams[i], opts)

  if(streams.length == 0)
    return through(opts)
  else if(streams.length == 1)
    return streams[0]

  var first = streams[0]
    , last = streams[streams.length - 1]
    , thepipe = duplexer(first, last)

  //pipe all the streams together

  function recurse (streams) {
    if(streams.length < 2)
      return
    streams[0].pipe(streams[1])
    recurse(streams.slice(1))
  }

  recurse(streams)

  function onerror () {
    var args = [].slice.call(arguments)
    args.unshift('error')
    thepipe.emit.apply(thepipe, args)
  }

  //es.duplex already reemits the error from the first and last stream.
  //add a listener for the inner streams in the pipeline.
  for(var i = 1; i < streams.length - 1; i ++)
    streams[i].on('error', onerror)

  return thepipe
}

function wrap (tr, opts) {
  if (typeof tr.read === 'function') return tr
  if (!opts) opts = tr._options || {}
  var input = through(opts), output = through(opts)
  input.pipe(tr).pipe(output)
  var dup = duplexer(input, output)
  tr.on('error', function (err) { dup.emit('error', err) });
  return dup;
}

},{"duplexer2":56,"through2":78}],56:[function(require,module,exports){
arguments[4][21][0].apply(exports,arguments)
},{"dup":21,"readable-stream":62}],57:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"./_stream_readable":59,"./_stream_writable":61,"_process":110,"core-util-is":4,"dup":22,"inherits":39}],58:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"./_stream_transform":60,"core-util-is":4,"dup":23,"inherits":39}],59:[function(require,module,exports){
arguments[4][24][0].apply(exports,arguments)
},{"./_stream_duplex":57,"_process":110,"buffer":102,"core-util-is":4,"dup":24,"events":104,"inherits":39,"isarray":40,"stream":122,"string_decoder/":71,"util":101}],60:[function(require,module,exports){
arguments[4][25][0].apply(exports,arguments)
},{"./_stream_duplex":57,"core-util-is":4,"dup":25,"inherits":39}],61:[function(require,module,exports){
arguments[4][26][0].apply(exports,arguments)
},{"./_stream_duplex":57,"_process":110,"buffer":102,"core-util-is":4,"dup":26,"inherits":39,"stream":122}],62:[function(require,module,exports){
arguments[4][27][0].apply(exports,arguments)
},{"./lib/_stream_duplex.js":57,"./lib/_stream_passthrough.js":58,"./lib/_stream_readable.js":59,"./lib/_stream_transform.js":60,"./lib/_stream_writable.js":61,"dup":27,"stream":122}],63:[function(require,module,exports){
(function (process){
var Duplex = require('readable-stream').Duplex;
var Readable = require('readable-stream').Readable;
var Pass = require('readable-stream').PassThrough;
var inherits = require('inherits');
var isArray = require('isarray');
var indexof = require('indexof');
var wrap = require('readable-wrap');

var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate : process.nextTick
;

module.exports = Pipeline;
inherits(Pipeline, Duplex);

module.exports.obj = function (streams, opts) {
    if (!opts && !isArray(streams)) {
        opts = streams;
        streams = [];
    }
    if (!streams) streams = [];
    if (!opts) opts = {};
    opts.objectMode = true;
    return new Pipeline(streams, opts);
};

function Pipeline (streams, opts) {
    if (!(this instanceof Pipeline)) return new Pipeline(streams, opts);
    if (!opts && !isArray(streams)) {
        opts = streams;
        streams = [];
    }
    if (!streams) streams = [];
    if (!opts) opts = {};
    Duplex.call(this, opts);
    
    var self = this;
    this._options = opts;
    this._wrapOptions = { objectMode: opts.objectMode !== false };
    this._streams = [];
    
    this.splice.apply(this, [ 0, 0 ].concat(streams));
    
    this.once('finish', function () {
        self._notEmpty();
        self._streams[0].end();
    });
}

Pipeline.prototype._read = function () {
    var self = this;
    this._notEmpty();
    
    var r = this._streams[this._streams.length-1];
    var buf, reads = 0;
    while ((buf = r.read()) !== null) {
        Duplex.prototype.push.call(this, buf);
        reads ++;
    }
    if (reads === 0) {
        var onreadable = function () {
            r.removeListener('readable', onreadable);
            self.removeListener('_mutate', onreadable);
            self._read()
        };
        r.once('readable', onreadable);
        self.once('_mutate', onreadable);
    }
};

Pipeline.prototype._write = function (buf, enc, next) {
    this._notEmpty();
    this._streams[0]._write(buf, enc, next);
};

Pipeline.prototype._notEmpty = function () {
    var self = this;
    if (this._streams.length > 0) return;
    var stream = new Pass(this._options);
    stream.once('end', function () {
        var ix = indexof(self._streams, stream);
        if (ix >= 0 && ix === self._streams.length - 1) {
            Duplex.prototype.push.call(self, null);
        }
    });
    this._streams.push(stream);
    this.length = this._streams.length;
};

Pipeline.prototype.push = function (stream) {
    var args = [ this._streams.length, 0 ].concat([].slice.call(arguments));
    this.splice.apply(this, args);
    return this._streams.length;
};

Pipeline.prototype.pop = function () {
    return this.splice(this._streams.length-1,1)[0];
};

Pipeline.prototype.shift = function () {
    return this.splice(0,1)[0];
};

Pipeline.prototype.unshift = function () {
    this.splice.apply(this, [0,0].concat([].slice.call(arguments)));
    return this._streams.length;
};

Pipeline.prototype.splice = function (start, removeLen) {
    var self = this;
    var len = this._streams.length;
    start = start < 0 ? len - start : start;
    if (removeLen === undefined) removeLen = len - start;
    removeLen = Math.max(0, Math.min(len - start, removeLen));
    
    for (var i = start; i < start + removeLen; i++) {
        if (self._streams[i-1]) {
            self._streams[i-1].unpipe(self._streams[i]);
        }
    }
    if (self._streams[i-1] && self._streams[i]) {
        self._streams[i-1].unpipe(self._streams[i]);
    }
    var end = i;
    
    var reps = [], args = arguments;
    for (var j = 2; j < args.length; j++) (function (stream) {
        if (isArray(stream)) {
            stream = new Pipeline(stream, self._options);
        }
        stream.on('error', function (err) {
            err.stream = this;
            self.emit('error', err);
        });
        stream = self._wrapStream(stream);
        stream.once('end', function () {
            var ix = indexof(self._streams, stream);
            if (ix >= 0 && ix === self._streams.length - 1) {
                Duplex.prototype.push.call(self, null);
            }
        });
        reps.push(stream);
    })(arguments[j]);
    
    for (var i = 0; i < reps.length - 1; i++) {
        reps[i].pipe(reps[i+1]);
    }
    
    if (reps.length && self._streams[end]) {
        reps[reps.length-1].pipe(self._streams[end]);
    }
    if (reps[0] && self._streams[start-1]) {
        self._streams[start-1].pipe(reps[0]);
    }
    
    var sargs = [start,removeLen].concat(reps);
    var removed = self._streams.splice.apply(self._streams, sargs);
    
    this.emit('_mutate');
    this.length = this._streams.length;
    return removed;
};

Pipeline.prototype.get = function () {
    if (arguments.length === 0) return undefined;
    
    var base = this;
    for (var i = 0; i < arguments.length; i++) {
        var index = arguments[i];
        if (index < 0) {
            base = base._streams[base._streams.length + index];
        }
        else {
            base = base._streams[index];
        }
        if (!base) return undefined;
    }
    return base;
};

Pipeline.prototype.indexOf = function (stream) {
    return indexof(this._streams, stream);
};

Pipeline.prototype._wrapStream = function (stream) {
    if (typeof stream.read === 'function') return stream;
    var w = wrap(stream, this._wrapOptions);
    w._write = function (buf, enc, next) {
        if (stream.write(buf) === false) {
            stream.once('drain', next);
        }
        else nextTick(next);
    };
    return w;
};

}).call(this,require('_process'))
},{"_process":110,"indexof":38,"inherits":39,"isarray":40,"readable-stream":69,"readable-wrap":48}],64:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"./_stream_readable":66,"./_stream_writable":68,"_process":110,"core-util-is":4,"dup":22,"inherits":39}],65:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"./_stream_transform":67,"core-util-is":4,"dup":23,"inherits":39}],66:[function(require,module,exports){
arguments[4][24][0].apply(exports,arguments)
},{"./_stream_duplex":64,"_process":110,"buffer":102,"core-util-is":4,"dup":24,"events":104,"inherits":39,"isarray":40,"stream":122,"string_decoder/":71,"util":101}],67:[function(require,module,exports){
arguments[4][25][0].apply(exports,arguments)
},{"./_stream_duplex":64,"core-util-is":4,"dup":25,"inherits":39}],68:[function(require,module,exports){
arguments[4][26][0].apply(exports,arguments)
},{"./_stream_duplex":64,"_process":110,"buffer":102,"core-util-is":4,"dup":26,"inherits":39,"stream":122}],69:[function(require,module,exports){
arguments[4][27][0].apply(exports,arguments)
},{"./lib/_stream_duplex.js":64,"./lib/_stream_passthrough.js":65,"./lib/_stream_readable.js":66,"./lib/_stream_transform.js":67,"./lib/_stream_writable.js":68,"dup":27,"stream":122}],70:[function(require,module,exports){
(function (process,Buffer){
module.exports = StringStream

var inherits = require('inherits')
var stream = require('stream')

inherits(StringStream, stream.Readable)

function StringStream (str) {
  if (!(this instanceof StringStream)) return new StringStream(str)
  stream.Readable.call(this)
  this._str = str
}

StringStream.prototype._read = function () {
  if (!this.ended) {
    var self = this
    process.nextTick(function () {
      self.push(new Buffer(self._str))
      self.push(null)
    })
    this.ended = true
  }
}

}).call(this,require('_process'),require("buffer").Buffer)
},{"_process":110,"buffer":102,"inherits":39,"stream":122}],71:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":102}],72:[function(require,module,exports){
(function (process){
var Stream = require('stream')

// through
//
// a stream that does nothing but re-emit the input.
// useful for aggregating a series of changing but not ending streams into one stream)

exports = module.exports = through
through.through = through

//create a readable writable stream.

function through (write, end, opts) {
  write = write || function (data) { this.queue(data) }
  end = end || function () { this.queue(null) }

  var ended = false, destroyed = false, buffer = [], _ended = false
  var stream = new Stream()
  stream.readable = stream.writable = true
  stream.paused = false

//  stream.autoPause   = !(opts && opts.autoPause   === false)
  stream.autoDestroy = !(opts && opts.autoDestroy === false)

  stream.write = function (data) {
    write.call(this, data)
    return !stream.paused
  }

  function drain() {
    while(buffer.length && !stream.paused) {
      var data = buffer.shift()
      if(null === data)
        return stream.emit('end')
      else
        stream.emit('data', data)
    }
  }

  stream.queue = stream.push = function (data) {
//    console.error(ended)
    if(_ended) return stream
    if(data === null) _ended = true
    buffer.push(data)
    drain()
    return stream
  }

  //this will be registered as the first 'end' listener
  //must call destroy next tick, to make sure we're after any
  //stream piped from here.
  //this is only a problem if end is not emitted synchronously.
  //a nicer way to do this is to make sure this is the last listener for 'end'

  stream.on('end', function () {
    stream.readable = false
    if(!stream.writable && stream.autoDestroy)
      process.nextTick(function () {
        stream.destroy()
      })
  })

  function _end () {
    stream.writable = false
    end.call(stream)
    if(!stream.readable && stream.autoDestroy)
      stream.destroy()
  }

  stream.end = function (data) {
    if(ended) return
    ended = true
    if(arguments.length) stream.write(data)
    _end() // will emit or queue
    return stream
  }

  stream.destroy = function () {
    if(destroyed) return
    destroyed = true
    ended = true
    buffer.length = 0
    stream.writable = stream.readable = false
    stream.emit('close')
    return stream
  }

  stream.pause = function () {
    if(stream.paused) return
    stream.paused = true
    return stream
  }

  stream.resume = function () {
    if(stream.paused) {
      stream.paused = false
      stream.emit('resume')
    }
    drain()
    //may have become paused again,
    //as drain emits 'data'.
    if(!stream.paused)
      stream.emit('drain')
    return stream
  }
  return stream
}


}).call(this,require('_process'))
},{"_process":110,"stream":122}],73:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"./_stream_readable":74,"./_stream_writable":76,"_process":110,"core-util-is":4,"dup":22,"inherits":39}],74:[function(require,module,exports){
arguments[4][34][0].apply(exports,arguments)
},{"_process":110,"buffer":102,"core-util-is":4,"dup":34,"events":104,"inherits":39,"isarray":40,"stream":122,"string_decoder/":71}],75:[function(require,module,exports){
arguments[4][35][0].apply(exports,arguments)
},{"./_stream_duplex":73,"core-util-is":4,"dup":35,"inherits":39}],76:[function(require,module,exports){
arguments[4][36][0].apply(exports,arguments)
},{"./_stream_duplex":73,"_process":110,"buffer":102,"core-util-is":4,"dup":36,"inherits":39,"stream":122}],77:[function(require,module,exports){
arguments[4][28][0].apply(exports,arguments)
},{"./lib/_stream_transform.js":75,"dup":28}],78:[function(require,module,exports){
var Transform = require('readable-stream/transform')
  , inherits  = require('util').inherits
  , xtend     = require('xtend')


// a noop _transform function
function noop (chunk, enc, callback) {
  callback(null, chunk)
}


// create a new export function, used by both the main export and
// the .ctor export, contains common logic for dealing with arguments
function through2 (construct) {
  return function (options, transform, flush) {
    if (typeof options == 'function') {
      flush     = transform
      transform = options
      options   = {}
    }

    if (typeof transform != 'function')
      transform = noop

    if (typeof flush != 'function')
      flush = null

    return construct(options, transform, flush)
  }
}


// main export, just make me a transform stream!
module.exports = through2(function (options, transform, flush) {
  var t2 = new Transform(options)

  t2._transform = transform

  if (flush)
    t2._flush = flush

  return t2
})


// make me a reusable prototype that I can `new`, or implicitly `new`
// with a constructor call
module.exports.ctor = through2(function (options, transform, flush) {
  function Through2 (override) {
    if (!(this instanceof Through2))
      return new Through2(override)

    this.options = xtend(options, override)

    Transform.call(this, this.options)
  }

  inherits(Through2, Transform)

  Through2.prototype._transform = transform

  if (flush)
    Through2.prototype._flush = flush

  return Through2
})


module.exports.obj = through2(function (options, transform, flush) {
  var t2 = new Transform(xtend({ objectMode: true, highWaterMark: 16 }, options))

  t2._transform = transform

  if (flush)
    t2._flush = flush

  return t2
})

},{"readable-stream/transform":77,"util":126,"xtend":99}],79:[function(require,module,exports){
var Duplex = require('readable-stream').Duplex;
var inherits = require('inherits');
var through = require('through2');
var duplexer = require('duplexer2');

var tokenize = require('html-tokenize');
var select = require('html-select');

var wrapElem = require('./lib/wrap.js');

module.exports = Trumpet;
inherits(Trumpet, Duplex);

function Trumpet () {
    var self = this;
    if (!(this instanceof Trumpet)) return new Trumpet;
    Duplex.call(this);
    this._tokenize = tokenize();
    this._writing = false;
    this._piping = false;
    this._select = this._tokenize.pipe(select());
    this._select.once('end', function () {
        self.emit('_end');
        self.push(null)
    });
    this.once('finish', function () { self._tokenize.end() });
}

Trumpet.prototype.pipe = function () {
    this._piping = true;
    return Duplex.prototype.pipe.apply(this, arguments);
};

Trumpet.prototype._read = function (n) {
    var row;
    var self = this;
    var buf, read = 0;
    var s = this._select;
    while ((row = s.read()) !== null) {
        if (row[0] === 'END') {
            this.push(row[1][1])
            read ++
        }
        else if (row[1] && row[1].length) {
            this.push(row[1]);
            read ++;
        }
    }
    if (read === 0) s.once('readable', function () { self._read(n) });
};

Trumpet.prototype._write = function (buf, enc, next) {
    if (!this._writing && !this._piping) {
        this._piping = true;
        this.resume();
    }
    return this._tokenize._write(buf, enc, next);
};

Trumpet.prototype.select = function (str, cb) {
    var self = this;
    var first = true;
    
    var res = self._selectAll(str, function (elem) {
        if (!first) return;
        first = false;
        res.createReadStream = function () {};
        res.createWriteStream = function () {};
        res.createStream = function () {};
        if (cb) cb(elem);
    });
    return res;
};

Trumpet.prototype.selectAll = function (str, cb) {
    return this._selectAll(str, cb);
};

Trumpet.prototype._selectAll = function (str, cb) {
    var self = this;
    var readers = [], writers = [], duplex = [];
    var gets = [], getss = [], sets = [], removes = [];
    
    this.once('_end', function () {
        readers.splice(0).forEach(function (r) {
            r.end();
            r.resume();
        });
        
        duplex.splice(0).forEach(function (d) {
            d.input.end();
            d.input.resume();
        });
    });
    
    var element, welem;
    this._select.select(str, function (elem) {
        element = elem;
        welem = wrapElem(elem);
        if (cb) cb(welem);
        
        elem.once('close', function () {
            element = null;
            welem = null;
        });
        
        readers.splice(0).forEach(function (r) {
            welem.createReadStream(r._options).pipe(r);
        });
        
        writers.splice(0).forEach(function (w) {
            w.pipe(welem.createWriteStream(w._options));
        });
        
        duplex.splice(0).forEach(function (d) {
            d.input.pipe(welem.createStream(d.options))
                .pipe(d.output)
            ;
        });
        
        gets.splice(0).forEach(function (g) {
            welem.getAttribute(g[0], g[1]);
        });
        
        getss.splice(0).forEach(function (cb) {
            welem.getAttributes(cb);
        });
        
        sets.splice(0).forEach(function (g) {
            welem.setAttribute(g[0], g[1]);
        });
        
        removes.splice(0).forEach(function (key) {
            welem.removeAttribute(key);
        });
    });
    
    return {
        getAttribute: function (key, cb) {
            if (welem) return welem.getAttribute(key, cb);
            gets.push([ key, cb ]);
            return this;
        },
        getAttributes: function (cb) {
            getss.push(cb);
            return this;
        },
        setAttribute: function (key, value) {
            if (welem) return welem.setAttribute(key, value);
            sets.push([ key, value ]);
            return this;
        },
        removeAttribute: function (key) {
            if (welem) return welem.removeAttribute(key);
            removes.push(key);
            return this;
        },
        createReadStream: function (opts) {
            if (welem) return welem.createReadStream(opts);
            var r = through();
            r._options = opts;
            readers.push(r);
            return r;
        },
        createWriteStream: function (opts) {
            if (welem) return welem.createWriteStream(opts);
            var w = through();
            w._options = opts;
            writers.push(w);
            return w;
        },
        createStream: function (opts) {
            if (welem) return welem.createStream(opts);
            var d = { input: through(), output: through() };
            d.options = opts;
            duplex.push(d);
            return duplexer(d.input, d.output);
        }
    };
};

Trumpet.prototype.createReadStream = function (sel, opts) {
    return this.select(sel).createReadStream(opts);
};

Trumpet.prototype.createWriteStream = function (sel, opts) {
    return this.select(sel).createWriteStream(opts);
};

Trumpet.prototype.createStream = function (sel, opts) {
    return this.select(sel).createStream(opts);
};

},{"./lib/wrap.js":80,"duplexer2":81,"html-select":12,"html-tokenize":31,"inherits":39,"readable-stream":87,"through2":89}],80:[function(require,module,exports){
var Duplex = require('readable-stream').Duplex;
var Readable = require('readable-stream').Readable;
var Writable = require('readable-stream').Writable;

module.exports = function (elem) {
    var welem = {};
    
    welem.name = elem.name;
    
    welem.getAttribute = function (key, cb) {
        var value = elem.getAttribute(String(key).toLowerCase());
        if (cb) cb(value);
        return value;
    };
    
    welem.getAttributes = function (cb) {
        var attrs = elem.getAttributes();
        if (cb) cb(attrs);
        return attrs;
    };
    
    welem.setAttribute = function (key, value) {
        elem.setAttribute(key, value);
    };
    
    welem.removeAttribute = function (key) {
        elem.removeAttribute(key);
    };
    
    welem.createReadStream = function (opts) {
        if (!opts) opts = {};
        
        var rs = elem.createReadStream({ inner: !opts.outer });
        var r = new Readable;
        r._read = function read () {
            var row, reads = 0;
            while ((row = rs.read()) !== null) {
                if (row[1].length) {
                    r.push(row[1]);
                    reads ++;
                }
            }
            if (reads === 0) rs.once('readable', read);
        };
        rs.on('end', function () { r.push(null) });
        
        return r;
    };
    
    welem.createWriteStream = function (opts) {
        if (!opts) opts = {};
        
        var ws = elem.createWriteStream({ inner: !opts.outer });
        var w = new Writable;
        w._write = function (buf, enc, next) {
            ws.write([ 'data', buf ]);
            next();
        };
        w.on('finish', function () { ws.end() });
        
        return w;
    };
    
    welem.createStream = function (opts) {
        if (!opts) opts = {};
        
        var d = new Duplex;
        var s = elem.createStream({ inner: !opts.outer });
        
        d._write = function (buf, enc, next) {
            s.write([ 'data', buf ]);
            next();
        };
        
        d._read = function read () {
            var row, reads = 0;
            while ((row = s.read()) !== null) {
                if (row[1].length) {
                    d.push(row[1]);
                    reads ++;
                }
            }
            if (reads === 0) s.once('readable', read);
        };
        
        d.on('finish', function () { s.end() });
        s.on('end', function () { d.push(null) });
        
        return d;
    };
    
    return welem;
};

},{"readable-stream":87}],81:[function(require,module,exports){
arguments[4][21][0].apply(exports,arguments)
},{"dup":21,"readable-stream":87}],82:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"./_stream_readable":84,"./_stream_writable":86,"_process":110,"core-util-is":4,"dup":22,"inherits":39}],83:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"./_stream_transform":85,"core-util-is":4,"dup":23,"inherits":39}],84:[function(require,module,exports){
arguments[4][24][0].apply(exports,arguments)
},{"./_stream_duplex":82,"_process":110,"buffer":102,"core-util-is":4,"dup":24,"events":104,"inherits":39,"isarray":40,"stream":122,"string_decoder/":71,"util":101}],85:[function(require,module,exports){
arguments[4][25][0].apply(exports,arguments)
},{"./_stream_duplex":82,"core-util-is":4,"dup":25,"inherits":39}],86:[function(require,module,exports){
arguments[4][26][0].apply(exports,arguments)
},{"./_stream_duplex":82,"_process":110,"buffer":102,"core-util-is":4,"dup":26,"inherits":39,"stream":122}],87:[function(require,module,exports){
arguments[4][27][0].apply(exports,arguments)
},{"./lib/_stream_duplex.js":82,"./lib/_stream_passthrough.js":83,"./lib/_stream_readable.js":84,"./lib/_stream_transform.js":85,"./lib/_stream_writable.js":86,"dup":27,"stream":122}],88:[function(require,module,exports){
arguments[4][28][0].apply(exports,arguments)
},{"./lib/_stream_transform.js":85,"dup":28}],89:[function(require,module,exports){
arguments[4][29][0].apply(exports,arguments)
},{"_process":110,"dup":29,"readable-stream/transform":88,"util":126,"xtend":90}],90:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"dup":30}],91:[function(require,module,exports){
var undefined = (void 0); // Paranoia

// Beyond this value, index getters/setters (i.e. array[0], array[1]) are so slow to
// create, and consume so much memory, that the browser appears frozen.
var MAX_ARRAY_LENGTH = 1e5;

// Approximations of internal ECMAScript conversion functions
var ECMAScript = (function() {
  // Stash a copy in case other scripts modify these
  var opts = Object.prototype.toString,
      ophop = Object.prototype.hasOwnProperty;

  return {
    // Class returns internal [[Class]] property, used to avoid cross-frame instanceof issues:
    Class: function(v) { return opts.call(v).replace(/^\[object *|\]$/g, ''); },
    HasProperty: function(o, p) { return p in o; },
    HasOwnProperty: function(o, p) { return ophop.call(o, p); },
    IsCallable: function(o) { return typeof o === 'function'; },
    ToInt32: function(v) { return v >> 0; },
    ToUint32: function(v) { return v >>> 0; }
  };
}());

// Snapshot intrinsics
var LN2 = Math.LN2,
    abs = Math.abs,
    floor = Math.floor,
    log = Math.log,
    min = Math.min,
    pow = Math.pow,
    round = Math.round;

// ES5: lock down object properties
function configureProperties(obj) {
  if (getOwnPropNames && defineProp) {
    var props = getOwnPropNames(obj), i;
    for (i = 0; i < props.length; i += 1) {
      defineProp(obj, props[i], {
        value: obj[props[i]],
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
  }
}

// emulate ES5 getter/setter API using legacy APIs
// http://blogs.msdn.com/b/ie/archive/2010/09/07/transitioning-existing-code-to-the-es5-getter-setter-apis.aspx
// (second clause tests for Object.defineProperty() in IE<9 that only supports extending DOM prototypes, but
// note that IE<9 does not support __defineGetter__ or __defineSetter__ so it just renders the method harmless)
var defineProp
if (Object.defineProperty && (function() {
      try {
        Object.defineProperty({}, 'x', {});
        return true;
      } catch (e) {
        return false;
      }
    })()) {
  defineProp = Object.defineProperty;
} else {
  defineProp = function(o, p, desc) {
    if (!o === Object(o)) throw new TypeError("Object.defineProperty called on non-object");
    if (ECMAScript.HasProperty(desc, 'get') && Object.prototype.__defineGetter__) { Object.prototype.__defineGetter__.call(o, p, desc.get); }
    if (ECMAScript.HasProperty(desc, 'set') && Object.prototype.__defineSetter__) { Object.prototype.__defineSetter__.call(o, p, desc.set); }
    if (ECMAScript.HasProperty(desc, 'value')) { o[p] = desc.value; }
    return o;
  };
}

var getOwnPropNames = Object.getOwnPropertyNames || function (o) {
  if (o !== Object(o)) throw new TypeError("Object.getOwnPropertyNames called on non-object");
  var props = [], p;
  for (p in o) {
    if (ECMAScript.HasOwnProperty(o, p)) {
      props.push(p);
    }
  }
  return props;
};

// ES5: Make obj[index] an alias for obj._getter(index)/obj._setter(index, value)
// for index in 0 ... obj.length
function makeArrayAccessors(obj) {
  if (!defineProp) { return; }

  if (obj.length > MAX_ARRAY_LENGTH) throw new RangeError("Array too large for polyfill");

  function makeArrayAccessor(index) {
    defineProp(obj, index, {
      'get': function() { return obj._getter(index); },
      'set': function(v) { obj._setter(index, v); },
      enumerable: true,
      configurable: false
    });
  }

  var i;
  for (i = 0; i < obj.length; i += 1) {
    makeArrayAccessor(i);
  }
}

// Internal conversion functions:
//    pack<Type>()   - take a number (interpreted as Type), output a byte array
//    unpack<Type>() - take a byte array, output a Type-like number

function as_signed(value, bits) { var s = 32 - bits; return (value << s) >> s; }
function as_unsigned(value, bits) { var s = 32 - bits; return (value << s) >>> s; }

function packI8(n) { return [n & 0xff]; }
function unpackI8(bytes) { return as_signed(bytes[0], 8); }

function packU8(n) { return [n & 0xff]; }
function unpackU8(bytes) { return as_unsigned(bytes[0], 8); }

function packU8Clamped(n) { n = round(Number(n)); return [n < 0 ? 0 : n > 0xff ? 0xff : n & 0xff]; }

function packI16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function unpackI16(bytes) { return as_signed(bytes[0] << 8 | bytes[1], 16); }

function packU16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function unpackU16(bytes) { return as_unsigned(bytes[0] << 8 | bytes[1], 16); }

function packI32(n) { return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]; }
function unpackI32(bytes) { return as_signed(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], 32); }

function packU32(n) { return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]; }
function unpackU32(bytes) { return as_unsigned(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], 32); }

function packIEEE754(v, ebits, fbits) {

  var bias = (1 << (ebits - 1)) - 1,
      s, e, f, ln,
      i, bits, str, bytes;

  function roundToEven(n) {
    var w = floor(n), f = n - w;
    if (f < 0.5)
      return w;
    if (f > 0.5)
      return w + 1;
    return w % 2 ? w + 1 : w;
  }

  // Compute sign, exponent, fraction
  if (v !== v) {
    // NaN
    // http://dev.w3.org/2006/webapi/WebIDL/#es-type-mapping
    e = (1 << ebits) - 1; f = pow(2, fbits - 1); s = 0;
  } else if (v === Infinity || v === -Infinity) {
    e = (1 << ebits) - 1; f = 0; s = (v < 0) ? 1 : 0;
  } else if (v === 0) {
    e = 0; f = 0; s = (1 / v === -Infinity) ? 1 : 0;
  } else {
    s = v < 0;
    v = abs(v);

    if (v >= pow(2, 1 - bias)) {
      e = min(floor(log(v) / LN2), 1023);
      f = roundToEven(v / pow(2, e) * pow(2, fbits));
      if (f / pow(2, fbits) >= 2) {
        e = e + 1;
        f = 1;
      }
      if (e > bias) {
        // Overflow
        e = (1 << ebits) - 1;
        f = 0;
      } else {
        // Normalized
        e = e + bias;
        f = f - pow(2, fbits);
      }
    } else {
      // Denormalized
      e = 0;
      f = roundToEven(v / pow(2, 1 - bias - fbits));
    }
  }

  // Pack sign, exponent, fraction
  bits = [];
  for (i = fbits; i; i -= 1) { bits.push(f % 2 ? 1 : 0); f = floor(f / 2); }
  for (i = ebits; i; i -= 1) { bits.push(e % 2 ? 1 : 0); e = floor(e / 2); }
  bits.push(s ? 1 : 0);
  bits.reverse();
  str = bits.join('');

  // Bits to bytes
  bytes = [];
  while (str.length) {
    bytes.push(parseInt(str.substring(0, 8), 2));
    str = str.substring(8);
  }
  return bytes;
}

function unpackIEEE754(bytes, ebits, fbits) {

  // Bytes to bits
  var bits = [], i, j, b, str,
      bias, s, e, f;

  for (i = bytes.length; i; i -= 1) {
    b = bytes[i - 1];
    for (j = 8; j; j -= 1) {
      bits.push(b % 2 ? 1 : 0); b = b >> 1;
    }
  }
  bits.reverse();
  str = bits.join('');

  // Unpack sign, exponent, fraction
  bias = (1 << (ebits - 1)) - 1;
  s = parseInt(str.substring(0, 1), 2) ? -1 : 1;
  e = parseInt(str.substring(1, 1 + ebits), 2);
  f = parseInt(str.substring(1 + ebits), 2);

  // Produce number
  if (e === (1 << ebits) - 1) {
    return f !== 0 ? NaN : s * Infinity;
  } else if (e > 0) {
    // Normalized
    return s * pow(2, e - bias) * (1 + f / pow(2, fbits));
  } else if (f !== 0) {
    // Denormalized
    return s * pow(2, -(bias - 1)) * (f / pow(2, fbits));
  } else {
    return s < 0 ? -0 : 0;
  }
}

function unpackF64(b) { return unpackIEEE754(b, 11, 52); }
function packF64(v) { return packIEEE754(v, 11, 52); }
function unpackF32(b) { return unpackIEEE754(b, 8, 23); }
function packF32(v) { return packIEEE754(v, 8, 23); }


//
// 3 The ArrayBuffer Type
//

(function() {

  /** @constructor */
  var ArrayBuffer = function ArrayBuffer(length) {
    length = ECMAScript.ToInt32(length);
    if (length < 0) throw new RangeError('ArrayBuffer size is not a small enough positive integer');

    this.byteLength = length;
    this._bytes = [];
    this._bytes.length = length;

    var i;
    for (i = 0; i < this.byteLength; i += 1) {
      this._bytes[i] = 0;
    }

    configureProperties(this);
  };

  exports.ArrayBuffer = exports.ArrayBuffer || ArrayBuffer;

  //
  // 4 The ArrayBufferView Type
  //

  // NOTE: this constructor is not exported
  /** @constructor */
  var ArrayBufferView = function ArrayBufferView() {
    //this.buffer = null;
    //this.byteOffset = 0;
    //this.byteLength = 0;
  };

  //
  // 5 The Typed Array View Types
  //

  function makeConstructor(bytesPerElement, pack, unpack) {
    // Each TypedArray type requires a distinct constructor instance with
    // identical logic, which this produces.

    var ctor;
    ctor = function(buffer, byteOffset, length) {
      var array, sequence, i, s;

      if (!arguments.length || typeof arguments[0] === 'number') {
        // Constructor(unsigned long length)
        this.length = ECMAScript.ToInt32(arguments[0]);
        if (length < 0) throw new RangeError('ArrayBufferView size is not a small enough positive integer');

        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        this.buffer = new ArrayBuffer(this.byteLength);
        this.byteOffset = 0;
      } else if (typeof arguments[0] === 'object' && arguments[0].constructor === ctor) {
        // Constructor(TypedArray array)
        array = arguments[0];

        this.length = array.length;
        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        this.buffer = new ArrayBuffer(this.byteLength);
        this.byteOffset = 0;

        for (i = 0; i < this.length; i += 1) {
          this._setter(i, array._getter(i));
        }
      } else if (typeof arguments[0] === 'object' &&
                 !(arguments[0] instanceof ArrayBuffer || ECMAScript.Class(arguments[0]) === 'ArrayBuffer')) {
        // Constructor(sequence<type> array)
        sequence = arguments[0];

        this.length = ECMAScript.ToUint32(sequence.length);
        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        this.buffer = new ArrayBuffer(this.byteLength);
        this.byteOffset = 0;

        for (i = 0; i < this.length; i += 1) {
          s = sequence[i];
          this._setter(i, Number(s));
        }
      } else if (typeof arguments[0] === 'object' &&
                 (arguments[0] instanceof ArrayBuffer || ECMAScript.Class(arguments[0]) === 'ArrayBuffer')) {
        // Constructor(ArrayBuffer buffer,
        //             optional unsigned long byteOffset, optional unsigned long length)
        this.buffer = buffer;

        this.byteOffset = ECMAScript.ToUint32(byteOffset);
        if (this.byteOffset > this.buffer.byteLength) {
          throw new RangeError("byteOffset out of range");
        }

        if (this.byteOffset % this.BYTES_PER_ELEMENT) {
          // The given byteOffset must be a multiple of the element
          // size of the specific type, otherwise an exception is raised.
          throw new RangeError("ArrayBuffer length minus the byteOffset is not a multiple of the element size.");
        }

        if (arguments.length < 3) {
          this.byteLength = this.buffer.byteLength - this.byteOffset;

          if (this.byteLength % this.BYTES_PER_ELEMENT) {
            throw new RangeError("length of buffer minus byteOffset not a multiple of the element size");
          }
          this.length = this.byteLength / this.BYTES_PER_ELEMENT;
        } else {
          this.length = ECMAScript.ToUint32(length);
          this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        }

        if ((this.byteOffset + this.byteLength) > this.buffer.byteLength) {
          throw new RangeError("byteOffset and length reference an area beyond the end of the buffer");
        }
      } else {
        throw new TypeError("Unexpected argument type(s)");
      }

      this.constructor = ctor;

      configureProperties(this);
      makeArrayAccessors(this);
    };

    ctor.prototype = new ArrayBufferView();
    ctor.prototype.BYTES_PER_ELEMENT = bytesPerElement;
    ctor.prototype._pack = pack;
    ctor.prototype._unpack = unpack;
    ctor.BYTES_PER_ELEMENT = bytesPerElement;

    // getter type (unsigned long index);
    ctor.prototype._getter = function(index) {
      if (arguments.length < 1) throw new SyntaxError("Not enough arguments");

      index = ECMAScript.ToUint32(index);
      if (index >= this.length) {
        return undefined;
      }

      var bytes = [], i, o;
      for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT;
           i < this.BYTES_PER_ELEMENT;
           i += 1, o += 1) {
        bytes.push(this.buffer._bytes[o]);
      }
      return this._unpack(bytes);
    };

    // NONSTANDARD: convenience alias for getter: type get(unsigned long index);
    ctor.prototype.get = ctor.prototype._getter;

    // setter void (unsigned long index, type value);
    ctor.prototype._setter = function(index, value) {
      if (arguments.length < 2) throw new SyntaxError("Not enough arguments");

      index = ECMAScript.ToUint32(index);
      if (index >= this.length) {
        return undefined;
      }

      var bytes = this._pack(value), i, o;
      for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT;
           i < this.BYTES_PER_ELEMENT;
           i += 1, o += 1) {
        this.buffer._bytes[o] = bytes[i];
      }
    };

    // void set(TypedArray array, optional unsigned long offset);
    // void set(sequence<type> array, optional unsigned long offset);
    ctor.prototype.set = function(index, value) {
      if (arguments.length < 1) throw new SyntaxError("Not enough arguments");
      var array, sequence, offset, len,
          i, s, d,
          byteOffset, byteLength, tmp;

      if (typeof arguments[0] === 'object' && arguments[0].constructor === this.constructor) {
        // void set(TypedArray array, optional unsigned long offset);
        array = arguments[0];
        offset = ECMAScript.ToUint32(arguments[1]);

        if (offset + array.length > this.length) {
          throw new RangeError("Offset plus length of array is out of range");
        }

        byteOffset = this.byteOffset + offset * this.BYTES_PER_ELEMENT;
        byteLength = array.length * this.BYTES_PER_ELEMENT;

        if (array.buffer === this.buffer) {
          tmp = [];
          for (i = 0, s = array.byteOffset; i < byteLength; i += 1, s += 1) {
            tmp[i] = array.buffer._bytes[s];
          }
          for (i = 0, d = byteOffset; i < byteLength; i += 1, d += 1) {
            this.buffer._bytes[d] = tmp[i];
          }
        } else {
          for (i = 0, s = array.byteOffset, d = byteOffset;
               i < byteLength; i += 1, s += 1, d += 1) {
            this.buffer._bytes[d] = array.buffer._bytes[s];
          }
        }
      } else if (typeof arguments[0] === 'object' && typeof arguments[0].length !== 'undefined') {
        // void set(sequence<type> array, optional unsigned long offset);
        sequence = arguments[0];
        len = ECMAScript.ToUint32(sequence.length);
        offset = ECMAScript.ToUint32(arguments[1]);

        if (offset + len > this.length) {
          throw new RangeError("Offset plus length of array is out of range");
        }

        for (i = 0; i < len; i += 1) {
          s = sequence[i];
          this._setter(offset + i, Number(s));
        }
      } else {
        throw new TypeError("Unexpected argument type(s)");
      }
    };

    // TypedArray subarray(long begin, optional long end);
    ctor.prototype.subarray = function(start, end) {
      function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

      start = ECMAScript.ToInt32(start);
      end = ECMAScript.ToInt32(end);

      if (arguments.length < 1) { start = 0; }
      if (arguments.length < 2) { end = this.length; }

      if (start < 0) { start = this.length + start; }
      if (end < 0) { end = this.length + end; }

      start = clamp(start, 0, this.length);
      end = clamp(end, 0, this.length);

      var len = end - start;
      if (len < 0) {
        len = 0;
      }

      return new this.constructor(
        this.buffer, this.byteOffset + start * this.BYTES_PER_ELEMENT, len);
    };

    return ctor;
  }

  var Int8Array = makeConstructor(1, packI8, unpackI8);
  var Uint8Array = makeConstructor(1, packU8, unpackU8);
  var Uint8ClampedArray = makeConstructor(1, packU8Clamped, unpackU8);
  var Int16Array = makeConstructor(2, packI16, unpackI16);
  var Uint16Array = makeConstructor(2, packU16, unpackU16);
  var Int32Array = makeConstructor(4, packI32, unpackI32);
  var Uint32Array = makeConstructor(4, packU32, unpackU32);
  var Float32Array = makeConstructor(4, packF32, unpackF32);
  var Float64Array = makeConstructor(8, packF64, unpackF64);

  exports.Int8Array = exports.Int8Array || Int8Array;
  exports.Uint8Array = exports.Uint8Array || Uint8Array;
  exports.Uint8ClampedArray = exports.Uint8ClampedArray || Uint8ClampedArray;
  exports.Int16Array = exports.Int16Array || Int16Array;
  exports.Uint16Array = exports.Uint16Array || Uint16Array;
  exports.Int32Array = exports.Int32Array || Int32Array;
  exports.Uint32Array = exports.Uint32Array || Uint32Array;
  exports.Float32Array = exports.Float32Array || Float32Array;
  exports.Float64Array = exports.Float64Array || Float64Array;
}());

//
// 6 The DataView View Type
//

(function() {
  function r(array, index) {
    return ECMAScript.IsCallable(array.get) ? array.get(index) : array[index];
  }

  var IS_BIG_ENDIAN = (function() {
    var u16array = new(exports.Uint16Array)([0x1234]),
        u8array = new(exports.Uint8Array)(u16array.buffer);
    return r(u8array, 0) === 0x12;
  }());

  // Constructor(ArrayBuffer buffer,
  //             optional unsigned long byteOffset,
  //             optional unsigned long byteLength)
  /** @constructor */
  var DataView = function DataView(buffer, byteOffset, byteLength) {
    if (arguments.length === 0) {
      buffer = new exports.ArrayBuffer(0);
    } else if (!(buffer instanceof exports.ArrayBuffer || ECMAScript.Class(buffer) === 'ArrayBuffer')) {
      throw new TypeError("TypeError");
    }

    this.buffer = buffer || new exports.ArrayBuffer(0);

    this.byteOffset = ECMAScript.ToUint32(byteOffset);
    if (this.byteOffset > this.buffer.byteLength) {
      throw new RangeError("byteOffset out of range");
    }

    if (arguments.length < 3) {
      this.byteLength = this.buffer.byteLength - this.byteOffset;
    } else {
      this.byteLength = ECMAScript.ToUint32(byteLength);
    }

    if ((this.byteOffset + this.byteLength) > this.buffer.byteLength) {
      throw new RangeError("byteOffset and length reference an area beyond the end of the buffer");
    }

    configureProperties(this);
  };

  function makeGetter(arrayType) {
    return function(byteOffset, littleEndian) {

      byteOffset = ECMAScript.ToUint32(byteOffset);

      if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength) {
        throw new RangeError("Array index out of range");
      }
      byteOffset += this.byteOffset;

      var uint8Array = new exports.Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT),
          bytes = [], i;
      for (i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1) {
        bytes.push(r(uint8Array, i));
      }

      if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
        bytes.reverse();
      }

      return r(new arrayType(new exports.Uint8Array(bytes).buffer), 0);
    };
  }

  DataView.prototype.getUint8 = makeGetter(exports.Uint8Array);
  DataView.prototype.getInt8 = makeGetter(exports.Int8Array);
  DataView.prototype.getUint16 = makeGetter(exports.Uint16Array);
  DataView.prototype.getInt16 = makeGetter(exports.Int16Array);
  DataView.prototype.getUint32 = makeGetter(exports.Uint32Array);
  DataView.prototype.getInt32 = makeGetter(exports.Int32Array);
  DataView.prototype.getFloat32 = makeGetter(exports.Float32Array);
  DataView.prototype.getFloat64 = makeGetter(exports.Float64Array);

  function makeSetter(arrayType) {
    return function(byteOffset, value, littleEndian) {

      byteOffset = ECMAScript.ToUint32(byteOffset);
      if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength) {
        throw new RangeError("Array index out of range");
      }

      // Get bytes
      var typeArray = new arrayType([value]),
          byteArray = new exports.Uint8Array(typeArray.buffer),
          bytes = [], i, byteView;

      for (i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1) {
        bytes.push(r(byteArray, i));
      }

      // Flip if necessary
      if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
        bytes.reverse();
      }

      // Write them
      byteView = new exports.Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT);
      byteView.set(bytes);
    };
  }

  DataView.prototype.setUint8 = makeSetter(exports.Uint8Array);
  DataView.prototype.setInt8 = makeSetter(exports.Int8Array);
  DataView.prototype.setUint16 = makeSetter(exports.Uint16Array);
  DataView.prototype.setInt16 = makeSetter(exports.Int16Array);
  DataView.prototype.setUint32 = makeSetter(exports.Uint32Array);
  DataView.prototype.setInt32 = makeSetter(exports.Int32Array);
  DataView.prototype.setFloat32 = makeSetter(exports.Float32Array);
  DataView.prototype.setFloat64 = makeSetter(exports.Float64Array);

  exports.DataView = exports.DataView || DataView;

}());

},{}],92:[function(require,module,exports){
(function (Buffer){
var Transform = require('readable-stream/transform');

module.exports = function () {
    var tr = Transform();
    var index = 0;
    var buffer = null;
    
    tr._transform = function (chunk, enc, next) {
        var len = chunk.length;
        if (len === 0) return next();
        var i = 0;
        
        if (buffer) {
            var blen = buffer.length;
            for (; i < len; i++) {
                buffer[index++] = chunk[i];
                if (index === blen) {
                    this.push(buffer);
                    buffer = null;
                    i++;
                    break;
                }
            }
            if (buffer) return next();
        }
        
        for (var j = Math.max(i, len - 5); j < len; j++) {
            var n = nbytes(chunk[j]);
            if (n > len - j) {
                if (j - i > 0) this.push(chunk.slice(i, j));
                buffer = Buffer(n);
                for (index = 0; index < len - j; index++) {
                    buffer[index] = chunk[j + index];
                }
                break;
            }
        }
        
        if (!buffer && i < len) {
            this.push(i ? chunk.slice(i) : chunk);
        }
        next();
    };
    
    tr._flush = function () {
        if (buffer) this.push(buffer.slice(0, index));
        this.push(null);
    };
    
    return tr;
};

function nbytes (b) {
    if (b >= 252) return 6;
    else if (b >= 248) return 5;
    else if (b >= 240) return 4;
    else if (b >= 224) return 3;
    else if (b >= 192) return 2;
    else return 1;
}

}).call(this,require("buffer").Buffer)
},{"buffer":102,"readable-stream/transform":97}],93:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"./_stream_readable":94,"./_stream_writable":96,"_process":110,"core-util-is":4,"dup":22,"inherits":39}],94:[function(require,module,exports){
arguments[4][34][0].apply(exports,arguments)
},{"_process":110,"buffer":102,"core-util-is":4,"dup":34,"events":104,"inherits":39,"isarray":40,"stream":122,"string_decoder/":71}],95:[function(require,module,exports){
arguments[4][35][0].apply(exports,arguments)
},{"./_stream_duplex":93,"core-util-is":4,"dup":35,"inherits":39}],96:[function(require,module,exports){
arguments[4][36][0].apply(exports,arguments)
},{"./_stream_duplex":93,"_process":110,"buffer":102,"core-util-is":4,"dup":36,"inherits":39,"stream":122}],97:[function(require,module,exports){
arguments[4][28][0].apply(exports,arguments)
},{"./lib/_stream_transform.js":95,"dup":28}],98:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],99:[function(require,module,exports){
module.exports = extend

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],100:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],101:[function(require,module,exports){

},{}],102:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
 *     on objects.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  function Bar () {}
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    arr.constructor = Bar
    return arr.foo() === 42 && // typed array instances can be augmented
        arr.constructor === Bar && // constructor can be set
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  this.length = 0
  this.parent = undefined

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    array.byteLength
    that = Buffer._augment(new Uint8Array(array))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` is deprecated
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` is deprecated
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":100,"ieee754":105,"is-array":107}],103:[function(require,module,exports){
arguments[4][4][0].apply(exports,arguments)
},{"buffer":102,"dup":4}],104:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],105:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],106:[function(require,module,exports){
arguments[4][39][0].apply(exports,arguments)
},{"dup":39}],107:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],108:[function(require,module,exports){
arguments[4][40][0].apply(exports,arguments)
},{"dup":40}],109:[function(require,module,exports){
arguments[4][41][0].apply(exports,arguments)
},{"_process":110,"dup":41}],110:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],111:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.3.2 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.3.2',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],112:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":113}],113:[function(require,module,exports){
arguments[4][42][0].apply(exports,arguments)
},{"./_stream_readable":115,"./_stream_writable":117,"core-util-is":103,"dup":42,"inherits":106,"process-nextick-args":109}],114:[function(require,module,exports){
arguments[4][43][0].apply(exports,arguments)
},{"./_stream_transform":116,"core-util-is":103,"dup":43,"inherits":106}],115:[function(require,module,exports){
arguments[4][44][0].apply(exports,arguments)
},{"./_stream_duplex":113,"_process":110,"buffer":102,"core-util-is":103,"dup":44,"events":104,"inherits":106,"isarray":108,"process-nextick-args":109,"string_decoder/":123,"util":101}],116:[function(require,module,exports){
arguments[4][45][0].apply(exports,arguments)
},{"./_stream_duplex":113,"core-util-is":103,"dup":45,"inherits":106}],117:[function(require,module,exports){
arguments[4][46][0].apply(exports,arguments)
},{"./_stream_duplex":113,"buffer":102,"core-util-is":103,"dup":46,"events":104,"inherits":106,"process-nextick-args":109,"util-deprecate":124}],118:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":114}],119:[function(require,module,exports){
arguments[4][47][0].apply(exports,arguments)
},{"./lib/_stream_duplex.js":113,"./lib/_stream_passthrough.js":114,"./lib/_stream_readable.js":115,"./lib/_stream_transform.js":116,"./lib/_stream_writable.js":117,"dup":47}],120:[function(require,module,exports){
arguments[4][28][0].apply(exports,arguments)
},{"./lib/_stream_transform.js":116,"dup":28}],121:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":117}],122:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":104,"inherits":106,"readable-stream/duplex.js":112,"readable-stream/passthrough.js":118,"readable-stream/readable.js":119,"readable-stream/transform.js":120,"readable-stream/writable.js":121}],123:[function(require,module,exports){
arguments[4][71][0].apply(exports,arguments)
},{"buffer":102,"dup":71}],124:[function(require,module,exports){
arguments[4][98][0].apply(exports,arguments)
},{"dup":98}],125:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],126:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":125,"_process":110,"inherits":106}],127:[function(require,module,exports){
var hstream = require('../');

var Stream = require('stream')
var str = require('string-to-stream')

var main    = "<!DOCTYPE html>\n<html>\n  <head>\n    <title>templateking</title>\n    <link rel=\"stylesheet\" type=\"text/css\" href=\"public/css/main.css\">\n  </head>\n  <body>\n    <div class=\"template\">template</div>\n    <div id=\"scripts\">\n      <script src=\"public/js/main.js\"></script>\n    </div>\n  </body>\n</html>\n"
var section = "\n        <h2 id=\"sectionheader\"></h2>\n        <div class=\"template\"></div>\n"
var message = "<div>\n  <h3 id=\"message\">Message</h3>\n  <div>Date/Time: <span id=\"datetime\">datetime</span></div>\n</div>\n\n\n"

var res = getRes()

var msg = 'okay'
var pagecontent = {
  'head': {_mapappend: {
    'link': [{'link':{href:'public/css/section.css'}}]
  }},
  'title':'pleather',
  '#sectionheader': {class: {append:'active'}, _text:'Section!'},
  '#message':msg, '#datetime':Date(),
  '#scripts': {_mapprepend: {
    'script': [
      {'script':{src:undefined, _html:'console.log("message loaded")'}},
      {'script':{src:'public/js/section.js'}}
    ]
  }}
}

templates([main, section, message], pagecontent, res)

function getRes () {
  var res = new Stream()
  res.writable = true
  res.write = function (data) {
    document.write(data.toString('utf-8'))
  }
  res.end = function () {
    console.log('end: ', Date())
  }
  return res
}

function templates (templates, content, response) {
  (function (templates) {
    var start = templates.reverse().shift()
    return templates.reduce(function(prev, next) {
      return str(next).pipe(hstream({'.template': prev}))
    }, str(start))
  })(templates).pipe(hstream(content)).pipe(response)
}

},{"../":1,"stream":122,"string-to-stream":70}]},{},[127]);
