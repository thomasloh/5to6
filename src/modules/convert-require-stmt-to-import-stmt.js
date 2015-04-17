var assert = require('assert');
var recast = require('recast');
var _      = require('lodash');
var n      = recast.types.namedTypes;
var b      = recast.types.builders;
var Set    = require('set');

/////////////////////////////////////////////////////
// Convert require statements to import statements //
/////////////////////////////////////////////////////

module.exports = function convertRequireStmtsToImportStmts(body) {

  ////////////
  // States //
  ////////////
  var namespaceToMembers = {};
  var moduleNameToPath   = {};
  var pathToModuleName   = {};
  var importedMembers    = new Set();
  var importedNamespaces = new Set();

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
      n.VariableDeclarator.assert(o);
      n.Identifier.assert(o.id);
      n.CallExpression.assert(o.init);
      assertIsValidRequireCallExpr(o.init);
    } catch (e) {
      return false;
    }

    return true;

  }

  function hasDeclarations(o) {
    return o.type == "VariableDeclaration" &&
            _.isArray(o.declarations) &&
            o.declarations.length > 0;
  }

  // Is "var bar = foo.bar"
  function isVariableDeclaratorWithMemberExpr(o) {

    try {
      n.VariableDeclarator.assert(o);
      n.Identifier.assert(o.id);
      n.MemberExpression.assert(o.init);
      n.Identifier.assert(o.init.object);
    } catch (e) {
      return false;
    }

    return true;

  }

  // Is "var Bar = require('foo').Bar"
  function isRequireVariableDeclarationWithMemberExpr(o) {
    try {
      n.VariableDeclarator.assert(o);
      n.Identifier.assert(o.id);
      n.MemberExpression.assert(o.init);
      n.Identifier.assert(o.init.property);
      n.CallExpression.assert(o.init.object);
      n.Identifier.assert(o.init.object.callee);
      assertIsValidRequireCallExpr(o.init.object);
      assert(o.init.object.arguments.length === 1, "Must have module name");
      assert(o.id.name === o.init.property.name, "Must be equal member extraction");
    } catch (e) {
      return false;
    }
    return true;
  }

  function isIdentiferEligibleForNamedImportImported(x) {
    return importedNamespaces.contains(x.init.object.name);
  }

  // First pass scan to collect info
  function firstPass(o) {

    if (_.isArray(o)) {
      return _.each(o, firstPass);
    }

    if (_.isObject(o)) {

      if (hasDeclarations(o)) {

        _.each(o.declarations, function(declarator) {

          if (isVariableDeclarationWithRequireCallExpr(declarator)) {
            var moduleName = declarator.id.name;
            var path = declarator.init.arguments[0].value;
            moduleNameToPath[moduleName] = path;
            pathToModuleName[path] = moduleName;
            return;
          }

          if (isVariableDeclaratorWithMemberExpr(declarator)) {
            var namespace = declarator.init.object.name;
            var property = declarator.init.property.name;
            namespaceToMembers[namespace] = namespaceToMembers[namespace] || [];
            namespaceToMembers[namespace].push(property);
          }

        });
      }

    }
  }

  // Second pass scan to collect info
  function secondPass(o) {

    if (_.isArray(o)) {
      return _.each(o, secondPass);
    }

    if (_.isObject(o)) {

      if (hasDeclarations(o)) {

        _.each(o.declarations, function(declarator) {

          if (isRequireVariableDeclarationWithMemberExpr(declarator)) {
            var modulePath = declarator.init.object.arguments[0].value;
            var namespace = pathToModuleName[modulePath];
            var property = declarator.id.name;

            if (namespaceToMembers[namespace] &&
                namespaceToMembers[namespace].length) {
              namespaceToMembers[namespace] = namespaceToMembers[namespace] || [];
              namespaceToMembers[namespace].push(property);
              importedMembers.add(property);
            }
            return;
          }

        });
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
    } catch (e) {
      return o;
    }

    function isRequireDeclarator(declarator) {
      try {
        n.VariableDeclarator.assert(declarator);
        n.Identifier.assert(declarator.id);
        n.CallExpression.assert(declarator.init);
        assertIsValidRequireCallExpr(declarator.init);
      } catch (e) {
        return false;
      }

      return true;
    }

    var someAreRequires = _.some(o.declarations, isRequireDeclarator);

    if (someAreRequires) {

      var requires = _.filter(o.declarations, isRequireDeclarator);
      var nonRequires = _.reject(o.declarations, isRequireDeclarator);

      nonRequires = nonRequires.map(function(declarator) {

        var name = declarator.id.name;

        if (name in namespaceToMembers) {
          return null;
        }

        return declarator;
      });

      if (!_.all(nonRequires, function(r){return _.isNull(r)})) {
        nonRequires = b.variableDeclaration("var", nonRequires);
      } else {
        nonRequires = null;
      }

      requires = requires.map(function(declarator) {

        // Validations
        try {
          n.VariableDeclarator.assert(declarator);
          n.Identifier.assert(declarator.id);
          n.CallExpression.assert(declarator.init);
          assertIsValidRequireCallExpr(declarator.init);
        } catch (e) {
          return declarator;
        }

        var name = declarator.id.name;
        var path = declarator.init.arguments[0].value;

        if (name in namespaceToMembers) {
          return null;
        }

        declarator = b.importDeclaration([
          b.importDefaultSpecifier(b.identifier(name))
        ], b.moduleSpecifier(path));

        return declarator;

      });

      return _.flatten([requires, nonRequires]);

    } else {
      return o;
    }

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

    if (hasDeclarations(o)) {

      var someAreRequires = _.some(o.declarations, isRequireVariableDeclarationWithMemberExpr);

      if (someAreRequires) {

        var requires = _.filter(o.declarations, isRequireVariableDeclarationWithMemberExpr);
        var nonRequires = _.reject(o.declarations, isRequireVariableDeclarationWithMemberExpr);

        nonRequires = nonRequires.map(function(declarator) {

          var name = declarator.id.name;

          if (name in namespaceToMembers) {
            return null;
          }

          return declarator;
        });

        if (!_.all(nonRequires, function(r){return _.isNull(r)})) {
          nonRequires = b.variableDeclaration("var", nonRequires);
        } else {
          nonRequires = null;
        }

        requires = requires.map(function(declarator) {

          if (!isRequireVariableDeclarationWithMemberExpr(declarator)) {
            return declarator;
          }

          var name = declarator.id.name;

          if (importedMembers.contains(name)) {
            return null;
          }

          var path = declarator.init.object.arguments[0].value;

          declarator = b.importDeclaration([
            b.importSpecifier(b.identifier(name))
          ], b.moduleSpecifier(path));

          return declarator;

        });

        return _.flatten([requires, nonRequires]);

      } else {
        return o;
      }

      if (!_.compact(o.declarations).length) {
        return null;
      }

    }

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

    if (_.isArray(o.declarations) && o.declarations.length) {

      o.declarations = o.declarations.map(function(declarator) {

        if (!isVariableDeclaratorWithMemberExpr(declarator)) {
          return declarator;
        }

        var namespace = declarator.init.object.name;

        if (!namespace) {
          return declarator;
        }

        if (!(namespace in namespaceToMembers)) {
          return declarator;
        }
        var property = declarator.init.property.name;
        if (!~namespaceToMembers[namespace].indexOf(property)) {
          return declarator;
        }

        //
        if (isIdentiferEligibleForNamedImportImported(declarator)) {
          return null;
        }

        var namespace = declarator.init.object.name;
        var property = declarator.init.property.name;

        o = b.importDeclaration(_.union([
          b.importDefaultSpecifier(b.identifier(namespace))]
        , namespaceToMembers[namespace].map(function(m) {
          return b.importSpecifier(b.identifier(m));
        })), b.moduleSpecifier(moduleNameToPath[namespace]));

        importedNamespaces.add(namespace);

      });

    }

    if (hasDeclarations(o)) {
      if (!_.compact(o.declarations).length) {
        return null;
      }
    }

    return o;

  }

  // First pass
  firstPass(body);

  // Second pass
  secondPass(body);

  // Second pass: Convert
  body = body.map(function(o) {
    o = convertIdentifierToNamedImport(o);
    o = convertRequireVariableDeclarationWithMemberExprToImportNamed(o);
    o = convertRequireVariableDeclarationToImportDefault(o);
    o = convertRequireExprStatementToPlainImport(o);
    return o;
  });

  return _.chain(body)
          .flatten()
          .reject(function(o) {
            return _.isArray(o) && !o.length})
          .value();

};
