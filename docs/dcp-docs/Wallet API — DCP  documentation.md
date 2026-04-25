## Wallet API

The Wallet API is a library for working with DCP, the Distributed Compute Platform, to perform operations related to Addresses, Keystores, Key Pairs, etc.

**Record of Issue**

| May 13 2020 | Ryan Rossiter | 1.2.4 | Polish for First-Dev |
| --- | --- | --- | --- |
| Jan 14 2020 | Nazila Akhavan | 1.2.3 | Added Address.verifySignature, makeSignedMessage, makeSignature |
| Dec 19 2020 | KC Erb | 1.2.2 | Clarified Keystore unlock duration behaviour |
| Sep 19 2019 | Wes Garland | 1.2.1 | Added Keystore constructor form 6 |
| Aug 1 2019 | Wes Garland | 1.2 | Renamed keystore types to AuthKeystore, IdKeystore, BankAccountKeystore. Disk-based APIs now only concerned with AuthKeys. |
| Jul 25 2019 | Wes Garland. | 1.1 | Changed definition of Wallet, renamed to Wallet API, introduced Keystore, PrivateKey, Address types |
| May 24 2019 | Wes Garland | 1.0.1 | Added DataTypes |
| May 23 2019 | Wes Garland | 1.0 | Initial Revision - Keystore API |

## Intended Audience

This document is intended for Distributive’s DCP core team and application developer teams, as well as external developers writing DCP applications.

## Definitions

### Address

A unique identifier in DCP which can be used as a Bank Account identifier (account number), Address on the Ethereum network, or as an identifier for any other arbitrary entity (eg. a job, a compute group, the bank, an administrator, etc.). DCP addresses are ERC-20 addresses.

Addresses that leave internal data structures (i.e. displayed on screen or transmitted across the network) should always be represented in the mixed-case checksum address encoding described in EIP-55.

### Private Key

A unique identifier in DCP which corresponds with an Address, which are used to sign messages. Simply knowing a private key indicates that you are authorized to use it.

Private Keys in DCP are 64-digit hexadecimal numbers chosen at random. The Address is derived by extracting the last 20 digits of the result of applying the kekkak-256 hashing algorithm to this key.

### Unlock

Unlocking refers to the decryption of an encrypted private key.

### Keystore File

A file which stores a JSON-encoded Keystore Object. This is the preferred method to store and reference private keys on disk. The file format is the UTC/JSON format used by geth and MyEtherWallet. It contains an encrypted private key and an address.

### Keystore Object

A data structure which can store a (public) Address and a private key. This object is the preferred way to communicate both addresses and private keys through DCP APIs. This is not the keystore object used by an underlying API / third-party library.

#### IdKeystore Object

A Keystore Object which is used to represent addresses identifying entities, such as the Scheduler, the Portal or an end user. Messages signed with identity keys belonging to end users have the same access privileges as the corresponding portal login.

#### BankAccountKeystore Object

A Keystore Object which is used to represent addresses corresponding to bank accounts. A message signed with a bank account’s private key has enough access to withdraw or escrow funds from the bank account.

#### AuthKeystore Object

A Keystore Object which used to represent authorization granted to a third-party. The specifics of this authorization are noted in the database. Types of authorization may include access to withdraw or escrow funds (up to a given limit, for a certain period of time) and may or may not require counter-signature by the third-party’s identity key.

### Wallet

In the general (blockchain) sense, a wallet is a piece of software that allows the user to interact with the greater economy as a whole. So as your actual wallet in your pocket has your cash and credit cards and you access your wallet in order to make a purchase and keep records (by pulling out cash or cards, and stuffing receipts back in), a blockchain wallet performs a similar function in that it gives you a place to store your private keys (your money/credits), it provides a balance of what all those credits add up to, it provides a way to receive credits and send credits, and provides a record of all those sends and receives. Most blockchain wallets provide at least 3 basic functions:

1. Generate and store your public/private key pairs
2. Allow you to use those key pairs through transactions (allows you to craft and transmit transactions to the peers)
3. Keep a record of the transactions

Additionally, most of the current crypto wallets (such as Bitcoin core) provide blockchain validation and consensus functions in that they can act to create or validate new blocks to the chain in addition to creating or validating transactions.

#### DCP Wallet

