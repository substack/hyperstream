var test = require('tape');
var utf8Stream = require('../');
var through = require('through');
var chunky = require('chunky');

test('single bytes', function (t) {
    t.plan(1);
    
    var buf = Buffer('☠ ￡');
    var strings = [];
    
    var d = utf8Stream();
    d.pipe(through(write, end));
    
    for (var i = 0; i < buf.length; i++) {
        d.write(buf.slice(i, i + 1));
    }
    d.end();
    
    function write (s) { strings.push(s.toString('utf8')) }
    function end () {
        t.deepEqual(strings, [ '☠', ' ', '￡' ]);
    }
});

test('random offsets', function (t) {
    t.plan(100);
    
    for (var i = 0; i < 100; i++) (function () {
        var buf = Buffer('☠ ￡');
        var strings = [];
        
        var d = utf8Stream();
        d.pipe(through(write, end));
        
        var bufs = chunky(buf);
        for (var i = 0; i < bufs.length; i++) {
            d.write(bufs[i]);
        }
        d.end();
        
        function write (s) { strings.push(s.toString('utf8')) }
        function end () {
            t.deepEqual(strings.join(''), '☠ ￡');
        }
    })();
});

test('more random offsets', function (t) {
    t.plan(100);
    
    for (var i = 0; i < 100; i++) (function () {
        var buf = Buffer('a¡é☠ ￡!');
        var strings = [];
        
        var d = utf8Stream();
        d.pipe(through(write, end));
        
        var bufs = chunky(buf);
        for (var i = 0; i < bufs.length; i++) {
            d.write(bufs[i]);
        }
        d.end();
        
        function write (s) { strings.push(s.toString('utf8')) }
        function end () {
            t.deepEqual(strings.join(''), 'a¡é☠ ￡!');
        }
    })();
});
