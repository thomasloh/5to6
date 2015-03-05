var assert = require('assert');
var recast = require('recast');
var _      = require('lodash');
var n      = recast.types.namedTypes;
var b      = recast.types.builders;

// module.exports = Component
// =>
// export default Component

module.exports = function convertModuleDotExportToExportDefault(body) {

  return body.map(function(o) {

    if (!o) {
      return o;
    }

    try {
      n.ExpressionStatement.assert(o);
      n.AssignmentExpression.assert(o.expression);
      assert(o.expression.operator === "=", "Must be equal op");
      n.MemberExpression.assert(o.expression.left);
      n.Identifier.assert(o.expression.left.object);
      assert(o.expression.left.object.name === "module", "Must be 'module' name");
      n.Identifier.assert(o.expression.left.property);
      assert(o.expression.left.property.name === "exports", "Must be 'exports' name");
      // n.Identifier.assert(o.expression.right);
    } catch(e) {
      return o;
    }

    // var Module = o.expression.right.name;
    o = b.exportDeclaration(true, o.expression.right);

    return o;

  });

};
