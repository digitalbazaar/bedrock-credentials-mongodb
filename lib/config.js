/*
 * Bedrock credentials mongodb configuration.
 *
 * Copyright (c) 2015 Digital Bazaar, Inc. All rights reserved.
 */
var config = require('bedrock').config;

config.constants.CREDENTIALS_CONTEXT_V1_URL = 'https://w3id.org/credentials/v1';

config['credentials-mongodb'] = {};
config['credentials-mongodb'].provider = {
  name: 'credentialProvider',
  enable: true
};
config['credentials-mongodb'].consumer = {
  name: 'credentialConsumer',
  enable: true
};

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
permissions.IDENTITY_COMPOSE = {
  id: 'IDENTITY_COMPOSE',
  label: 'Compose a view of an Identity from a set of Credentials.',
  comment: 'Required to compose an Identity from a set of Credentials.'
};
