/*
 * Copyright (c) 2015-2016 Digital Bazaar, Inc. All rights reserved.
 */
/* jshint node: true */
'use strict';

var mocks = {};
module.exports = mocks;

mocks.credentialTemplate = {
  "@context": [
    "https://w3id.org/identity/v1",
    "https://w3id.org/credentials/v1",
    {
      test: "urn:test:"
    }
  ],
  type: [
    "Credential",
    "test:EmailCredential"
  ],
  name: "Test 1: Work Email",
  issued: "2015-01-01T01:02:03Z",
  issuer: "urn:issuer:test",
  claim: {
    email: "dev@examplebusiness.com"
  },
  signature: {
    type: "GraphSignature2012",
    created: "2015-01-01T01:02:03Z",
    creator: "https://staging-idp.truecred.com/i/demo/keys/1",
    signatureValue: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz01234567890ABCDEFGHIJKLM=="
  }
};
