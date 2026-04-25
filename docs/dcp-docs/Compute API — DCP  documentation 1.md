---
tags:
  - "clippings"
tags:
tags:
---
## Compute API

The Compute API is a library for working with DCP, the Distributed Compute Platform, to perform arbitrary computations on the Distributed Computer.

**Record of Issue**

| May 06 2020 | Wes Garland | Stamp Compute API 1.5.2 |
| --- | --- | --- |
| May 05 2020 | Nazila Akhavan | Add getJobInfo, getSliceInfo |
| Feb 24 2020 | Ryan Rossiter | Add job.status, job.runStatus, clarify marketRate |
| Dec 09 2019 | Ryan Rossiter | Update requirements object property descriptions |
| Oct 08 2019 | Jason Erb | Clarified distinction between Worker and Sandbox |
| Sep 23 2019 | Wes Garland | Compute API 1.51 Release. Improved language. |
| Sep 20 2019 | Wes Garland | Compute API 1.5 Release.   Improved vocabulary, minor document reorg, Application->Appliance, Appliance re-work, job costing details, Scheduler class, Scheduler explanation, Job Lifetime, ENOFUNDS refinement |
| Jul 15 2019 | Wes Garland | Glossary update; Generator->Job, Worker Thread->Sandbox, Miner->Worker |
| Feb 13 2019 | Wes Garland | \- Added offscreenCanvas and sandboxing info to Worker Environment   \- Added API compute.status   \- Began enumerating Worker Capabilities   \- Sparse and Output Set Range Objects   \- Added job handle collateResults and results properties   \- More work on task/slice differentiation |
| Nov 23 2018 | Wes Garland | \- Deprecated Application   \- Introduced Shared State and Access Keys   \- Improved Task/Slice Differentiation/Composibility |
| Oct 31 2018 | Wes Garland | Initial Release |
| Oct 29 2018 | Wes Garland | Second Draft Review |
| Oct 23 2018 | Wes Garland | Moved toward generator-oriented syntax |
| Oct 19 2018 | Wes Garland | First Draft Review |

## Intended Audience

This document is intended for software developers working with DCP. It is organized as a reference manual / functional specification; introductory documentation is in the DCP-Client document.

## Overview

This API focuses on jobs, both ad-hoc and from published appliances, built around some kind of iteration over a common Work Function, and events. The API entry points are all exports of the DCP `compute` module.

### See Also

- DCP-Client package
- Wallet API

## Implementation Status

As of this writing (September 2019), the Compute API is very much a “work in progress”, with core functionality finished and well-tested, but finer details unfinished or omitted entirely. This document intends to document the final product, so that early-access developers can write future-proof or future-capable code today.

*Note*: The list below is not complete, and may not be up to date. Caveat Developtor!

### Implemented

- compute.do
- compute.for
- compute.resume
- Range Objects
- Distribution Objects

### Partially Implemented

- Module system; public modules inside sandboxes used by work functions are complete, however there is no automatic bundling of private modules, no access restrictions, no automatic version maintenance, etc.
- Wallet API is well-implemented on NodeJS but browser support falls back to the keychain API (asking users to upload keystore files all the time)

### Not Implemented

- Appliances
- Proxy Keys
- Identity Keys
- Consensus Jobs
- Reputation
- `console` events’ `same` counter.

## Definitions

- **Task** - A unit of work which is composed of one or more slices, which can be executed by a single worker.
- **Slice** - A unit of work, represented as source code plus data and meta data, which has a single entry point and return type.
- **Job** - The collection consisting of an input set, Work Function, arguments, and result set.
- **Module** - A unit of source code which can be used by, but addressed independently of, a job. Compute API modules are similar to CommonJS modules.
- **Package** - A group of related modules
- **Scheduler** - The daemon which connects both workers and clients together, doles out work, and sends information about DCC movement to the Bank. The scheduler groups slices into tasks based on a variety of criteria such as slice cost, leaf-node cache locality, and sandbox capabilities.
- **Worker** - A software program having one supervisor and one or more sandboxes. This program communicates with the scheduler and module server to retrieve tasks and modules, which are sent to and executed on the worker.
- **Sandbox** - An ES execution environment in the worker which executes modules and tasks supplied by the supervisor.
- **Supervisor** - The part of the worker which manages sandboxes, mediates communication with sandboxes, and so on.
- **Client** - A program which uses DCP that is executed/used by the end-user.
- **Appliance** - a named collection of well-characterized Work Functions
- **Distributed Computer** A distributed supercomputer consisting of one or more Schedulers and Workers.

## About the Compute API

The *compute* module is the holding the module for classes and configuration options (especially default options) related to this API. Throughout this document, it is assumed that this module’s exports are available as the global symbol `compute`.

Most computations on the Distributed Computer operate by mapping an input set to an output set by applying a work function to each element in the input set. Input sets can be arbitrary collections of data, but are frequently easily-described number ranges or distributions.

*Work* functions can be supplied directly as arguments in calls to API functions like `compute.do` and `compute.for`.

**note** - When *work* is a function, it is turned into a string with `Function.prototype.toString` before being transmitted to the scheduler. This means that *work* cannot close over local variables, as these local variables will not be defined in the worker’s sandbox. When *work* is a string, it is evaluated in the sandbox, and is expected to evaluate to a single function.

## Jobs

*Jobs* associate work with input sets and arguments, and enable their mapping and distribution on the Distributed Computer. Jobs with ad-hoc Work functions can be created with the `compute.do` and `compute.for` APIs.

Fundamentally, a Job is

- an input set,
- a work function, and
- arguments to the work function
- an output set, which is result of applying the work function and its arguments to each element of the input set.

The Scheduler on the Distributed Computer is responsible for moving work and data around the network, in a way which is cost-efficient; costs are measured in terms of CPU time, GPU time, and network traffic (input and output bytes).

Clients specify the price they are willing to pay to have their work done; Workers specify the minimum wage they are willing to work for. The scheduler connects both parties in a way that allows Workers to maximize their income, while still serving the needs of all users on the Distributed Computer. Essentially, the higher the wage the client is willing to pay, the more Workers will be assigned to compute the job.

### Work Characterization

