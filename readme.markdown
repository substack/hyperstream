# hyperstream

stream html into html at a css selector

[![build status](https://secure.travis-ci.org/substack/hyperstream.png)](http://travis-ci.org/substack/hyperstream)

# example

``` js
var hyperstream = require('hyperstream');
var fs = require('fs');

var hs = hyperstream({
    '#a': fs.createReadStream(__dirname + '/a.html'),
    '#b': fs.createReadStream(__dirname + '/b.html')
});
var rs = fs.createReadStream(__dirname + '/index.html');
rs.pipe(hs).pipe(process.stdout);
```

```
$ node example/hs.js
<html>
  <body>
    <div id="a"><h1>a!!!</h1></div>
    <div id="b"><b>bbbbbbbbbbbbbbbbbbbbbb</b></div>
  </body>
</html>
```

# methods

``` js
var hyperstream = require('hyperstream')
```

## var hs = hyperstream(streamMap)

Return a duplex stream that takes an html stream as input and produces an html
stream as output, inserting the streams given by `streamMap` at the css selector
keys.

If `streamMap` values are strings or functions, update the contents at the css
selector key with their contents directly without using a stream.

If `streamMap` values are non-stream objects, iterate over the keys and set
attributes for each key.

These attributes are special. Each attribute can be a string, buffer, or stream:

* `_html` - set the inner content as raw html
* `_text` - set the inner content as text encoded as html entities
* `_append`, `_appendText` - add text to the end of the inner content encoded as
html entities
* `_appendHtml` - add raw html to the end of the inner content
* `_prepend`, `_prependText` - add text to the beginning of the inner content
encoded as html entities
* `_prependHtml` - add raw html to the beginning of the inner context
* `_map` - select an HTML segment to use as a template to be duplicated for each member of a data array
* `_mapappend` - same as `_map` but insert after the sample template and don't overwrite it
* `_mapprepend` - same as `_map` but insert before the sample template and don't overwrite it

For example, to set raw html into the inner content with the `_html` attribute,
do:

``` js
hyperstream({
    '#content': {
        _html: stream, // apply raw stream of data
        'data-start': 'cats!', // set attribute "data-start" to the value "cats!"
        'data-end': 'cats!\ufff' // set attribute "data-end" to the value "cats!\ufff"
    }
})
```

You can also specify string operations for properties with an object instead of
a string. The object can have these properties:

* `append`
* `prepend`

Object properties are particularly handy for adding classes:

``` js
hyperstream({
    '.row': {
        class: { append: ' active' }
    }
})
```

which turns:

``` html
<div class="row"><b>woo</b></div>
```

into:

``` html
<div class="row active"><b>woo</b></div>
```

And you can build table rows and lists of data using the `_map` attribute.
`_map` grabs the designated sub-template from the source HTML stream and duplicates
it for each member of a data array.

index.html:

```
<html>
  <body>
    <div id="a"><h1>Group List:</h1></div>
    <div id="b">
        <div class="row">
            <span class="name">one</span> <span class="age">1</span>
        </div>
        <div class="row">
            <span class="name">two</span> <span class="age">2</span>
        </div>
    </div>
  </body>
</html>
```

index.js:

```
var hyperstream = require('hyperstream')
var fs = require('fs');

var hs = hyperstream({
    '#a > h1': 'Group List as of: ' + todays_date,
    '#b': { _map: {
            '.row': [
                {'.name': 'person', '.age': 10},
                {'.name': 'place', '.age': 20},
                {'.name': 'thing', '.age': 30},
            ]
    }}
});
var rs = fs.createReadStream(__dirname + '/index.html');
rs.pipe(hs).pipe(process.stdout);
```

output:

```
<html>
  <body>
    <div id="a"><h1>Group List as of: Nov. 9, 2015</h1></div>
    <div id="b">
        <div class="row">
            <span class="name">person</span> <span class="age">10</span>
        </div>
        <div class="row">
            <span class="name">place</span> <span class="age">20</span>
        </div>
        <div class="row">
            <span class="name">thing</span> <span class="age">30</span>
        </div>
    </div>
  </body>
</html>
```

In this case `_map` locates the sub-template by searching within the tag
having ID `"b"` and getting the first block of HTML having the class `"row"`.
The sub-template is duplicated For each member of the data array and the
content of the class selectors matching the data parameter names is replaced
with the corresponding data.

Rather than replace the existing sub-template data you can add additional data before or 
after the data already in the template stream using these properties:

* _mapappend
* _mapprepend

Using one of these attributes will use the designated sub-template as model
but not overwrite it, simply include more data in the output stream.

## hs.select(), hs.update(), hs.replace(), hs.remove()

Proxy through methods to the underlying
[trumpet](https://github.com/substack/node-trumpet) instance.

# install

With [npm](https://npmjs.org) do:

```
npm install hyperstream
```

# license

MIT
