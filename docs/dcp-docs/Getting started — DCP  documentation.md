## Getting started

## The simplest Distributed job

This is a tutorial for an application that squares an array of numbers using DCP in Node.js.

In reality, it wouldn’t make sense to put something this computationally cheap on DCP. This tutorial’s purpose is to show how straightforward using DCP is. Please navigate to more in-depth tutorials for more involved use cases.

Create an account and set up your keystores to follow along with this tutorial.

Enter the command below into your terminal to download the DCP packages. Create a file to write your JavaScript code in after download is complete.

```bash
npm i dcp-client
```

Require the necessary client DCP packages.

```js
const { init } = require('dcp-client');

await init('https://scheduler.distributed.computer');
const compute = require('dcp/compute');
```

Each element of the below input set will be squared.

```js
const data = [1, 53, 2, 12];
```

This is the work function that squares each element of the input set. DCP sends the function out to several Workers. Each Worker will obtain one element of the input set.

```js
function workFunction(datum) {
  // Return the square of the number passed in
  progress();
  return datum * datum;
}
```

The work function also contains an important line `progress();`. Progress is a call made to tell the scheduler that the job is still alive and running. Progress is considered the heart beat of the job, without it the job would die and no results would be returned. Progress must always be called in all DCP applications.

This creates a job and deploys it on the network where Workers execute it remotely. It waits for the results to come back from the `job.exec()` call and then prints them to the terminal.

This creates a job object made up of the array of numbers and work function defined earlier. The `job.exec()` function splits the job into pieces called slices and sends each piece to a Worker to compute. After waiting for the results to come back from the Workers, each slice is printed to the console.

```js
const job = compute.for(data, workFunction);
const results = await job.exec();
console.log(results);
```

Here is the full code:

```js
async function main() {
  const { init } = require('dcp-client');
  await init('https://scheduler.distributed.computer');
  const compute = require('dcp/compute');

  // Data and work function
  const data = [1, 53, 2, 12];
  function workFunction(datum) {
    // Return the square of the number passed in
    progress();
    return datum * datum;
  }

  // Create and execute the job
  const job = compute.for(data, workFunction);
  const results = await job.exec();
  console.log(Array.from(results));
}
main();
```

Congrats, you’ve distributed code and data across remote computers to perform parallel calculations.