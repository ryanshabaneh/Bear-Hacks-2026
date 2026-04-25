
DCP is a distributed computing and payments platform built on the web stack.

DCP lets developers write and deploy distributed, map-reduce–style jobs from JavaScript (browser and Node.js) and Python environments, including websites, web applications, Node.js programs, and Python scripts or notebooks. Jobs execute across a global network of CPU and GPU workers.

DCP also enables individuals and organizations to operate DCP Workers—CPU and GPU nodes that securely execute job slices—to earn compute credits or run workloads on private or internal networks.

**What’s Next?**

- New to DCP?
	- Create a [DCP Portal](https://dcp.cloud/) account to earn, spend, buy, and sell DCP Compute Credits.
		- Generate your DCP API keys in [getting setup](https://docs.dcp.dev/intro/getting-setup.html)
		- Deploy your first Job in
		- Explore more job examples and tutorials
- Questions or ideas?
	- Chat with DCP developers on the [Slack channel](https://join.slack.com/t/dcp-devs/shared_invite/zt-56v87qj7-fkqZOXFUls8rNzO4mxHaIA)
		- Ask or answer questions on [Stack Overflow](https://stackoverflow.com/questions/tagged/dcp)
		- Contact us by email at [info@distributive.network](mailto:info%40distributive.network).

Advanced Guides

- [Python SDK](https://docs.dcp.dev/advanced/bifrost.html)
- [Deploying jobs with remote input data](https://docs.dcp.dev/advanced/data-uri.html)

> [!important] Important
> Node.js
> 
> All modules (other than `dcp-client`) become available after completion of one of the `dcp-client` initialization functions.
> 
> ```js
> require('dcp-client').initSync();
> const compute = require('dcp/compute');
> ```

> [!important] Important
> Web Browser
> 
> All modules are available in the global `dcp` object after importing the `dcp-client` script.
> 
> ```html
> <script src="https://scheduler.distributed.computer/dcp-client/dcp-client.js"></script>
> <script>
>   const { compute } = dcp;
> </script>
> ```

Support

Indices and tables

- [Glossary](https://docs.dcp.dev/glossary.html)