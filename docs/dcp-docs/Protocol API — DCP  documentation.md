## Protocol API

DCP uses cryptographic message-signing techniques to provide message non-repudiation and protection against request forgery and replay attacks.

The Protocol API represents the low-level entity connection and message-passing interfaces in DCP. The Protocol itself can sit on top of HTTP, HTTP/2, WebSockets, TCP, or men in Jeeps with pockets full of USB keys: the actual transport is irrelevant at the API level, except for the protocol field of the URL object used to establish a connection.

The Protocol API is used to establish secureable communications between two entities, implement remote procedure call semantics, and provide the necessary tools for a developer to implement access controls and describe authorizations. Additionally, the API allows developers to create messages bearing secure authorization and access memos which can be transferred between entities via untrusted third parties.

**Record of Issue**

| Date | Author(s) | Ver | Change |
| --- | --- | --- | --- |
| Mar 9 2021 | KC Erb | 2.0 | Remove `request-batch` and `response-batch` types, add `ack` type, document `state` s and new nonce/token structure that `ack` s introduce. |
| Oct 19 2020 | KC Erb | 1.4 | Update definition of `message.id` to be unique per transmission. |
| Feb 10 2020 | KC Erb | 1.3 | - Clarified meaning of authorization. - isAuthorizedFor -> doesAuthorize |
| Jan 28 2020 | Ryan Rossiter   Eddie Roosenmaallen   Nazila Akhavan | 1.2 | - Add version to connect response - Add reserved v3 route - ErrorPayload disambiguation, TransportClass and keyStore parameters to Protocol.accept() |
| Jan 14 2020 | Wes Garland | 1.1 | - Add connection.ErrorPayload & Error Codes - Add initiator version check - Add connection.identity - Add Request validity, target startup delay - Section on Data Representation - authorizedFor -> isAuthorizedFor |
| Jan 08 2020 | Wes Garland | 1.0 | Initial release to sprint-planning team |

## Intended Audience

This document has been prepared for public dissemination.

## Glossary

- **entity**: any component of a Distributed Computer system (e.g. Scheduler, Bank, Client) which communicate via DCP.
- **protected resource**: A unit of data associated with an Ethereum key-pair (private key, address) which may only be accessed by entities that know the private key.
- **resource address**: the address of a protected resource, such as a Bank Account.
- **resource owner**: any bearer of a resource’s private key.
- **guardian**: An entity mediating access to a protected resource; e.g. the Bank acts as a guardian for bank accounts.
- **authorize**: A resource owner authorizes a resource guardian to use the resource in conjunction with an operation.
- **initiator**: the entity which initiates the connection (“client” in traditional client-server topology).
- **target**: the entity to which the initiator connected.
- **peer**: the initiator’s target, or the target’s initiator.
- **message**: An instance of `protocol.Message`.
- **message originator**: the bearer of the private key that was used to sign the message.
- **request message**: A message, generally sent from initiator to target, containing instructions (e.g. withdraw $7 from bank account 123456).
- **response message**: A message, generally sent from target to initiator, containing the response to, or result of, a request message.
- **ack**: A message which acknowledges receipt of a request or a response by either peer.
- **authenticate**: Messages are authenticated by connections to ensure they came from the peer. Payloads that authorize the use of protected resources are authenticated to ensure they were issued by a resource owner.

## Overview

This high-level protocol is designed to operate at OSI Level 5 (Session Layer) or higher. It enables bi-directional communication between peers with stateful sessions, with a client/server-flavoured startup mechanism. The current implementation direction is to implement the protocol on top of socket.io, however this is not a strict requirement and should be treated as an implementation detail.

Connections are established by having the initiator contact the target. This allows us, in particular, to traverse NAT without worrying about STUN, and also allows us to operate atop Level 7 protocols such as HTTP.

Protocol connections are stateful, but not necessarily connected. Each Connection has a session id which is used to identify the connection at the DCP level. It is possible that the underlying protocol or connection could change during a DCP session.

Future directions which should be possible with this message exchange format and API:

Improvements from v4 in this spec:

- connections now have control over transmission verification instead of relying on underlying transport
- users must create transport and connection pools on a target to decouple the two and allow the underlying transport to disconnect without affecting the dcp session
- the addition of `state` to connections allows finer control over startup, shutdown, and expected behavior when an established connection loses its transport

Improvements from v3 in this spec:

- better future-proofing
- data layer encapsulation separate from payload
	- can now have both bank account and identity keys in one message
		- can specify messages which can be handed off securely to a third-party
		- with the entire payload in the signed portion of the message (old version did not sign against URL), we close a certain class of potential security vulnerability.
- uniform message format allows tighter security controls and error management
	- nonce is no longer optional, closing possible CSRF and replay attack surface
		- all messages have identity

DCP Sessions are identified by the `dcpsid` property which is present in every message (except the initial connection messages where it is established). There is no requirement to send all messages for a given DCP Session on the same underlying transport.

Messages are exchanged in the form of requests and responses. Either peer can send a request; all requests require a response. Each peer can have, at most, one open request at a time.

Security protocols are consistent and invariant across message types:

