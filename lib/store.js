/*
 * Bedrock credentials mongodb module.
 *
 * This modules exposes an API for inserting and querying credentials that
 * are stored in a mongodb database.
 *
 * Copyright (c) 2015 Digital Bazaar, Inc. All rights reserved.
 */
 /* jshint node: true */
 'use strict';

var _ = require('lodash');
var async = require('async');
var bedrock = require('bedrock');
var brPermission = require('bedrock-permission');
var database = require('bedrock-mongodb');
var BedrockError = bedrock.util.BedrockError;
var jsonld = require('jsonld');

// load config defaults
require('./config');

// module permissions
var PERMISSIONS = bedrock.config.permission.permissions;

// module API
var api = {};
module.exports = api;

// Expose database API
api.database = database;

/* Note: By default, two stores are created, but some consumers of this
module may only ever use one of them, depending on the role they play. The
stores are:

1. `provider`: To be used by credential providers that store credentials that
  can be provided to other credential players upon request. This store is
  typically used by credential issuers, curators, and aggregators.

2. `consumer`: To be used by credential players that have obtained
  credentials from providers. This store is typically used by credential
  consumers.

Other stores can be manually created, but care must be taken to initialize
them properly. */
api.Store = Store;
api.provider = new Store();
api.consumer = new Store();

var logger = bedrock.loggers.get('app');

bedrock.events.on('bedrock-mongodb.ready', function(callback) {
  var config = bedrock.config['credentials-mongodb'];
  async.auto({
    provider: function(callback) {
      if(config.provider.enable) {
        return api.provider.init(config.provider, callback);
      }
      logger.debug(
        'bedrock-credentials-mongodb skipped provider store creation');
      callback();
    },
    consumer: function(callback) {
      if(config.consumer.enable) {
        return api.consumer.init(config.consumer, callback);
      }
      logger.debug(
        'bedrock-credentials-mongodb skipped consumer store creation');
      callback();
    }
  }, function(err) {
    callback(err);
  });
});

bedrock.events.on('bedrock.test.configure', function() {
  // load test config
  require('./test.config');
});

function Store() {
  this.name = null;
  this.collection = null;
  this._idGenerator = null;
}

/**
 * Initializes this Store prior to use.
 *
 * @param options the options to use.
 *          name the name of the mongodb collection to initialize.
 *
 * @param callback(err) called once the operation completes.
 */
Store.prototype.init = function(options, callback) {
  var self = this;
  self.name = options.name;
  logger.debug('bedrock-credentials-mongodb creating store: ' + self.name);
  logger.warning('referenceId index is temporarily disabled');
  async.auto({
    openCollections: function(callback) {
      database.openCollections([self.name], function(err) {
        if(!err) {
          // store collection
          self.collection = database.collections[self.name];
        }
        callback(err);
      });
    },
    createIndexes: ['openCollections', function(callback) {
      // TODO: add index on domain-specific id
      database.createIndexes([{
        collection: self.name,
        fields: {id: 1},
        options: {unique: true, background: false}
      }, {
        collection: self.name,
        fields: {recipient: 1, issuer: 1, id: 1},
        options: {unique: true, background: false}
      }, {
        collection: self.name,
        fields: {issuer: 1, id: 1},
        options: {unique: true, background: false}
      }/* FIXME: re-enable this index , {
        collection: self.name,
        fields: {issuer: 1, referenceId: 1},
        options: {unique: true, background: false}
      }*/], callback);
    }],
    createCredentials: ['createIndexes', function(callback) {
      // create credentials, ignoring duplicate errors
      async.eachSeries(options.credentials, function(credential, callback) {
        self.insert(null, credential, function(err) {
          if(err && database.isDuplicateError(err)) {
            err = null;
          }
          callback(err);
        });
      }, callback);
    }],
    createIdGenerator: function(callback) {
      database.getDistributedIdGenerator(self.name, function(err, idg) {
        if(!err) {
          self._idGenerator = idg;
        }
        callback(err);
      });
    }
  }, function(err) {
    if(!err) {
      logger.debug('bedrock-credentials-mongodb created store: ' + self.name);
    }
    callback(err);
  });
};

