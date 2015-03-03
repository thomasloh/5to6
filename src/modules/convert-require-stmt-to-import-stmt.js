var assert = require('assert');
var recast = require('recast');
var _      = require('lodash');
var n      = recast.types.namedTypes;
var b      = recast.types.builders;

/////////////////////////////////////////////////////
// Convert require statements to import statements //
/////////////////////////////////////////////////////

module.exports = function convertRequireStmtsToImportStmts(body) {

  ////////////
  // States //
  ////////////
  var identifiersToMembers = {};
  var moduleNameToPath     = {};
  var importedNamespaces   = new Set();

  /////////////////////////
  // Assertion utilities //
  /////////////////////////

  // Assert "require('foo')" on CallExpr
  function assertIsValidRequireCallExpr(o) {
    if (o.callee.name !== "require") {
      throw Error("Must be require()");
    }
    if (!o.arguments[0]) {
      throw Error("Must have at least one argument");
    }
    if (typeof o.arguments[0].value !== "string") {
      throw Error("Must have string path");
    }
  }

  // Is "require('foo')"
  function isRequireExprStmt(o) {

    try {
      n.ExpressionStatement.assert(o);
      n.CallExpression.assert(o.expression);
      assertIsValidRequireCallExpr(o.expression);
    } catch (e) {
      return false;
    }

    return true;

  }

  // Is "var foo = require('foo')"
  function isVariableDeclarationWithRequireCallExpr(o) {

    try {
      n.VariableDeclaration.assert(o);
      n.VariableDeclarator.assert(o.declarations[0]);
      n.Identifier.assert(o.declarations[0].id);
      n.CallExpression.assert(o.declarations[0].init);
      assertIsValidRequireCallExpr(o.declarations[0].init);
    } catch (e) {
      return false;
    }

    return true;

  }

  // Is "var bar = foo.bar"
  function isVariableDeclarationWithMemberExpr(o) {

    try {
      n.VariableDeclaration.assert(o);
      n.VariableDeclarator.assert(o.declarations[0]);
      n.Identifier.assert(o.declarations[0].id);
      n.MemberExpression.assert(o.declarations[0].init);
    } catch (e) {
      return false;
    }

    return true;

  }

  function isIdentiferEligibleForNamedImportImported(x) {
    return importedNamespaces.has(x.declarations[0].init.object.name);
  }

  // Scanner
  function scan(o) {

    if (_.isArray(o)) {
      return _.each(o, scan);
    }

    if (_.isObject(o)) {

      if (isVariableDeclarationWithRequireCallExpr(o)) {
        var moduleName = o.declarations[0].id.name;
        var path = o.declarations[0].init.arguments[0].value;
        moduleNameToPath[moduleName] = path;
        return;
      }


      if (isVariableDeclarationWithMemberExpr(o)) {
        var namespace = o.declarations[0].init.object.name;
        var property = o.declarations[0].init.property.name;
        identifiersToMembers[namespace] = identifiersToMembers[namespace] || [];
        identifiersToMembers[namespace].push(property);
        return;
      }


    }
  }


  //////////////////////////
  // Conversion utilities //
  //////////////////////////

  // var Foo = require('foo')
  // =>
  // import Foo from 'foo'
  function convertRequireVariableDeclarationToImportDefault(o) {

    if (!o) {
      return o;
    }

    // Validations
    try {
      n.VariableDeclaration.assert(o);
      n.VariableDeclarator.assert(o.declarations[0]);
      n.Identifier.assert(o.declarations[0].id);
      n.CallExpression.assert(o.declarations[0].init);
      assertIsValidRequireCallExpr(o.declarations[0].init);
    } catch (e) {
      return o;
    }

    var name = o.declarations[0].id.name;
    var path = o.declarations[0].init.arguments[0].value;

    if (name in identifiersToMembers) {
      return null;
    }

    o = b.importDeclaration([
      b.importDefaultSpecifier(b.identifier(name))
    ], b.moduleSpecifier(path));

    return o;

  }

  // var Bar = require('foo').Bar
  // =>
  // import {Bar} from 'foo'
  function convertRequireVariableDeclarationWithMemberExprToImportNamed(o) {

    if (!o) {
      return o;
    }

    // Validations
    try {
      n.VariableDeclaration.assert(o);
      n.VariableDeclarator.assert(o.declarations[0]);
      n.Identifier.assert(o.declarations[0].id);
      n.MemberExpression.assert(o.declarations[0].init);
      n.Identifier.assert(o.declarations[0].init.property);
      n.CallExpression.assert(o.declarations[0].init.object);
      n.Identifier.assert(o.declarations[0].init.object.callee);
      assertIsValidRequireCallExpr(o.declarations[0].init.object);
    } catch (e) {
      return o;
    }

    var name = o.declarations[0].id.name;
    var path = o.declarations[0].init.object.arguments[0].value;

    o = b.importDeclaration([
      b.importSpecifier(b.identifier(name))
    ], b.moduleSpecifier(path));

    return o;

  }

  // require('foo')
  // =>
  // import 'foo'
  function convertRequireExprStatementToPlainImport(o) {

    if (!o) {
      return o;
    }

    try {
      n.ExpressionStatement.assert(o);
      n.CallExpression.assert(o.expression);
      assertIsValidRequireCallExpr(o.expression);
    } catch (e) {
      return o;
    }

    var path = o.expression.arguments[0].value;

    o = b.importDeclaration([], b.moduleSpecifier(path));

    return o;

  }

  // var Foo = require('foo')
  // var Bar = Foo.Bar
  // var Baz = Foo.Baz
  // =>
  // import Foo from 'foo'
  // import {Bar, Baz} from 'foo'
  function convertIdentifierToNamedImport(o) {

    if (!o) {
      return o;
    }

    if (!isVariableDeclarationWithMemberExpr(o)) {
      return o;
    }

    var namespace = o.declarations[0].init.object.name;

    if (!namespace) {
      return o;
    }

    if (!(namespace in identifiersToMembers)) {
      return o;
    }
    var property = o.declarations[0].init.property.name;
    if (!~identifiersToMembers[namespace].indexOf(property)) {
      return o;
    }

    //
    if (isIdentiferEligibleForNamedImportImported(o)) {
      return null;
    }

    var namespace = o.declarations[0].init.object.name;
    var property = o.declarations[0].init.property.name;

    o = b.importDeclaration(_.union([
      b.importDefaultSpecifier(b.identifier(namespace))]
    , identifiersToMembers[namespace].map(function(m) {
      return b.importSpecifier(b.identifier(m));
    })), b.moduleSpecifier(moduleNameToPath[namespace]));

    importedNamespaces.add(namespace);

    return o;


  }

  // First pass: Scan
  scan(body);

  // Second pass: Convert
  body = body.map(function(o) {
    o = convertIdentifierToNamedImport(o);
    o = convertRequireVariableDeclarationToImportDefault(o);
    o = convertRequireVariableDeclarationWithMemberExprToImportNamed(o);
    o = convertRequireExprStatementToPlainImport(o);
    return o;
  });

  return body;

};
