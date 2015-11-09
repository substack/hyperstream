var concat = require('concat-stream')
var str = require('../')
var test = require('tape')

test('basic tests', function (t) {
  t.plan(2)
  str('hi there').pipe(concat(function (data) {
    t.equal(data.toString(), 'hi there')
  }))
  str('').pipe(concat(function (data) {
    t.equal(data.toString(), '')
  }))
})
