/**
 * Module dependencies.
 */

var stack = require("stack")
  , proto = require('./application')
  , Route = require('./router/route')
  , Router = require('./router')
  , req = require('./request')
  , res = require('./response')
  , emitter = require("emitter")
  , merge = require("stack").utils.merge;

/**
 * Expose `createApplication()`.
 */

exports = module.exports = createApplication;

/**
 * Create an isomorphic application.
 *
 * @return {Function}
 * @api public
 */

function createApplication() {
  var app = stack();
  app.request = { __proto__: req };
  app.response = { __proto__: res };
  merge(app, proto);
  app.init();
  return app;
}

exports.Route = Route;
exports.Router = Router;
