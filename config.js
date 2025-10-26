(function (){
  'use strict';

  var session      = require("express-session"),
      RedisStore   = require('connect-redis').default,
      redis        = require('redis')

  var redisClient = redis.createClient({
    socket: {
      host: "session-db"
    },
    legacyMode: true
  });
  redisClient.connect().catch(console.error);

  module.exports = {
    session: {
      name: 'md.sid',
      secret: 'sooper secret',
      resave: false,
      saveUninitialized: true
    },

    session_redis: {
      store: new RedisStore({client: redisClient}),
      name: 'md.sid',
      secret: 'sooper secret',
      resave: false,
      saveUninitialized: true
    }
  };
}());
