(function (){
  'use strict';

  var express   = require("express")
    , axios     = require("axios")
    , endpoints = require("../endpoints")
    , helpers   = require("../../helpers")
    , app       = express()

  app.get("/catalogue/images*", function (req, res, next) {
    var url = endpoints.catalogueUrl + req.url.toString();
    axios.get(url, {responseType: 'stream'})
      .then(function(response) {
        response.data.pipe(res);
      })
      .catch(function(error) {
        next(error);
      });
  });

  app.get("/catalogue*", function (req, res, next) {
    helpers.simpleHttpRequest(endpoints.catalogueUrl + req.url.toString(), res, next);
  });

  app.get("/tags", function(req, res, next) {
    helpers.simpleHttpRequest(endpoints.tagsUrl, res, next);
  });

  module.exports = app;
}());
