var test = require('tap').test;
var hyperstream = require('../');
var through = require('through');
var concat = require('concat-stream');

var fs = require('fs');
var expected = fs.readFileSync(__dirname + '/az_multi/expected.html', 'utf8');

test('fs stream and a slow stream', function (t) {
    t.plan(1);
    
    var hs = hyperstream({
        '#a': createAzStream(),
        '#b': fs.createReadStream(__dirname + '/az_multi/b.html'),
        '#c': createAzStream(),
        '#d': fs.createReadStream(__dirname + '/az_multi/d.html')
    });
    hs.pipe(concat(function (src) {
        t.equal(src.toString('utf8'), expected);
    }));
    
    var rs = fs.createReadStream(__dirname + '/az_multi/index.html');
    rs.pipe(hs);
});

function createAzStream () {
    var rs = through();
    var ix = 0;
    var iv = setInterval(function () {
        rs.queue(String.fromCharCode(97+ix));
        if (++ix === 26) {
            clearInterval(iv);
            rs.queue(null);
        }
    }, 25);
    return rs;
}
