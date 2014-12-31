/**
 * Module dependencies
 */

var util = require('util')
  , _ = require('lodash');

var raml = require('raml-parser')
  , sys = require('sys')
  , exec = require('child_process').exec
  , fs = require("fs");

// Make _.defaults recursive
_.defaults = require('merge-defaults');


// assumes it's ran against new model file
function addAttributes(rootPath, modelName, spec) {
  var modelFile = rootPath + '/api/models/' + modelName + '.js';
  //var model = require(modelFile);
  //model.attributes = _.merge(model.attributes, spec);

  var text = String(fs.readFileSync(modelFile));
  text = text.replace(/attributes:[^}]*}/,
    'attributes: ' + JSON.stringify(spec, null, 2));

  fs.writeFileSync(modelFile, text);
}

function convertRamlFormToSailsModel(resource) {
  var spec;

  var validKeys = ['required','type'];

  // find all post params
  _.filter(resource.methods, function(m) {
     return m.method == "post";
  }).forEach(function(m) {
 
    var params = findNested(m.body, "formParameters");
    spec = _.merge.apply(_, params);
 
    // filter out waterline supported properties
    spec = _.mapValues(spec, function(att) {
      return _.transform(att, function(res, v, k) {
        if(validKeys.indexOf(k) < 0)
          delete res[k];
        else
          res[k] = v;
      });
    });

  });

  return spec;
}

function findNested(obj, key, memo) {
  _.isArray(memo) || (memo = []);
  _.forOwn(obj, function(val, i) {
    if (i === key) {
      memo.push(val);
    } else {
      findNested(val, key, memo);
    }
  });
  return memo;
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}


/**
 * This `before` function is run before generating targets.
 * Validate, configure defaults, get extra dependencies, etc.
 *
 * @param  {Object} scope
 * @param  {Function} cb    [callback]
 */
module.exports = function (scope, cb) {

    // scope.args are the raw command line arguments.
    //
    // e.g. if someone runs:
    // $ sails generate raml-scaffolding user find create update
    // then `scope.args` would be `['user', 'find', 'create', 'update']`
    if (!scope.args[0] || !fs.existsSync(scope.args[0])) {
      console.error('Syntax: sails generate raml-scaffolding api-file.raml');
      return;
    }

    // scope.rootPath is the base path for this generator
    //
    // e.g. if this generator specified the target:
    // './Foobar.md': { copy: 'Foobar.md' }
    //
    // And someone ran this generator from `/Users/dbowie/sailsStuff`,
    // then `/Users/dbowie/sailsStuff/Foobar.md` would be created.
    if (!scope.rootPath) {
      return cb( INVALID_SCOPE_VARIABLE('rootPath') );
    }

    // Attach defaults
    _.defaults(scope, {
      createdAt: new Date()
    });

    raml.loadFile(scope.args[0]).then( function(rootNode) {

      /*var models = _.map(rootNode.resources, function(n,i) {
        return n.relativeUriPathSegments[0].replace(/s$/,'');
      });*/

      rootNode.resources.forEach(function(m, i) {

        var modelName = m.relativeUri.split('/')[1];

        if (!/^[a-z0-9]+$/i.test(modelName)) {
          return console.error("Invalid model name", modelName);
        }

        // remove suffix if sails.config.blueprints.pluralize?
        modelName = capitalize(modelName);

        // TODO: too hacky, use sails-genearate-model programmatically
        var child = exec("sails generate model "+modelName, function (error, stdout, stderr) {
          sys.print(stdout);
          sys.print(stderr);
          if (error !== null) {
            console.log('exec error: ' + error);
          }
        })
        .on("close", function (code, sig) {

          if(code != 0) return console.error("Failed to generate model", modelName);

          try {
            var spec = convertRamlFormToSailsModel(m);
            //console.log(spec)
            addAttributes(scope.rootPath, modelName, spec || {});
          } catch(err) {
            cb(err);
          }

        });
      });

      // When finished, we trigger a callback with no error
      // TODO: put model generation in promises and call cb when done
      cb();

    });

};


/**
 * INVALID_SCOPE_VARIABLE()
 *
 * Helper method to put together a nice error about a missing or invalid
 * scope variable. We should always validate any required scope variables
 * to avoid inadvertently smashing someone's filesystem.
 *
 * @param {String} varname [the name of the missing/invalid scope variable]
 * @param {String} details [optional - additional details to display on the console]
 * @param {String} message [optional - override for the default message]
 * @return {Error}
 * @api private
 */

function INVALID_SCOPE_VARIABLE (varname, details, message) {
  var DEFAULT_MESSAGE =
  'Issue encountered in generator "raml-scaffolding":\n'+
  'Missing required scope variable: `%s`"\n' +
  'If you are the author of `sails-generate-raml-scaffolding`, please resolve this '+
  'issue and publish a new patch release.';

  message = (message || DEFAULT_MESSAGE) + (details ? '\n'+details : '');
  message = util.inspect(message, varname);

  return new Error(message);
}
