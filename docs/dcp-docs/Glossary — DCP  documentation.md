## Glossary

## Entities

Bank [](#term-Bank "Link to this term")

A server which

- manages a ledger for Compute Credits
- enables the movement of Compute Credits between entities requesting work and entities performing work
- enables the placement of Compute Credits in escrow on behalf of the for work which the anticipates to be done

Portal [](#term-Portal "Link to this term")

A web app which allows or enables

Sandbox [](#term-Sandbox "Link to this term")

A component of a used to execute arbitrary JavaScript code in a secure environment. Implemented by the class (there are plans to change the name someday). In essence, the uses one Sandbox per CPU core, although it might use more to work around system scheduler deficiencies, network overhead, etc. `window.Worker()` implements Sandboxes in the web browser.

Scheduler [](#term-Scheduler "Link to this term")

A server which

- receives work functions and data sets from Compute API
- slices data into smaller sets
- transmits work and data points to Worker
- determines cost of work and instructs the Bank to distribute funds between entities accordingly
- ensures that all tasks complete, provided it can deploy appropriate financial and computation resources in furtherance of this goal

Supervisor [](#term-Supervisor "Link to this term")

The component of a Worker which communicates with the Scheduler and Sandboxes.

Worker [](#term-Worker "Link to this term")

A JavaScript program which includes a Supervisor and one or more Sandboxes

- performs computations
- retrieves work and data points from Scheduler
- retrieves work dependencies from Package Server
- returns results and cost metrics to Scheduler
- Specific instances of Worker include
- a browser-based Worker
- a standalone Worker operating on Google’s v8 engine

## Concepts

Address [](#term-Address "Link to this term")

A unique identifier in DCP that can represent a Bank Account identifier (account number) or identifier.

Bank Account [](#term-Bank-Account "Link to this term")

A ledger that acts as a repository for Compute Credits. Metadata attached to bank accounts can restrict certain operations, such as ear-marking funds for use by just job deployment.

CGIO [](#term-CGIO "Link to this term")

The measure of CPU time, GPU time, input bytes and output bytes for a given slice of work. DCP workers can configure minimum credits for each (CPU, GPU, I or O) to reflect their cost of compute. Only slices whose offered price is greater than the minimum wage set by the worker can be taken by that worker.

DCP [](#term-DCP "Link to this term")

A distributed computing and payments platform consisting of one or more schedulers and workers. When used as a proper noun, DCP is the one hosted at [https://dcp.cloud/](https://dcp.cloud/).

Job [](#term-Job "Link to this term")

The collection consisting of an input set, Work Function, and result set. Referred to in earlier versions of the Compute API (incorrectly) as a Generator.

Keystore [](#term-Keystore "Link to this term")

A data structure that stores an encrypted key pair (address + private key). In general, owners encrypt their keystore with a passphrase.

Keystore File [](#term-Keystore-File "Link to this term")

A file that stores a JSON-encoded Keystore.

Module [](#term-Module "Link to this term")

A unit of source code that can be used by, but addressed independently of, a. Compute API modules are akin to CommonJS modules.

Package [](#term-Package "Link to this term")

A group of related modules

Slice [](#term-Slice "Link to this term")

A unit of work, represented as source code plus data and metadata, which has a single entry point and return type. Each Slice in a corresponds to one element in the Job’s input set.

Task [](#term-Task "Link to this term")

A unit of work composed of one or more slices, which a single worker can execute.

Wallet [](#term-Wallet "Link to this term")

A piece of software that allows a person to interact with the greater economy as a whole. It’s analogous to your actual wallet in your pocket has your cash and credit cards, and you access your wallet to buy something and keep records (by pulling out cash or cards, and stuffing receipts back in).

DCP acts as a Wallet; the platform exposes Wallet-related capabilities both via software APIs and the portal website.

- The portal, wallet API, and command-line tools can generate public/private key pairs
- A database stores public/private key pairs as passphrase-protected Keystores
- The DCP Wallet stores public/private key pairs. People can retrieve them via the portal website.

Work [](#term-Work "Link to this term")

Work Function [](#term-Work-Function "Link to this term")

A function that a executes once per for a given, accepting the input datum and returning a result which the adds to the result set.