These tutorials walk through creating and running distributed DCP jobs using Python, covering setup, job definition, execution, and result processing.

## Sample Code

This is a minimal code example for a DCP job in Python. Full and more advanced configuration options are available in the tutorials, examples, and the specification.

```python
import dcp
dcp.init()

input_set = [1, 2, 3, 4, 5, 6, 7, 8, 9]

def work_function(input, arg1, arg2):
    dcp.progress()
    return input * arg1 * arg2

job = dcp.compute_for(input_set, work_function, [25, 11])

job.on('accepted', lambda _: print(f"Job id: {job.id}\nAwaiting results..."))
job.on('error', lambda e: print(e))

job.exec()
results = job.wait()

print(results)
```

## Job Tutorials

**[Basic DCP Job Tutorial (Python)](https://docs.dcp.dev/tutorials/python/to-upper-case.html)**

Learn the basics of creating and running your first DCP Job in Python—this tutorial is essential before moving on to advanced job features.

## Examples

**[Newton Fractals (Colab)](https://colab.research.google.com/drive/1iJgjX12pRC2BzkUIpeNpgmNOfP9_jo3F?usp=sharing)**

Distributed fractal image generation, using Google Colab with python packages (numpy, sympy) from the package manager.

**[Numerical modelling (.py script)](https://github.com/dan-distributive/dcp-python-job-examples/blob/main/physics-job.py)**

Distributed numberical integration for a computational electrodynamics problem, using python packages (numpy, scipy) from the package manager.