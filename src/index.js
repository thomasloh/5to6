var recast = require('recast');
var _      = require('lodash');
var n      = recast.types.namedTypes;
var b      = recast.types.builders;
var fs     = require('fs');
var colors = require('colors');
var Promise = require('bluebird');

var middlewares = [
  require('./modules/convert-require-stmt-to-import-stmt'),
  require('./modules/strip-use-stricts'),
  require('./modules/convert-module-dot-export-to-export-default.js'),
  require('./modules/convert-fn-expr-in-obj-to-shorthand'),
  require('./modules/convert-same-key-value-in-obj-expr-to-just-key')
];

/////////////
// Convert //
/////////////
function convert(pattern, opts) {

  var verbose = opts.verbose;

  var glob = require('glob');
  var path = require('path');
  var exec = Promise.promisify(require('child_process').exec);
  var p = path.join(process.cwd(), pattern, "/**/*.+(jsx|js)");

  if (verbose) {
    console.log("File pattern to search: " + p);
  }

  var files = glob.sync(p);

  if (!files) {
    if (verbose) {
      console.log("Error globbing files.".red);
    }
    return;
  }

  if (!files.length) {
    if (verbose) {
      console.log("No files to convert.".yellow);
    }
  }

  Promise.all(files.map(function(file) {

    return exec('git ls-files ' + file + ' --error-unmatch').then(function() {

      // Read file and parse to ast
      var code   = fs.readFileSync(file, "utf-8");
      var ast    = recast.parse(code);

      if (!code) {
        if (verbose) {
          console.log(file + " is empty or does not exist.".yellow);
        }
        return;
      }

      // Run through middlewares
      ast.program.body = middlewares.reduce(function(body, m) {
        return m(body);
      }, ast.program.body);

      // Write
      fs.writeFileSync(file, _.trimLeft(recast.print(ast).code));

      if (verbose) {
        console.log((file + " is converted.").green);
      }

    })
    .catch(function(e) {
      if (verbose) {
        console.log((file + " is not converted because it's not tracked by git.").red);
      }
    });

  }));

}


module.exports = convert;