- All message transmissions (requests, responses, and acks) are signed with the sending peer’s identity key.
- Authorization is part of the payload; the resource owner identifies which peer (or peers) may act on the request.
- No message-related information is contained outside of the (signed) payload; specifically, when authorizing a guardian to use a protected resource, the guardian’s address is only in the payload.
- All response and request messages have a nonce and all acks have an ack-token, which is used to protect against cross-site request forgeries and replay attacks.
	- Initial request id is specified by initiator
		- Initial nonce is specified by target in an ack to the initial request
		- Initial response has the same id as the request it is responding to
		- Initial response is ack’d as well, providing a nonce to the target
		- All requests and responses include the nonce most recently received on that connection
		- All requests and responses include an ack token which must be present on the ack for that message
		- Request ids may only be used once
- DCP Session ID is specified during the response to the initial request and never changes for a given session
- The identity key for a given session never changes

Multiple messages can be sent in a single ‘batch’ message; this is supported intrinsically in the protocol, and message batching is handled automatically by virtue of the JavaScript event loop.

Requests can be created for secure transmission through a third party; for example, a Client can send a message to a Scheduler which gives said Scheduler (and only that Scheduler) permission to access a particular account on a specific Bank.

## Data Representation

### Network Traffic

All data transmitted in DCPv4 ‘on the wire’ has been serialized with the JavaScript-native JSON code. There is no requirement that objects and values sent on the wire have have a 1:1 correspondence with the API layer types.

#### Hexadecimal Values

Hexadecimal values (such as Ethereum addresses) sent over the network as strings should have the `0x` prefix removed. If it is present upon receipt, it should be ignored.

#### Ethereum Addresses

Ethereum addresses should be sent over the network in checksum format. Addresses which appear to be in checksum format, but are not valid addresses, should trigger rejections at the point where the address is passed to the `wallet.Address` constructor (the constructor will throw).

### Time

All time values in DCPv4 are represented as seconds since the epoch; in most cases, fractional seconds are supported as floating-point numbers. When converting between fractional and whole seconds, values should be truncated and not rounded.

## Classes

### Message

A Message object represents a message which can be sent between DCP entities. There are four types of messages:

- Request
- Response
- Ack
- Batch

### Connection

A Connection object represents a connection to another DCP entity. A DCP connection may ‘live’ longer than the underlying transport’s connection, and the underlying transport connection (or, indeed, transport) may change throughout the life of the DCP connection.

DCP connections are uniquely identified by the DCP Session ID, specified by the `dcpsid` property, present in every message body. This session id is negotiated during connection, with the initiator and target each providing half of the string.

Connection objects inherit from EventEmitter.

#### new Connection (optional url, optional idKeystore, optional connectionOptions)

This constructor returns an object which represents a connection between DCP entities. *note* - the entities will not actually be connected until a call to `this.connect()` or `this.send()`.

- `url`: {string or instanceof `URL` or `DcpURL` } - URL of the target - mandatory when entity is initiator; ignored when entity is target;
	- if `string` or `instanceof URL`, it is coerced internally to `DcpURL` before memoization
- `idKeystore`: { instance of `wallet.IdKeystore` or a Promise which resolves to `wallet.IdKeystore` } - the identity keystore used to sign messages; used for non-repudiation. The default value is a promise (`await wallet.getId()` see: Wallet API)
- `connectionOptions`: An object specifying arbitrary options for configuring a connection
	- Properties `idKeystore`, `url` are treated as above.
		- `identityUnlockTimeout`: Number of (floating-point) seconds to leave the identity keystore unlocked between invocations of `Connection.send`.
		- `allowBatch`: { boolean } - if false, will limit each transmission to one message.
		- `maxMessagesPerBatch`: Tuning parameter for batch size. If less than 1, equivalent to `allowBatch: false`.
		- `ttl`: A number or an object describing the time-to-live for the `validity` property of message payloads. If a number N is specified, it will be treated as `{default: N}`. The units are floating-point seconds.
			- `min`: the minimum ttl allowable (request receiver only)
						- `max`: the maxmium ttl allowable (request receiver only)
						- `default`: the ttl to use when not specified (request receiver or sender)
						- `ntp`: true when the operating system upon which the entity is running has an operating NTP daemon.

#### Connection.identity

The identity keystore or undefined. This property is only guaranteed to be defined after the connection is established.

#### Connection.peerAddress

Undefined until connection; then it becomes an instance of `wallet.Address` representing the public address of the connected peer.

#### Connection.dcpsid

Undefined until connection; then it becomes a string representing a unique DCP session.

#### Connection.Message

A constructor with `Protocol.Message` on its prototype chain; used to construct batch, request, response, and ack messages for transmission on this connection.

#### async Connection.close()

This method sends a `close` to the peer on the next pass of the event loop or later. Once the response has been received, the protocol connection is closed; once the underlying connection has been confirmed closed, the session is invalidated and the promise is resolved. Any messages that were queued before calling close will be delivered before sending the ‘close’ operation. If the close message is not sent in a timely manner, the connection will be forcefully closed by rejecting all pending message promises and then closing the underlying connection. (Timeout is configured by `connectionOptions.closeTimeout`.)

Any subsequent calls to `Connection.send()` on a closed connection will result in an error due to this invalidated session.

*See: Reserved Operations section, close*

#### async Connection.connect()

This method, when invoked by an initiator,

- establishes the connection between the two entities. Connection establishment means:
	- Establish underlying transport protocol connection (when applicable, e.g. an HTTP or web socket connection)
		- Establish version compatibility (`body.payload.data.version`)
		- Exchange initial nonces (`body.nonce`, `body.id`)
		- Establish `dcpsid` (DCP Session ID)
		- set `this.peerAddress` to the remote peer’s public address
