var test = require('tap').test;
var through = require('through');
var hyperstream = require('../');

var fs = require('fs');
var expected = fs.readFileSync(__dirname + '/num/expected.html', 'utf8');

test('num', function (t) {
    t.plan(1);
    
    var hs = hyperstream({
        '#a': 5,
        '#b': 6,
        '#c': { n: 123 },
        '#c span': function (html) { return html.length }
    });
    var rs = fs.createReadStream(__dirname + '/num/index.html');
    
    var data = '';
    rs.pipe(hs).pipe(through(write, end));
    
    function write (buf) { data += buf }
    
    function end () {
        t.equal(data, expected);
    }
});
