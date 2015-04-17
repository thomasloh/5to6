# Note: Experimental

5to6
========================

[Motivation](https://medium.com/@thomas_loh/es5-es6-e55e9bf59819)

Converts (partial) ES5 code to ES6. Converted files are expected to be used with  ES6 transpilers like Babel.

Uses [recast](https://github.com/benjamn/recast) to get code's AST and detect then modify certain syntax to the equivalent in ES6. Semantics don't change, only the syntax.

# Supported conversions

```javascript
var b = {
 abc: abc
}
=>
var b = {
 abc
}

{
 abc: function() {
   console.log('a')
 }
}
=>
{
 abc() {
   console.log('a')
 }
}

module.exports = Component
=>
export default Component

var Foo = require('foo')
=>
import Foo from 'foo'

var Bar = require('foo').Bar
=>
import {Bar} from 'foo'

require('foo')
=>
import 'foo'

var Foo = require('foo')
var Bar = Foo.Bar
var Baz = Foo.Baz
=>
import Foo, {Bar, Baz} from 'foo'
```

# Install

```bash
sudo npm install 5to6 -g
```

# Usage

```bash
5to6 -s src    # converts all js or jsx files in "src" folder (relative to current directory)

5to6 -s .      # converts all js or jsx files in current directory

5to6 -s . -v   # verbose mode
```

# Caveats

This lib was initially created to convert a particular project's codebase to ES6, so it assumes certain code structure. If your codebase is using the commonjs style modules structure, it should work. Codebase with everything in one big closure will not work. Again, this lib is experimental.

5to6 directly writes to file after conversion. So it depends on git, not for conversion, but for reversion in case output is not as expected etc.

To revert conversion, simply run

```bash
git reset --hard
```

# Credits

Huge credit goes to [recast](https://github.com/benjamn/recast) by [benjamn](https://github.com/benjamn)
