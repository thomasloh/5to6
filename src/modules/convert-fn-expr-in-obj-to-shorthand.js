var assert = require('assert');
var recast = require('recast');
var _      = require('lodash');
var n      = recast.types.namedTypes;
var b      = recast.types.builders;

// {
//  abc: function() {
//    console.log('a')
//  }
// }
// =>
// {
//  abc() {
//    console.log('a')
//  }
// }

module.exports = function convertFnExprOfObjExprPropTo(body) {

  var bod = body;

  if (body.type === "BlockStatement") {
    bod = body.body;
  }

  bod = bod.map(function(o) {

    if (!o) {
      return o;
    }

    if (o.body) {
      o.body = convertFnExprOfObjExprPropTo(o.body);
      return o;
    }

    if (o.init && o.init.type === "ObjectExpression") {
      o.init.properties = convertFnExprOfObjExprPropTo(o.init.properties);
      return o;
    }

    if (o.init && o.init.type === "CallExpression") {
      o.init.arguments = convertFnExprOfObjExprPropTo(o.init.arguments);
      return o;
    }

    if (o.declarations) {
      o.declarations = convertFnExprOfObjExprPropTo(o.declarations);
      return o;
    }

    if (o.properties) {
      o.properties = convertFnExprOfObjExprPropTo(o.properties);
      return o;
    }

    if (o.value && o.value.type === "ObjectExpression") {
      o.value.properties = convertFnExprOfObjExprPropTo(o.value.properties);
      return o;
    }

    try {
      n.Property.assert(o);
      n.Identifier.assert(o.key);
      n.FunctionExpression.assert(o.value);
    } catch(e) {
      return o;
    }

    o.method = true;

    return o;

  });

  if (body.type === "BlockStatement") {
    body.body = bod;
  }

  return body;

};
