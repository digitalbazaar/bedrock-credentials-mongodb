# bedrock-credentials-mongodb ChangeLog

### Changed
- Update `bedrock-mongodb` peer dependency.

## 3.3.1 - 2017-03-20

### Changed
- Add error logging.

## 3.3.0 - 2017-02-23

### Added
- Add `events` to mongo stores.
- Add `insert` and `postInsert` events for modifying credential
  or meta data prior to insertion.

## 3.2.2 - 2016-11-29

### Changed
- Change permission check on `count` API.

## 3.2.1 - 2016-09-19

### Changed
- Restructure test framework for CI.

## 3.2.0 - 2016-08-12

### Added
- Add ability to include custom meta data via `store.insert`.

## 3.1.0 - 2016-06-28

### Added
- Implement remove API.

## 3.0.3 - 2016-06-07

### Changed
- Update dependencies.

## 3.0.2 - 2016-05-31

### Fixed
- Fix-up permission check.

## 3.0.1 - 2016-05-30

### Fixed
- Fix-up conditional.

## 3.0.0 - 2016-05-29

### Added
- **BREAKING**: Add unique `credential.issuer`+`credential.referenceId` index.

## 2.1.0 - 2016-04-26

### Added
- Count function to the API.

## 2.0.0 - 2016-03-03

### Changed
- Update package dependencies for npm v3 compatibility.

## 1.0.0 - 2016-01-31

### Added
- Basic Store API and provider and consumer built-in configurable stores.

- See git history for other changes.