- resolves after sending `operation: 'connect'` message and receiving the response
- rejects with Error if the connection cannot be established, or if connection was already established

If target determines that the connection cannot be established due to a protocol version mismatch, the target will respond with a message whose body has the following properties:

- success = ‘false’
- type = ‘protocol’
- code = ‘EVERSION’
- message = < semver expression of acceptable version >

If the initiator determines that the connection cannot be established due to a protocol version mismatch, the client will close the connection and reject with `Error.code = 'ETARGETVERSION'`.

Conforming implementations should, when possible, reject with `Error.code = 'EADDRCHANGE'` if the connection address has changed for that URL since the last time we connected to that URL. *(Analogue: ssh fingerprint change)*

*See: Reserved Operations section, connect*

#### async Connection.keepalive()

This method sends a `keepalive` to the peer, and resolves when the response has been received.

*See: Reserved Operations section, keepalive*

#### async Connection.send(message)

This method sends a message to the connection peer. If the connection has not yet been established, this routine will first invoke (and await) `this.connect()`.

- resolves with instance of Response or rejects with Error
- does not mutate passed message, except for `message.id`
- if message is not an instance of `this.Message`,
	- we construct a new `this.Request`
		- using passed object as the constructor argument
		- assign message to this new Request
- generates unique `message.id` to associate this transmission of the message with its response.

##### Return value

Connection.send() always returns a Promise.

###### Response Messages

The promise is resolved or rejected as soon as the response message has been delivered to the peer via the underlying transport as indicated by an ack.

When the promise is resolved, there is no argument. If the promise is rejected, it will be rejected with an instance of Error.

###### Request Messages

This promise is resolved with a response message when the peer sends a Response with the same id as this Request. The `success` property of this response will be `true` and the `payload` property will hold the corresponding data (if any).

If the peer responds with `success` false, the `payload` property will instead be an instance of `connection.ErrorPayload`.

- If the API consumer needs to differentiate between error payloads which were instances of Error and/or its superclasses at the peer end, the API consumer will need to inspect type `name` property.

The promise will be rejected if there is some underlying problem with the local machine, software bugs, network, etc. so that the connection is unable to send messages (for example when the `closeTimeout` is reached and there are still unsent messages in the queue).

The promise is rejected with a rejection object that is an instance of Error.

###### Batch Messages

Batch messages are used internally when more then one message is queued to be sent. It carries with it one nonce for the whole batch, and each message is parsed and handled normally on the receiving end.

Upon receipt of a batch, the receiver immediately sends an ack to give the sender a new nonce.

### connection.ErrorPayload

This class is used to create and represent payloads which indicate unexpected errors (such as a version error or a file that does not exist), and *not application level errors* (such as a bank account which does not have enough money to deploy a job).

This class inherits from `Error`.

#### form 2: new connection.ErrorPayload(string message, optional string code, optional object ctor)

This form accepts a string message, an optional string error code, and an optional constructor ctor; if ctor is not specified, Error will be used.

If the constructor is not an instance of error, this form will return the equivalent of ``new connection.ErrorPayload(new TypeError(`${ctor} is not an instance of Error`))``.

The function then creates a serializable object as form 1, but adds a special property, `type` whose value is `'protocol'`. This property will be used to differentiate between protocol-level errors (such as invalid operation or bad version) and unexpected errors in protocol-using code. For example,

```javascript
function routeSwitch(request) {
  let response;
  try {
    if (request.operation === 'escrow') {
      response = escrow(request);
    } else {
      response = new request.connection.ErrorPayload('invalid operation: \`${request.operation}\`');
    }
  } catch (e) {
    response = e;
  } finally {
    if (typeof response !==  'object')
      response = new request.connection.ErrorPayload('Response should not be ${typeof response}!', TypeError);
    request.respond(response);
}
```

### Connection.Message

A Connection.Message object represents a message which can be sent between DCP entities on a given connection. Inherits from `protocol.Message`.

#### new Connection.Message()

Constructor

#### Connection.Message.connection

This property is a reference to the connection instance of which this constructor is a property.

#### async Connection.Message.sign

Signs a message using the identity keystore `ks` supplied during Connection instantiation, using the `sign()` method of the identity keystore corresponding to the connection.

This function returns a promise which resolves to a string which is an Ethereum signed message.

#### async Connection.Message.send()

- equivalent to this.connection.send(this)

### Connection.Request

This class, which inherits from Connection.Message, represents a request message that may be sent to the connection peer.

Request Messages have the following properties:

- **id**: unique string. The API will provide one immediately before transmission. A given entity will never process two messages with the same id and overlapping validity time.
- **payload**: An object which represents the payload which is transmitted to the connection peer. If specified in the constructor, its properties are used to initialize the message payload.
	- **operation**: string describing the operation; has meaning to the peer.
		- **data** - undefined or an arbitrary value which can be serialized to JSON which represents the arguments to the operation.
		- **validity**: The `validity` property of a Request payload is an object which can be fully (or partially) populated by the API consumer; they will be fully populated by `Request.send()` as needed.
		- **stamp**: A string which is unique enough to prevent us from accidentally creating indifferentiable unique messages, possibly on different connections, even if they are otherwise identical and were created at exactly the same time.
			- Suggested algorithm: `md5sum(request.id + (request.dcpsid || Date.now() + Math.random()))`
				- **time**: the current time, according to the target’s clock (or NTP), expressed an integer number of seconds which have elapsed since the epoch (C `time_t`)
				- **ttl**: optional - the number of (floating point) seconds after which the message expires. If this is not specified, the guardian (and potentially any intermediary machines) will use their own default value.
		- **allow**: an array identifying the resource guardian allowed to perform the operation on a resource when the message is received from a given accessor. Each element in the array has the shape `{ resource: address, guardian: address, accessor: address }` (See **Connection.Request.authorize**).
