var hyperstream = require('../');
var fs = require('fs');

var hs = hyperstream({
    'head': { _mapappend: {
        'script': [{'script': {src: 'fun.js'}}],
        'link': [{'link': {href: 'fun.css'}}]
    }},
    //'#a': fs.createReadStream(__dirname + '/hs/a.html'),
    '#a > h1': function (template) {
        return template + template
    },
    '#b': { _map: {
            '.row': [
                //{'.name': 'person', '.age': 10},
                //{'.name': 'person', '.age': 10, 'tda': 'yamon', 'td': { class: {append: ' testme2'}}},
                {'td': {class: {append: ' testm3'}}, '.name': 'person', '.age': 10},
                {'.name': 'place', '.age': 20},
                {'.name': 'thing', '.age': 30},
                {'.name': 'thought', '.age': 40}
            ] 
    }},
    '#c': { _text: fs.createReadStream(__dirname + '/hs/a.html') }
});
var rs = fs.createReadStream(__dirname + '/hs/index.html');
rs.pipe(hs).pipe(process.stdout);
