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
store.insert(credential, callback);

// get a credential from storage
store.get(query, callback);
