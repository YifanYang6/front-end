(function (){
  'use strict';

  var async     = require("async")
    , express   = require("express")
    , axios     = require("axios")
    , helpers   = require("../../helpers")
    , endpoints = require("../endpoints")
    , app       = express()

  // List items in cart for current logged in user.
  app.get("/cart", function (req, res, next) {
    console.log("Request received: " + req.url + ", " + req.query.custId);
    var custId = helpers.getCustomerId(req, app.get("env"));
    console.log("Customer ID: " + custId);
    axios.get(endpoints.cartsUrl + "/" + custId + "/items")
      .then(function(response) {
        helpers.respondStatusBody(res, response.status, typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
      })
      .catch(function(error) {
        next(error);
      });
  });

  // Delete cart
  app.delete("/cart", function (req, res, next) {
    var custId = helpers.getCustomerId(req, app.get("env"));
    console.log('Attempting to delete cart for user: ' + custId);
    axios.delete(endpoints.cartsUrl + "/" + custId)
      .then(function(response) {
        console.log('User cart deleted with status: ' + response.status);
        helpers.respondStatus(res, response.status);
      })
      .catch(function(error) {
        next(error);
      });
  });

  // Delete item from cart
  app.delete("/cart/:id", function (req, res, next) {
    if (req.params.id == null) {
      return next(new Error("Must pass id of item to delete"), 400);
    }

    console.log("Delete item from cart: " + req.url);

    var custId = helpers.getCustomerId(req, app.get("env"));

    axios.delete(endpoints.cartsUrl + "/" + custId + "/items/" + req.params.id.toString())
      .then(function(response) {
        console.log('Item deleted with status: ' + response.status);
        helpers.respondStatus(res, response.status);
      })
      .catch(function(error) {
        next(error);
      });
  });

  // Add new item to cart
  app.post("/cart", function (req, res, next) {
    console.log("Attempting to add to cart: " + JSON.stringify(req.body));

    if (req.body.id == null) {
      next(new Error("Must pass id of item to add"), 400);
      return;
    }

    var custId = helpers.getCustomerId(req, app.get("env"));

    async.waterfall([
        function (callback) {
          axios.get(endpoints.catalogueUrl + "/catalogue/" + req.body.id.toString())
            .then(function(response) {
              console.log(response.data);
              callback(null, response.data);
            })
            .catch(function(error) {
              callback(error);
            });
        },
        function (item, callback) {
          var body = {itemId: item.id, unitPrice: item.price};
          console.log("POST to carts: " + endpoints.cartsUrl + "/" + custId + "/items" + " body: " + JSON.stringify(body));
          axios.post(endpoints.cartsUrl + "/" + custId + "/items", body)
            .then(function(response) {
              callback(null, response.status);
            })
            .catch(function(error) {
              callback(error);
            });
        }
    ], function (err, statusCode) {
      if (err) {
        return next(err);
      }
      if (statusCode != 201) {
        return next(new Error("Unable to add to cart. Status code: " + statusCode))
      }
      helpers.respondStatus(res, statusCode);
    });
  });

// Update cart item
  app.post("/cart/update", function (req, res, next) {
    console.log("Attempting to update cart item: " + JSON.stringify(req.body));
    
    if (req.body.id == null) {
      next(new Error("Must pass id of item to update"), 400);
      return;
    }
    if (req.body.quantity == null) {
      next(new Error("Must pass quantity to update"), 400);
      return;
    }
    var custId = helpers.getCustomerId(req, app.get("env"));

    async.waterfall([
        function (callback) {
          axios.get(endpoints.catalogueUrl + "/catalogue/" + req.body.id.toString())
            .then(function(response) {
              console.log(response.data);
              callback(null, response.data);
            })
            .catch(function(error) {
              callback(error);
            });
        },
        function (item, callback) {
          var body = {itemId: item.id, quantity: parseInt(req.body.quantity), unitPrice: item.price};
          console.log("PATCH to carts: " + endpoints.cartsUrl + "/" + custId + "/items" + " body: " + JSON.stringify(body));
          axios.patch(endpoints.cartsUrl + "/" + custId + "/items", body)
            .then(function(response) {
              callback(null, response.status);
            })
            .catch(function(error) {
              callback(error);
            });
        }
    ], function (err, statusCode) {
      if (err) {
        return next(err);
      }
      if (statusCode != 202) {
        return next(new Error("Unable to add to cart. Status code: " + statusCode))
      }
      helpers.respondStatus(res, statusCode);
    });
  });
  
  module.exports = app;
}());