/**
 * Creates a new Credential ID based on the given prefix.
 *
 * @param prefix the prefix to prepend to the auto-generated ID.
 * @param callback(err, id) called once the operation completes.
 */
Store.prototype.generateId = function(prefix, callback) {
  this._idGenerator.generateId(function(err, id) {
    if(err) {
      return callback(err);
    }
    callback(null, prefix + id);
  });
};

/**
 * Inserts a Credential.
 *
 * @param actor the actor performing the action.
 * @param credential the Credential containing the minimum required data.
 * @param [options] the options to use.
 * @param callback(err, record) called once the operation completes.
 */
Store.prototype.insert = function(actor, credential, options, callback) {
  var self = this;

  if(typeof options === 'function') {
    callback = options;
    options = {};
  }

  logger.debug('inserting credential', credential);

  async.auto({
    checkPermission: function(callback) {
      brPermission.checkPermission(
        actor, PERMISSIONS.CREDENTIAL_INSERT,
        {resource: credential, translate: ['issuer', 'recipient']}, callback);
    },
    insert: ['checkPermission', function(callback) {
      var referenceIdHash;
      if('referenceId' in credential) {
        referenceIdHash = database.hash(credential.referenceId);
      } else {
        referenceIdHash = database.hash(credential.id);
      }
      var now = Date.now();
      var record = {
        id: database.hash(credential.id),
        issuer: database.hash(credential.issuer),
        recipient: database.hash(credential.claim.id),
        referenceId: referenceIdHash,
        meta: {
          created: now,
          updated: now
        },
        credential: database.encode(credential)
      };
      self.collection.insert(
        record, database.writeOptions, function(err, result) {
          if(err) {
            return callback(err);
          }
          result.ops[0].credential = database.decode(result.ops[0].credential);
          callback(null, result.ops[0]);
        });
    }]
  }, function(err, results) {
    callback(err, results.insert);
  });
};

/**
 * Gets a Credential.
 *
 * @param actor the actor performing the action.
 * @param id the ID of the Credential to retrieve.
 * @param callback(err, credential, meta) called once the operation completes.
 */
Store.prototype.get = function(actor, id, callback) {
  var self = this;
  var query = {id: database.hash(id)};
  async.waterfall([
    function(callback) {
      self.getAll(actor, query, callback);
    },
    function(records, callback) {
      if(records.length === 0) {
        return callback(new BedrockError(
          'Credential not found.', 'NotFound',
          {id: id, httpStatusCode: 404, 'public': true}));
      }
      callback(null, database.decode(records[0].credential),
        database.decode(records[0].meta));
    }
  ], callback);
};

/**
 * Retrieves all Credentials matching the given query.
 *
 * @param actor the actor performing the action.
 * @param [query] the query to use (defaults to {}).
 * @param [fields] optional fields to include or exclude (default: {}).
 * @param [options] options (eg: 'sort', 'limit').
 * @param callback(err, records) called once the operation completes.
 */
