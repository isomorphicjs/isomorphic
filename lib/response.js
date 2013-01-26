
/**
 * Module dependencies.
 */

var utils = require('./utils')
  , stack = require('stack')
  , EventEmitter = require("emitter")
  , Response = require("res")
  , parse = stack.utils.parseUrl;

/**
 * Response prototype.
 */

var res = module.exports = {
  __proto__: Response.prototype
};

/**
 * Set status `code`.
 *
 * @param {Number} code
 * @return {ServerResponse}
 * @api public
 */

res.status = function(code){
  this.statusCode = code;
  return this;
};

/**
 * Set Link header field with the given `links`.
 *
 * Examples:
 *
 *    res.links({
 *      next: 'http://api.example.com/users?page=2',
 *      last: 'http://api.example.com/users?page=5'
 *    });
 *
 * @param {Object} links
 * @return {ServerResponse}
 * @api public
 */

res.links = function(links){
  return this.set('Link', Object.keys(links).map(function(rel){
    return '<' + links[rel] + '>; rel="' + rel + '"';
  }).join(', '));
};

/**
 * Send a response.
 *
 * Examples:
 *
 *     res.send(new Buffer('wahoo'));
 *     res.send({ some: 'json' });
 *     res.send('<p>some html</p>');
 *     res.send(404, 'Sorry, cant find that');
 *     res.send(404);
 *
 * @param {Mixed} body or status
 * @param {Mixed} body
 * @return {ServerResponse}
 * @api public
 */

res.send = function(body){
  var req = this.req
    , head = 'HEAD' == req.method
    , len;

  // allow status / body
  if (2 == arguments.length) {
    // res.send(body, status) backwards compat
    if ('number' != typeof body && 'number' == typeof arguments[1]) {
      this.statusCode = arguments[1];
    } else {
      this.statusCode = body;
      body = arguments[1];
    }
  }

  switch (typeof body) {
    // response status
    case 'number':
      this.get('Content-Type') || this.type('txt');
      this.statusCode = body;
      body = http.STATUS_CODES[body];
      break;
    // string defaulting to html
    case 'string':
      if (!this.get('Content-Type')) {
        this.charset = this.charset || 'utf-8';
        // this.type('html');
      }
      break;
    case 'boolean':
    case 'object':
      if (null == body) {
        body = '';
      } else if (Buffer.isBuffer(body)) {
        this.get('Content-Type') || this.type('bin');
      } else {
        return this.json(body);
      }
      break;
  }

  // populate Content-Length
  if (undefined !== body && !this.get('Content-Length')) {
    this.set('Content-Length', len = body.length);
  }

  // ETag support
  // TODO: W/ support
  if (len > 1024) {
    if (!this.get('ETag')) {
      this.set('ETag', etag(body));
    }
  }

  // freshness
  if (req.fresh) this.statusCode = 304;

  // strip irrelevant headers
  if (204 == this.statusCode || 304 == this.statusCode) {
    this.removeHeader('Content-Type');
    this.removeHeader('Content-Length');
    this.removeHeader('Transfer-Encoding');
    body = '';
  }

  // respond
  this.end(head ? null : body);
  return this;
};


/**
 * Set header `field` to `val`, or pass
 * an object of header fields.
 *
 * Examples:
 *
 *    res.set('Foo', ['bar', 'baz']);
 *    res.set('Accept', 'application/json');
 *    res.set({ Accept: 'text/plain', 'X-API-Key': 'tobi' });
 *
 * Aliased as `res.header()`.
 *
 * @param {String|Object|Array} field
 * @param {String} val
 * @return {ServerResponse} for chaining
 * @api public
 */

res.set =
res.header = function(field, val){
  if (2 == arguments.length) {
    if (Array.isArray(val)) val = val.map(String);
    else val = String(val);
    this.setHeader(field, val);
  } else {
    for (var key in field) {
      this.set(key, field[key]);
    }
  }
  return this;
};

/**
 * Get value for header `field`.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

res.get = function(field){
  return this.getHeader(field);
};

/**
 * Clear cookie `name`.
 *
 * @param {String} name
 * @param {Object} options
 * @param {ServerResponse} for chaining
 * @api public
 */

res.clearCookie = function(name, options){
  var opts = { expires: new Date(1), path: '/' };
  return this.cookie(name, '', options
    ? utils.merge(opts, options)
    : opts);
};

/**
 * Set cookie `name` to `val`, with the given `options`.
 *
 * Options:
 *
 *    - `maxAge`   max-age in milliseconds, converted to `expires`
 *    - `signed`   sign the cookie
 *    - `path`     defaults to "/"
 *
 * Examples:
 *
 *    // "Remember Me" for 15 minutes
 *    res.cookie('rememberme', '1', { expires: new Date(Date.now() + 900000), httpOnly: true });
 *
 *    // save as above
 *    res.cookie('rememberme', '1', { maxAge: 900000, httpOnly: true })
 *
 * @param {String} name
 * @param {String|Object} val
 * @param {Options} options
 * @api public
 */

