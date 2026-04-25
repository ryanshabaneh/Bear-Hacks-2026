## dcp-client

> [!note] Note
> This module is only necessary in environments with `require`.
> 
> You must initialize using one of the below methods to prepare the dcp-client library.

The `dcp-client` library is the official client library for the Distributive Compute Platform (DCP). This library allows client applications to communicate with the Scheduler, Bank, and other parts of a DCP network. This library is re-distributable with other programs under the terms of the MIT license.

## Installation

The source code for this library is online on [GitHub](https://github.com/Distributed-Compute-Labs/dcp-client), and the installation package is available via [npm](https://www.npmjs.com/package/dcp-client). The DCP-Client code can run in almost any JavaScript environment which supports ES5 and XMLHttpRequest. The officially supported platforms are:

- Node.js version 12 (LTS)
- BravoJS, latest version
- Vanilla Web - no module system at all

### Node.js

To use DCP from Node.js, you need to `npm i dcp-client` from your project’s source directory, which updates your `package.json`, making this library a dependency of your app.

### Vanilla-Web

To use the DCP Client library from a plain vanilla web platform, you must make the contents of the npm package visible to your web app.