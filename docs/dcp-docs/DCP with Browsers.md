These tutorials walk through creating and running distributed DCP jobs from a web page using a browser, covering setup, job definition, execution, and result processing.

## Environment

Requirements:

- A modern web browser
- A [DCP Portal](https://dcp.cloud/) account

## Sample Code

This is a minimal code example for a DCP job in a web browser. Full and more advanced configuration options are available in the tutorials, examples, and the specification.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script src="https://scheduler.distributed.computer/dcp-client/dcp-client.js"></script>
  <script>
    async function main() {
      const consoleEl = document.querySelector('#jobConsole');
      const log = (msg) => {
        consoleEl.value += msg + '\n';
        consoleEl.scrollTop = consoleEl.scrollHeight;
      };

      const compute = dcp.compute;

      const inputSet = [1, 2, 3, 4, 5, 6, 7, 8, 9];

      async function workFunction(input, arg1, arg2) {
        progress();
        return input * arg1 * arg2;
      };

      const job = compute.for(inputSet, workFunction, [25, 11]);

      job.on('accepted', () => log(\`Job id: ${job.id}\nAwaiting results...\`));
      job.on('error', (err) => log(\`Job error: ${JSON.stringify(err, null, 2)}\`));

      let results = await job.exec();

      log(results);
    }
  </script>
</head>

<body>
  <br>
  <button id="deploy-btn" onclick="main()">Deploy Job</button>
  <br><br>
  <textarea id="jobConsole" cols="120" rows="30"></textarea>
</body>
</html>
```

## Job Tutorials

**[Basic DCP Job Tutorial (Web Browser)](https://docs.dcp.dev/tutorials/web/to-upper-case.html)**

Learn the basics of creating and running your first DCP Job in a web browser—this tutorial is essential before moving on to advanced job features.