res.cookie = function(name, val, options){
  options = utils.merge({}, options);
  var secret = this.req.secret;
  var signed = options.signed;
  if (signed && !secret) throw new Error('cookieParser("secret") required for signed cookies');
  if ('object' == typeof val) val = 'j:' + JSON.stringify(val);
  if (signed) val = 's:' + sign(val, secret);
  if ('maxAge' in options) {
    options.expires = new Date(Date.now() + options.maxAge);
    options.maxAge /= 1000;
  }
  if (null == options.path) options.path = '/';
  this.set('Set-Cookie', cookie.serialize(name, String(val), options));
  return this;
};


/**
 * Set the location header to `url`.
 *
 * The given `url` can also be the name of a mapped url, for
 * example by default express supports "back" which redirects
 * to the _Referrer_ or _Referer_ headers or "/".
 *
 * Examples:
 *
 *    res.location('/foo/bar').;
 *    res.location('http://example.com');
 *    res.location('../login'); // /blog/post/1 -> /blog/login
 *
 * Mounting:
 *
 *   When an application is mounted and `res.location()`
 *   is given a path that does _not_ lead with "/" it becomes
 *   relative to the mount-point. For example if the application
 *   is mounted at "/blog", the following would become "/blog/login".
 *
 *      res.location('login');
 *
 *   While the leading slash would result in a location of "/login":
 *
 *      res.location('/login');
 *
 * @param {String} url
 * @api public
 */

res.location = function(url){
  var app = this.app
    , req = this.req;

  // setup redirect map
  var map = { back: req.get('Referrer') || '/' };

  // perform redirect
  url = map[url] || url;

  // relative
  if (!~url.indexOf('://') && 0 != url.indexOf('//')) {
    var path = app.path();

    // relative to path
    if ('.' == url[0]) {
      url = req.path + '/' + url;
    // relative to mount-point
    } else if ('/' != url[0]) {
      url = path + '/' + url;
    }
  }

  // Respond
  this.set('Location', url);
  return this;
};

/**
 * Redirect to the given `url` with optional response `status`
 * defaulting to 302.
 *
 * The resulting `url` is determined by `res.location()`, so
 * it will play nicely with mounted apps, relative paths,
 * `"back"` etc.
 *
 * Examples:
 *
 *    res.redirect('/foo/bar');
 *    res.redirect('http://example.com');
 *    res.redirect(301, 'http://example.com');
 *    res.redirect('http://example.com', 301);
 *    res.redirect('../login'); // /blog/post/1 -> /blog/login
 *
 * @param {String} url
 * @param {Number} code
 * @api public
 */

res.redirect = function(url){
  var app = this.app
    , head = 'HEAD' == this.req.method
    , status = 302
    , body;

  // allow status / url
  if (2 == arguments.length) {
    if ('number' == typeof url) {
      status = url;
      url = arguments[1];
    } else {
      status = arguments[1];
    }
  }

  // Set location header
  this.location(url);
  url = this.get('Location');

  // Support text/{plain,html} by default
  this.format({
    text: function(){
      body = statusCodes[status] + '. Redirecting to ' + encodeURI(url);
    },

    html: function(){
      var u = utils.escape(url);
      body = '<p>' + statusCodes[status] + '. Redirecting to <a href="' + u + '">' + u + '</a></p>';
    },

    default: function(){
      body = '';
    }
  });

  // Respond
  this.statusCode = status;
  this.set('Content-Length', Buffer.byteLength(body));
  this.end(head ? null : body);
};

/**
 * Render `view` with the given `options`.
 *
 * Options:
 *
 *  - `cache`     boolean hinting to the engine it should cache
 *  - `filename`  filename of the view being rendered
 *
 * @param  {String} view
 * @param  {Object} options
 * @api public
 */

res.render = function(view, options){
  var self = this
    , options = options || {}
    , req = this.req
    , app = req.app;

  // merge res.locals
  options._locals = self.locals;

  if (self.app.enabled('streaming')) {
    var emitter = new EventEmitter

    emitter.on("data", function(str){
      self.write(str);
    });
    emitter.on("err", function(err){
      req.next(err)
    });
    emitter.on("end", function(){
      self.end();
    });

    // render
    app.render(view, options, emitter);
  }
  else {
    // default callback to respond
    var fn = function(err, str){
      if (err) return req.next(err);
      self.send(str);
    };

    // render
    app.render(view, options, fn);
  }
};
