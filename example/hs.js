var hyperstream = require('../');
var fs = require('fs');

var hs = hyperstream({
    //'#a': fs.createReadStream(__dirname + '/hs/a.html'),
    '#a': function (template) {
        return template + template
    },
    '#b': { _map: {
            '.hey': [
                {'.name': 'thing', '.age': 'finite'},
                {'.name': 'calling', '.age': 'eternal'},
                {'.name': 'calling3', '.age': 'eternal3'},
                {'.name': 'essense', '.age': 'infinity'}
            ] 
        }}
});
var rs = fs.createReadStream(__dirname + '/hs/index.html');
rs.pipe(hs).pipe(process.stdout);
