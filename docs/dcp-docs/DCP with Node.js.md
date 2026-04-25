These tutorials walk through creating and running distributed DCP jobs using Node.js, covering setup, job definition, execution, and result processing.

## Environment

Requirements:

- [Node.js (LTS)](https://nodejs.org/)
- `id.keystore` and `default.kestore` in `~/.dcp` (see [API keys](https://docs.dcp.dev/intro/getting-setup.html))
- npm i dcp-client

## Sample Code

This is a minimal code example for a DCP job in Node.js. Full and more advanced configuration options are available in the tutorials, examples, and the specification.

```js
async function main() {
    const compute = require('dcp/compute');

    const inputSet = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    async function workFunction(input, arg1, arg2) {
        progress();
        return input * arg1 * arg2;
    };

    let job = compute.for(inputSet, workFunction, [25, 11]);

    job.on('accepted', () => console.log(\`Job id: ${job.id}\nAwaiting results...\`));
    job.on('error', (error) => console.error('  Job error:', error));

    let results = await job.exec();

    console.log(results);
};

require('dcp-client').init().then(main);
```

## Job Tutorials

**[Basic DCP Job Tutorial (Node.js)](https://docs.dcp.dev/tutorials/node/to-upper-case.html)**

Learn the basics of creating and running your first DCP Job in Node.js—this tutorial is essential before moving on to advanced job features.

## Examples

**[Batch inference](https://github.com/dan-distributive/onnx-inference-dcp)**

Distributed batch AI inference with ONNX Wasm and WebGPU backends, and using python pre- and post-processing scripts.

**[Numerical modelling](https://github.com/dan-distributive/emcoil)**

Distributed numberical integration for a computational electrodynamics problem, using local modules.