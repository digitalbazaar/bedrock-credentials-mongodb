/*
 * Copyright (c) 2015-2017 Digital Bazaar, Inc. All rights reserved.
 */
/* jshint node: true */
'use strict';

var async = require('async');
var bedrock = require('bedrock');
var config = bedrock.config;
var database = require('bedrock-mongodb');
var mockData = require('./mock.data');
var uuid = require('uuid').v4;

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
    credential.sysStatus = 'active';
    credentials.push(credential);
  }
  return credentials;
};

helpers.dropCollections = function(callback) {
  async.each(COLLECTION_NAMES, function(collection, callback) {
    if(!database.collections[collection]) {
      return callback();
    }
    database.collections[collection].drop(function(err, result) {
      delete database.collections[collection];
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
  database.client.collections(function(err, reply) {
    var collectionNames = reply.map(function(obj) {
      return obj.s.name;
    });
    callback(err, collectionNames);
  });
};

helpers.removeCollections = function(callback) {
  var collectionNames = ['credentialProvider'];
  database.openCollections(collectionNames, function(err) {
    async.each(collectionNames, function(collectionName, callback) {
      database.collections[collectionName].remove({}, callback);
    }, function(err) {
      callback(err);
    });
  });
};
