var trumpet = require('trumpet');
var through = require('through2');
var concat = require('concat-stream');
var u8 = require('utf8-stream');
var combine = require('stream-combiner2');
var ent = require('ent');

module.exports = function (streams) {
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
                        v.pipe(elem.createWriteStream())
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
                        v.pipe(body, { end: false })
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
                        v.pipe(encoder()).pipe(body, { end: false })
                        v.on('end', function () { body.pipe(body) });
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

