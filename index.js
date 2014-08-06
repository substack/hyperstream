var trumpet = require('trumpet');
var through = require('through');
var concat = require('concat-stream');

module.exports = function (streams) {
    if (!streams) streams = {};
    var tr = trumpet();
    Object.keys(streams).forEach(function (key) {
        var value = streams[key];
        var vstream;
        
        if (typeof value === 'object' && value.pipe) {
            vstream = through().pause();
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
                vstream.resume();
            }
            else if (typeof value === 'object') {
                Object.keys(value).forEach(function (sel) {
                    if (sel === '_html') {
                        value[sel].pipe(elem.createWriteStream())
                    }
                    else elem.setAttribute(sel, value[sel]);
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

function isStream (s) { return s && typeof s.pipe === 'function' }
function toStr (s) {
    if (Buffer.isBuffer(s) || typeof s === 'string') return s;
    return String(s);
}
