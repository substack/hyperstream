var hyperstream = require('../');
var fs = require('fs');

var hs = hyperstream({
    '#a': fs.createReadStream(__dirname + '/hs/a.html'),
    '#b': fs.createReadStream(__dirname + '/hs/b.html')
});
var rs = fs.createReadStream(__dirname + '/hs/index.html');
rs.pipe(hs).pipe(process.stdout);
