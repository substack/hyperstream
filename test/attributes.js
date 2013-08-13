var test = require('tap').test;
var hyperstream = require('..');
var concat = require('concat-stream');

var src = '<div><input value=""></div>';
var expected = '<div><input value="value"></div>';

test('attributes', function (t) {
    t.plan(1);
    var hs = hyperstream({
       'input': { value : 'value' } 
    });
    hs.pipe(concat(function (html) {
        t.equal(html.toString(), expected);
    }));
    hs.end(src);
});