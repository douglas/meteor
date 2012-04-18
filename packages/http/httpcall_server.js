Meteor.http = Meteor.http || {};

(function() {

  var request = __meteor_bootstrap__.require('request');
  var url_util = __meteor_bootstrap__.require('url');


  Meteor.http.call = function(method, url, options, callback) {

    ////////// Process arguments //////////

    if (! callback && typeof options === "function") {
      // support (method, url, callback) argument list
      callback = options;
      options = null;
    }

    options = options || {};

    method = (method || "").toUpperCase();

    if (! /^https?:\/\//.test(url))
      throw new Error("url must be absolute and start with http:// or https://");

    var url_parts = url_util.parse(url);

    var new_url = Meteor.http._buildUrl(
      url_parts.protocol+"//"+url_parts.host+url_parts.pathname,
      url_parts.search, options.query, options.params);


    var content = options.content;
    if (options.data)
      content = JSON.stringify(options.data);


    ////////// Callback wrapping //////////

    var fut;
    if (! callback) {
      // Sync mode
      fut = new Future;
      callback = function(error, result) {
        fut.ret(result);
      };
    } else {
      // Async mode
      // re-enter user code in a Fiber
      callback = Meteor.bindEnvironment(callback, function(e) {
        Meteor._debug("Exception in callback of Meteor.http.call", e.stack);
      });
    }

    // wrap callback to always return a result object, and always
    // have an 'error' property in result
    callback = (function(callback) {
      return function(error, result) {
        result = result || {};
        result.error = error;
        callback(error, result);
      };
    })(callback);

    // safety belt: only call the callback once.
    callback = _.once(callback);


    ////////// Kickoff! //////////

    var req_options = {
      url: new_url,
      method: method,
      encoding: "utf8",
      jar: false,
      timeout: options.timeout,
      body: content,
      followRedirect: options.followRedirects
    };

    request(req_options, function(error, res, body) {
      var response = null;

      if (! error) {

        response = {};
        response.statusCode = res.statusCode;
        response.content = function() {
          return body;
          };
        response.data = function() {
          return JSON.parse(response.content());
        };

        if (res.statusCode >= 400)
          error = new Error("failed");
      }

      callback(error, response);

    });

    // If we're in sync mode, block and return the result.
    if (fut)
      return fut.wait();
  };

})();
