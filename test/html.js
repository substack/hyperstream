var hyperstream = require('../');
var test = require('tap').test;
var concat = require('concat-stream');

test('string _html', function (t) {
    t.plan(1);
    
    var hs = hyperstream({
        '.row': { _html: '<b>beep boop</b>' }
    });
    hs.pipe(concat(function (body) {
        t.equal(
            body.toString('utf8'),
            '<div class="row"><b>beep boop</b></div>'
        );
    }));
    hs.end('<div class="row"></div>');
});