Work is characterized throughout the lifetime of the job. CPU time and GPU time are constantly normalized against benchmark specifications, and network traffic is measured directly. Work starts out as uncharacterized.

#### Uncharacterized Work

Uncharacterized work is released slowly into the network for measurement. Funds are escrowed during deploy to cover the static offer price for all slices.

#### Well-Characterized Work

Well-characterized work can be deployed on the network more quickly, skipping the estimation phase. Client developers can specify work characterization (sliceProfile objects) while submitting work; these can be either directly specified or calculated locally via the job estimation facilities. Additionally, work originating from Appliances is always well-characterized.

graph TD launch\[compute.for.exec\] --> deployFee(charge deployment fee) deployFee --> wellChar wellChar{is job well<br/>characterized?} --yes--> working wellChar --no--> estJob estJob(deploy a few slices at market rate and escrow enough DCC to compute 95% of slices) estJob --> ckENOFUNDS ckENOFUNDS(enough DCC for estimation?) --yes --> estDone(estimation completes) ckENOFUNDS --no --> evENOFUNDS(ENOFUNDS event handler?) evENOFUNDS -- yes --> finishEst finishEst>job.escrow && job.resume\] --> ckENOFUNDS evENOFUNDS -- no --> reject reject(compute.for.exec rejects) estDone --> working working(Main work begins) working --> ckFixed ckFixed{fixed rate per slice and <br/> fixed number of slices?} ckFixed -- yes --> escrow(escrow enough funds for whole job) ckFixed -- no --> pieceMeal(escrow enough funds for each task as it is handed out) pieceMeal-->2ckENOFUNDS 2ckENOFUNDS{have enough<br/>DCC in account?} 2ckENOFUNDS -- no --> 2evENOFUNDS(ENOFUNDS event handler?) 2evENOFUNDS -- yes --> 2resume escrow --> 2ckENOFUNDS 2resume>job.escrow && job.resume\] --> 2ckENOFUNDS 2evENOFUNDS -- no --> reject 2ckENOFUNDS -- yes --> finishJob(all slices computed) finishJob --> resolve\[compute.for.exec resolves\] reject --> done resolve --> done(Done)

## Static Methods

### compute.cancel

This function allows the client to cancel a running job. This function takes as its sole argument a Job id and tells the scheduler to cancel the job. This method returns a promise which is resolved once the scheduler acknowledges the cancellation and has transitioned to a state where no further costs will be incurred as a result of the job.

### compute.do

This function returns a JobHandle (an object which corresponds to a job), and accepts one or more arguments, depending on form.

| Argument | Type | Description |
| --- | --- | --- |
| n | Number | number of times to run the work function |
| work | String | the work function to run. If it is not a string, the toString() method will be invoked on this argument. |
| arguments | Object | an optional Array-like object which contains arguments which are passed to the work function |

- **form 1**: `compute.do(work, arguments)` This form returns a JobHandle and accepts one argument, *work*. Executing this job will cause *work* to run a single task on the Distributed Computer. This interface is in place primarily to enable DCP-related testing during software development. When it is executed, the returned promise will be resolved with a single-element array containing the value returned by *work*.
- **form 2**: `compute.do(n, work, arguments)` This form returns a JobHandle which, when executed, causes *work* to run *n* times and resolve the returned promise with an array of values returned by *work* in no particular order. For each invocation of the *work* function, *work* will receive as its sole argument a unique number which is greater than or equal to zero and less than *n*.

### compute.for

This function returns a JobHandle (an object which corresponds to a job), and accepts two or more arguments, depending on form. The *work* is scheduled for execution with one slice of the input set, for each element in the set. It is expected that *work* could be executed multiple times in the same sandbox, so care should be taken not to write functions which depend on uninitialized global state and so on.

Every form of this function returns a handle for a job which, when executed, causes *work* to run *n* times and resolve the returned promise with an array of values returned by *work*, indexed by slice number (position within the set), where *n* is parallel the number of elements in the input set.

When the input set is composed of unique primitive values, the array which resolves the promise will also have an own property `entries` method which returns an array, indexed by slice number, which contains a {key: value} object, where key is in the input to *work*, and value is the return value of *work* for that input. This array will be compatible with functions accepting the output of Object.entries() as their input.

The `for` method executes a function, *work*, in the worker by iterating over a series of values. Each iteration is run as a separate task, and each receives a single value as its first argument. This is an overloaded function, accepting iteration information in a variety of ways. When *work* returns, the return value is treated as result, which is eventually used as part of the array or object which resolves the returned promise.

**note** - When *work* is a function, it is turned into a string with `Function.prototype.toString` before being transmitted to the scheduler. This means that *work* cannot close over local variables, as these local variables will not be defined in the worker’s sandbox. They can be provided to the `arguments` argument and will be given to the work function after the iterator value. When *work* is a string, it is evaluated in the sandbox, and is expected to evaluate to a single function.

| Argument | Type | Description |
| --- | --- | --- |
| rangeObject | Object | see Range Objects, below |
| start | Number | the first number in a range |
| stop | Number | the last number in a range |
| step | Number | optional, the space between numbers in a range |
| work | String | the work function to run. If it is not a string, the toString() method will be invoked on this argument. |
| arguments | Object | an optional Array-like object which contains arguments which are passed to the work function |

- **form 1**: `for (rangeObject, work, arguments)` This form accepts a range object *rangeObject*, (see below) and this range object is used as part of the job on the scheduler. What this means is that this form is very efficient, particularly for large ranges, as the iteration through the set happens on the scheduler, and one item at a time. When the range has `{ start:0, step:1 }`, the returned promise is resolved with an array of resultant values. Otherwise, the returned promise is resolved with an object whose keys are the values in the range.
- **form 2a**: `for (start, end, step, work, arguments)` - *start*, *end*, and *step* are numbers used to create a range object. Otherwise, this is the same as form 1.
- **form 2b**: `for (start, end, work, arguments)` - exactly the same as form 2a, except step is always 1.
- **form 3**: `for ({ ranges: [rangeObject, rangeObject...] }, work, arguments)` Similar to form1, except with a multi range object containing an array of range objects in the key *ranges*. These are used to create multi-dimensional ranges, like nested loops. If they were written as traditional loops, the outermost loop would be the leftmost range object, and the innermost loop would be the rightmost range object.

