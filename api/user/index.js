(function() {
    'use strict';

    var async = require("async"), express = require("express"), axios = require("axios"), endpoints = require("../endpoints"), helpers = require("../../helpers"), app = express(), cookie_name = "logged_in"


    app.get("/customers/:id", function(req, res, next) {
        helpers.simpleHttpRequest(endpoints.customersUrl + "/" + req.session.customerId, res, next);
    });
    app.get("/cards/:id", function(req, res, next) {
        helpers.simpleHttpRequest(endpoints.cardsUrl + "/" + req.params.id, res, next);
    });

    app.get("/customers", function(req, res, next) {
        helpers.simpleHttpRequest(endpoints.customersUrl, res, next);
    });
    app.get("/addresses", function(req, res, next) {
        helpers.simpleHttpRequest(endpoints.addressUrl, res, next);
    });
    app.get("/cards", function(req, res, next) {
        helpers.simpleHttpRequest(endpoints.cardsUrl, res, next);
    });

    // Create Customer - TO BE USED FOR TESTING ONLY (for now)
    app.post("/customers", function(req, res, next) {
        console.log("Posting Customer: " + JSON.stringify(req.body));

        axios.post(endpoints.customersUrl, req.body)
            .then(function(response) {
                helpers.respondSuccessBody(res, JSON.stringify(response.data));
            })
            .catch(function(error) {
                next(error);
            });
    });

    app.post("/addresses", function(req, res, next) {
        req.body.userID = helpers.getCustomerId(req, app.get("env"));

        console.log("Posting Address: " + JSON.stringify(req.body));
        axios.post(endpoints.addressUrl, req.body)
            .then(function(response) {
                helpers.respondSuccessBody(res, JSON.stringify(response.data));
            })
            .catch(function(error) {
                next(error);
            });
    });

    app.get("/card", function(req, res, next) {
        var custId = helpers.getCustomerId(req, app.get("env"));
        axios.get(endpoints.customersUrl + '/' + custId + '/cards')
            .then(function(response) {
                var data = response.data;
                if (data.status_code !== 500 && data._embedded.card.length !== 0 ) {
                    var resp = {
                        "number": data._embedded.card[0].longNum.slice(-4)
                    };
                    return helpers.respondSuccessBody(res, JSON.stringify(resp));
                }
                return helpers.respondSuccessBody(res, JSON.stringify({"status_code": 500}));
            })
            .catch(function(error) {
                next(error);
            });
    });

    app.get("/address", function(req, res, next) {
        var custId = helpers.getCustomerId(req, app.get("env"));
        axios.get(endpoints.customersUrl + '/' + custId + '/addresses')
            .then(function(response) {
                var data = response.data;
                if (data.status_code !== 500 && data._embedded.address.length !== 0 ) {
                    var resp = data._embedded.address[0];
                    return helpers.respondSuccessBody(res, JSON.stringify(resp));
                }
                return helpers.respondSuccessBody(res, JSON.stringify({"status_code": 500}));
            })
            .catch(function(error) {
                next(error);
            });
    });

    app.post("/cards", function(req, res, next) {
        req.body.userID = helpers.getCustomerId(req, app.get("env"));

        console.log("Posting Card: " + JSON.stringify(req.body));
        axios.post(endpoints.cardsUrl, req.body)
            .then(function(response) {
                helpers.respondSuccessBody(res, JSON.stringify(response.data));
            })
            .catch(function(error) {
                next(error);
            });
    });

    // Delete Customer - TO BE USED FOR TESTING ONLY (for now)
    app.delete("/customers/:id", function(req, res, next) {
        console.log("Deleting Customer " + req.params.id);
        axios.delete(endpoints.customersUrl + "/" + req.params.id)
            .then(function(response) {
                helpers.respondSuccessBody(res, JSON.stringify(response.data));
            })
            .catch(function(error) {
                next(error);
            });
    });

    // Delete Address - TO BE USED FOR TESTING ONLY (for now)
    app.delete("/addresses/:id", function(req, res, next) {
        console.log("Deleting Address " + req.params.id);
        axios.delete(endpoints.addressUrl + "/" + req.params.id)
            .then(function(response) {
                helpers.respondSuccessBody(res, JSON.stringify(response.data));
            })
            .catch(function(error) {
                next(error);
            });
    });

    // Delete Card - TO BE USED FOR TESTING ONLY (for now)
    app.delete("/cards/:id", function(req, res, next) {
        console.log("Deleting Card " + req.params.id);
        axios.delete(endpoints.cardsUrl + "/" + req.params.id)
            .then(function(response) {
                helpers.respondSuccessBody(res, JSON.stringify(response.data));
            })
            .catch(function(error) {
                next(error);
            });
    });

    app.post("/register", function(req, res, next) {
        console.log("Posting Customer: " + JSON.stringify(req.body));

        async.waterfall([
                function(callback) {
                    axios.post(endpoints.registerUrl, req.body)
                        .then(function(response) {
                            if (response.status == 200 && response.data != null && response.data != "") {
                                if (response.data.error) {
                                    callback(response.data.error);
                                    return;
                                }
                                console.log(response.data);
                                var customerId = response.data.id;
                                console.log(customerId);
                                req.session.customerId = customerId;
                                callback(null, customerId);
                                return;
                            }
                            console.log(response.status);
                            callback(true);
                        })
                        .catch(function(error) {
                            callback(error);
                        });
                },
                function(custId, callback) {
                    var sessionId = req.session.id;
                    console.log("Merging carts for customer id: " + custId + " and session id: " + sessionId);

                    axios.get(endpoints.cartsUrl + "/" + custId + "/merge" + "?sessionId=" + sessionId)
                        .then(function(response) {
                            console.log('Carts merged.');
                            if(callback) callback(null, custId);
                        })
                        .catch(function(error) {
                            if(callback) callback(error);
                        });
                }
            ],
            function(err, custId) {
                if (err) {
                    console.log("Error with log in: " + err);
                    res.status(500);
                    res.end();
                    return;
                }
                console.log("set cookie" + custId);
                res.status(200);
                res.cookie(cookie_name, req.session.id, {
                    maxAge: 3600000
                }).send({id: custId});
                console.log("Sent cookies.");
                res.end();
                return;
            }
        );
    });

    app.get("/login", function(req, res, next) {
        console.log("Received login request");

        async.waterfall([
                function(callback) {
                    axios.get(endpoints.loginUrl, {
                        headers: {
                            'Authorization': req.get('Authorization')
                        }
                    })
                        .then(function(response) {
                            if (response.status == 200 && response.data != null && response.data != "") {
                                console.log(response.data);
                                var customerId = response.data.user.id;
                                console.log(customerId);
                                req.session.customerId = customerId;
                                callback(null, customerId);
                                return;
                            }
                            console.log(response.status);
                            callback(true);
                        })
                        .catch(function(error) {
                            callback(error);
                        });
                },
                function(custId, callback) {
                    var sessionId = req.session.id;
                    console.log("Merging carts for customer id: " + custId + " and session id: " + sessionId);

                    axios.get(endpoints.cartsUrl + "/" + custId + "/merge" + "?sessionId=" + sessionId)
                        .then(function(response) {
                            console.log('Carts merged.');
                            callback(null, custId);
                        })
                        .catch(function(error) {
                            // if cart fails just log it, it prevents login
                            console.log(error);
                            callback(null, custId);
                        });
                }
            ],
            function(err, custId) {
                if (err) {
                    console.log("Error with log in: " + err);
                    res.status(401);
                    res.end();
                    return;
                }
                res.status(200);
                res.cookie(cookie_name, req.session.id, {
                    maxAge: 3600000
                }).send('Cookie is set');
                console.log("Sent cookies.");
                res.end();
                return;
            });
    });

    module.exports = app;
}());
