/**
 * Module dependencies
 */

var util = require('util')
  , _ = require('lodash');

var raml = require('raml-parser')
  , sys = require('sys')
  , exec = require('child_process').exec
  , fs = require("fs")
  , Promise = require("bluebird");

// Make _.defaults recursive
_.defaults = require('merge-defaults');


// assumes it's ran against new model file
function addAttributes(rootPath, modelName, spec) {
  var modelFile = rootPath + '/api/models/' + modelName + '.js';
  //var model = require(modelFile);
  //model.attributes = _.merge(model.attributes, spec);

  var comments = _.mapValues(spec, function(att) { return att['_comment']; });
  spec = _.mapValues(spec, function(att) { return _.omit(att, '_comment'); });

  var text = String(fs.readFileSync(modelFile));
  var attjson = JSON.stringify(spec, null, 2)
    .replace(/^{/, '').replace(/\s*}$/, '').trim();

  if(!attjson.length) return;
  attjson += ",";

  // if there's a close brace on same line with attributes, assume it's empty
  if(/attributes:.*}/.test(text)) {
    text = text.replace(/attributes:.*/, attjson);
  } else {
    // try to inject at the start of attributes object
    text = text.replace(/(attributes:.*\n)/, '$1' + attjson);
  }

  _.keys(spec).forEach(function(k) {
    if(comments[k]) {

      var formattedComment = "  /**\n   * "
        + comments[k].split(/\n/).join('\n   * ')
        + "\n   */\n$1";

      // yolo
      text = text.replace(
        new RegExp('^(  "'+k+'")', 'm'),
        formattedComment
        );

    }
  });

  fs.writeFileSync(modelFile, text);
}

function convertRamlFormToSailsModel(resource) {
  var spec;

  // http://raml.org/spec.html#named-parameters
  // https://github.com/balderdashy/waterline-docs/blob/master/models.md
  var ramlWaterlineMap = {
    'minimum': 'min',
    'maximum': 'max',
    'minLength': 'minLength',
    'maxLength': 'maxLength',
    'required': 'required',
    'type': 'type',
    'default': 'defaultsTo',
    'enum': 'enum',
    'pattern': 'regex'
  };

  // find all post params
  _.filter(resource.methods, function(m) {
     return m.method == "post";
  }).forEach(function(m) {
 
    var params = findNested(m.body, "formParameters");
    spec = _.merge.apply(_, params);
 
    // filter out waterline supported properties
    spec = _.mapValues(spec, function(att) {

      var ret = _.transform(att, function(res, v, k) {
        if(k in ramlWaterlineMap) {
          res[ramlWaterlineMap[k]] = v;
        }
      });

      if("description" in att) {
        // silly annotation feature to add waterline specific things in the raml spec
        att.description.split(/\n/)
        .forEach(function(l)
        {
          var anline = l.split(/@wl-/); 
          if (anline.length > 1) {
            var m = anline[1].match(/^(\w+) (.+)$/);
            if(m && m.length == 3) {
              var val = m[2];
              try {
                // minimal effort of supporting arrays
                val = JSON.parse(val.replace(/'/g,'"'));
              } catch(e) {
              }
              ret[m[1]] = val;
            }
          } else {
            // expose rest of description as comment in model
            if(!ret['_comment']) ret['_comment'] = "";
            ret['_comment'] += anline[0];
          }
        });
      }

      return ret;

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

function createResources(res, modelName, spec, options) {
  var resPromises = [];

  if(res.resources) {
    options.parent = modelName;
    res.resources.forEach(function(r, i) {
      resPromises.push(createResource(r, options));

      var model = r.relativeUri.split('/')[1];
      if (/^[a-z0-9]+$/i.test(model)) {
        spec[model] = { 'model': capitalize(model) };
      }
    });
  }
  addAttributes(options.rootPath, modelName, spec);
  return resPromises;
}


// TODO parse all first, then create
function createResource(res, options) {
  var modelName = res.relativeUri.split('/')[1];

  modelName = capitalize(modelName);
  if (/s$/.test(modelName) && options.pluralized) {
    modelName = modelName.slice(0, -1);
  }

  var spec = convertRamlFormToSailsModel(res) || {};

  function resolveAll(promises, resolve, reject) {
    try {
      Promise.settle(promises).then(function(results) {
        var reason = _.find(results, function(result){
          if(result.isRejected()) return result.reason();
        });
        if(reason) return reject(reason);
        resolve();
      });
    } catch(err) {
      reject(err);
    }
  }

  return new Promise(function(resolve, reject) {
    if (!/^[a-z0-9]+$/i.test(modelName)) {
      modelName = options.parent;
      resolveAll(createResources(res, modelName, spec, options), resolve, reject);

    } else {
      // TODO: too hacky, use sails-generate-api programmatically
      process.chdir(options.rootPath);

      var errmsg = "";
      var child = exec("sails generate api "+modelName, function (error, stdout, stderr) {

        sys.print(stdout);
        errmsg += stderr;
/*
        if (error !== null) {
          console.error(error);
          return reject(error);
        }
*/
      })
      .on("close", function (code, sig) {
     
        if(/already exists/.test(errmsg)) {
          // TODO merge with existing?
        } else if(code != 0) {
          return reject("sails generate exitcode", code);
        } else { 
          console.log("==", modelName);
        }

        resolveAll(createResources(res, modelName, spec, options), resolve, reject);
      });
    }
  });
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

    var bp = (function() {
      try {
        return require(scope.rootPath + '/config/blueprints');
      } catch(e) {}
    })() || {};

    raml.loadFile(scope.args[0]).then( function(rootNode) {
      /*var models = _.map(rootNode.resources, function(n,i) {
        return n.relativeUriPathSegments[0].replace(/s$/,'');
      });*/

      var resPromises = [];

      try {
        rootNode.resources.forEach(function(r) {
          resPromises.push(
            createResource(r, {
                rootPath: scope.rootPath,
                pluralized: bp.blueprints && bp.blueprints.pluralize
              })
            );
        });
      } catch(e) {
        console.error(e);
      }

      // When finished, we trigger a callback with no error
      Promise.settle(resPromises).then(function(results) {
        var all = _.all(results, function(r) {
          if (r.isRejected()) {
            cb(new Error(r.reason()));
            return false;
          }
          return true;
        });
        if(all) cb();
      });

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
