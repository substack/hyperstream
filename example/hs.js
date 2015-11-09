var hyperstream = require('../');
var fs = require('fs');

var hs = hyperstream({
    //'#a': fs.createReadStream(__dirname + '/hs/a.html'),
    '#a': function (template) {
        return template + template
    },
    '#b': { _map: [
            '.hey', [
                {'.name': 'thing', '.age': 'finite'},
                {'.name': 'calling', '.age': 'eternal'},
                {'.name': 'calling2', '.age': 'eternal2'},
                {'.name': 'calling3', '.age': 'eternal3'},
                {'.name': 'calling4', '.age': 'eternal4'}
            ] 
        ] }
});
var rs = fs.createReadStream(__dirname + '/hs/index.html');
rs.pipe(hs).pipe(process.stdout);
