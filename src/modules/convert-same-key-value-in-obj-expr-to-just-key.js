var assert = require('assert');
var recast = require('recast');
var _      = require('lodash');
var n      = recast.types.namedTypes;
var b      = recast.types.builders;

// var b = {
//  abc: abc
// }
// =>
// var b = {
//  abc
// }

module.exports = function convertSameKeyValueInObjExprToJustKey(body) {

  return body.map(function(o) {

    if (!o) {
      return o;
    }

    if (_.isArray(o.body)) {
      o.body = convertSameKeyValueInObjExprToJustKey(o.body);
      return o;
    }

    if (o.init && o.init.type === "ObjectExpression") {
      o.init.properties = convertSameKeyValueInObjExprToJustKey(o.init.properties);
      return o;
    }

    if (o.init && o.init.type === "CallExpression") {
      o.init.arguments = convertSameKeyValueInObjExprToJustKey(o.init.arguments);
      return o;
    }

    if (o.declarations) {
      o.declarations = convertSameKeyValueInObjExprToJustKey(o.declarations);
      return o;
    }

    if (o.properties) {
      o.properties = convertSameKeyValueInObjExprToJustKey(o.properties);
      return o;
    }

    if (o.value && o.value.type === "ObjectExpression") {
      o.value.properties = convertSameKeyValueInObjExprToJustKey(o.value.properties);
      return o;
    }

    try {
      n.Property.assert(o);
      n.Identifier.assert(o.key);
      n.Identifier.assert(o.value);
      assert(o.key.name === o.value.name, "Key and value must equal");
    } catch(e) {
      return o;
    }

    o.shorthand = true;

    return o;

  });

};
