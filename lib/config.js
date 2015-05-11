/*
 * Bedrock credentials mongodb configuration.
 *
 * Copyright (c) 2015 Digital Bazaar, Inc. All rights reserved.
 */
var config = require('bedrock').config;

config['credentials-mongodb'] = {};

// credential permissions
var permissions = config.permission.permissions;
permissions.CREDENTIAL_ADMIN = {
  id: 'CREDENTIAL_ADMIN',
  label: 'Credential Administration',
  comment: 'Required to administer Credentials.'
};
permissions.CREDENTIAL_ACCESS = {
  id: 'CREDENTIAL_ACCESS',
  label: 'Access Credential',
  comment: 'Required to access a Credential.'
};
permissions.CREDENTIAL_INSERT = {
  id: 'CREDENTIAL_INSERT',
  label: 'Insert a Credential into the database',
  comment: 'Required to insert a Credential.'
};
permissions.CREDENTIAL_REMOVE = {
  id: 'CREDENTIAL_REMOVE',
  label: 'Remove Credential',
  comment: 'Required to remove a Credential.'
};