- **auth**: This property is an object that relates to **payload.allow**. It authorizes a guardian to perform the operation using one or more protected resources (See **Connection.Request.authorize**). It contains key-value pairs of `<resource address>: <payload signature>`.

#### new Connection.Request()

form 1: new Connection.Request(): A new Request Message is constructed

form 2: new Connection.Request(payload {object}): A new Request Message is constructed; the passed object is used to specify the message payload.

form 3: new Connection.Request(operation {string}, optional data): A new Request Message is constructed; the passed string is used to specify the message payload operation property; if the optional data parameter is specified, it is used as the payload data property.

#### async Connection.Request.respond(…)

This method is a convenience method which is equivalent to

```javascript
(new Connection.Response(this, ...)).send()
```

#### Connection.Request.authorize(resourceKeystore, optional guardianAddress, optional accessorAddress)

This method receives as its arguments:

- an instance of Keystore `resourceKeystore`,
- an optional argument `guardianAddress`, which defaults to `Connection.peerAddress`,
- and an optional argument `accessorAddress`, which defaults to `Connection.identity.address`.

This function identifies the resource, the resource’s guardian, and the peer which is authorized to pass this message to the guardian (accessor),

> Guardian authorization is important because resource addresses may be duplicated across different guardians, but this may represent different actual resources. For example, the same bank account address on two different banks could refer to completely different groups of funds, potentially in completely disconnected DCP universes....but even though the funds are different, by virtue of having identical account numbers, authorization signatures would be identical if the payload did not specify which guardian is authorized by it.

The keystore passed to this function is used to sign the payload (populate `auth` key) upon invoking `Request.send()`. The purpose of authorization is to confirm that what is recorded in the `Request.payload.allow` object has been authorized by a resource owner.

Each invocation of this method results in an entry being pushed onto the `Request.payload.allow` array: `{ resource: 'acc07', guardian: 'bac', accessor: 'c001d00d' }`

This function will invoke `resourceKeystore.unlock()` as soon as it is invoked, which may trigger a passphrase prompt via the Wallet API. The protocol API will not access the private key, either directly or indirectly, until the the request is actually about to be serialized for transmission (which is when the `Request.auth` property is updated with the signature(s)).

*(see: Connection.Request.isAuthorizedFor, Connection.Request.send())*

##### Third-Party Requests

The `guardianAddress` argument is necessarily different from `Connection.peerAddress` when authorizing a message which will pass through a third party on its way to the protected resource’s guardian.

##### Multi-Resource Requests

When creating multi-resource requests, it is necessary to call `Connection.Request.authorize` explicitly for each accessor/resource/guardian address triple.

#### Connection.Request.doesAuthorize(resourceAddress, optional guardianAddress, optional accessorAddress, optional validateSignature)

This method receives as its arguments:

- resourceAddress: the address of the resource that the request authorizes use of.
- guardianAddress: the address of the guardian that is authorized to act on the request, defaults to `Connection.identity.address`
- accessorAddress: the address of the accessor that the guardian should accept this message from, defaults to `Connection.peerAddress`
- validateSignature: boolean indicating whether or not the signature in `Request.auth` should be verified in addition to checking if a corresponding object is present in `Request.payload.allow`.

This returns `true` or `false`, depending on whether or not the guardian is authorized to use the protected resource identified by `resourceAddress` (and the request came from `Connection.peerAddress`).

If the passed arguments are not an instance of `wallet.Address` (excluding `validateSignature`), they will be passed to the `wallet.Address` constructor in an attempt to make an address.

The request authorizes use of the protected resource only when

1. the `payload.allow` property of the message contains an Array element having
- a `resource` property having the `resourceAddress`
- a `guardian` property having the `guardianAddress`
- an `accessor` property having the `accessorAddress`

AND if `validateSignature`:

2. the request’s `auth` object contains a key which is the address of the resource
3. the corresponding value is a signature which was made by signing the `payload` property of the message

*(see: Connection.Request.authorize)*

#### async Connection.Request.send(…optional ks)

This function uses `Connection.Message.send()` to transmit the message to the remote peer, and returns that promise.

If the optional keystore `ks` is present, this function immediately invokes `this.authorize(ks)`, yielding a message which authorizes:

- the resource with the address `ks.address`
- to be used by the guardian `Connection.peerAddress`
- when the peer that sent the message is `Connection.identity.address`

Before the message is sent, any memoized authorizations are applied by calculating the signature for `this.payload` via `ks.getSignature()`, updating the `auth` property to have a (key, value) pair of `(ks.address, signature)`. Redundant memos for the same resource will be collapsed into a single signing operation.

### Connection.Response

This class represents Response messages on this connection, and inherits from Connection.Message.

- **id**: same id as Request message that precipitated this response
- **success**: true | false (boolean)
	- if success is false, this means we could not perform the request for whatever reason, with more details in the payload property.
- **payload**: when success is true, this property can carry arbitrary information, and need not be specified at all. When success is `false`, this property will be an ErrorPayload object.

