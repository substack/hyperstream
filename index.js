var trumpet = require('trumpet');
var through = require('through2');
var concat = require('concat-stream');
var u8 = require('utf8-stream');
var combine = require('stream-combiner2');
var ent = require('ent');
var keepalive = {end: false}

module.exports = function (streams) {
    if (!streams) streams = {};
    var tr = trumpet();
    Object.keys(streams).forEach(function (key) {
        var value = streams[key];
        var vstream;

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
                    else if (prop === '_append' && (Buffer.isBuffer(v)
                    || typeof v === 'string')) {
                        var body = elem.createStream();
                        body.pipe(body, keepalive);
                        body.on('end', function(){
                          body.end(v);
                        });
                    }
                    else if (prop === '_append' && isStream(v)) {
                        var body = elem.createStream();
                        body.pipe(body, keepalive);
                        body.on('end', function(){
                          v.pipe(body)
                        });
                    }
                    else if (prop === '_prepend' && (Buffer.isBuffer(v)
                    || typeof v === 'string')) {
                        var body = elem.createStream();
                        body.write(v);
                        body.pipe(body);
                    }
                    else if (prop === '_prepend' && isStream(v)) {
                        var body = elem.createStream();
                        v.pipe(body, keepalive)
                        v.on('end', function(){
                          body.pipe(body);
                        });
                    }
                    else elem.setAttribute(prop, value[prop]);
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

function encoder () {
    return combine(u8(), through(function (buf, enc, next) {
        this.push(ent.encode(buf.toString('utf8')));
        next();
    }));
}
