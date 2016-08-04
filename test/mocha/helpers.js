/*
 * Copyright (c) 2015-2016 Digital Bazaar, Inc. All rights reserved.
 */
/* jshint node: true */
'use strict';

var async = require('async');
var bedrock = require('bedrock');
var config = bedrock.config;
var db = require('bedrock-mongodb');
var mockData = require('./mock.data');
var uuid = require('node-uuid').v4;

var COLLECTION_NAMES = ['credentialProvider', 'credentialConsumer'];

var helpers = {};
module.exports = helpers;

helpers.generateCredentials = function(quantity, recipientDid) {
  // all credentials will have the same recipient
  var recipient = recipientDid || uuid();
  var credentials = [];
  for(var i = 0; i < quantity; i++) {
    var credential = bedrock.util.clone(mockData.credentialTemplate);
    credential.id = 'did:' + uuid();
    credential.claim.id = 'did:' + recipient;
    credentials.push(credential);
  }
  return credentials;
};

helpers.dropCollections = function(callback) {
  async.each(COLLECTION_NAMES, function(collection, callback) {
    if(!db.collections[collection]) {
      return callback();
    }
    db.collections[collection].drop(function(err, result) {
      delete db.collections[collection];
      callback(err);
    });
  }, function(err) {
    // ignore 'ns not found' error
    if(err && err.message !== 'ns not found') {
      return callback(err);
    }
    callback();
  });
};

helpers.listCollections = function(callback) {
  db.client.collections(function(err, reply) {
    var collectionNames = reply.map(function(obj) {
      return obj.s.name;
    });
    callback(err, collectionNames);
  });
};
