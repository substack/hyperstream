var hyperstream = require('../');
var test = require('tap').test;
var concat = require('concat-stream');

test('string _text', function (t) {
    t.plan(1);
    
    var hs = hyperstream({
        '.row': { _text: '<b>beep boop</b>' }
    });
    hs.pipe(concat(function (body) {
        t.equal(
            body.toString('utf8'),
            '<div class="row">&lt;b&gt;beep boop&lt;/b&gt;</div>'
        );
    }));
    hs.end('<div class="row"></div>');
});
