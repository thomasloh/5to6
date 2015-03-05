#!/usr/bin/env node

var commander = require("commander");
var main = require('../src/index');
var colors = require('colors');

var program = new commander.Command('5to6');

program.option("-s, --source <type>", "Source to convert from ES5 to ES6 i.e. 5to6 -s src/js");
program.option("-v, --verbose", "Verbose mode");

var pkg = require("../package.json");
program.version(pkg.version);
program.parse(process.argv);

// Verify source
var source = program.source;
var verbose = program.verbose;

if (!source) {
  return program.help();
}

// Check git binary
var exec = require('child_process').exec;
exec('which git', verifyGit);

function verifyGit(error, stdout, stderr) {

  // Git not installed
  if (!stdout) {
    return console.warn("git must to be installed. In case want to revert changes, can use `git reset --hard`".red);
  }

  // Make sure HEAD is clean
  exec('git diff', verifyWorkingCopyClean);

  function verifyWorkingCopyClean(error, stdout, stderr) {

    if (stdout) {
      return console.warn("git working copy must be clean, otherwise doing `git revert` later (if any) will revert previously changed files as well, so please commit your changed files first...".red);
    }

    main(source, {verbose: verbose});

  }

}

