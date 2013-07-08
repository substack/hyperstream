var trumpet = require('trumpet');
var through = require('through');
var concat = require('concat-stream');

module.exports = function (streams) {
    if (!streams) streams = {};
    var tr = trumpet();
    Object.keys(streams).forEach(function (key) {
        var value = streams[key];
        tr.selectAll(key, function (elem) {
            if (typeof value === 'string') {
                elem.createWriteStream().end(value);
            }
            else if (typeof value === 'object' && value.pipe) {
                value.pipe(elem.createWriteStream());
            }
            else if (typeof value === 'function') {
                var stream = elem.createStream();
                stream.pipe(concat(function (body) {
                    stream.end(value(body.toString('utf8')));
                }));
            }
        });
    });
    return tr;
};
