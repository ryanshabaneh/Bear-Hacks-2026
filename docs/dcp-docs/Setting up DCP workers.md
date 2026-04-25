Workers complete pieces of DCP jobs, called slices, then return the results. DCP jobs need at least one worker to do the compute work, though increasing the number of workers decreases the job time. The worker type doesn’t matter based on the job.

## Web worker

This worker runs in the browser, through the `DCP Portal`.

## Local worker localExec()

This is an alternative to `job.exec()`, and when called it won’t distribute slices of the job over the network to other DCP workers. Instead, it creates a DCP worker on the local machine of the program, and executes the slices there. This is excellent for testing and debugging new DCP apps, before the compute time is too long for one machine.

**Distribute to several workers:**

```js
const job = compute.for(inputSet, workFunction);
const resultSet = await job.exec();
```

**Run locally:**

```js
const job = compute.for(inputSet, workFunction);
const resultSet = await job.localExec();
```

> [!note] Note
> Using `localExec()` requires the [`dcp-worker`](https://www.npmjs.com/package/dcp-worker) package.