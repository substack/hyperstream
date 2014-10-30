var hyperstream = require('../');
var test = require('tap').test;
var concat = require('concat-stream');

test('null value', function (t) {
    t.plan(1);
    
    var hs = hyperstream({
        '.row': null
    });
    hs.pipe(concat(function (body) {
        t.equal(
            body.toString('utf8'),
            '<div class="row"></div>'
        );
    }));
    hs.end('<div class="row"></div>');
});
