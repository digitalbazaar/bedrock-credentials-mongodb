/*
 * Copyright (c) 2015 Digital Bazaar, Inc. All rights reserved.
 */

'use strict';

var _ = require('lodash');
var async = require('async');
var bedrock = require('bedrock');
var config = bedrock.config['credentials-mongodb'];
var db = require('bedrock-mongodb');
var uuid = require('node-uuid');
var store = require('../lib/store');
var COLLECTION_NAMES = ['credentialProvider', 'credentialConsumer'];
var savedSettings = {};

before(function(done) {
  savedSettings.provider = {};
  savedSettings.consumer = {};
  savedSettings.provider.enable = config.provider.enable;
  savedSettings.consumer.enable = config.consumer.enable;
  done();
});

after(function(done) {
  config.provider.enable = savedSettings.provider.enable;
  config.consumer.enable = savedSettings.consumer.enable;
  // allow module to create collections
  bedrock.events.emit('bedrock.start', done);
});

describe('bedrock-credentials-mongodb initialization', function() {

  beforeEach(function(done) {
    // restore these values to defaults found in the config
    config.provider.enable = true;
    config.consumer.enable = true;
    dropCollections(function() {
      listCollections(function(err, collectionNames) {
        _.intersection(collectionNames, COLLECTION_NAMES)
          .should.have.length(0);
        done();
      });
    });
  });

  afterEach(function(done) {
    dropCollections(done);
  });

  it('should create provider and consumer stores', function(done) {
    bedrock.events.emit('bedrock.start', function() {
      listCollections(function(err, collectionNames) {
        _.intersection(collectionNames, COLLECTION_NAMES)
          .should.have.length(2);
        done();
      });
    });
  });

  it('should create only a provider store', function(done) {
    config.provider.enable = true;
    config.consumer.enable = false;
    bedrock.events.emit('bedrock.start', function() {
      listCollections(function(err, collectionNames) {
        _.intersection(collectionNames, COLLECTION_NAMES)
          .should.have.length(1);
        _.includes(collectionNames, 'credentialProvider').should.be.true;
        done();
      });
    });
  });

  it('should create only a consumer store', function(done) {
    config.provider.enable = false;
    config.consumer.enable = true;
    bedrock.events.emit('bedrock.start', function() {
      listCollections(function(err, collectionNames) {
        _.intersection(collectionNames, COLLECTION_NAMES)
          .should.have.length(1);
        _.includes(collectionNames, 'credentialConsumer').should.be.true;
        done();
      });
    });
  });

});

