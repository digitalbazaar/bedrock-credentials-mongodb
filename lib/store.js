/*
 * Bedrock credentials mongodb module.
 *
 * This modules exposes an API for inserting and querying credentials that
 * are stored in a mongodb database.
 *
 * Copyright (c) 2015 Digital Bazaar, Inc. All rights reserved.
 */
var async = require('async');
var bedrock = require('bedrock');
var brPermission = require('bedrock-permission');
var database = require('bedrock-mongodb');
var BedrockError = bedrock.util.BedrockError;

// load config defaults
require('./config');

// module permissions
var PERMISSIONS = bedrock.config.permission.permissions;

// module API
var api = {};
module.exports = api;

var logger = bedrock.loggers.get('app');

// distributed ID generator for credentials
var idGenerator = null;

bedrock.events.on('bedrock-mongodb.ready', function(callback) {
  async.auto({
    openCollections: function(callback) {
      database.openCollections(['credential'], callback);
    },
    createIndexes: ['openCollections', function(callback) {
      // TODO: add index on domain-specific id
      database.createIndexes([{
        collection: 'credential',
        fields: {id: 1},
        options: {unique: true, background: false}
      }, {
        collection: 'credential',
        fields: {recipient: 1, issuer: 1, id: 1},
        options: {unique: true, background: false}
      }, {
        collection: 'credential',
        fields: {issuer: 1, id: 1},
        options: {unique: true, background: false}
      }], callback);
    }],
    createIdGenerator: function(callback) {
      database.getDistributedIdGenerator('credential', function(err, idg) {
        if(!err) {
          idGenerator = idg;
        }
        callback(err);
      });
    }
  }, function(err) {
    callback(err);
  });
});

bedrock.events.on('bedrock.test.configure', function() {
  // load test config
  require('./test.config');
});

/**
 * Creates a new Credential ID based on the given prefix.
 *
 * @param prefix the prefix to prepend to the auto-generated ID.
 * @param callback(err, id) called once the operation completes.
 */
api.generateId = function(prefix, callback) {
  idGenerator.generateId(function(err, id) {
    if(err) {
      return callback(err);
    }
    callback(null, prefix + id);
  });
};

/**
 * Inserts a Credential into the database.
 *
 * @param actor the actor performing the action.
 * @param credential the Credential containing the minimum required data.
 * @param [options] the options to use.
 * @param callback(err, record) called once the operation completes.
 */
api.insert = function(actor, credential, options, callback) {
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
      var now = Date.now();
      var record = {
        id: database.hash(credential.id),
        issuer: database.hash(credential.issuer),
        recipient: database.hash(credential.recipient),
        meta: {
          created: now,
          updated: now
        },
        credential: database.encode(credential)
      };
      database.collections.credential.insert(
        record, database.writeOptions, function(err, result) {
          if(err) {
            return callback(err);
          }
          callback(null, database.decode(result.ops[0].credential));
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
api.get = function(actor, id, callback) {
  async.waterfall([
    function(callback) {
      api.checkPermission(
        actor, PERMISSIONS.CREDENTIAL_ACCESS, {resource: id}, callback);
    },
    function(callback) {
      database.collections.credential.findOne(
        {id: database.hash(id)}, {}, callback);
    },
    function(record, callback) {
      if(!record) {
        return callback(new BedrockError(
          'Credential not found.', 'NotFound',
          {id: id, httpStatusCode: 404, 'public': true}));
      }
      callback(null, database.decode(record.credential), record.meta);
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
api.getAll = function(actor, query, fields, options, callback) {
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
      database.collections.credential.find(
        query, fields, options).toArray(callback);
    },
    clean: ['find', function(callback, results) {
      // do in series to preserve record order
      var cache = {};
      var cleanedRecords = [];
      async.forEachSeries(results.find, function(record, callback) {
        if(!record.credential) {
          // no credential data requested, return record
          // (done for simple existence check)
          cleanedRecords.push(record);
          return callback();
        }
        var credential = record.credential = database.decode(record.credential);
        // check to make sure the caller is allowed to access the credential
        // (Note: fields *must not* have excluded `credential.id` in this case
        // or else the look up for the permission check will fail)
        brPermission.checkPermission(
          actor, PERMISSIONS.CREDENTIAL_ACCESS, {
            resource: credential,
            translate: ['issuer', 'recipient'],
            get: function(resource, callback) {
              // Note: It's hard to optimize this away be always including
              // `issuer` and `recipient` because that may have unintended
              // consequences
              api.get(null, credential.id, callback);
            }
          }, function(err) {
            if(!err) {
              cleanedRecords.push(record);
            }
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
