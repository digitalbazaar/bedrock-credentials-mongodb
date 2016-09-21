# bedrock-credentials-mongodb

![build status](http://ci.digitalbazaar.com/buildStatus/icon?job=bedrock-credentials-mongodb)

A [bedrock][] module that stores credentials in a MongoDB database.

## Requirements

- npm v3+

## Quick Examples

```
npm install bedrock-credentials-mongodb
```

```js
var bedrock = require('bedrock');
var store = require('bedrock-credentials-mongodb');

// insert a credential into storage
store.insert(actor, credential, callback);

// get a credential from storage
store.get(actor, query, callback);

// count credentials matching a query
// NOTE: for optimal performance, special attention should be given to query
// parameters and indexing.  Refer to MongoDB documentation for special
// considerations if a sharded cluster is involved.
store.count(actor, query, callback);
```

[bedrock]: https://github.com/digitalbazaar/bedrock
