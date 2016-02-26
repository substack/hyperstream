var hyperstream = require('../')
var fs = require('fs');

var hs = hyperstream({
    '#a > h1': 'Group List as of: ' + Date(),
    '#b': { _map: {
            '.row': [
                {'.name': 'person', '.age': 10},
                {'.name': 'place', '.age': 20},
                {'.name': 'thing', '.age': 30},
            ]
    }}
});
var rs = fs.createReadStream(__dirname + '/map/index.html');
rs.pipe(hs).pipe(process.stdout);
