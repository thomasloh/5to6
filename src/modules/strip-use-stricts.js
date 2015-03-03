var assert = require('assert');
var recast = require('recast');
var _      = require('lodash');
var n      = recast.types.namedTypes;
var b      = recast.types.builders;

//////////////////////////
// Strip "use strict;"s //
//////////////////////////

module.exports = function stripUseStricts(body) {

  return body.map(function(o) {

    if (!o) {
      return o;
    }

    // Validations
    try {
      n.ExpressionStatement.assert(o);
      n.Literal.assert(o.expression);
      assert(o.expression.value === "use strict", "Expecting \"use strict\"; expr stmt");
    } catch (e) {
      return o;
    }

    // Strip
    return null;

  });

};
