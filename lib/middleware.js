
/**
 * Module dependencies.
 */

var utils = require('./utils');

/**
 * Initialization middleware, exposing the
 * request and response to eachother.
 *
 * @param {Function} app
 * @return {Function}
 * @api private
 */

exports.init = function(app){
  return function isomorphicInit(req, res, next){
    req.app = res.app = app;
    req.res = res;
    res.req = req;
    req.next = next;

    req.__proto__ = app.request;
    res.__proto__ = app.response;

    res.locals = res.locals || utils.locals(res);

    next();
  }
};