DCP acts as a Wallet; the platform exposes Wallet-related functionality both via software APIs and the DCP Portal web site (https://dcp.cloud).

- Public/private key pairs are generated via the portal, wallet API, and command-line utilities
- Public/private key pairs are stored in the database as passphrase-protected Keystores
- Public/private key pairs stored in the DCP Wallet can be retrieved via the portal website

##### Anticipated Future Functionality

- API access to keystores via RESTful web API

### Bank Account

A DCP Bank Account is simply an entry in a ledger, which supports operations such as deposit, withdraw, and move funds (between accounts or into escrow). All operations are performed by the Bank, which receives signed messages bearing a cryptographic signature matching the account address.

## General DCP Architecture Notes

- Bank balances are entries in a ledger; the accounts table of a database
- Any ethereum address (public key) is a valid address in which to deposit funds, and the Bank will auto-create new accounts on an as-needed basis.
- If you can sign a message with the private key, you can check the balance, withdraw funds, etc.
- The Wallet screen in the portal is nothing more than a place where encrypted key pairs are stored, indexed by user. It is totally legitimate for more than one user to have an encrypted key pair describing the same bank account; for example, a group of developers on the same project sharing compute funding.

## Core API

### Introduction

DCP Addresses can be used as a Bank Account identifier (account number), an Address on the Ethereum network, or as an identifier for any other arbitrary entity (eg. a user, the bank, an administrator, etc.).

It is considered bad practice to identify multiple entities using the same Address. It is important to remember that;

- a user may have more than one Bank Account
- a plurality of users may have access to the same Bank Account
- it is possible to have a Bank Acount which is not associated with any user or even any other entity

### API DataTypes

#### Address

Address objects represent DCP Addresses. All Addresses used within DCP or DCP Applications should be represented by Address Objects, and all comparisons between Addresses and Address-like values must be done with the `Address.prototype.eq` method.

##### Constructor

The Address constructor accepts as its argument a string or an object which corresponds to the Address we want to represent.

If the passed address is a string, it should be (but is not required to be) in checksum format; a leading 0x is not required. If the passed address is a instance of PrivateKey or Address, the address associated with the object used. If the passed address is any other type of object, we coerce the object with toString(16) before working with it (BigNumber and similar objects are expected to “just work”)

##### Methods

`Address.prototype.eq` - This function is used to compare two Addresses, or an Address and a PrivateKey.

`Address.prototype.ct` - This function is used to deterimine if the Address corresponds to a given PrivateKey.

`Address.prototype.verifySignature` - This function allows us to validate signatures in order to implement the Connection.Request.authorizedFor method. The first argument is the messageBody as a string or an object, and the second argument is the signature. It returns a boolean.

#### PrivateKey

PrivateKey objects represent DCP private keys. All raw private keys used throughout DCP or DCP Applications should be stored in PrivateKey objects, however for security reasons, raw private keys should stored as little as possible: the preferred method to store a private key is via a keystore file or Keystore object.

All comparisons between PrivateKeys and PrivateKey-like values must be done with the `PrivateKey.prototype.eq` method.

##### Constructor

The PrivateKey Constructor accepts as its argument a string or object corresponding to the private key we want to represent. If the passed private key is a string, it should (but is not required to) have the 0x prefix. If the argument is an object, and is a Keystore object, we extract the private key; otherwise we coerce the object with toString(16) before working with it (BigNumber and similar objects are expected to “just work”).

##### Methods

`PrivateKey.prototype.eq` - This function is used to compare this PrivateKey against another private key. Any argument which is acceptable to the constructor is acceptable to this method.

`PrivateKey.prototype.ct` - This function is used to deterimine if the PrivateKey corresponds to a given Address.

#### Keystore

Keystores are stored in Keystore objects. These objects are instanceof `require('wallet').Keystore`. Other classes, such as BankAccountKeystore, AuthKeystore, and IdKeystore are also instances of Keystore.

##### Constructor \[async\]

The constructor returns a Promise which is resolved with a locked Keystore object whose Address is known.

Any call to the constructor may trigger `exports.passphrasePrompt`. Any forms of the constructor referencing PrivateKey can be an instance of PrivateKey, or anything which can be used as an argument to the PrivateKey constructor.

form 1: `new Keystore()`: This form accepts no arguments and returns a Keystore object that corresponds to a randomly-selected private key. This form will prompt the user for a password to encrypt itself with.

form 2: `new Keystore(PrivateKey)`: This form accepts, as its sole argument, a private key and returns a Keystore object that corresponds to that private key. The Keystore will be locked, and the key will be encrypted with the passphrase supplied by exports.passphrasePrompt().

form 3: `new Keystore(PrivateKey, passphrase)`: This form accepts as its arguments a private key and a passphrase, returning a Keystore object that corresponds to that private key, encrypted with that passphrase. If the passphrase is `false`, the empty passphrase will be used.

form 4: `new Keystore(third-party keystore object, optional passphrase)`: This form accepts as its argument a keystore object from a third party, such as MyEtherWallet, geth, Web3, etc. If this object cannot be parsed, or is otherwise unusable, the Promise will be rejected with an instance of Error.

During serialization with `toJSON()`, objects created with this form must return the original object, stringified with `JSON.stringify()`.

If the passphrase is `false`, the passphrase argument will be considered to be undefined.

form 5: `new Keystore(JSON string, optional passphrase)`: This form accepts as its argument a JSON-encoded string. It is identical to form 4, except the string is first turned into a object with JSON.parse().

During serialization with `toJSON()`, objects created with this form must return the original string, unaltered.

form 6: `new Keystore (Keystore object)`: This form accepts as its argument a Keystore object.

During serialization with `toJSON()`, objects created with this form must return the result of invoking `toJSON()` on the original object.

form 7: `new Keystore (null, passphrase)`: This form accepts as its argument null and a passphrase, and returns a Keystore object that corresponds to a randomly-selected private key, encrypted with the supplied passphrase.

##### Properties

`address` - an instance of Address which represents the (public) address in the Keystore

`label` - a string which, when not undefined, is used to generate the message which is printed to prompt for the passphrase during the `unlock` method.

##### Methods

**`toJSON`** - This method allows us to serialize the Keystore object in a format suitable for sharing with third parties, taking care not to drop any metadata, nor give way any secrets we have learned from the user since the constructor was invoked.

**`makeSignedMessage`** - This method makes protocol API’s Connection.Message.sign to be able to sign messages by using the messageBody. It returns the signed message in a string.

**`makeSignature`** - This method allows us to create signature in order to implement the Connection.Request.authorize method. It takes the messageBody as an input and returns the signature in a string.

**`async unlock(passphrase, time, autoReset)`** - This method unlocks the Keystore object for a given amount of time, specified in floating-point seconds. When the object is unlocked, *getPrivateKey* and related operations do not need to ask for a passphrase, as the private key is “remembered” internally. If time is not specified, the object will be immediately locked after the next call to *getPrivateKey*. This method may trigger a call to `exports.passphrasePrompt`.

When the unlock timer is running and the autoReset flag is true, a subsequent call to *getPrivateKey* resets and restarts the timer.

When the unlock timer is running, a subsequent call to *unlock* that specifies an extension of the timer requires a password check before extending the timer.

If this newly-specified unlock duration is longer than the duration specified during the last unlock which had autoReset flag set to true, then a password check is given followed by

1. If the autoReset flag is true for this invocation, the autoReset duration is increased
2. Otherwise, the current unlock duration is increased, but the autoReset duration remains the samethat implies a longer unlock duration resets and restarts the timer.

When the passphrase is not specified, the `exports.passphrasePrompt` function is invoked to solicit it from the user if the keystore is not already unlocked.

**`Keystore.prototype.lock()`** - This method locks the Keystore object immediately.

**`Keystore.prototype.getPrivateKey`** - This method returns an instance of PrivateKey, unlocking the Keystore with `Keystore.prototype.unlock` as needed.

### User Interface Hooks

#### passphrasePrompt(message)

This function accepts a string, which is displayed to the user, and returns a string which was entered by the user.

In NodeJS applications, this function solicits input from the standard input, and does not display what the user is typing.

In browser applications, this function solicits input from the active browser window, using an `<INPUT type="password">` element.

### API Functions - NodeJS

In addition to the classes outline above, the Wallet API offers functions for locating and opening Keystore files which correspond to AuthKeystores. While it is not required, Client developers using NodeJS are encouraged to use these when using disk-based keystores in order to give DCP programs a consistent user experience.

#### NodeJS Platforms

Keystore Files are loaded, by default, from the `.dcp` directory in the user’s home directory. They are stored in files ending in `.keystore`. The first part of the filename corresponds, by default, to the name assigned to the Keystore in the DCP Web Portal.

#### Web Platforms

Keystore Files can be either files on the user’s local filesystem, browser local storage, or within the Distributed.Computer Wallet.

#### Unified Platform

The next version of this specification will allow NodeJS Platforms to use the Distributed.Computer Wallet via a RESTful API.

*Unified and Web Platform implementation are currently out-of-scope – wait for later version of spec*

#### load \[async\]

This function accepts a Keystore name or filename, reads the contents of the associated file, and return a promise. The promise is either rejected with an instance of Error, or it is resolved with an object which has the following properties:

**keystore** - a Keystore Object corresponding to the keystore that was loaded

**safe** - a boolean flag which, when true, indicates that the keystore was read from a secure location.

form 1: `wallet.load(filename)` *\- NodeJS only*: `filename` must be an absolute path, or begin withgin with `path.sep`, `'.' + path.sep`, or `'..' + path.sep`.  
The *safe* flag is set to true to indicate that the Keystore file was stored safely; this happens if and only if the following conditions are true:

1. The containing directory and all its ancestors, up to and including the root directory, is not world-writable
2. The Keystore File is neither world-writable nor world-readable

form 2: `wallet.load(options)`: This form builds a Keystore File filename based on its arguments, performing the operations described in *form 1* once the filename has been determined.

The `options` object can be used to override the default name and directory for the Keystore File.

| Option | Type | Behaviour |
| --- | --- | --- |
| name | `string` | Override the default keystore name, normally “default” |
| paths | `string[]` | Override default keystore directory *search path*, normally the application data directory, followed by the “.dcp” directory in the home directory belonging to the user invoking the program (NodeJS only). Note that the search path is never used when *name* specifies a complete pathname. |
| dir | `string` | Override the paths array with `[dir]` |
| KeystoreConstructor | `function` | Override the constructor to use for the keystore |

#### get

These functions examine parameters and accepts options relating to its environment, uses this information to select a Keystore File, load it via `wallet.load`, and return an AuthKeystore object. If it cannot return an AuthKeystore object, this function will throw an Error.

Note that this function does not perform any validation on the Keystore, other than it is in the correct file format.

form 1: `wallet.get(options)`: This form loads a Keystore File via `wallet.load` and returns an AuthKeystore object. The `options` object is used to override default parameters which help to identify and locate the Keystore File.

On NodeJS: The options object is passed directly to `wallet.load`. On Web: The options object is primarily used to provide context to the user for showing a modal;

| Option | Type | Behaviour |
| --- | --- | --- |
| name | `string` | Override the default keystore name, normally “default” |
| contextId | `string` | An optional, user-defined identifier used for caching keystores. |

```
See \`job.contextId\` in the compute-api spec. |
```

| jobName | `string` | Optional name of the job that the keystore is being requested for | | KeystoreConstructor | `function` | Override the constructor to use for the keystore |

form 2: `wallet.get()`: This form is equivalent to `wallet.get({})`.

form 3: `wallet.get(string)`: This form is equivalent to `wallet.get({name: string})`

form 4: `wallet.get(array)`: This form accepts an Array-like object, formatted like `process.argv`, to specify options for invoking *form 1*. Its purpose is to unify Keystore, PrivateKey, and Address-related options for programs written in NodeJS.

| Argument | Behaviour |
| --- | --- |
| –private-key | Generate a keystore corresponding to the specified private key, ignoring all other considerations |
| \-i name | Override the `name` option for getId |
| \-k name | Override the `name` option for get |
| \-p | Set the `checkEmpty` option to false |

form 5: `wallet.get(array, options)`: This form accepts an Array-like object, as described in *form 4*, and an options object as described in *form 1*. Its behaviour is to generate an options object from the array, merge the passed options object into this options object, and invoke *form 1*.  
To be clear, the `options` argument has a higher precedence than the `array` argument.

form 6: `wallet.get(array, string)`: This form is equivalent to `wallet.get(array, {name: string})`

#### getId()

This function behaves exactly the same as **get()**, except its default keystore file is the `id` keystore instead of the `default` keystore.

#### add(keystore, name=‘default’)

This function will add the provided keystore to the wallet API internal cache, which will return the same keystore when `get` is called with the same name.

#### addId(keystore)

Same as `add` but with `name='id'`. Keystore can then be retrieved with `getId`.

### clear

This function will clear the wallet API’s internal keystore cache.