#### new Connection.Response()

form 1: new Connection.Response(): A new Response Message is constructed.

form 2: new Connection.Response(request, error {instance of Error | connection.ErrorPayload}): A new Response Message is constructed;

- the passed request is used to determine the request id
- `this.success` is false
- `this.payload` becomes `new connection.ErrorPayload(error)`

form 3: new Connection.Response(request, payload): A new Response Message is constructed;

- the passed request is used to determine the request id
- `this.success` is true
- the passed data is used to specify `this.payload`

### Connection.Batch

This class represents Batch messages on this connection, and inherits from `Connection.Message`.

Future versions of this protocol will also have Batch messages that contain Batch messages. The current intention is that Batch messages will only be used internally by the protocol itself.

### Connection.Ack

This class represents ack messages on this connection, and inherits from `Connection.Message`. A call to `new Ack(message)` will return an `Ack` message which acknowledges receipt of the passed message. It can be signed and sent over the wire. It is also responsible for rehydrating itself so that `new Ack(ackJSON)` will produce an instance of `Ack` corresponding to the JSON ack that was sent over the wire. Because acks are responsible for carrying the next `nonce` to a peer, they use a different unique identifier, the `ackToken`, to prove their validity. Thus requests/responses cary ack tokens and acks carry nonces.

### Connection.currentTime()

This routine returns the current time for the purposes of populating the Request message `payload.validity.time` property.

If the Connection is a target, or was flagged with the `ntp` option during instantiation, or no responses have ever been received, the local clock is used. Otherwise, the time is calculated based on the most-recently-received `Response.time` and a delta between “now” and when that message was received. This delta should not be calculated based on the system clock, as this could jump mid-session if the system administrator adjusts the system clock. Instead, the calculation should be based on something like `performance.now()` on the browser or `require('perf_hooks').performance.nodeTiming.duration` on NodeJS.

This routine returns the integer number of seconds which have elapsed since the epoch (C `time_t`).

### Transport

This module is the base class for transports used by the protocol. A protocol transport knows how to communicate with peers using a specific method (WebSocket, HTTP, postMessage, etc).

#### Transport.require

This static method will do some checking of the passed module name and then it will load and return that module. The `transports` array of a `connectionOptions` object gives the names of modules which can be tried when the system tries to establish a transport.

```javascript
const TransportClass = Transport.require(moduleName);
const transport = new TransportClass(argument, connectionOptions);
```

#### Transport.connect

This will guarantee that the underlying connection is connected, otherwise it will throw an error.

#### Transport.send

This will guarantee that the provided message is sent and will throw an error if it can’t be sent.

#### Transport.close

This will guarantee that the underlying connection is closed if it resolves and will throw an error if it can’t be closed.

## Static Methods

### clearIdentityCache(identity | true)

This method clears the identity cache that is used by Connection.connect() to track (URL, identity) pairs.

form 1: argument is instance of wallet.Keystore: cache entry corresponding to argument.address is cleared

form 2: argument is instance of wallet.Address: cache entry corresponding to argument is cleared

form 3: argument is boolean value `true`: entire cache is cleared

## Events

### Connection

#### request

The ‘request’ event is emitted by Connection objects when the connected peer sends a Request message, or when the local entity extracts a Request message that was encapsulated in a Batch message.

The event handler has `this` set to the Connection instance, and it will receive as its argument the Request object, if and only if, the Request passes the steps outlined in *Message Authorization*.

#### readyStateChange

The `readyStateChange` event is provided primarily as a debugging interface, but should be implemented rigorously nevertheless as it might be used by other developers. The event handlers are fired with the new `readyStateChange` as their only {string} argument, and `this` is set to the Connection instance.

| state |  |
| --- | --- |
| initial | the state the connection instance starts in, before a connection attempt has ever been made. |
| established | fired immediately after connection establishment, before the first Request message, even if the first Request message and the connect message are present in the same Batch message. |
| waiting | targets only, a connection is `waiting` when it fails to send a message and now must wait for the initiator to reach out again on a new transport. |
| close-wait | targets only, when a target receives the `close` request, it responds and awaits an ack. While waiting for this ack it is in the `close-wait` state. If no ack is received in 10s, it will close the connection forcefully. |
| closing | once `close` has been called the connection is closing and will remain in the closing state until it has been completely shut down. |
| closed | fired after the ‘close’ event. Indicates a connection which is no longer capable of sending. |

#### send

The send event is provided only as a debugging interface, and the interface should be considered unstable. The send event is emitted every time a message is sent to the peer; this does not include the contents of Batch messages. (Specifically, a batch message with 10 requests in it would trigger `send` once but `request` ten times).

The send event handler is invoked with the Message object as its first argument, the serialized Ethereum message as its second argument, and `this` is set to the Connection instance.

#### close

The `close` event emitted when the Connection is closed, whether due to API direction or error detection. This means that the `dcpsid` DCP Session Identifier is no longer valid and will never be valid again.

## Message Transmission & Receipt

DCP Messages are encapsulated within Ethereum messages for wireline transmission; these are signed with the originator’s identity key for non-repudiation.

### Ethereum messages

Every Ethereum message is a JSON-stringified JavaScript object with the following properties:

- **owner**: the public address of the message sender (i.e. identity address)
- **signature**: a checksum of the message body, generated using the message sender’s private key (identity key).
- **body**: an object containing DCP-related properties, such as `type`, `payload`, `id`, `dcpsid`, `auth`, etc.