describe('bedrock-credentials-mongodb operations', function() {
  beforeEach(function(done) {
    config.provider.enable = true;
    config.consumer.enable = false;
    async.series([
      function(callback) {
        dropCollections(callback);
      },
      function(callback) {
        bedrock.events.emit('bedrock.start', callback);
      }
    ], done);
  });

  afterEach(function(done) {
    dropCollections(done);
  });

  it('should insert a credential without alteration', function(done) {
    var credential = generateCredentials(1)[0];
    store.provider.insert(null, credential, function(err, result) {
      result.id.should.exist;
      result.id.should.be.a('string');
      result.issuer.should.exist;
      result.issuer.should.be.a('string');
      result.recipient.should.exist;
      result.recipient.should.be.a('string');
      result.meta.should.exist;
      result.meta.should.be.an('object');
      result.meta.created.should.exist;
      result.meta.created.should.be.a('number');
      result.meta.updated.should.exist;
      result.meta.updated.should.be.a('number');
      result.credential.should.exist;
      result.credential.should.be.an('object');
      JSON.stringify(result.credential)
        .should.equal(JSON.stringify(credential));
      done();
    });
  });

  it('should retrieve a credential by id', function(done) {
    var credential = generateCredentials(1)[0];
    async.series([
      function(callback) {
        store.provider.insert(null, credential, callback);
      },
      function(callback) {
        store.provider.get(
          null, credential.id, function(err, result) {
            result.should.be.an('object');
            JSON.stringify(result)
              .should.equal(JSON.stringify(credential));
            callback(err);
          });
      }
    ], done);
  });

  it('should return an error if credential id is not found', function(done) {
    // there are no credentials in the database
    var credential = generateCredentials(1)[0];
    store.provider.get(
      null, credential.id, function(err, result) {
        err.should.exist;
        err.should.be.an('object');
        err.name.should.exist;
        err.name.should.be.a('string');
        err.name.should.equal('NotFound');
        err.message.should.exist;
        err.message.should.be.a('string');
        err.message.should.equal('Credential not found.');
        err.details.should.exist;
        err.details.should.be.an('object');
        err.details.id.should.exist;
        err.details.id.should.equal(credential.id);
        err.details.httpStatusCode.should.exist;
        err.details.httpStatusCode.should.equal(404);
        err.details.public.should.exist;
        err.details.public.should.be.true;
        done();
      });
  });

  it('should throw error on inserting a duplicate credential', function(done) {
    var credential = generateCredentials(1)[0];
    async.series([
      function(callback) {
        store.provider.insert(null, credential, function(err, result) {
          // console.log('ERROR', err);
          // console.log('RESULT', result);
          callback();
        });
      },
      function(callback) {
        store.provider.insert(null, credential, function(err, result) {
          err.should.exist;
          db.isDuplicateError(err).should.be.true;
          callback();
        });
      },
      function(callback) {
        // there should only be one record in the collection
        store.provider.getAll(null, {}, function(err, results) {
          results.should.have.length(1);
          callback();
        });
      }
    ], done);
  });

  it('should retrieve all credentials based on empty query', function(done) {
    var credentials = generateCredentials(3);
    async.series([
      function(callback) {
        async.each(credentials, function(credential, callback) {
          store.provider.insert(null, credential, callback);
        }, callback);
      },
      function(callback) {
        // empty query should return all records
        store.provider.getAll(null, {}, function(err, results) {
          results.should.have.length(3);
          callback();
        });
      }
    ], done);
  });

  it('should retrieve a credential based on query by id', function(done) {
    var credentials = generateCredentials(3);
    async.series([
      function(callback) {
        async.each(credentials, function(credential, callback) {
          store.provider.insert(null, credential, callback);
        }, callback);
      },
      function(callback) {
        async.each(credentials, function(credential, callback) {
          var query = {
            'credential.id': credential.id
          };
          store.provider.getAll(null, query, function(err, results) {
            should.not.exist(err);
            results.should.have.length(1);
            JSON.stringify(results[0].credential)
              .should.equal(JSON.stringify(credential));
            callback();
          });
        }, callback);
      }
    ], done);
  });

  it('should retrieve only specified fields', function(done) {
    var credentials = generateCredentials(1);
    async.series([
      function(callback) {
        async.each(credentials, function(credential, callback) {
          store.provider.insert(null, credential, callback);
        }, callback);
      },
      function(callback) {
        async.each(credentials, function(credential, callback) {
          var query = {
            'credential.id': credential.id
          };
          var fields = {
            'credential.issuer': '',
            'credential.issued': ''
          };
          store.provider.getAll(null, query, fields, function(err, results) {
            should.not.exist(err);
            results.should.have.length(1);
            // result will include mongo _id field
            Object.keys(results[0].credential).should.have.length(2);
            JSON.stringify(results[0].credential.issuer)
              .should.equal(JSON.stringify(credential.issuer));
            JSON.stringify(results[0].credential.issued)
              .should.equal(JSON.stringify(credential.issued));
            callback();
          });
        }, callback);
      }
    ], done);
  });

  it('should retrieve credentials based on query by recipient', function(done) {
    var credentials = [];
    var credentialBatches = {};
    var credentialCounts = [3, 5, 7];
    // each batch will have a unique recipient and record count
    _.forEach(credentialCounts, function(count) {
      var recipient = uuid.v4();
      credentialBatches[recipient] = count;
      credentials = credentials.concat(generateCredentials(count, recipient));
    });
    async.series([
      function(callback) {
        async.each(credentials, function(credential, callback) {
          store.provider.insert(null, credential, callback);
        }, callback);
      },
      function(callback) {
        async.forEachOf(
          credentialBatches, function(count, recipient, callback) {
            var query = {
              'credential.claim.id': 'did:' + recipient
            };
            store.provider.getAll(null, query, function(err, results) {
              should.not.exist(err);
              results.should.have.length(count);
              callback();
            });
          }, callback);
      }
    ], done);
  });

  it('should compose an identity', function(done) {
    var recipient = uuid.v4();
    var recipientDid = 'did:' + recipient;
    var credentials = generateCredentials(3, recipient);
    var template = {
      email: ''
    };
    async.series([
      function(callback) {
        async.each(credentials, function(credential, callback) {
          store.provider.insert(null, credential, callback);
        }, callback);
      },
      function(callback) {
        store.provider.compose(
          null, recipientDid, template, function(err, identity) {
            should.not.exist(err);
            identity.should.be.an('object');
            should.exist(identity['@context']);
            should.exist(identity.id);
            identity.id.should.equal(recipientDid);
            should.exist(identity.credential);
            identity.credential.should.be.an('array');
            // there are 3 email credentials for this recipient
            identity.credential.should.have.length(3);
            callback();
          });
      }
    ], done);
  });

});

function generateCredentials(quantity, recipientDid) {
  // all credentials will have the same recipient
  var recipient = recipientDid || uuid.v4();
  var credentials = [];
  for(var i = 0; i < quantity; i++) {
    var credential = bedrock.util.clone(config.mock.credentialTemplate);
    credential.id = 'did:' + uuid.v4();
    credential.claim.id = 'did:' + recipient;
    credentials.push(credential);
  }
  return credentials;
};

function dropCollections(callback) {
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

function listCollections(callback) {
  db.client.collections(function(err, reply) {
    var collectionNames = reply.map(function(obj) {
      return obj.s.name;
    });
    callback(err, collectionNames);
  });
};
