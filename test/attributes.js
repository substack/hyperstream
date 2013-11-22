var test = require('tap').test;
var hyperstream = require('..');
var concat = require('concat-stream');

var src = '<div><input value=""><span></span></div>';
var expected = '<div><input value="value"><span class="class"></span></div>';

test('attributes', function (t) {
    t.plan(1);
    var hs = hyperstream({
       input : { value : 'value' },
       span : { 'class': 'class' }
    });
    hs.pipe(concat(function (html) {
        t.equal(html.toString(), expected);
    }));
    hs.end(src);
});