Message types are differentiated during transmission with a `type` property in the message body, however at the API level, this property is not exposed and the `instanceof` operator should be used to determine message types if the need arises.

Ethereum messages are created by the `Connection.Message.sign()` method, which is invoked by `Connection.send()`.

### Message Grammar

This grammar describes JavaScript objects which are serialized with the usual JSON semantics for transmission.

#### Grammar Syntax

| Syntax | meaning |  |
| --- | --- | --- |
| A → B \| C | “A is a B or a C” |  |
| {} | Object containing properties as defined by this syntax between braces: |  |
|  | a, b, c | properties a, b, c |
|  | a: ‘abc’ | property a has string value ‘abc’ |
|  | b\* | property b is optional |
|  | … | any number of arbitrary properties |
| \[ things \] | an array of things |  |
| thing+ | One or more things |  |
| thing\* | Zero or N things, where N is positive, whole, and finite. |  |
| ‘abc’ | the string literal, `abc` |  |
| integer | the set of all integers in the range `(-(2^53`, 2^53)\` |  |
| string | any Unicode String representable by the current engine; a minimum of 128 × 1024 × 1024 code points must be supported by a supported implementation. |  |

#### DCP Message Exchange Grammar

DCP Messages are exchanged as Ethereum signed messages, which are objects serialized with JSON before transmission.

```
signed-message → { owner, signature, body }

body → request
     | response
     | batch

request → { type: 'request', id, payload, auth*, dcpsid, nonce<last> }
        
response → { type: 'response', id<request>, time, success: boolean, payload, dcpsid, nonce }

payload → { operation, validity, allow*, ... } /* request */
        | anything /* response */

allow → [ { accessor: address, guardian: address, resource: address }* ]

auth → { <resource-address>: signature }

time → integer

ttl → integer

stamp → string

validity → { time, ttl, stamp  }
 
boolean → true
        | false

ack → { type: 'ack', id, messageId, token }

token → string

requests → [ request+ ]

