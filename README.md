# bedrock-credentials-mongodb

A [bedrock][] module that stores credentials in a MongoDB database.

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
```

[bedrock]: https://github.com/digitalbazaar/bedrock
