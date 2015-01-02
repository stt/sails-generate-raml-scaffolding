/**
 * Test dependencies
 */
var lifecycle = require('./helpers/lifecycle');
var path = require('path');
var fs = require('fs');
var assert = require('assert');


//
// Fixtures
//
var SCOPE = {
	rootPath: '.',
	generatorName: 'foobar',
  generatorType: 'baz',
  modules: {'baz': 'lib'},
  args: ['test/fixtures/api.raml']
};



/**
 * Test the generator.
 */

describe('generator', function () {

	before( lifecycle.setup(SCOPE) );

	it('should work', function () {
    var modelFile = path.resolve(SCOPE.rootPath, 'api/models/User.js');
    var text = String(fs.readFileSync(modelFile));
    assert(/datetime/.test(text));
	});

	after( lifecycle.teardown() );
});