responses → [ response+ ]
```

- `owner` is the identity address (public key) of the entity sending the message
- `signature` is a checksum of the message body or payload, calculated with the identity private key
- `body` is the body of the message
- `id` is a unique per-transmission message id
- `dcpsid` is the session id established during connection startup
- `id<request>` is the `id` of the request to which we’re responding
- `nonce<last>` is the `nonce` supplied by the most recent response
- `messageId` is the id of the message being ack’d
- `token` is like a nonce but for acks
- `operation` is the operation to perform

### Message Transmission Implementation Details

Message signing has significant overhead, as does establishing connections in the underlying protocol. For this reason, we employ transparent opportunistic batching in DCPv4, with the following algorithm for `Connection.send`:

- Connection.send() invoked
	- first send?
		- Create Connection-specific batch message array `pending`
				- await Connection.connect()
		- push message into batch message array
		- finish run-to-completion to give other messages opportunity to send; if `pending.length === 1`, schedule an event-loop callback, `transmit()`
		- `transmit() =>`
		- if this connection does not have a nonce to ready use (i.e. there is a pending request in flight), re-schedule `transmit()` and return immediately
				- if `pending.length === 1`, send `pending.pop().sign()`
				- else sign and send a Batch containing at most `connectionOptions.maxMessagesPerBatch` messages and unshift them from `pending`
				- if `pending.length !== 0`, schedule another call to `transmit()`
- The actual wire-protocol payload is given `message.sign()`
- send wire-payload to connection peer

### Message Receipt Implementation Details

When a Message is received from the peer we

- verify that it was signed with the same identity that responded to the initial connect message, when the session was established. If the signature cannot be verified,
	- details must be logged to `console.warn`
		- the connection must be closed in a way that it cannot be resurrected
		- an exception must be thrown (or promise rejected)
- Check the message type.
	- If the message type is `batch`, each message in the batch is individually processed with the rules in this section
		- If the message type is `request`, the message is dispatched via the `request` event name.
		- If the message type is `response`, the message is used to resolve an outstanding request on this connection; if the request does not exist,
		- details must be logged to `console.warn`
				- the connection must be closed in a way that it cannot be resurrected
				- an exception must be thrown (or promise rejected)

## Message Authentication Algorithm

Message authentication happens transparently and automatically at the protocol. No unauthenticated requests will ever be presented to the application layer under any circumstances.

- check dcpsid is correct (if underlying protocol suitably stateful)
- check nonce is correct
- check signature against identity address
- used predominately for
	- non-repudiation
		- to prevent cross-site request forgeries (CSRF)
		- to prevent replay attacks

## Request Authentication Algorithm

Request authentication is used to prevent unauthorized access to protected resources. While it happens strictly at the application layer, the Protocol API provides the mechanisms for making this consistent and easy.

This authentication is based on the following principles:

1. every protected resource has a unique Ethereum address
2. only the entities that are authorized to use the resources know the corresponding private keys
3. the guardian knows the public addresses of all protects resources that it protects
4. the guardian can remember all payload validity stamps that it receives from anyone, for their entire validity period.
5. 100% of the information required to grant access to the resource is contained within the `payload` property of a Request

### Allow and Auth

The allow and auth fields work together to document what entity is allowed to make use of the protected resource (as described by the payload) and to document that authorization with a signature generated for the payload and with the private key corresponding to the public address identiying the protected resource.

- The `allow` property of the Request `payload` contains an array with entries in the form `{ resource, guardian, accessor }` which describes which `resource` on which `guardian` is allowed to be modified by which `accessor`.
- The `auth` property of the Request contains a key/value pair lookup table of resource addresses and signatures
- These signatures were generated with the resource addresses’ corresponding private keys

This gives the resource guardian the confidence that the entity with control of the protected resource authorized the entity making the request to make it, even if those two entities are not the same entity.

#### Cheque Scenario

For example, Dan might write Wes a cheque for $1,000,000, which Wes would present to the Royal Bank, asking for permission to withdraw the money from Dan’s account, and Dan could hand this cheque to Jack to give to Wes.

In this scenario,

- the Royal Bank is the guardian
- Dan’s bank account is the protected resource
- Wes is the entity making the request
- Dan’s signature has authorized the request, which specifies that
	- Wes is allowed to make it
		- It is drawn on Dan’s bank account
		- Wes is only authorized to withdraw $1,000,000
- The cheque is the Request
- Jack is an intermediary who has no part in the transaction other than to pass around the request
- There is no special relationship between Jack and Dan except that
	- Dan trusts Jack to deliver the cheque to Wes
		- Wes trusts that Jack isn’t going to give him a fake cheque

### Validity

When a Request message is sent, the sender stamps the payload with the transmission time, according to either NTP or the clock on the target.

Every entity has both minimum and maximum TTL values. If the `ttl` property of the `validity` property of the Request’s `payload` is specified and between the minimum and maximum value, that value is used for the Request’s TTL. Otherwise,

- if that `ttl` is specified but too short, the minimum value is used
- if that `ttl` is specified but too long, the maximum value is used
- if that `ttl` is not specified, the default value is used
- if the default value is was not specified on the Connection, then the minimum value is used

The receiving entity then examines the `time` property of the `validity` object.

- if the `operation` is not `'connect'`:
- if the `operation.validity.time` property of the Request message is not defined, an error.code=EINVAL ErrorPayload response is sent
- if the `time` is in the future, an error.code=ETIMETRAVEL ErrorPayload response is sent
- if the `time` + the TTL is in the past, an error.code=EEXPIRED ErrorPayload response is sent
- if the receiver has ever seen a request with the same `stamp` on any connection from any source, an error.code=EDUP response is sent
- If no error response was sent, the ‘ `request` ’ event is fired.

#### Cheque Scenario (cont’d)

Revisiting the cheque scenario above, the bank also needs to ensure that the cheque is being presented to the bank for the first time, and is not a digital or photo copy.

Every cheque has a cheque number (*validity.stamp*) that accompanies the bank transit number (*guardian address*) and account number (*resource address*). The bank keeps a list of all the cheque numbers that have been drawn on that account, but keeping a list of all cheques forever would be burdensome. The bank’s solution is to look at the date on the cheque (*validity.time*) and adds one year (*validity.ttl*) to that period. If that date is in the past, the cheque is more than a year old and will not be honoured.

### Target Startup Notes

In order to be fully secure against replay attacks, targets operating over DCPv4 must employ one of the two following algorithms to prevent message replays (purposeful or otherwise) from triggering a given behaviour more than once, including after a maintenance cycle or crash-recovery:

1. store all validity-checking information (eg. `payload.validity.stamp` and its expiry time) in an ACID-compliant storage system
- do not acknowledge message receipt until the backing store confirms the data has been permanently recorded
2. Wait for at least the maximal maximum TTL associated with any connection which the target may receive Requests on before accepting any new messages.

Care must be taken by system administrators operating guardian entities when adjusting the system clock or extending validity times on established guardians, as this could open the system up to a replay attack. For this reason, it is highly recommended that all time changes on systems hosting guardians be made via NTP.

## Response Authentication Algorithm

- check that id matches an outstanding request on that connection
- same checks as Message Authentication, except no nonce

## Reserved Operations

Certain payload.operation values in Request messages are reserved for use by the protocol itself;

- connect
- close
- keepalive
- v3

The messages are sent by same-named methods of `Connection` instances, and automatically responded at the protocol level *without triggering the request callback*.

### connect

The connect operation is the only Request which must be sent from an initiator to a target; all other Request/Response pairs can be exchanged between peers.

This operation establishes the initial DCPv4 connection, ensuring version compatibility, providing initial nonce/id values, and creates the DCP Session Identifier (`dcpsid`). Both the initiator and the target provide half of `dcpsid`, which is of the form X-Y where X is provided by the initiator and Y is provided by the target. Both X and Y must be absolutely unique in their environments.

#### Request connect (initiator -> target) Body

```javascript
{
  id: 'f123',
  nonce: 'aaabbbcccddd',
  payload:
  {
    operation: 'connect',
    data: { version: '1.1.0', sid: 'INITIATOR_STRING//' },
    validity: { time: '117082920', stamp: '77d25ca91196ceb1c0b851660989b51a', ttl: 15 },
  }
}
```

#### Response connect (target -> initiator) Body

```javascript
{
  id: 'f123',
  time: '1578683050',
  success: 'true',
  dcpsid: 'INITIATOR_STRING//TARGET_STRING',
  nonce: '1337c0ded00d',
  payload: {
      version: '4.0.0'
  }
}
```

or, in the case of a protocol version mismatch:

```javascript
{
  id:  'f123',
  time: '1578683050',
  success: 'false',
  payload:
  {
    message: '>2.0.0',
    code: 'EVERSION'
  }
}
```

A sample Request as sent ‘on the wire’, after being signed, including Ethereum envelope:

```javascript
{
  owner: <initiator's identity.address>,
  signature: <signature(body)>
  body: 
  {
    id: <whatever but unique>,
    payload:
    {
      operation: <name of operation>,
      data: /* JSONable whatever or undefined */,
      allow: [ { resource: <resource address>, guardian: <guardian address>, accessor: <accessor address> }, ... ],
      validity: { time, stamp, ttl }
    }
    auth: { <resource address>: signature(payload) },
    dcpsid: /* unique per "connection", assigned during connect */
    nonce: /* last nonce received */
  }
}
```

### close

Request: `{ payload: { operation: 'close' } }` Response: `{ success: true }`

### keepalive

Request: `{ payload: { operation: 'keepalive' } }` Response: `{ success: true }`

### v3

The v3 operation provides a v4 wrapper to access services provided via a v3 endpoint. The server must configure the v4 Dispatcher with a handle to the v3 router, then clients may use the `Connection.sendv3` method as a replacement for v3’s `protocol.send`; `sendv3` accepts the same basic parameters as `protocol.send` - `url`, `message`, and optional `key`.

At the server side, the request will be shaped into a v3 SignedMessage format, with the owner set to the first `allow` resource if present or the Request’s `owner` otherwise.

Request:

```javascript
{
 payload: { 
  operation: 'v3',
  data: {
   url: '/example-url',
   message: {
    /* message body */
   }
  },
        allow: [
            { resource: dcpId, guardian: dcpId, accessor: dcpId }
        ],
 }
}
```

Response:

```javascript
{
 success: true,
 payload: {
  v3status: 'resolve' | 'reject',
  v3rejection: /* if v3status is 'reject', then rejected Error */,
  v3resolution: /* if v3status is 'resolve', then returned v3 message body */,
 }
}
```

## Sample Code

### Send Simple Message

```javascript
let conn = new protocol.Connection(peerURL);
let response = await conn.send('add', [1, 2, 3, 4, 5])
console.log('The answer is', response.payload);
```

### Receive Simple Message

Setting up a target is a bit more complex. A target needs to be able to manage a pool of connections and transports and read messages coming in off of those transports to determine which connections they go to (or create one if an initial connect request comes in).

Using socket.io as an example of a transport layer that could receive an initial connect request (and thus instantiate a `Connection` instance at a target) we can build a simple demo that doesn’t quite have all the error handling needed but shows the basic idea.

```javascript
// build a pool of connections and transports
let connections = [];
let transports = [];
const identity = await wallet.getId();
const httpServer = http.createServer();
this.socketIOServer = socketio(httpServer);
this.socketIOServer.on('connection', function (socket) {
  // create a new transport using our SocketIOTransport class
  const transport = new SocketIOTransport(socket);
  transports.push(transport);
  transport.on('message', function (message) {
    // determine if message should go to an existing connection or create a new one
    let conn;
    if (isConnectMessage(message)) {
      conn = await Connection.newTarget(identity, transport);
      // respond to a new connection being created so that when it emits a 'request' event you can do something with it.
      registerNewConnection(conn);
    } else {
      conn = connections.find( (conn) => conn.dcpsid === message.body.dcpsid );
      // handle case where no connection was found
    }
    conn.transport = transport;
    conn.onMessage(message);
  }
});
httpServer.listen(this.url.port);
```

### Send Message via Third-Party

A message which is handed to the scheduler to allow the scheduler to escrow some funds from a bank account without multiple round trips might looks like this:

```javascript
let schedulerConn = new protocol.Connection(schedulerLocation, idKS);
let bankAddress = (await schedulerConn.send('getLocalBankAddress'));
let bankAccountKS = await wallet.get();
let idKS = await wallet.getId();
let request = new schedulerConn.Request({operation: 'escrow'});

request.payload.data = { source: bankAccountKS.address, amount: 100 };
request.authorize(bankAccountKS);
response = await schedulerConn.send(message);
```

Note that the bank/scheduler message payload details are beyond the scope of this specification.

### Send Message using protected resource

In this example, the bank might understand an operation named ‘transfer’, which transfers funds from one account to another. The source account would require the message sender to have the authority to do this.

```javascript
let bank = new protocol.Connection(bankURL);
let fundsSourceKS = await wallet.get();
let fundsTarget = new wallet.Address('0xc0ffee');
let request = new bank.Request('transfer', { 
  amount: 123.45,
  source: fundsSourceKS.address,
  target: fundsTarget
});
request.authorize(fundsSourceKS);
let result = await request.send();
console.log('Funds were successfully transferred; receipt:', result)
```

### Receive Message requesting use of protected resource

Using the example from before, let’s look at what `registerNewConnection` might do.

```javascript
async function registerNewConnection (conn) {
  conn.on('request', (request) => {
    switch (request.payload.operation) {
      case 'transfer':
        response = await oper_transfer(request); 
        break;
      default: 
        response = new Error('Invalid Request');
        break;
    }
    request.respond(response);
  }
}

async function oper_transfer(request) {
  let {amount, source, target} = request.payload.data;

  if (!request.doesAuthorize(source))
    return { status: 'not authorized' };
     
  let result = await require('./bank_guts').transfer(amount, source, target);
  if (result !== true)
    return { status: 'fail', error: result };
  return { status: 'ok' };
}
```