The promise is resolved following the same rules as in form 1, except the arrays/objects nest with each range object. (See examples for more clarity)

- **form 4**: `for (iterableObject, work, arguments)` *iterableObject* could be an Array, ES6 function\* generator, or any other type of iterable object.

*Future Note* - form4 with an ES6 function *job argument presents the possibility where, in a future version of DCP, the protocol will support extremely large input sets without transferring the sets to the scheduler in their entirety. Since these are ES6 function* generators, the scheduler could request blocks of data from the client even while the client is ‘blocked’ in an await call, without altering the API. This means DCP could process, for example, jobs where the input set is a very long list of video frames and each slice represents one frame.

#### Result Handles

Result handles act as a proxy to access the results (a mapping from input set to output set) of a job. The result handle for a job is returned by `exec`, returned by the `complete` event, and located in `job.results`. The result handle is an Array-like object which represents a mapping between slice number (index) and a result. Additional, non-enumerable methods will be available on this object to make marrying the two sets together more straightforward. These methods are are based on methods of `Object`.

- **entries()** - returns an Array of `[input, output]` pairs, in the same order as that the data appear in the input set, where *work* (`input`) yields `output`. If the input to *work* had more than argument, `input` will be an Array that is equivalent to the arguments vector that *work* was called with.
- **fromEntries()** - returns an Object associating `entries()` ’s `input` with `output`, for all elements in the input set where `input` is an ES5 primitive type. In the case where there are key collisions, the key closest to the end of the input set will be used. Equivalent to `Object.fromEntries(results.entries())` (see [https://tc39.github.io/proposal-object-from-entries/](https://tc39.github.io/proposal-object-from-entries/)).
- **keys()** - returns the entire input set, in the order specified when the job was created
- **values()** - returns the entire output set, in the same order as the input set
- **key(n)** - Returns the *n* th item in the input set (e.g. `results.keys[n]`), taking steps to avoid re-generating the entire input set if not necessary.
- **lookupValue(*input*)** - Returns the value corresponding to the value returned from the job for the slice matching *input*. For example, if a *work* function was invoked with the input “blue”, then lookupValue(“blue”) would return the value which that slice returned. If the arguments are not part of the input set, ERANGE is thrown.

When `job.collateResults` was set to `true` (the default), the result handle will be automatically populated with the results as they are computed. Otherwise when `job.collateResults` is `false`, the `fetch` method will have to be used before results are available in the handle. Attempting to access a result before it is in memory will cause an error to be thrown.

There are 4 methods provided for accessing or manipulating results that are stored on the scheduler:

- **list (`rangeObject`)** - returns a Range Object for the slices whose results have been computed and whose slice numbers match the provided ranged object. If no range object is provided, all slices whose results have been computed will be returned.
- **delete (`rangeObject`)** - delete the results currently on the scheduler corresponding to the slices whose slice numbers match the provided ranged object. If no range object is provided, all results which have been computed will be deleted from the scheduler.
- **fetch (`rangeObject`, `emitEvents`)** - fetches results from the scheduler corresponding to the slices whose slice numbers match the provided ranged object (or all if not provided). The fewtched results will be populated onto the result handle. If `emitEvents` is true, `result` events will be emitted for every slice that wasn’t already present in the result handle, and if `emitEvents` is “all” then a `result` event will be emitted for every slice.
- **stat (`rangeObject`**) - returns a set of objects for the slices on the scheduler corresponding to the slices whose slice numbers match the provided ranged object. The set will have the same API as an output set, but rather than the results for a *work* function, each element of the set will be an object with the following properties:
	- *distributedTime*: the timestamp documenting when the slice was initially distributed to a Worker
		- *computedTime*: the timestamp document when the scheduler received the result for this slice
		- *payment*: the amount of DCC which was charged to the payment account to compute this slice

### compute.status

This function allows the client to query the status of jobs which have been deployed to the scheduler.

- **form 1**: `compute.status(job)`: returns a status object describing a given job. The argument can be either a job Id or a Job Handle.
- **form 2**: `compute.status(paymentAccount, startTime, endTime)`: returns an array of status objects corresponding to the status of jobs deployed by the given payment account. If startTime is specified, jobs older than this will not be listed. If endTime is specified, jobs newer than this will not be listed. startTime and endTime can be either the number of milliseconds since the epoch, or instances of `Date`. The paymentAccount argument can be a Keystore object, or any valid argument to the Keystore constructor (see: Wallet API).

### compute.getJobInfo

This async function accepts job Id as its argument and returns information and status of a job specified with jobID.

### compute.getSliceInfo

This async function accepts job Id as its argument and returns status and history of a slice(s) of the job specified with jobID.

### compute.marketRate

This function allows the client to specify “going rate” for a job, which will be dynamically set for each slice as it is paid out.

**NYI:** For now the scheduler will use 0.0001465376 DCC as the market rate, multiplied by the factor if provided.

- **form 1**: `compute.marketRate`: Using marketRate as a property will use the most recent market rate for each slice
- **form 2**: `compute.marketRate(factor = 1.0)`: Calling marketRate as a function will cause the job to use the daily calculated rate, multiplied by the provided factor.

### compute.getMarketValue

This function returns a promise which is resolved with a signed WorkValueQuote object. This object contains a digital signature which allows it to be used as a firm price quote during the characterization phase of the job lifecycle, provided the job is deployed before the quoteExpiry and the CPUHour, GPUHour, InputMByte and OutputMByte fields are not modified. This function ensures the client developer’s ability to control costs during job characterization, rather than being completely at the mercy of the market. **Note:** Market rates are treated as spot prices, but are calculated as running averages.

### compute.calculateSlicePayment

This function accepts as its arguments a SliceProfile object and a WorkValue object, returning a number which describes the payment required to compute such a slice on a worker or in a market working at the rates described in the WorkValue object. This function does not take into account job-related overhead.

```javascript
job.setSlicePaymentOffer(1.0001 * compute.calculateSlicePayment(job.initialSliceProfile, await job.scheduler.getMarketRate()))
```

## Data Types

### Range Objects

Range objects are vanilla ES objects used to describe value range sets for use by `compute.for()`. Calculations made to derive the set of numbers in a range are carried out with BigNumber, eg. arbitrary-precision, support. The numbers Infinity and -Infinity are not supported, and the API does not differentiate between +0 and -0.

Describing value range sets, rather than simply enumerating ranges, is important because of the need to schedule very large sets without the overhead of transmitting them to the scheduler, storing them, and so on.

Range Objects are plain JavaScript objects with the following properties:

- `start`: The lowest number in the range
- `end`: The highest number in the range
- `step`: The increment used between iterations, to get from start to end.
- `group`: The number of consecutive elements in the range which will be processed by each slice. If this value is specified, even if it is specified as 1, the function called in the sandbox (eg. *work*) will receive as its argument an array of elements in the set as its input. When this value is not specified, the function called in the worker sandbox will receive a single datum as its input.

When `end - start` is not an exact multiple of `step`, the job will behave as though `end` were the nearest number in the range which *is* an even multiple of step, offset by start. For example, the highest number generated in the range object `{start: 0, end: 1000, step: 3}` would be 999.

#### Sparse Range Objects

Range Objects whose values are not contiguous are said to be sparse. The syntax for specifying a sparse range object is

```javascript
{ sparse: [range object, range object...]}
```

Any range object can be used in the specification of a sparse range object, except for a sparse range object.

### Distribution Objects

Distribution objects are used with `compute.for`, much like range objects. They are created by methods of the set exports of the stats module, and are used to describes input sets which follow common distributions used in the field of statistics. The following methods are exported:

- **normalRNG(n, x̄, σ)** – generates a set of numbers arranged in a normal distribution, where – *n* represents the size of the set – *x̄* represents the mean of the distribution – *σ* represents the standard deviation of the distribution
- **random(n, min, max)** – generates a set of randomly-distributed numbers, where – *n* represents the size of the set – *min* represents the smallest number in the set – *max* respresents the smallest number which is greater than *min* but not in the set
- **randomInt(n, min, max)** – generates a set of randomly-distributed integers, where – *n* represents the size of the set – *min* represents the smallest number in the set – *max* respresents the smallest number which is greater than *min* but not in the set

```javascript
let stats = require('stats')
let job = compute.for(stats.set.normalRNG(10, 100, 0.2), (i) => i)
```

### Job Handles

Job handles are objects which correspond to jobs, and are instances of `compute.Job`. They are created by some exports of the compute module, such as `compute.do` and `compute.for`.

#### Properties

- **requirements** - A object describing the requirements that workers must have to be eligible for this job. See section *Requirements Objects*.
- **initialSliceProfile** - an object describing the cost the user believes each the average slice will incur, in terms of CPU/GPU and I/O (see: *SliceProfile Objects*). If defined, this object is used to provide initial scheduling hints and to calculate escrow amounts.
- **slicePaymentOffer** - an object describing the payment the user is willing to make to execute one slice of the job. See section *PaymentDescriptor Objects*.
- **paymentAccount** - a handle to a Keystore Object that describes a bank account which is used to pay for executing the job.
- **work** - an EventEmitter object with emits arbitrary events that are triggered by the *work* (user code running in a sandbox).
- **requirePath** - initially initialized as an empty array, this object is captured during deployment, and is pushed on to `require.path` in the worker before *work* is evaluated in the main module.
- **modulePath** - initially initialized as an empty array, this object is captured during deployment, and is pushed on to `module.path` in the sandbox’s main module before *work* is evaluated in the main module.
- **collateResults** - when this property is false, the job will be deployed in such a way that results are not returned to the client unless explicitly requested (e.g. via the `result` event listener or the `results` method of the job handle). Changing this property after the job has been deployed has no effect.
- **status** - an object having the properties `runStatus`, `total`, `distributed`, and `computed`. This object reflects a “live status” while the job handle is awaiting the `exec` Promise resolution/rejection.
	- `runStatus`: The current run status of the job.
		- `total`: Once the job is ready (payment authorized, etc), this value represents the total number of slices; until the job is ready, this value will be undefined.
				- `distributed`: The total number of unique slices that have been sent to Workers for computation.
				- `computed`: The total number of slices in this job for which the scheduler has results.
- **public** - an object describing the properties used to describe and label the work when it is deployed, it contains the following properties:
	- `name`: A string containing the name of the job, this is displayed on the progress bar in the browser worker.
		- `description`: A string containing a description of the job, this is displayed when a browser worker user hovers over the progress bar for a job.
		- `link`: A string containing a URL for providing more info about the job, browser worker users can visit the URL by clicking on the job row. (May be deprecated)
- **contextId** - An optional string identifier. This can be used to indicate to caching mechanisms that keystores with the same name are different. For example, if several “default” keystores must be used for different jobs, `contextId` should be set to a different string on each job to prevent incorrect caching.
- **scheduler** - an instance of URL object defining the location of the scheduler on which the job is to be deployed. If not specified, the value used will be `dcpConfig.scheduler.location`.
- **bank** - an instance of URL object defining the location of the bank. If not specified, the value used will be `dcpConfig.bank.location`. Note that this must correspond to the bank used by the scheduler or the job will be rejected.

##### Present once job has been deployed

- **id** - a unique string assigned by the scheduler which can be used to resume or cancel the execution of a previously-deployed job.
- **receipt** - a cryptographic receipt indicating deployment of the job on the scheduler
- **meanSliceProfile** - a SliceProfile object which contains the average costs for the slices which have been computed to date. Until the first result is returned, this property is undefined.
- **results** - a Result Handle object used to query and manipulate the output set. (See \*Result Handles)

#### Methods

- **cancel** - Cancel the job. This method returns a promise which is resolved once the scheduler acknowledges the cancellation and has transitioned to a state where no further costs will be incurred as a result of this job.
- **resume** - Ask the scheduler to resume distributing slices for the job. This method returns a Promise which will resolve once the scheduler has resumed distributing slices, or may reject with an error indicating why it was unable to resume (eg. ENOFUNDS if there are not enough credits escrowed).
- **exec** - tells the scheduler to deploy the job. This method accepts arguments `slicePaymentOffer`, `paymentAccount` and `initialSliceProfile`, which, when not undefined, update the related properties of the JobHandle. `paymentAccount` can be any valid argument to the `wallet.Keystore` constructor.  
	This method returns a promise which is resolved with a result handle once the scheduler notifies the client that the job is done via the `complete` event.  
	Additionally, calling this on a job that is already deployed will fetch the partially or fully computed results if `collateResults` is set to true. Otherwise, `job.results.fetch` will need to be called to access the results stored on the Distributed Computer.  
	This method can reject the promise with errors from the scheduler. Any of the errors below imply that the scheduler has paused the job:  
	ENOFUNDS - insufficient credit in the account associated with the payment account. This error can happen immediately upon deployment, or partway through the job if the scheduler discovers that tasks are using more compute than estimated and it needs to re-escrow. Calling `exec` on this JobHandle after an ENOFUNDS error will cause the scheduler to attempt to resume the job as described above. If the promise is rejected with the errors below, the scheduler has cancelled the job:  
	ENOPROGRESS - the scheduler has determined that too many sandboxes are not receiving regular progress update messages, are receiving invalid progress messages, or that tasks are completing without emitting at least one progress update message.  
	ETOOMANYTASKS - the scheduler has determined that this job exceeds the maximum number of allowable tasks per job  
	EWORKTOOBIG - the scheduler has determined that the combined size of the work function and local modules associated with this job exceeds the maximum allowable size  
	ETOOBIG - the scheduler has determined that this job exceeds the maximum allowable amount of work  
	ESLICETOOSLOW - the scheduler has determined that individual tasks in this job exceed the maximum allowable execution time on the reference core  
	ETOOMANYERRORS - the scheduler has determined that too many work functions are terminating with uncaught exceptions for this job  
	Any other rejections should be treated as transient errors, and client developers should assume that the results could be retrieved eventually by calling `await compute.resume(job.id).exec()`. These transient errors include, but are not limited to:  
	EPERM - client tried to do something prohibited, such as updating the payment account of a job.
- **localExec**: This function is identical to *exec*, except that the job is executed locally, in the client. It accepts one argument, `cores`. If cores is false, the execution will happen in the same JavaScript context as the client. Otherwise, cores is interpreted as the number of local cores in which to execute the job. Local modules will be loaded using regular filesystem semantics; modules which originate in packages will be loaded from the module server associated with the current scheduler.
- **requires**: This function specifies a module dependency (when the argument is a string) or a list of dependencies (when the argument is an array) of the *work* function. This function can be invoked multiple times before deployment. See the *Modules and Packages* section for more information.
- **estimate**: This function returns a promise which is resolved with a SliceProfile object describing the resources consumed to run one slice of the job. The function accepts as its sole argument a sample datum, which may or may not be actual data from the input set. If no argument is specified, the first element of the input set will be used for the calculation.
- **setSlicePaymentOffer**: Set the payment offer; i.e. the number of DCC the user is willing to pay to compute one slice of the job. This is equivalent to the first argument to `exec`. When this method is called for a job which is already deployed, any changes to the slice payment offer will be transmitted to the scheduler, and the scheduler will apply them *on a best-effort basis to slices dispatched after the change request*. Note that a new payment offer will generally cause the scheduler to alter the quantity of DCC currently in escrow for that job, which can cause the job to emit the ENOFUNDS event. *There is no guarantee that changes to the slice payment offer will occur immediately.*
- **setPaymentAccountKeystore**: Set the payment account. This is equivalent to the second argument to `exec`. Setting the payment account after the initial call to `exec` will throw EPERM in the setter.

#### Events

The JobHandle is an EventEmitter (see *EventEmitters*, below), and it can emit the following events:

- **accepted** - fired when job is deployed. Returns:

```javascript
{
    job // original object that was delivered to the scheduler for deployment
}
```

- **cancel** - fired when job is cancelled
- **result** - fired when a result is returned. Returns:

```javascript
{
    address, // address (id) of the job
    task, // the address of the task (slice) that the result came from
    sort, // the index of the slice
    result: {
        request: 'main',
        result, // value returned
    }
}
```

- **resultsUpdated** - fired when the result handle is modified, either when a new `result` event is fired or when results are populated with `resultHandle.fetch()`
- **complete** - fired when the job has finished running. Returns: The result handle for the job.
- **status** - fired when a status update is received. Returns:

```javascript
{
  address, // address (id) of the job
  total, // total number of slices
  distributed, // number of slices that have been distributed
  computed, // number of slices that have returned a result
  runStatus, // the job's run status before any updates from a status event
}
```

- **error** - fired when a slice throws an error and fails to complete. Returns:

```javascript
{
  address, // address (id) of the job
  sliceIndex, // the index of the slice that threw the error
  message, // the error message
  stack, // the error stacktrace
  name, // the error name
}
```

- **console** - fired when `console.log` (or info, debug, warn, error) is called from within the work function. Returns:

```javascript
{
  address, // address (id) of the job
  sliceIndex, // the index of the slice that produced this event
  level, // the log level, one of 'debug', 'info', 'log', 'warn', or 'error'
  message, // the console log message
}
```

**Note**: In the case where the most recent message is identical to the message that is about to be emitted, the message is not emitted, but rather a “same” counter is incremented. Eventually, a `console` event on the JobHandle will be emitted; this event will have the sole property same, having the value of the “same” counter. This will happen when a new, different, message is logged, the worker terminates, or a progress update event is emitted; whichever comes first.

- **noProgress** - fired when a slice is stopped for not calling progress. Contains information about how long the slice ran for, and about the last reported progress calls. Returns:

```javascript
{
  address, // address (id) of the job
  sliceIndex, // the index of the slice that failed due to no progress
  timestamp, // how long the slice ran before failing
  progressReports: {
    last: { // The last progress report received from the worker
      timestamp, // time since start of slice
      progress, // progress value reported
      value, // last value that was passed to the progress function
      throttledReports, // number of calls to progress that were throttled since last report
    },
    lastUpdate: { // The last determinate (update to the progress param) progress report received from the worker
      timestamp,
      progress,
      value,
      throttledReports,
    }
  }
}
```

- **noProgressData** - Identical to `noProgress`, except that it also contains the data that the slice was executed with. Returns:

```javascript
{
  ...{ noProgress event },
  data, // the data that the slice was executed with
}
```

- *Error Statuses* - Any of the scheduler errors listed above in *Job Methods* will be emitted from the job handle.

The jobHandle’s `work` property is also an EventEmitter, which will emit custom events from the work function.

### Worker Environment

Work functions (i.e. the final argument to `compute.for()` are generally executed in sandboxes inside workers. These are the functions which map the input set to the output set.

Each work function receives as its input one element in the input set. Multi-dimensional elements, such as those defined in `compute.for() form 3`, will be passed as multiple arguments to the function. The function returns the corresponding output set element, and *must emit progress events*.

The execution environment is based on CommonJS, providing access to the familiar `require()` function, user-defined modules, and modules in packages deployed on Distributed Compute Labs’ module server. Global symbols which are not part of the ECMA-262 specification (such as `XmlHTTPRequest` and `fetch`) are not available.

#### Global Symbols

- **OffscreenCanvas** – As defined in the HTML Standard, provides a canvas which can be rendered off-screen. If this interface is not available in a given worker, the worker will not report capability “offscreenCanvas”.
- **progress(n)** – a function that returns `true` and which accepts as its sole argument a number between 0 and 1 (inclusive) that represents a best-guess at the completed portion of the task as a ratio of completed work to total work. If the argument is a string ending in the `%` symbol, it will be interpreted as a number in the usual mathematical sense. If the argument is undefined, the slice progress is noted but the amount of progress is considered to be indeterminate.  
	This function emits a progress event. Progress events should be emitted approximately once per second; a task which fails to emit a progress event for a certain period of time will be cancelled by the supervisor. The argument to this function is interpreted to six significant digits, and must increase for every call. *All work functions must emit at least one progress event* - this requirement will be enforced by the estimator.
	- The period of time mentioned above will be at least 30 wall-clock seconds and at least 30 benchmark-adjusted seconds
- **console.log()** – a function which emits `console` events on the JobHandle. See
- **console.debug()** – exactly the same as `console.log()`, except with *level* = “debug”
- **console.info()** – exactly the same as `console.log()`, except with *level* = “info”
- **console.warn()** – exactly the same as `console.log()`, except with *level* = “warn”
- **console.error()** – exactly the same as `console.log()`, except with *level* = “error”. **note** - some ES environments (Chrome, Firefox) implement C-style print formatting in this method. This is currently not supported.
- **work** – an object that contains the following properties:
	- **emit()** – emit an arbitrary event, which will be fired by the *work* object on the JobHandle in the client. The first argument to this function is the event name; the second argument becomes the value passed to the event handler in the client. **Note** - only values which can be represented in JSON are supported.
		- **job** - an object with additional data about the job
		- **public** - The `public` data object that the job was created with, has properties `name`, `description`, and `link`

## Requirements Objects

Requirements objects are used to inform the scheduler about specific execution requirements, which are in turn used as part of the capabilities exchange portion of the scheduler-to-worker interaction.

Boolean requirements are interpreted as such:

- if true, that capability *must* be present in the worker
- if false, that capability *must not* be present in the worker

In the example above, only workers with a GPU, running ES7 on SpiderMonkey using fdlibm library would match. In the example below, any worker which can interpret ES7 but is not SpiderMonkey will match:

```javascript
let requirements = {
  engine: {
    es2019: true,
    spidermonkey: false
  }
}
```

### Requirements Object Properties

- `environment.fdlibm`: Workers express capability ‘fdlibm’ in order for client applications to have confidence that results will be bitwise identical across workers. This library is recommended, but not required, for implementaiton of Google chrome, Mozilla Firefox and the DCP standalone worker use fdlibm but Microsoft Edge and Apple Safari do not use it.
- `environment.offscreenCanvas`: When present, this capability indicates that the worker environment has the OffscreenCanvas symbol defined.
- `details.offscreenCanvas.bigTexture4096`: This capability indicates that the worker’s WebGL MAX\_TEXTURE\_SIZE is at least 4096.
- `details.offscreenCanvas.bigTexture8192`: This capability indicates that the worker’s WebGL MAX\_TEXTURE\_SIZE is at least 8192.
- `details.offscreenCanvas.bigTexture16384`: This capability indicates that the worker’s WebGL MAX\_TEXTURE\_SIZE is at least 16384.
- `details.offscreenCanvas.bigTexture32768`: This capability indicates that the worker’s WebGL MAX\_TEXTURE\_SIZE is at least 32768.
- `engine.es7`: This capability enforces that the worker is running an es7-compliant JavaScript engine.
- `engine.spidermonkey`: The capability enforces that the worker will run in the SpiderMonkey JS engine.

## GPUs

DCP supports [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) and plans on supporting [WebGPU](https://gpuweb.github.io/gpuweb/). This functionality can be used by setting the `gpu` flag listed under.

## EventEmitters

All EventEmitters defined in this API will be bound (i.e. have `this` set) to the relevant job when the event handler is invoked, unless the event handler has previously been bound to something else with bind or an arrow function.

The EventEmitters have the following methods:

- **on** `(eventName, listener)`: execute the function *listener* when the event *eventName* is triggered.
- **addListener** `(eventName, listener)`: same as *on*
- **addEventListener** `(eventName, listener)`: same as *on*
- **removeListener** `(eventName, listener)`: remove an event listener which has been attached with *on* or one of its synonyms.
- **removeEventListener** `(eventName, callback)`: same as *removeListener*
- **listenerCount** `(eventName)`: returns a count of the number of listeners registered for `eventName`.

## Modules

The *work* specified by the `JobHandle.exec` method can depend on modules being available in the sandbox. This will be handled by automatically publishing all of the modules which are listed as relative dependencies of the job. Client developers can assume that dependencies loaded from the require.path are part of pre-published packages.

The DCP developer ecosystem offers the ability to run CommonJS-style modules and pure-ES NPM packages seamlessly and without transpilation steps on the following host environments

- arbitrary web document
- arbitrary web worker
- DCP sandbox
	- NodeJS

For more information, see the DCP Modules document.

### Appliances

Future versions of DCP will expand the Appliance concept to include the ability to support licensing and royalties. For example, developers will be able to publish appliances which

- may only be executed by users holding the correct (chainable, revocable) cryptographic key
- cause a payment to the Appliance author for each job deployed
- cause a payment to the Appliance author for each slice computed

### Appliance Handles

Appliance handles are objects which correspond to appliances. They are created by instantiating the `compute.Appliance` class.

#### Constructor

The Appliance constructor is an overloaded object which is used for defining/publishing appliances and referencing appliances on the scheduler.

##### new Appliance() - form 1 - preparing to publish

This form of the constructor is used for creating/publishing appliances. It accepts three arguments: *applianceName*, *version*, and *publishKeystore*.

- **applianceName** - this is a user-defined string, such as “ffmpeg-util”, which is used to reference the appliance on the Distributed Computer. It must be unique across the network.
- **version** - this is the version number of the appliance that is being defined, represented as a string (e.g. “1.0.0”). The Compute API uses the same version number scheme as npm. It is an error to use the same version number twice for the same appliance under any circumstance.
- **publishKeystore** - this is the keystore whose key is used to sign the appliance. If any version of the appliance has been published on a scheduler, only new versions of that appliance signed by the same key will be accepted for publication.

##### new Appliance() - form 2 - published appliance

This form of the constructor is used to access functions which have already been published. It accepts two arguments: *applianceName*, and *version*.

- **applianceName** - this is a user-defined string, such as “ffmpeg-util”, which is used to reference the appliance on the Distributed Computer.
- **version** - this is a string describing the version of the appliance that the client application developer wants to use. The Compute API supports the same syntax as npm uses in package.json, including the `"^1.0.0"` and `"#versionIdHexString"` forms.

#### Methods

##### For new appliances

- **publish** - Request publication of an appliance on the connected scheduler. Returns a promise which is an object having the following properties:
	- **versionId** - a unique hex string assigned by the scheduler which uniquely identifies this version of this appliance. Prepending this string with an octothorpe will make it a valid argument for the *version* property of the Appliance constructor, referencing exactly this version of the code.
		- **receipt** - a cryptographic receipt indicating that the appliance has been submitted for publication to the scheduler.
		- **cost** - the number of DCCs the publish wallet was debited for this transaction

All properties of an appliance must be redefined when a new version is published. Publish may reject the promise with the following errors:

- ENAMESPACE - The appliance name has already been reserved
- EEXIST - This version has already been published
- EWORKTOOBIG - the combined size of the functions and local modules associated with this appliance exceeds the maximum allowable size
- ENOFUNDS - insufficient credit in the account associated with the publish wallet
- **refund** - accepts as its sole argument the object that *publish* resolved its promise with. This causes the scheduler to un-publish the appliance and refund the DCCs used to publish it. This action must be performed before the appliance has been used by a job, or 24 hours, whichever comes first.
- **defineFunction** - Define a function in the appliance, return an instance of JobHandle and accepting four arguments:
	- the function’s name
		- its implementation, with identical semantics to the *work* function in a job (see: `compute.for()`)
		- an Estimation Function (see below)
		- a slice profile object, used as the baseSliceProfile for the Estimation Function. Any changes to the `requirePath` or `modulePath` properties on this object will be stored during *publish()* and will be reflected automatically when the function is used in a job.
- **requirePath** - initially initialized as an empty array, this object is captured during *publish()*, and is pushed on to `require.path` in the worker before requirePath is adjusted for the function (see *requirePath* in the Job Handles section)

##### For deployed appliances

- **do** - same as `compute.do`, except instead of a function *work*, name of the function within the appliance is specificed. Returns an instance of JobHandle.
- **for** - same as `compute.for`, except instead of a function *work*, the name of the function within the appliance is specified. Returns an instance of JobHandle.

##### Properties

- **id** - a unique string assigned by the scheduler which uniquely identifies this appliance.
- **versionId** - a unique string assigned by the scheduler which uniquely identifies this version of this appliance; same as the string returned during the *publish()* phase.

###### These properties are optional, public, and probably displayed or used during mining

- **hashTags** - meta data about the Appliance, used by workers. Comma-separated strings
- **name** - human-readabled appliance name
- **description** - human-readable description of the appliance
- **author** - author name
- **organization** - author’s organization (e.g. university, employer, etc)
- **email** - author’s email address
- **website** - website related to the appliance

### Estimation Functions

Estimation functions are used by the scheduler to characterize slices derived from Appliances based on knowledge of the input set, without actually performing any work.

An estimation function receives as its arguments the first element in the input set for a given job, followed by any work function arguments. The function must return an object whose properties are numbers which represent linear scaling factors for the various resources (cpuHours, gpuHours and outputBytes) as defined in the baseSliceProfile. The inputBytes element is not used here as the Scheduler has the means to calculate that directly on a per-slice basis.

An undefined estimation function or estimation function result causes the work to deployed as though it came from an ad-hoc job.

Estimation functions which routinely yield slice characterizations bearing no resemblance to reality will eventually be blacklisted from the network; if the publishKeystore happens to be an Identity on the Distributed Computer, that person will be notified when the blacklisting happens.

## SlicePaymentDescriptor Objects

SlicePaymentDescriptor are used to describe the payment that the user is offering to compute one (each) slice of the job. The Compute API defines three **fixed value** descriptors for use by DCP users; other descriptors can be specified as SlicePaymentDescriptor objects. The fixed value profiles are

- *Number literal* - request computation at that value per slice; i.e. `0` requests free computation and `100` offers to pay 100 DCC per slice.
- *`compute.marketValue`* - request computation of the entire job at market value (as of the time when the job is executed), with ***no upper limit whatsoever***.
- *`compute.marketValue(ratio, max)`* - request computation at market value multiplied by *ratio*, with an upper limit per slice of *max* DCC. In this case, the market value used is from a snapshot taken at a regular interval; this is to prevent run-away valuation when *ratio*!= 1 and the job dominates the scheduler’s work.

SlicePaymentDescriptor objects have the following properties:

- **offerPerSlice** – the payment a user is offering to compute one (each) slice of the job.

Any interface which accepts a SlicePaymentDescriptor object (e.g. `exec()`) must also handle literal numbers, instances of Number, and BigNums. When a number is used, it is equivalent to an object which specifies *offerPerSlice*. i.e., `.exec(123)` is the same as `.exec({ offerPerSlice: 123 })`

## Shared State

There is an object which is available as the `state` property of the global `worker` object in sandboxes, and the `state` property of the job handle in clients. The data stored in this object is without restriction, except that

1. It must be compatible with JSON
2. Properties must not collide with methods defined by this specification

When the sandbox is first initialized for a given job, the object will be set to the current state of the object stored by the scheduler. The live object may be re-used by subsequent slices for the same job which are executed on the same worker, *even if no synchronization methods were invoked*.

### Synchronization

The arbiter of state is the scheduler. Updates to the state object happen asynchronously on the network, but this API provides some synchronization primitives which are processed at the scheduler.

There is no synchronization by default. A worker that mutates the state object without invoking a synchronization method will not have its changes propagated back to the scheduler.

- **set `()`** — this method sends the current state object to the scheduler
- **set `("max", "prop")`** — this invocation replaces the object at the scheduler when the value of the property named `prop` is bigger than the same-named value in the object stored by the scheduler. The ‘bigger’ comparison is made with the > operator.
- **set `("min", "prop")`** — this invocation replaces the object at the scheduler when the value of the property named `prop` is smaller than the same-named value in the object stored by the scheduler. The ‘smaller’ comparison is made with the < operator.
- **set `("operator", "prop")`** — this invocation replaces the object at the scheduler when comparing the value of the property named `prop` with the same-named value in the object stored by the scheduler is true. Only the following operators are supported: <, >, <=, >=, ==,!=
- **testAndSet `()`** — - this method performs a test-and-set operation on the scheduler. It supports exactly the same syntax as the *set()* method, but is an async function that returns a Promise which is resolved with a snapshot of the object at the scheduler before the replacement was made, or `false` if no replacement was made.
- **increment `("prop", n)`** — - this method increments the property named `prop` in the state object on the scheduler by *n* with the += operator. The default value for n is 1. Negative values are supported.

### Events

The state object is an EventEmitter. In the client, `this` is set to the JobHandle. The object can emit the following events:

- **change** - This event is emitted immediately after the state object in memory has been modified by virtue of having received a state change message from the scheduler.
- **workFunctions**

*Note*: The scheduler does not transmit state synchronization events to clients or workers that are not listening for them.

#### Example

```javascript
const paymentAccount = keystore.getWallet()

let job = compute.for(1, 2000, (i) => {
  let test
  lt best = worker.state.best

  worker.state.addEventListener("change", () => best = worker.state.best)
  for (let x=0; x < i; x++) {
     test = require('./refiner').refine(x, i)
     if (test < best) {
       worker.state.best = test
       worker.state.set("min", "best")
     }
     progress(x/i)
  }
})
job.state.best = Infinity
let results = await job.exec()
console.log("The best result was: ", job.state.best)
```

## Distributed Computer Wallet

The Distributed Computer acts as a wallet for two types of keys; “Identity” and “Bank Account”. Identity keys identify an individual; Bank Account keys identify accounts within the DCP bank and the DCC contract on the Ethereum network.

The preferred way to exchange keys between DCP client appliance, configuration files, end users, etc, is to use encrypted keystores. Distributed Compute Labs strongly discourages developers from writing code which requires users to possesses private keys, or enter passphrases to unlock to non-proxy keystores.

For more information, see the Wallet API and Proxy Keys documents.

## Example Programs

All example programs are written for operation within any of the environments supported by DCP-Client, provided they are surrounded by appropriate initialization code for their respective environments.

### NodeJS

```javascript
async function main() {
  const compute = require('dcp/compute');
  const wallet = require('dcp/wallet');

  /* example code goes here */
}

require('dcp-client').init().then(main).finally(() => setImmediate(process.exit));
```

### Vanilla Web

```html
<html><head>
  <script src="https://scheduler.distributed.computer/dcp-client.js"></script>
</head>
<body onload="main();">
<script>
  async function main() {
    const { compute, wallet } = dcp;
    /* example code goes here */
  }
</script>
</body>
</html>
```

### 1\. compute.for() form 2b

```javascript
let job = compute.for(1, 3, function (i) {
  progress('100%');
  return i*10;
})
let results = await job.exec(compute.marketPrice);
console.log('results:    ', results);
console.log('entries:    ', results.entries());
console.log('fromEntries:', results.fromEntries());
console.log('keys:       ', results.keys());
console.log('values:     ', results.values());
console.log('key(2):     ', results.key(2));
```

Output:

```javascript
results:     [ 10, 20, 30 ]
entries:     [ [ '1', 10 ], [ '2', 20 ], [ '3', 30 ] ]
fromEntries: { '1': 10, '2': 20, '3': 30 }
keys:        [ '1', '2', '3' ]
values:      [ 10, 20, 30 ]
key(2):      20
```

### 2\. compute.for() form 1, step overflow

```javascript
const paymentAccount = keystore.getWallet();
let job = compute.for({start: 10, end: 13, step: 2}, (i) => progress(1) && i);
let results = await job.exec();
console.log(results)
```

Output: `[ 10, 12 ]`

### 3\. compute.for() form 1 with group

```javascript
let job = compute.for({start: 10, end: 13, group: 2}, (i) => progress(1) && i[1]-i[0]);
let results = await job.exec();
console.log(results);
```

Output: `[ 1, 1 ]`

### 4\. compute.for() form 3

```javascript
let job = compute.for([{start: 1, end: 2}, {start: 3, end: 5}], 
                       (i,j) => (progress(1), i*j));
let results = await job.exec();
console.log(results);
```

Output: \[\[3, 4, 5\], \[6, 8, 10\]\]

### 5\. compute.for(), form 3

```javascript
let job = compute.for([{start: 1, end: 2}, {start: 3, end: 5}], function(i,j) {
  return [i, j, i*j];
})
let results = await job.exec();
console.log(results);
```

Output: \[\[\[1, 3, 3\], \[1, 4, 4\], \[1, 5, 5\]\], \[\[2, 3, 6\], \[2, 4, 8\], \[2, 5, 10\]\]\]

### 6\. compute.for() form 4

```javascript
let job = compute.for([123,456], function(i) { 
  progress(1);
  return i;
})
let results = await job.exec();
console.log(results);
```

Output: `[ 123, 456 ]`

### 7\. Typical ENOFUNDS hander

```javascript
job.on("ENOFUNDS", (fundsRequired) => {
  await job.escrow(fundsRequired);
  job.resume();
})
```