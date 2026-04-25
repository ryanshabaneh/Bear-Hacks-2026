## Worker API

This API is used to instantiate DCP workers, which will perform compute tasks on the network in exchange for DCCs.

**Record of Issue**

## Glossary

- **Worker** - The Worker is an entity representing a supervisor and any number of sandboxes. It connects to the distributed computer and performs work by assigning slices to sandboxes.
- **Supervisor** - The supervisor is the entity responsible for managing sandboxes within the worker.
- **Sandbox** - A sandbox is the environment in which a slice is computed. The supervisor instantiates and terminates these sandboxes, and assigns it work to be computed. A sandbox could be a web worker, a standalone V8 environment, or any other interface that implements the WebWorker spec.

## Worker API

The Worker class is an [EventEmitter](https://nodejs.org/docs/latest/api/events.html) instance, and it emits events that can be listened to with the standard EventEmitter methods. See for the events it emits.

### Constructor

#### new Worker(options: object)

This contstructor instantiates a worker using the provided options object. `options: object`:

- `paymentAddress?: string | Keystore`: Address used for depositing DCCs in after a slice is computed, will default to `(await wallet.get()).address`
- `identityKeystore?: Keystore`: Keystore that will be used as the identity when communicating with the scheduler, will default to `wallet.getId()`
- `schedulerURL?: URL | string`: URL to use when connecting to the scheduler, defaults to `dcpConfig.scheduler.location`.
- `jobAddress?: string`: When provided, this worker will only compute slices for the provided job. The job must have been deployed with the local exec flag set.
- `maxWorkingSandboxes: number = 1`: Maximum number of sandboxes that can be working at one time.
- `minimumWage?: object`: When provided, it refers to the minimum payout per slice the worker will accept from a job. Actually, the worker can decide how much it wants to charge for different types of measurement:
	- `CPU: number`: DCC per second of CPU time.
		- `GPU: number`: DCC per second of GPU time.
		- `input: number`: DCC per byte of inbound network traffic, that includes the bytes of slice input, arguments, work function, and modules.
		- `output: number`: DCC per byte of outbound network traffic, that includes the bytes of console messages and results.
- `sandboxOptions: object`:
	- `SandboxConstructor: constructor`: Constructor for the sandbox environment, it should implement the [WebWorker API](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker). When not provided in the browser, it will default to the global `Worker` constructor.
		- `ignoreNoProgress: boolean = false`: When true, the sandbox will ignore errors from the sandbox not firing progress events.

### Methods

#### worker.start(): Promise<void>

This method will start the worker. It will begin to fetch work from the supervisor and submit the computed results automatically. It will throw if the worker is already started.

#### worker.stop(immediate: boolean = false): Promise<void>

This method will stop the worker. If the `immediate` flag is true, the worker will terminate all working sandboxes without waiting for them to finish working.

Implementation note: This method should wait for the remaining sandboxes to finish before resolving when `immediate` is false. At the moment it will resolve after terminating the idle workers then `immediate` is true.

#### Worker.disableWorker()

This static method will set a key in local storage (or on the file system on Node) to disable the worker. The user will need to manually intervene before the worker can be started again.

### Properties

- `worker.working: boolean`: This boolean indicates the current status of the worker. It should not be set manually.
- `worker.supervisor: Supervisor`: The internal supervisor instance.
- `worker.schedMsg: SchedMsg`: The internal schedMsg client instance. Custom behaviour for schedMsg commands can be provided on this object, see.

### Events

- `start`: Emitted when the worker is started.
- `stop`: Emitted when the worker is stopped.
- `sandbox`: Emitted when the worker instantiates a new sandbox. The argument provided to the callback is the `Sandbox` instance.
- `payment`: Emitted when the worker submits a result. Contains the value of DCC earned.
	- **Payload Object:**
		- `accepted: boolean`: Whether or not the slice was accepted, payment value will be 0 if not accepted.
				- `payment: string`: String representation of the DCC value that was paid out.
				- `reason: string`: Reason string for why the slice was accepted/rejected.
				- `paymentAddress: string`: Bank address that the payment was sent to.
- `fetchStart`: Emitted when the worker starts a request to fetch slices from the scheduler.
- `fetchEnd`: Emitted when the worker’s slice fetch request is finished, on both success and error. If it was emmitted due to an error, the callback argument will be the error instance.
- `fetch`: Emitted when the worker successfully fetches slices from the scheduler.
- `fetchError`: Emitted when the worker’s slice fetch request returns an error. The callback argument is the error instance.
- `submitStart`: Emitted when the worker starts a request to submit a result to the scheduler.
- `submitEnd`: Emitted when the worker’s result submit request is finished, on both success and error. If it was emitted due to an error, the callback argument wil be the error instance.
- `submit`: Emitted when the worker successfully submits a result to the scheduler.
- `submitError`: Emitted when the worker’s result submit request returns an error. The callback argument is the error instance.

## Sandbox API

The Sandbox is also an [EventEmitter](https://nodejs.org/docs/latest/api/events.html). See below for the events it provides.

### Events

- `sliceStart`: Emitted when the sandbox begins working on a slice.  
	**Payload Object:**
	- `job: object`: The job description object. Use `job.public` for accessing the job’s title/description.
- `sliceFinish`: Emitted when the sandbox completes the slice it was working on. The callback argument is an object containing the job address, slice number, and the time report of the slice.
- `sliceError`: Emitted when the slice the sandbox was working on throws an error. The first argument is the same payload from `sliceStart`, the second argument is the error instance.
- `sliceEnd`: Emitted when the slice either finishes or throws an error. The callback argument is the payload from `sliceStart`.
- `terminate`: Emitted when the sandbox environment is terminated. The sandbox will not be used after this event is emitted.

## Overriding SchedMsg Handlers

The worker’s SchedMsg instance (`worker.schedMsg`) subscribes to global commands from the scheduler. It contains default handlers for cross-platform handling of commands, but they can be overriden for clients to provide their own behaviour.

The scheduler’s commands are propagated in the SchedMsg instance by means of it being an EventEmitter. Additional event listeners can be registered, and listeners will be executed in LIFO (last-in-first-out) order. This means that if you add your own listener, it will be run before the default one.

If a command listener returns `false` then it will cancel the execution of the remaining listeners. This is the recommended method of overriding the default listener:

```javascript
const worker = new Worker();
worker.schedMsg.on("announce", ({ message }) => {
  console.log("The scheduler sent an announcement:", message);
  return false; // cancel the default behaviour
});
```

### SchedMsg Commands

- `kill`: This command instructs the worker to immediately stop working, and can optionally disable the worker to prevent restarting. The user will need to manually intervene to restart the worker.  
	**Payload Object**:
	- `temporary: boolean`: When false, the worker will be disabled.
- `restart`: This command instructs the worker to restart, e.g. call `worker.stop()` then `worker.start()`.
- `remove`: This command instructs the worker to stop working on a specific job.  
	**Payload Object**:
	- `jobAddress: string`: The address of the job to stop working on.
- `announce`: This command is an announcement from the scheduler, the provided message should be displayed to the user (modal on web, console on node).  
	**Payload Object**:
	- `message: string`: The message to be displayed to the user.
- `reload`: This command instructs the worker to “hard” reload, in the browser this will trigger a page refresh and in node it will exit the process.
- `openPopup`: This *web-only* command will open a new webpage to the provided URL.  
	**Payload Object**:
	- `href: string`: The URL to open the new page to.