Store.prototype.getAll = function(actor, query, fields, options, callback) {
  var self = this;
  // handle args
  if(typeof query === 'function') {
    callback = query;
    query = null;
    fields = null;
  } else if(typeof fields === 'function') {
    callback = fields;
    fields = null;
  } else if(typeof options === 'function') {
    callback = options;
    options = null;
  }
  query = query || {};
  fields = fields || {};
  options = options || {};
  async.auto({
    find: function(callback) {
      self.collection.find(query, fields, options).toArray(callback);
    },
    clean: ['find', function(callback, results) {
      // do in series to preserve record order
      var cleanedRecords = [];
      async.forEachSeries(results.find, function(record, callback) {
        if(!record.credential) {
          // no credential data requested, return record
          // (done for simple existence check)
          cleanedRecords.push(record);
          return callback();
        }
        var credential = record.credential = database.decode(record.credential);
        // if the credential is fully public, skip permissions check
        if(jsonld.hasValue(credential, 'sysPublic', '*')) {
          cleanedRecords.push(record);
          return callback();
        }
        // check to make sure the caller is allowed to access the credential
        // (Note: fields *must not* have excluded `credential.id` in this case
        // or else the look up for the permission check will fail)
        brPermission.checkActorPermission(
          actor, PERMISSIONS.CREDENTIAL_ACCESS, {
            resource: credential,
            translate: ['issuer', 'claim'],
            get: function(resource, callback) {
              // Note: It's hard to optimize this away be always including
              // `issuer` and `recipient` because that may have unintended
              // consequences
              self.get(null, credential.id, callback);
            }
          }, function(err) {
            if(!err) {
              cleanedRecords.push(record);
            }
            // TODO: If permissions check fails, but there are public properties
            // in the record, delete all properties that are not listed in
            // credential.sysPublic and push to cleanedRecords
            callback();
          });
      }, function(err) {
        callback(err, cleanedRecords);
      });
    }]
  }, function(err, results) {
    callback(err, results.clean);
  });
};

/**
 * Counts all Credentials matching the given query.
 *
 * @param actor the actor performing the action.
 * @param [query] the query to use (defaults to {}).
 * @param [options] options
 * @param callback(err, count) called once the operation completes.
 */
Store.prototype.count = function(actor, query, options, callback) {
  var self = this;
  // handle args
  if(typeof query === 'function') {
    callback = query;
    query = null;
  } else if(typeof options === 'function') {
    callback = options;
    options = null;
  }
  query = query || {};
  options = options || {};
  async.auto({
    checkPermission: function(callback) {
      brPermission.checkPermission(
        actor, PERMISSIONS.CREDENTIAL_ADMIN, callback);
    },
    count: function(callback) {
      self.collection.count(query, options, callback);
    }
  }, function(err, results) {
    callback(err, results.count);
  });
};

/**
 * Composes a view of an identity based on the given template and the
 * credentials associated with it.
 *
 * @param actor the actor performing the action.
 * @param recipient the ID of the recipient of the credentials to use.
 * @param template the identity template.
 * @param [options] the options to use.
 * @param callback(err, identity) called once the operation completes.
 */
Store.prototype.compose = function(
  actor, recipient, template, options, callback) {
  var self = this;

  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  // TODO: use identity context only once context conflicts are handled
  var identity = {
    '@context': [
      bedrock.config.constants.IDENTITY_CONTEXT_V1_URL,
      bedrock.config.constants.CREDENTIALS_CONTEXT_V1_URL
    ],
    id: recipient
  };
  async.auto({
    checkPermission: function(callback) {
      brPermission.checkPermission(
        actor, PERMISSIONS.IDENTITY_COMPOSE, {resource: recipient}, callback);
    },
    find: ['checkPermission', function(callback) {
      // FIXME: this will currently get *all* credentials for a recipient,
      // which is inefficient, optimize using indexes on properties asserted
      // by credentials
      // TODO: filter potential credentials via options (eg: restrict types
      // of credentials to retrieve to optimize)
      self.collection.find({
        recipient: database.hash(recipient)
      }, {credential: true}, callback);
    }],
    compose: ['find', function(callback, results) {
      var properties = Object.keys(template).filter(function(p) {
        return p !== 'id';
      });
      var cursor = results.find;
      var done = false;
      async.until(function() {return done;}, function(callback) {
        cursor.nextObject(function(err, record) {
          if(err) {
            return callback(err);
          }
          if(!record) {
            done = true;
            return callback();
          }
          // find intersection of template and asserted properties
          var cred = database.decode(record.credential);
          var assertions = Object.keys(cred.claim || {}).filter(function(p) {
            return p !== 'id';
          });
          if(_.intersection(properties, assertions).length > 0) {
            bedrock.jsonld.addValue(
              identity, 'credential', {'@graph': cred},
              {propertyIsArray: true});
          }
          callback();
        });
      }, callback);
    }]
  }, function(err) {
    callback(err, identity);
  });
};
