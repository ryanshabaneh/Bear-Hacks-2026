To deploy a job with a large amount of input data, you may want to avoid uploading it to the scheduler, from which the workers executing slices of your job fetch from. Instead, you can have the workers directly fetch the job from a remote location specified as a.

To deploy a job using input data specified with `URL` objects, there are two ways to stringify input-data before sending the data to workers from the web server:

- JSON: A common method for serializing data in network requests.
- [KVIN](https://www.npmjs.com/package/kvin): A comprehensive library that serializes JavaScript types for transmission over a network in a way that co-exists peacefully with JSON, but it supports more data types (for example, Typed Arrays, values with circular references, etc.). It’s a Content-Type that DCP workers understand for the express purpose of being able to fetch said complex data types.
	To let workers know about it, you need to define the Content-Type (for example, in an Express app: `res.header("Content-Type", "application/x-kvin")`), when using `kvin.serialize(inputData)`.

Note that specifying the `Access-Control-Allow-Headers` and `Access-Control-Allow-Origin` headers are also necessary so that workers on web browsers can fetch the data.

## Input data

The input data in this example is an array of `URL` objects. For demonstration purposes, the example represents the input data as a basic data structure.

```js
// INPUT DATA WITH JSON(default)
const express = require('express');

const app = express();
const port = 12345;
app.get('/', (req, res) => {
  res.header('Access-Control-Allow-Headers', 'content-type');
  res.header('Access-Control-Allow-Origin', '*');
  const inputData = { x: 1, y: 2 };
  res.send(inputData);
});

app.listen(port, () => {
  console.log(\`port ${port} is ready!\`);
});

const inputSet = [new URL('http://localhost:12345/')];
```

```js
// INPUT DATA WITH KVIN
const express = require('express');
const kvin = require('kvin');

const app = express();
const port = 12345;
app.get('/', (req, res) => {
  res.header('Access-Control-Allow-Headers', 'content-type');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Content-Type', 'application/x-kvin');
  const inputData = { x: 1, y: 2 };
  res.send(kvin.serialize(inputData));
});

app.listen(port, () => {
  console.log(\`port ${port} is ready!\`);
});

const inputSet = [new URL('http://localhost:12345/')];
```

## compute.for

```js
const job = compute.for(inputSet, workFn, args);
```

## Worker

To allow workers to fetch specific URLs, add the URL’s `origin` to the worker’s configured `allowOrigins` list.

The worker’s `allowOrigins` list specifies which origins the worker can accept data from. Allowing all makes the worker vulnerable to cross-origin attacks, so add just trustworthy origins.

- [Web worker](https://docs.dcp.dev/intro/workers.html): Type into the browser console (Press F12, or “Inspect” the page then press the ‘Console’ tab) `dcpConfig.worker.allowOrigins.any.push('http://localhost:12345')`.
- [localExec()](https://docs.dcp.dev/intro/workers.html): Add the following in your JS code before calling job.localExec():

```js
const dcpConfig = require('dcp/dcp-config');

dcpConfig.worker.allowOrigins.any.push(
  'https://localhost:12345',
  'https://localhost:12346',
);
```

> [!note] Note
> The URL’s `origin` is the protocol (ex: `https://` or `http://`), the host name (ex: `example.com`), and the port if specified (ex: `:443`). For example, the `origin` of the site `https://example.com:443/foo` would just be `https://example.com:443`.
> 
> ### Remote data set
> 
> A class that stores `URI` s representing data, arguments, etc. You can define an array of `URL` objects or use:
> 
> ```js
> const { RemoteDataSet } = require('dcp/compute');
> 
> const inputSet = new RemoteDataSet(
>   \`http://localhost:12345\`,
>   \`http://localhost:12346\`,
> );
> ```
> 
> Use `RemoteDataSet` as an argument for the worker function to accept a mix of remote and local shared arguments. Push the local argument URI to the defined remoteDataSet.
> 
> ```js
> const args = new RemoteDataSet(
>   \`http://localhost:1234\`,
>   \`http://localhost:1235\`,
> );
> args.push('data:,hello-world');
> ```
> 
> `RemoteDataPattern` is another remote class that’s available (for input data) to prevent repeating `URI` ’s that have the similar pattern (example: `http://site.com/1.json`,`http://site.com/2.json`) and allow passing the pattern and the number of slices.
> 
> ```js
> const { RemoteDataPattern } = require('dcp/compute');
> 
> const pattern = 'http://site.com/{slice}.json';
> const b = new RemoteDataPattern(pattern, 2);
> const job = compute.for(b, function (el) {
>   console.log(el);
> });
> ```
> 
> ## Full code
> 
> Click to see full code
> 
> ```js
> const express = require('express');
> 
> async function main() {
>   const compute = require('dcp/compute');
>   const app = express();
> 
>   /* INPUT SET */
>   const port1 = 12345;
>   app.get('/', (req, res) => {
>     res.header('Access-Control-Allow-Headers', 'content-type');
>     res.header('Access-Control-Allow-Origin', '*');
>     const inputData = { x: 1, y: 2 };
>     res.send(inputData);
>   });
> 
>   app.listen(port1, () => {
>     console.log(\`port ${port1} is ready!\`);
>   });
> 
>   const port2 = 12346;
>   app.get('/', (req, res) => {
>     res.header('Access-Control-Allow-Headers', 'content-type');
>     res.header('Access-Control-Allow-Origin', '*');
>     const inputData = { x: 101, y: 201 };
>     res.send(inputData);
>   });
> 
>   app.listen(port2, () => {
>     console.log(\`port ${port2} is ready!\`);
>   });
> 
>   const inputSet = [
>     new URL('http://localhost:12345/'),
>     new URL('http://localhost:12346/'),
>   ];
> 
>   /* WORK FUNCTION */
>   async function workFn(data) {
>     progress();
>     let sum = 0;
>     for (let i = 0; i < 10000000; i += 1) {
>       progress(i / 10000000);
>       sum += Math.random();
>     }
>     return data;
>   }
> 
>   // Create new job.
>   const job = compute.for(inputSet, workFn);
>   job.public.name = 'dataURL-example';
> 
>   // Adding Job Listeners.
>   job.on('accepted', () => {
>     console.log(\` - Job accepted by scheduler, waiting for results\`);
>     console.log(\` - Job has address ${job.id}\`);
>     startTime = Date.now();
>   });
> 
>   job.on('readystatechange', (arg) => {
>     console.log(\`new ready state: ${arg}\`);
>   });
> 
>   job.on('result', (ev) => {
>     console.log(
>       \` - Received result for slice ${ev.sliceNumber} at ${
>         Math.round((Date.now() - startTime) / 100) / 10
>       }s\`,
>     );
>     console.log(
>       \` * Wow! ${JSON.stringify(ev.result)} is such a pretty object!\`,
>     );
>   });
> 
>   // SKIP IF: you do not need a Compute Group
>   // job.computeGroups = [{ joinKey: 'KEY', joinSecret: 'SECRET' }];
> 
>   /* PROCESS RESULTS */
>   let resultSet = await job.exec();
>   resultSet = Array.from(resultSet);
>   console.log(resultSet.toString().replace(',', ''));
> }
> 
> require('dcp-client')
>   .init('https://scheduler.distributed.computer')
>   .then(main)
>   .catch(console.error);
> ```