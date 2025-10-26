(function (){
  'use strict';

  var async     = require("async")
    , express   = require("express")
    , axios     = require("axios")
    , endpoints = require("../endpoints")
    , helpers   = require("../../helpers")
    , app       = express()

  app.get("/orders", function (req, res, next) {
    console.log("Request received with body: " + JSON.stringify(req.body));
    var logged_in = req.cookies.logged_in;
    if (!logged_in) {
      throw new Error("User not logged in.");
      return
    }

    var custId = req.session.customerId;
    async.waterfall([
        function (callback) {
          axios.get(endpoints.ordersUrl + "/orders/search/customerId?sort=date&custId=" + custId)
            .then(function(response) {
              console.log("Received response: " + JSON.stringify(response.data));
              if (response.status == 404) {
                console.log("No orders found for user: " + custId);
                return callback(null, []);
              }
              callback(null, response.data._embedded.customerOrders);
            })
            .catch(function(error) {
              if (error.response && error.response.status === 404) {
                console.log("No orders found for user: " + custId);
                return callback(null, []);
              }
              callback(error);
            });
        }
    ],
    function (err, result) {
      if (err) {
        return next(err);
      }
      helpers.respondStatusBody(res, 201, JSON.stringify(result));
    });
  });

  app.get("/orders/*", function (req, res, next) {
    var url = endpoints.ordersUrl + req.url.toString();
    axios.get(url, {responseType: 'stream'})
      .then(function(response) {
        response.data.pipe(res);
      })
      .catch(function(error) {
        next(error);
      });
  });

  app.post("/orders", function(req, res, next) {
    console.log("Request received with body: " + JSON.stringify(req.body));
    var logged_in = req.cookies.logged_in;
    if (!logged_in) {
      throw new Error("User not logged in.");
      return
    }

    var custId = req.session.customerId;

    async.waterfall([
        function (callback) {
          axios.get(endpoints.customersUrl + "/" + custId)
            .then(function(response) {
              console.log("Received response: " + JSON.stringify(response.data));
              var jsonBody = response.data;
              var customerlink = jsonBody._links.customer.href;
              var addressLink = jsonBody._links.addresses.href;
              var cardLink = jsonBody._links.cards.href;
              var order = {
                "customer": customerlink,
                "address": null,
                "card": null,
                "items": endpoints.cartsUrl + "/" + custId + "/items"
              };
              callback(null, order, addressLink, cardLink);
            })
            .catch(function(error) {
              callback(error);
            });
        },
        function (order, addressLink, cardLink, callback) {
          async.parallel([
              function (callback) {
                console.log("GET Request to: " + addressLink);
                axios.get(addressLink)
                  .then(function(response) {
                    console.log("Received response: " + JSON.stringify(response.data));
                    var jsonBody = response.data;
                    if (jsonBody.status_code !== 500 && jsonBody._embedded.address[0] != null) {
                      order.address = jsonBody._embedded.address[0]._links.self.href;
                    }
                    callback();
                  })
                  .catch(function(error) {
                    callback(error);
                  });
              },
              function (callback) {
                console.log("GET Request to: " + cardLink);
                axios.get(cardLink)
                  .then(function(response) {
                    console.log("Received response: " + JSON.stringify(response.data));
                    var jsonBody = response.data;
                    if (jsonBody.status_code !== 500 && jsonBody._embedded.card[0] != null) {
                      order.card = jsonBody._embedded.card[0]._links.self.href;
                    }
                    callback();
                  })
                  .catch(function(error) {
                    callback(error);
                  });
              }
          ], function (err, result) {
            if (err) {
              callback(err);
              return;
            }
            console.log(result);
            callback(null, order);
          });
        },
        function (order, callback) {
          console.log("Posting Order: " + JSON.stringify(order));
          axios.post(endpoints.ordersUrl + '/orders', order)
            .then(function(response) {
              console.log("Order response: " + JSON.stringify(response.status));
              console.log("Order response: " + JSON.stringify(response.data));
              callback(null, response.status, response.data);
            })
            .catch(function(error) {
              callback(error);
            });
        }
    ],
    function (err, status, result) {
      if (err) {
        return next(err);
      }
      helpers.respondStatusBody(res, status, JSON.stringify(result));
    });
  });

  module.exports = app;
}());
